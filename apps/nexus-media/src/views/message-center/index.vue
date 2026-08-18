<script lang="ts" setup>
import type { AgentApi } from '#/api/modules/agent';

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NEmpty,
  NInput,
  NModal,
  NPopconfirm,
  NSpin,
  NTag,
} from 'naive-ui';

import {
  clearAgentChat,
  confirmAgentChat,
  deleteAgentMemory,
  getAgentKbStatus,
  getAgentMemories,
  getConversation,
  getMessageHistory,
  getMessageUnreadCount,
  interactMessage,
  markMessageRead,
  streamAgentChat,
  streamMessages,
} from '#/api/modules/agent';
import { getAllSystemConfigApi } from '#/api/modules/system';
import { queueOsNotify } from '#/utils/os-notify';
import { dispatchUnreadSync } from '#/utils/unread-sync';

import ChatMessage from './components/ChatMessage.vue';
import ConfirmCard from './components/ConfirmCard.vue';
import WelcomePanel from './components/WelcomePanel.vue';

interface Message {
  id: number;
  /** 后端消息 ID（已读标记用；用户/助手消息无此字段） */
  backendId?: number;
  role: 'assistant' | 'system' | 'user';
  content: string;
  image?: string;
  items?: AgentApi.ListItem[];
  reasoning?: string;
  url?: string;
  toolEvents?: AgentApi.ChatEvent[];
  streaming?: boolean;
  /** 是否已读（来自后端 read 字段） */
  read?: boolean;
  /** 新消息标记：本会话新到达的未读消息 */
  isNew?: boolean;
  ts?: number;
  _sort?: number;
}

const messages = ref<Message[]>([]);
const input = ref('');
const sending = ref(false);
const agentEnabled = ref(false);
const providerName = ref('');
const kbTotal = ref(0);
const unreadCount = ref(0);
const listRef = ref<HTMLDivElement | null>(null);
const chatAbort = ref<AbortController | null>(null);
const streamAbort = ref<AbortController | null>(null);
const confirmState = ref<null | {
  arguments: Record<string, any>;
  message: string;
  tool: string;
}>(null);
const confirmBusy = ref(false);

let msgSeq = 0;
let streamCursor = 0;
let streamBackoff = 3000;
let ioObserver: IntersectionObserver | null = null;
const readTimers = new Map<number, ReturnType<typeof setTimeout>>();
const msgElements = new Map<number, HTMLElement>();
let streamReconnectTimer: null | number = null;
let placeholderId: null | number = null;

const STREAM_CURSOR_KEY = 'nexus-agent-stream-cursor';
const NOTIFIED_KEY = 'nexus-agent-notified-ids';

/** 已推送过 OS 通知的消息 ID 集合（localStorage 持久化，去重防重放） */
const notifiedIds = ref<Set<number>>(
  new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]').map(Number)),
);

function saveNotifiedIds() {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notifiedIds.value]));
}

/** 页面不在前台且该消息未推送过 → 排队弹 OS 通知（聚合 + 提示音由工具处理） */
function maybeNotify(item: AgentApi.MessageStreamItem) {
  if (!item.id) return;
  const title = item.title?.trim() || '新消息';
  const body = (item.content || '').trim() || '';
  if (item.kind === 'list') return;
  if (
    (document.hidden || !document.hasFocus()) &&
    !notifiedIds.value.has(item.id)
  ) {
    notifiedIds.value.add(item.id);
    saveNotifiedIds();
    queueOsNotify(title, body);
  }
}

/** 刷新未读数 + 广播跨标签同步 */
async function refreshUnread() {
  try {
    const res = await getMessageUnreadCount();
    const next = res?.unread || 0;
    if (next !== unreadCount.value) {
      unreadCount.value = next;
      dispatchUnreadSync();
    }
  } catch {
    unreadCount.value = 0;
  }
}

async function markAllRead() {
  try {
    await markMessageRead();
    unreadCount.value = 0;
    // 已读后清除新消息标记（不再高亮）
    messages.value.forEach((m) => {
      m.isNew = false;
      m.read = true;
    });
    // 通知铃铛/布局监听同步未读数
    dispatchUnreadSync();
  } catch {
    // 标记失败不阻断
  }
}

/** 滚动到列表底部（看到最新消息）即视为已读；程序性滚动不触发 */
function onListScroll() {
  if (autoScrolling || unreadCount.value === 0) return;
  const el = listRef.value;
  if (!el) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
    markAllRead();
  }
}

// 视口内已读：消息进入视口并停留片刻后标记该条已读（比定时全量已读更精准）
const READ_VIEW_DELAY = 900;

/** 消息元素进视口 → 延迟后标记已读 */
function scheduleRead(msgId: number) {
  const msg = messages.value.find((m) => m.id === msgId);
  if (!msg || msg.read !== false || !msg.backendId || readTimers.has(msgId)) {
    return;
  }
  readTimers.set(
    msgId,
    setTimeout(async () => {
      readTimers.delete(msgId);
      const target = messages.value.find((m) => m.id === msgId);
      if (!target || target.read || !target.backendId) return;
      try {
        await markMessageRead([target.backendId]);
      } catch {
        return;
      }
      target.read = true;
      target.isNew = false;
      if (unreadCount.value > 0) unreadCount.value -= 1;
      dispatchUnreadSync();
    }, READ_VIEW_DELAY),
  );
}

/** 消息行 ref：进入视口即观察 */
function setMsgRef(msgId: number, el: unknown) {
  const node = el as HTMLElement | null;
  if (!node) {
    msgElements.delete(msgId);
    return;
  }
  msgElements.set(msgId, node);
  ioObserver?.observe(node);
}

function clearReadTimers() {
  for (const t of readTimers.values()) clearTimeout(t);
  readTimers.clear();
}

/** 时间标签（今天 / 昨天 / M月D日） */
function fmtDate(ts?: number): string {
  const d = new Date(ts || Date.now());
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 时刻标签（HH:MM，用于未读边界） */
function fmtTime(ts?: number): string {
  const d = new Date(ts || Date.now());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 按时间分组：与上一条日期不同时显示时间分隔（未读边界不重复显示日期） */
function showTimeDivider(idx: number): boolean {
  if (showNewMarker(idx)) return false;
  if (idx <= 0) return true;
  const prev = messages.value[idx - 1];
  const cur = messages.value[idx];
  if (!prev || !cur) return false;
  return fmtDate(prev.ts) !== fmtDate(cur.ts);
}

/** 是否未读消息 */
function isUnread(msg: Message): boolean {
  return msg.isNew || msg.read === false;
}

/** 未读边界：本条未读且上一条已读（或为第一条）时显示时间标记 */
function showNewMarker(idx: number): boolean {
  const cur = messages.value[idx];
  if (!cur || !isUnread(cur)) return false;
  if (idx <= 0) return true;
  const prev = messages.value[idx - 1];
  return !prev || !isUnread(prev);
}

function loadStreamCursor(): number {
  try {
    return Number(localStorage.getItem(STREAM_CURSOR_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveStreamCursor(cursor: number) {
  try {
    localStorage.setItem(STREAM_CURSOR_KEY, String(cursor));
  } catch {
    // ignore
  }
}

const showMemoryModal = ref(false);
const memories = ref<{ source: string; text: string }[]>([]);
const memoryLoading = ref(false);

const canSend = computed(() => input.value.trim() && !sending.value);
const modeLabel = computed(() =>
  agentEnabled.value
    ? `AI 助手 · ${providerName.value || 'LLM'}`
    : '内置命令模式',
);

const listHeight = ref<number>(0);

function measureListHeight() {
  // 页面根高度 = 视口高度 - 布局头部（main 顶部偏移），使聊天列表成为内部滚动容器
  const mainEl = document.querySelector('main');
  const top = mainEl ? mainEl.getBoundingClientRect().top : 88;
  listHeight.value = Math.max(320, Math.round(window.innerHeight - top));
}

/** 程序性滚动标记：自动滚动不触发已读，用户滚动才触发 */
let autoScrolling = false;

function scrollToBottom() {
  // 双 rAF 确保列表高度定型后再滚（markdown/图片异步渲染会改变 scrollHeight）
  autoScrolling = true;
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = listRef.value;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        setTimeout(() => {
          autoScrolling = false;
        }, 400);
      });
    });
  });
}

function pushMessage(msg: Omit<Message, 'id'>): Message {
  const item = { ...msg, id: ++msgSeq, ts: msg.ts || Date.now() };
  messages.value.push(item);
  scrollToBottom();
  return item;
}

async function fetchStatus() {
  try {
    const cfg = await getAllSystemConfigApi();
    agentEnabled.value = cfg?.['agent.enabled'] === true;
    providerName.value = cfg?.['agent.default_provider'] || '';
  } catch {
    agentEnabled.value = false;
  }
  if (agentEnabled.value) {
    try {
      const res = await getAgentKbStatus();
      const ns = (res as any)?.namespaces || {};
      kbTotal.value = Object.values(ns).reduce(
        (a: number, b) => a + Number(b || 0),
        0,
      );
    } catch {
      kbTotal.value = 0;
    }
  }
}

function startMessageStream() {
  streamAbort.value?.abort();
  streamAbort.value = new AbortController();
  streamMessages(
    streamCursor,
    {
      onEvent: (item) => {
        streamCursor = Math.max(streamCursor, item.cursor);
        saveStreamCursor(streamCursor);
        streamBackoff = 3000; // 有数据即重置退避
        // 命令占位替换：收到回复/通知时移除"正在处理…"
        if (placeholderId != null) {
          messages.value = messages.value.filter((m) => m.id !== placeholderId);
          placeholderId = null;
        }
        maybeNotify(item);
        const title = item.title?.trim();
        const content = item.content?.trim();
        pushMessage({
          role: 'system',
          backendId: item.id ?? item.cursor,
          content: content ? `${title}\n${content}` : title,
          image: item.image || '',
          items: item.items || [],
          url: item.url || '',
          read: item.read === false ? false : true,
          isNew: true,
          ts: item.ts ? item.ts * 1000 : Date.now(),
        });
        // 新未读到达：刷新未读数并同步铃铛
        if (item.read === false || item.kind === 'notify') {
          refreshUnread();
        }
      },
      onEnd: () => {
        // 断线重连（指数退避 + 抖动；页面销毁时由 signal 终止，不再重连）
        if (!streamAbort.value?.signal.aborted) {
          streamReconnectTimer = window.setTimeout(
            startMessageStream,
            streamBackoff + Math.random() * 1000,
          );
          streamBackoff = Math.min(streamBackoff * 2, 30_000);
        }
      },
    },
    streamAbort.value.signal,
  );
}

async function send(text?: string) {
  const question = (text ?? input.value).trim();
  if (!question || sending.value) return;
  input.value = '';
  pushMessage({ role: 'user', content: question });

  if (!agentEnabled.value) {
    // 内置命令模式：回复经消息流返回
    const placeholder = pushMessage({
      role: 'system',
      content: '正在处理，请稍候…',
    });
    placeholderId = placeholder.id;
    try {
      await interactMessage(question);
    } catch (error: any) {
      placeholder.content = `命令发送失败：${error?.message || '未知错误'}`;
      placeholderId = null;
    }
    return;
  }

  // AI 对话模式
  sending.value = true;
  const toolEvents = ref<AgentApi.ChatEvent[]>([]);
  const assistant = pushMessage({
    role: 'assistant',
    content: '',
    toolEvents: toolEvents.value,
    streaming: true,
  });
  chatAbort.value = new AbortController();
  streamAgentChat(
    { question },
    {
      onEvent: (ev) => {
        switch (ev.type) {
          case 'answer': {
            assistant.content = ev.content || '';
            assistant.streaming = false;
            // 确认卡场景 answer 为空：移除无内容的空气泡（保留工具 chip）
            if (!assistant.content && !assistant.toolEvents?.length) {
              messages.value = messages.value.filter(
                (m) => m.id !== assistant.id,
              );
            }
            scrollToBottom();

            break;
          }
          case 'confirm_required': {
            confirmState.value = {
              tool: ev.tool || '',
              arguments: ev.arguments || {},
              message: ev.message || '',
            };
            sending.value = false;

            break;
          }
          case 'error': {
            assistant.content = assistant.content || `出错了：${ev.content}`;
            assistant.streaming = false;

            break;
          }
          case 'reasoning': {
            assistant.reasoning =
              (assistant.reasoning || '') + (ev.content || '');
            scrollToBottom();

            break;
          }
          case 'tool_call': {
            toolEvents.value.push({ ...ev });
            scrollToBottom();

            break;
          }
          case 'tool_result': {
            const idx = toolEvents.value.findLastIndex(
              (t) =>
                t.type === 'tool_call' &&
                (ev.step == null ? t.tool === ev.tool : t.step === ev.step),
            );
            if (idx === -1) {
              toolEvents.value.push({ ...ev });
            } else {
              toolEvents.value.splice(idx + 1, 0, { ...ev });
            }
            if (ev.need_confirm) sending.value = false;

            break;
          }
          // No default
        }
      },
      onError: (error) => {
        assistant.content = `请求失败：${error?.message || '网络错误'}`;
        assistant.streaming = false;
      },
      onEnd: () => {
        sending.value = false;
        assistant.streaming = false;
      },
    },
    chatAbort.value.signal,
  );
}

function stop() {
  chatAbort.value?.abort();
  chatAbort.value = null;
  sending.value = false;
}

async function approveConfirm() {
  if (!confirmState.value) return;
  confirmBusy.value = true;
  try {
    // requestClient 已解包 data 且 code≠0 会抛错：成功 await 即为执行成功
    await confirmAgentChat({
      tool: confirmState.value.tool,
      arguments: confirmState.value.arguments,
    });
    pushMessage({ role: 'assistant', content: '已执行确认操作。' });
  } catch (error: any) {
    pushMessage({
      role: 'assistant',
      content: `执行失败：${error?.message || '未知错误'}`,
    });
  } finally {
    confirmBusy.value = false;
    confirmState.value = null;
  }
}

function rejectConfirm() {
  pushMessage({ role: 'assistant', content: '已取消该操作。' });
  confirmState.value = null;
}

async function openMemoryModal() {
  showMemoryModal.value = true;
  memoryLoading.value = true;
  try {
    const res: any = await getAgentMemories();
    memories.value = res?.memories || [];
  } catch {
    memories.value = [];
  } finally {
    memoryLoading.value = false;
  }
}

async function removeMemory(text: string) {
  try {
    await deleteAgentMemory(text);
    memories.value = memories.value.filter((m) => m.text !== text);
  } catch {
    // ignore
  }
}

async function clearSession() {
  try {
    await clearAgentChat('');
  } catch {
    // ignore
  }
  messages.value = [];
  // 通知流游标推进到当前最新，刷新后不再重放旧通知
  streamCursor = Math.max(streamCursor, 0);
  saveStreamCursor(streamCursor);
}

// 移动端无 Shift+Enter：Enter 保留换行（textarea 默认），发送靠按钮
const isCoarsePointer = ref(
  typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches,
);

function onKeydown(e: KeyboardEvent) {
  // isComposing / keyCode 229：中文输入法候选词确认回车不触发发送
  const composing = e.isComposing || e.keyCode === 229;
  if (
    e.key === 'Enter' &&
    !e.shiftKey &&
    !composing &&
    !isCoarsePointer.value
  ) {
    e.preventDefault();
    send();
  }
}

async function restoreTimeline() {
  // 会话（user/assistant）与通知（system）双源历史按时间合并进同一时间线：
  // - 同一回答可能双源持久化（会话 + 通知），按内容去重只保留一次
  // - 无可靠时间的消息（ts=0）按来源相对顺序排在末尾
  const merged: (Omit<Message, 'id'> & { _sort: number; ts: number })[] = [];
  try {
    const res: any = await getConversation('');
    const list = res?.messages || [];
    let order = 0;
    for (const m of list) {
      if (m.role === 'user' || m.role === 'assistant') {
        merged.push({
          role: m.role,
          content: m.content || '',
          // 会话 ts 为秒级 epoch，统一转毫秒与通知（*1000）同一单位，否则会话永远排在通知前面
          ts: (Number(m.ts) || 0) * 1000,
          _sort: order++,
        });
      }
    }
  } catch {
    // 会话历史不可用时忽略
  }
  try {
    const res: any = await getMessageHistory(200);
    const list: AgentApi.MessageStreamItem[] = res?.messages || [];
    if (list.length > 0 && streamCursor) {
      streamCursor = Math.max(...list.map((m) => m.cursor));
      saveStreamCursor(streamCursor);
    }
    let order = 0;
    for (const item of list) {
      const title = item.title?.trim();
      const content = item.content?.trim();
      merged.push({
        role: 'system',
        backendId: item.id ?? item.cursor,
        content: content ? `${title}\n${content}` : title,
        image: item.image || '',
        items: item.items || [],
        url: item.url || '',
        read: item.read !== false,
        ts: (Number(item.ts) || 0) * 1000,
        _sort: order++,
      });
    }
  } catch {
    // 忽略
  }
  // 按时间升序；ts=0（无时间）按来源顺序排在末尾
  merged.sort((a, b) =>
    a.ts || b.ts ? a.ts - b.ts || a._sort - b._sort : a._sort - b._sort,
  );
  // 交叉去重：仅当通知（system）内容与 用户/助手（会话）消息相同（同一回答双源持久化）时，
  // 保留会话侧、跳过通知；重复的通知（如相同快照的"站点数据统计"）不去重，避免误删
  const convContents = new Set<string>(
    merged
      .filter((m) => m.role !== 'system')
      .map((m) => (m.content || '').trim())
      .filter(Boolean),
  );
  for (const m of merged) {
    const c = (m.content || '').trim();
    if (m.role === 'system' && c && convContents.has(c)) continue;
    const { ts: _ts, _sort, ...rest } = m;
    pushMessage(rest);
  }
}

function onStorageSync(e: StorageEvent) {
  if (e.key === STREAM_CURSOR_KEY) {
    const val = Number(e.newValue || 0) || 0;
    if (val > streamCursor) {
      streamCursor = val;
    }
  }
}

onMounted(async () => {
  streamCursor = loadStreamCursor();
  window.addEventListener('storage', onStorageSync);
  window.addEventListener('resize', measureListHeight);
  document.addEventListener('visibilitychange', onVisibilityChange);
  fetchStatus();
  measureListHeight();
  // 视口观察：进视口的未读消息自动已读
  ioObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = Number((entry.target as HTMLElement).dataset.msgId);
        if (id) scheduleRead(id);
      }
    },
    { root: listRef.value, threshold: 0.3 },
  );
  await restoreTimeline();
  // 历史加载完成后重新测量高度并滚到最新消息（底部）
  measureListHeight();
  scrollToBottom();
  // 内容渲染稳定后再补一次滚动（图片/富文本异步渲染）
  window.setTimeout(scrollToBottom, 300);
  startMessageStream();
  // 未读数；已读由视口观察 + 全部已读按钮 + 切回前台时完成
  refreshUnread();
});

onBeforeUnmount(() => {
  window.removeEventListener('storage', onStorageSync);
  window.removeEventListener('resize', measureListHeight);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  chatAbort.value?.abort();
  streamAbort.value?.abort();
  if (streamReconnectTimer) clearTimeout(streamReconnectTimer);
  ioObserver?.disconnect();
  clearReadTimers();
});

/** 页面是否曾切到后台（仅真正从后台切回时才全部已读，避免初始加载误清未读） */
let wasHidden = false;

/** 从后台切回页面时刷新未读数并全部已读 */
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    wasHidden = true;
  } else if (document.visibilityState === 'visible' && wasHidden) {
    wasHidden = false;
    refreshUnread();
    markAllRead();
  }
}
</script>

<template>
  <div
    class="flex h-full flex-col"
    :style="{ height: listHeight ? `${listHeight}px` : undefined }"
  >
    <!-- 头部 -->
    <div
      class="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-4 py-2.5"
      :style="{
        background: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
      }"
    >
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
        <IconifyIcon
          icon="lucide:message-square-text"
          class="size-5 shrink-0"
          :style="{ color: 'hsl(var(--primary))' }"
        />
        <span
          class="text-sm font-semibold"
          :style="{ color: 'hsl(var(--foreground))' }"
        >
          消息中心
        </span>
        <NTag size="small" :type="agentEnabled ? 'success' : 'default'" round>
          {{ modeLabel }}
        </NTag>
        <NTag v-if="agentEnabled && kbTotal" size="small" round>
          知识库 {{ kbTotal }}
        </NTag>
        <NTag v-if="unreadCount" type="error" size="small" round>
          未读 {{ unreadCount }}
        </NTag>
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
        <NButton
          v-if="unreadCount"
          size="small"
          quaternary
          aria-label="全部已读"
          @click="markAllRead"
        >
          <template #icon>
            <IconifyIcon icon="lucide:check-check" class="size-4" />
          </template>
          <span class="max-sm:hidden">全部已读</span>
        </NButton>
        <NButton
          size="small"
          quaternary
          aria-label="偏好记忆"
          @click="openMemoryModal"
        >
          <template #icon>
            <IconifyIcon icon="lucide:brain" class="size-4" />
          </template>
          <span class="max-sm:hidden">偏好记忆</span>
        </NButton>
        <NPopconfirm @positive-click="clearSession">
          <template #trigger>
            <NButton size="small" quaternary aria-label="清空会话">
              <template #icon>
                <IconifyIcon icon="lucide:trash-2" class="size-4" />
              </template>
              <span class="max-sm:hidden">清空会话</span>
            </NButton>
          </template>
          清空当前对话与通知记录？
        </NPopconfirm>
      </div>
    </div>

    <!-- 消息区 -->
    <div
      ref="listRef"
      class="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
      @scroll="onListScroll"
    >
      <div class="mx-auto w-full max-w-3xl">
        <WelcomePanel
          v-if="messages.length === 0"
          :agent-enabled="agentEnabled"
          :provider-name="providerName"
          @prompt="send"
        />
        <template v-for="(msg, idx) in messages" :key="msg.id">
          <div
            v-if="showTimeDivider(idx)"
            class="my-2 flex items-center justify-center"
          >
            <span
              class="rounded-full px-3 py-0.5 text-xs"
              :style="{
                color: 'hsl(var(--muted-foreground))',
                background: 'hsl(var(--muted) / 50%)',
              }"
            >
              {{ fmtDate(msg.ts) }}
            </span>
          </div>
          <div v-if="showNewMarker(idx)" class="my-2 flex items-center gap-2">
            <span
              class="h-px flex-1"
              :style="{ background: 'hsl(var(--border))' }"
            ></span>
            <span
              class="text-xs"
              :style="{ color: 'hsl(var(--muted-foreground))' }"
            >
              {{ fmtTime(msg.ts) }}
            </span>
            <span
              class="h-px flex-1"
              :style="{ background: 'hsl(var(--border))' }"
            ></span>
          </div>
          <div
            :ref="(el: unknown) => setMsgRef(msg.id, el)"
            :data-msg-id="msg.id"
          >
            <ChatMessage
              :role="msg.role"
              :content="msg.content"
              :image="msg.image"
              :items="msg.items"
              :url="msg.url"
              :tool-events="msg.toolEvents"
              :reasoning="msg.reasoning"
              :streaming="msg.streaming"
            />
          </div>
        </template>
        <ConfirmCard
          v-if="confirmState"
          :tool="confirmState.tool"
          :arguments="confirmState.arguments"
          :message="confirmState.message"
          :busy="confirmBusy"
          @approve="approveConfirm"
          @reject="rejectConfirm"
        />
        <div v-if="sending" class="flex justify-center py-2">
          <NSpin size="small" />
        </div>
      </div>
    </div>

    <!-- 偏好记忆弹窗 -->
    <NModal
      v-model:show="showMemoryModal"
      preset="card"
      title="偏好记忆（长程语义记忆）"
      style="width: min(560px, 92vw)"
    >
      <div class="space-y-2">
        <NSpin :show="memoryLoading">
          <NEmpty v-if="memories.length === 0" description="暂无偏好记忆" />
          <div
            v-for="m in memories"
            :key="m.source"
            class="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            :style="{
              borderColor: 'hsl(var(--border))',
              background: 'hsl(var(--card))',
            }"
          >
            <span
              class="min-w-0 flex-1"
              :style="{ color: 'hsl(var(--card-foreground))' }"
            >
              {{ m.text }}
            </span>
            <NPopconfirm @positive-click="removeMemory(m.text)">
              <template #trigger>
                <NButton size="tiny" quaternary type="error">
                  <template #icon>
                    <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                  </template>
                </NButton>
              </template>
              删除这条偏好记忆？
            </NPopconfirm>
          </div>
        </NSpin>
      </div>
    </NModal>

    <!-- 输入区 -->
    <div
      class="border-t px-4 py-3"
      :style="{
        background: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
      }"
    >
      <div class="mx-auto flex w-full max-w-3xl items-end gap-1.5">
        <div class="min-w-0 flex-1">
          <NInput
            v-model:value="input"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 5 }"
            :placeholder="
              agentEnabled
                ? isCoarsePointer
                  ? '输入问题，回车换行，点发送按钮发送…'
                  : '输入问题，Enter 发送，Shift+Enter 换行…'
                : '输入命令，如：订阅 流浪地球 / 下载 xxx / 搜索 xxx'
            "
            @keydown="onKeydown"
          />
        </div>
        <NButton
          v-if="!sending"
          type="primary"
          :disabled="!canSend"
          aria-label="发送"
          class="shrink-0"
          @click="send()"
        >
          <template #icon>
            <IconifyIcon icon="lucide:send" class="size-4" />
          </template>
          <span class="max-sm:hidden">发送</span>
        </NButton>
        <NButton
          v-else
          type="error"
          aria-label="停止"
          class="shrink-0"
          @click="stop"
        >
          <template #icon>
            <IconifyIcon icon="lucide:square" class="size-4" />
          </template>
          <span class="max-sm:hidden">停止</span>
        </NButton>
      </div>
    </div>
  </div>
</template>
