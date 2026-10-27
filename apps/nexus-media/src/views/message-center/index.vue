<script lang="ts" setup>
import type { AgentApi } from '#/api/modules/agent';

import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NDrawer,
  NEmpty,
  NInput,
  NModal,
  NPopconfirm,
  NPopover,
  NSelect,
  NSpin,
  NSwitch,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  cancelAgentChat,
  clearAgentChat,
  confirmAgentChat,
  createAgentSession,
  deleteAgentMemory,
  deleteAgentSession,
  getAgentKbStatus,
  getAgentMemories,
  getAgentSessions,
  getAgentStatus,
  getConversation,
  getMessageHistory,
  getMessageUnreadCount,
  interactMessage,
  markMessageRead,
  rejectAgentChat,
  renameAgentSession,
  streamAgentChat,
  streamMessages,
  uploadAgentAttachment,
} from '#/api/modules/agent';
import { canOsNotify, queueOsNotify } from '#/utils/os-notify';
import {
  dispatchUnreadSync,
  listenScrollFirstUnread,
} from '#/utils/unread-sync';

import ChatMessage from './components/ChatMessage.vue';
import ConfirmCard from './components/ConfirmCard.vue';
import SessionSidebar from './components/SessionSidebar.vue';
import WelcomePanel from './components/WelcomePanel.vue';

interface Message {
  attachments?: AgentApi.ChatAttachment[];
  id: number;
  /** 后端消息 ID（已读标记用；用户/助手消息无此字段） */
  backendId?: number;
  role: 'assistant' | 'system' | 'user';
  content: string;
  image?: string;
  items?: AgentApi.ListItem[];
  reasoning?: string;
  url?: string;
  usage?: number;
  toolEvents?: AgentApi.ChatEvent[];
  streaming?: boolean;
  /** 是否已读（来自后端 read 字段） */
  read?: boolean;
  /** 新消息标记：本会话新到达的未读消息 */
  isNew?: boolean;
  ts?: number;
  _sort?: number;
}

const message = useMessage();
const messages = ref<Message[]>([]);
const input = ref('');
const sending = ref(false);
const agentEnabled = ref(false);
const providerName = ref('');
const modelName = ref('');
const attachments = ref<
  { image_data?: string; media_type?: string; name: string; text: string }[]
>([]);
const attachmentInput = ref<HTMLInputElement | null>(null);
const sessionTokens = computed(() => {
  const live = visibleMessages.value.reduce(
    (sum, item) => sum + (item.usage || 0),
    0,
  );
  const persisted =
    sessions.value.find((item) => item.session_id === currentSessionId.value)
      ?.token_usage || 0;
  return Math.max(live, persisted);
});
const kbTotal = ref(0);
const unreadCount = ref(0);
const activeTab = ref<'chat' | 'notifications'>('chat');
const currentSessionId = ref('');
const sessions = ref<any[]>([]);
const sessionsLoading = ref(false);
const sessionDrawer = ref(false);
const visibleMessages = computed(() =>
  activeTab.value === 'chat'
    ? messages.value.filter((msg) => msg.role !== 'system')
    : messages.value.filter((msg) => msg.role === 'system'),
);

/** 推理强度与思考模式（按次覆盖，初始值跟随 Agent 全局配置） */
const MAX_EFFORT_TIP =
  '最高档仅部分支持推理的模型可用，不支持的模型会自动降级为高';
const reasoningOptions = [
  { value: 'low', label: '低', tip: '' },
  { value: 'high', label: '高', tip: '' },
  { value: 'max', label: '最高', tip: MAX_EFFORT_TIP },
];
const reasoningEffort = ref<'high' | 'low' | 'max'>('high');
const thinkingEnabled = ref(true);

/** 下拉选项渲染：最高 选项附带信息图标与 tooltip */
function renderReasoningLabel(option: Record<string, any>) {
  const tip = option.tip as string;
  if (!tip) {
    return h('span', { class: 'text-xs' }, option.label as string);
  }
  return h(
    NTooltip,
    { placement: 'top' },
    {
      trigger: () =>
        h('span', { class: 'flex items-center gap-1 text-xs' }, [
          option.label as string,
          h(IconifyIcon, { icon: 'lucide:info', class: 'size-3' }),
        ]),
      default: () => h('span', { class: 'text-xs' }, tip),
    },
  );
}
const listRef = ref<HTMLDivElement | null>(null);
const chatAbort = ref<AbortController | null>(null);
const currentTurnId = ref('');
const streamAbort = ref<AbortController | null>(null);
const confirmState = ref<null | {
  arguments: Record<string, any>;
  message: string;
  pending_action_id: string;
  tool: string;
}>(null);
const confirmBusy = ref(false);

let msgSeq = 0;
let streamCursor = 0;
let streamBackoff = 3000;
let ioObserver: IntersectionObserver | null = null;
const readTimers = new Map<number, ReturnType<typeof setTimeout>>();
// 已读批量合并：视口内多条消息的已读请求去抖为一次提交，避免同秒并发打爆后端
const pendingReadIds = new Set<number>();
let pendingReadTimer: null | number = null;
const READ_BATCH_DELAY = 400;
const msgElements = new Map<number, HTMLElement>();
let streamReconnectTimer: null | number = null;
let placeholderId: null | number = null;
let unlistenScrollFirstUnread: (() => void) | null = null;

const STREAM_CURSOR_KEY = 'nexus-agent-stream-cursor';
const NOTIFIED_KEY = 'nexus-agent-notified-ids';

/** 已推送过 OS 通知的消息 ID 集合（localStorage 持久化，去重防重放） */
const notifiedIds = ref<Set<number>>(
  new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]').map(Number)),
);

function saveNotifiedIds() {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notifiedIds.value]));
}

/** 新消息 → 排队弹 OS 通知（去重；已授权才弹并记录） */
function maybeNotify(item: AgentApi.MessageStreamItem) {
  if (!item.id) return;
  const title = item.title?.trim() || '新消息';
  const body = (item.content || '').trim() || '';
  if (item.kind === 'list') return;
  if (canOsNotify() && !notifiedIds.value.has(item.id)) {
    notifiedIds.value.add(item.id);
    saveNotifiedIds();
    // 点击系统通知即视为已读：单条标记该条，聚合通知一次全部已读；随后回滚到第一条未读
    queueOsNotify(
      title,
      body,
      () => {
        markOneRead(Number(item.id));
        scrollToFirstUnread();
      },
      () => {
        markMessageRead().catch(() => {});
        messages.value.forEach((m) => {
          m.read = true;
          m.isNew = false;
        });
        unreadCount.value = 0;
        dispatchUnreadSync();
        refreshUnread();
        scrollToFirstUnread();
      },
    );
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

// 未读刷新防抖：SSE 消息流/广播同步高频触发时合并请求，避免打爆后端限流（429）
let refreshUnreadTimer: null | number = null;

function scheduleRefreshUnread() {
  if (refreshUnreadTimer) return;
  refreshUnreadTimer = window.setTimeout(() => {
    refreshUnreadTimer = null;
    refreshUnread();
  }, 2000);
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

/** 单条已读（点击系统通知时用）：落库 + 本地取消高亮 + 同步未读数 */
function markOneRead(backendId: number) {
  if (!backendId) return;
  markMessageRead([backendId]).catch(() => {});
  const target = messages.value.find((m) => m.backendId === backendId);
  if (target) {
    target.read = true;
    target.isNew = false;
  }
  unreadCount.value = Math.max(0, unreadCount.value - 1);
  dispatchUnreadSync();
  refreshUnread();
}

/** 已读请求合并：同批 id 去抖后一次提交，避免逐条并发 */
function enqueueRead(backendId: number) {
  if (!backendId) return;
  pendingReadIds.add(backendId);
  if (pendingReadTimer) return;
  pendingReadTimer = window.setTimeout(() => {
    pendingReadTimer = null;
    flushPendingRead();
  }, READ_BATCH_DELAY);
}

/** 立即提交待读 id（离开页面时兜底） */
function flushPendingRead() {
  if (pendingReadTimer) {
    clearTimeout(pendingReadTimer);
    pendingReadTimer = null;
  }
  if (pendingReadIds.size === 0) return;
  const ids = [...pendingReadIds];
  pendingReadIds.clear();
  markMessageRead(ids).catch(() => {});
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
    setTimeout(() => {
      readTimers.delete(msgId);
      const target = messages.value.find((m) => m.id === msgId);
      if (!target || target.read || !target.backendId) return;
      enqueueRead(target.backendId);
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
  const prev = visibleMessages.value[idx - 1];
  const cur = visibleMessages.value[idx];
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

/** 滚动到第一条未读消息（置顶显示）；无未读返回 false */
function scrollToFirstUnread(retries = 10): boolean {
  const idx = visibleMessages.value.findIndex((m) => isUnread(m));
  const target = idx >= 0 ? visibleMessages.value[idx] : undefined;
  if (!target) return false;
  autoScrolling = true;
  const finish = () => {
    window.setTimeout(() => {
      autoScrolling = false;
    }, 400);
  };
  // 元素可能尚未挂载（长列表/异步渲染）→ 有界重试，避免一次失败就停在顶部
  const tryScroll = (attempt: number) => {
    const el = msgElements.get(target.id);
    const list = listRef.value;
    if (el && list) {
      // 相对滚动容器的偏移：offsetTop 受 offsetParent 影响，长列表里可能不准
      const top =
        el.getBoundingClientRect().top -
        list.getBoundingClientRect().top +
        list.scrollTop;
      list.scrollTop = Math.max(0, top - 8);
      finish();
      return;
    }
    if (attempt < retries) {
      window.setTimeout(() => tryScroll(attempt + 1), 120);
      return;
    }
    autoScrolling = false;
  };
  nextTick(() => {
    requestAnimationFrame(() => tryScroll(0));
  });
  return true;
}

async function switchTab(tab: 'chat' | 'notifications') {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  await nextTick();
  measureListHeight();
  if (!scrollToFirstUnread()) {
    scrollToBottom();
  }
}

function pushMessage(msg: Omit<Message, 'id'>): Message {
  const item = reactive({ ...msg, id: ++msgSeq, ts: msg.ts || Date.now() });
  messages.value.push(item);
  scrollToBottom();
  return item;
}

async function fetchStatus() {
  try {
    const status = await getAgentStatus();
    agentEnabled.value = status.enabled;
    providerName.value = status.provider;
    modelName.value = status.model;
    reasoningEffort.value = status.reasoning_effort;
    thinkingEnabled.value = status.thinking_enabled;
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
        // 新未读到达：刷新未读数并同步铃铛（防抖合并，避免突发消息打爆限流）
        if (item.read === false || item.kind === 'notify') {
          scheduleRefreshUnread();
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

function chooseAttachment() {
  attachmentInput.value?.click();
}

async function onAttachmentSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  for (const file of files.slice(0, 3 - attachments.value.length)) {
    try {
      const result = await uploadAgentAttachment(file);
      attachments.value.push({
        name: result.name,
        text: result.text,
        image_data: result.image_data,
        media_type: result.media_type,
      });
    } catch (error: any) {
      if (error?.response?.status === 413) {
        message.error('附件超过服务器上传限制');
      } else {
        message.error(
          error?.response?.data?.detail ||
            error?.response?.data?.message ||
            error?.message ||
            `附件 ${file.name} 上传失败`,
        );
      }
    }
  }
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1);
}

function retryMessage(target: Message) {
  if (sending.value) return;
  const index = messages.value.findIndex((item) => item.id === target.id);
  for (let i = index - 1; i >= 0; i -= 1) {
    const item = messages.value[i];
    if (item?.role === 'user' && item.content) {
      void send(item.content);
      return;
    }
  }
}

async function send(text?: string) {
  const question = (text ?? input.value).trim();
  if (!question || sending.value) return;
  const pendingAttachments = [...attachments.value];
  input.value = '';
  attachments.value = [];
  pushMessage({
    role: 'user',
    content: question,
    attachments: pendingAttachments,
  });

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
    {
      question,
      attachments: pendingAttachments,
      session_id: currentSessionId.value,
      reasoning_effort: reasoningEffort.value,
      disable_thinking: !thinkingEnabled.value,
    },
    {
      onEvent: (ev) => {
        switch (ev.type) {
          case 'turn_start': {
            currentTurnId.value = ev.turn_id || '';

            break;
          }
          case 'token': {
            assistant.content += ev.content || '';
            scrollToBottom();

            break;
          }
          case 'cancelled': {
            assistant.content = assistant.content
              ? `${assistant.content}\n\n（已停止）`
              : ev.content || '已停止本次请求';
            assistant.streaming = false;

            break;
          }
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
            void loadSessions();

            break;
          }
          case 'confirm_required': {
            confirmState.value = {
              tool: ev.tool || '',
              arguments: ev.arguments || {},
              message: ev.message || '',
              pending_action_id: ev.pending_action_id || '',
            };

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
          case 'usage': {
            assistant.usage = ev.total_tokens || 0;

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
        if (
          error?.name === 'AbortError' ||
          /aborted|abort/i.test(error?.message || '')
        ) {
          assistant.streaming = false;
          return;
        }
        assistant.content = `请求失败：${error?.detail || error?.data?.detail || error?.message || '网络错误'}`;
        assistant.streaming = false;
      },
      onEnd: () => {
        sending.value = false;
        assistant.streaming = false;
        currentTurnId.value = '';
      },
    },
    chatAbort.value.signal,
  );
}

async function stop() {
  const turnId = currentTurnId.value;
  chatAbort.value?.abort();
  chatAbort.value = null;
  sending.value = false;
  const assistant = [...messages.value]
    .reverse()
    .find((msg) => msg.role === 'assistant' && msg.streaming);
  if (assistant) {
    assistant.content = assistant.content
      ? `${assistant.content}\n\n（已停止）`
      : '已停止本次请求';
    assistant.streaming = false;
  }
  if (turnId) {
    try {
      await cancelAgentChat(turnId);
    } catch {
      // 网络失败时仍保持本地停止状态，后端会在下一个事件点继续取消
    }
  }
  currentTurnId.value = '';
}

async function approveConfirm() {
  if (!confirmState.value) return;
  confirmBusy.value = true;
  try {
    // requestClient 已解包 data 且 code≠0 会抛错：成功 await 即为执行成功
    await confirmAgentChat(confirmState.value.pending_action_id);
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

async function rejectConfirm() {
  if (!confirmState.value) return;
  try {
    await rejectAgentChat(confirmState.value.pending_action_id);
    pushMessage({ role: 'assistant', content: '已取消该操作。' });
  } catch (error: any) {
    pushMessage({
      role: 'assistant',
      content: `取消失败：${error?.message || '未知错误'}`,
    });
  } finally {
    confirmState.value = null;
  }
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
    await clearAgentChat(currentSessionId.value);
  } catch {
    // ignore
  }
  messages.value = messages.value.filter((msg) => msg.role === 'system');
  // 通知流游标推进到当前最新，刷新后不再重放旧通知
  streamCursor = Math.max(streamCursor, 0);
  saveStreamCursor(streamCursor);
}

async function loadSessions() {
  sessionsLoading.value = true;
  try {
    const res = await getAgentSessions();
    sessions.value = res.sessions || [];
  } catch {
    sessions.value = [];
  } finally {
    sessionsLoading.value = false;
  }
}

async function renameSession(sessionId: string, title: string) {
  try {
    await renameAgentSession(sessionId, title);
    await loadSessions();
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '重命名失败');
  }
}

async function loadSessionMessages() {
  const systemMessages = messages.value.filter((msg) => msg.role === 'system');
  messages.value = systemMessages;
  try {
    const res: any = await getConversation(currentSessionId.value);
    for (const item of res?.messages || []) {
      if (item.role === 'user' || item.role === 'assistant') {
        pushMessage({
          role: item.role,
          content: item.content || '',
          ts: (Number(item.ts) || 0) * 1000,
          attachments: item.attachments || [],
        });
      }
    }
  } catch {
    // 保留空会话，通知区不受影响
  }
}

function addDraftSession() {
  const id = currentSessionId.value;
  if (!id) return;
  sessions.value = [
    {
      session_id: id,
      title: '新对话',
      updated_at: new Date().toISOString(),
      token_usage: 0,
    },
    ...sessions.value.filter((item) => item.session_id !== id),
  ];
}

async function createSession() {
  const res = await createAgentSession();
  currentSessionId.value = res.session_id;
  activeTab.value = 'chat';
  sessionDrawer.value = false;
  await loadSessions();
  addDraftSession();
  await loadSessionMessages();
}

async function selectSession(sessionId: string) {
  if (sending.value || sessionId === currentSessionId.value) return;
  currentSessionId.value = sessionId;
  activeTab.value = 'chat';
  sessionDrawer.value = false;
  await loadSessionMessages();
}

async function deleteSession(sessionId: string) {
  await deleteAgentSession(sessionId);
  if (sessionId === currentSessionId.value) {
    await createSession();
  }
  await loadSessions();
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
    const res: any = await getConversation(currentSessionId.value);
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
  // 点击系统通知（可能已在本页）时重新定位到第一条未读
  unlistenScrollFirstUnread = listenScrollFirstUnread(() => {
    scrollToFirstUnread();
  });
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
  // 每次进入消息中心都从新会话开始，侧栏立即标记“新对话”
  await createSession();
  await restoreTimeline();
  measureListHeight();
  // 打开时定位到第一条未读；全部已读时才滚到最新消息（底部）
  nextTick(() => {
    if (!scrollToFirstUnread()) {
      scrollToBottom();
    }
  });
  // 内容渲染稳定后再补一次（图片/富文本异步渲染会改变高度）
  window.setTimeout(() => {
    if (!scrollToFirstUnread()) {
      scrollToBottom();
    }
  }, 300);
  startMessageStream();
  // 未读数；已读由视口观察 + 全部已读按钮 + 切回前台时完成
  refreshUnread();
});

onBeforeUnmount(() => {
  window.removeEventListener('storage', onStorageSync);
  window.removeEventListener('resize', measureListHeight);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  unlistenScrollFirstUnread?.();
  unlistenScrollFirstUnread = null;
  chatAbort.value?.abort();
  streamAbort.value?.abort();
  if (streamReconnectTimer) clearTimeout(streamReconnectTimer);
  ioObserver?.disconnect();
  flushPendingRead();
  clearReadTimers();
});

/** 页面是否曾切到后台（仅真正从后台切回时才重新定位，避免初始加载误判） */
let wasHidden = false;

/** 从后台切回页面时刷新未读数并定位到第一条未读（由视口观察逐条标记已读，不整页清空） */
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    wasHidden = true;
  } else if (document.visibilityState === 'visible' && wasHidden) {
    wasHidden = false;
    refreshUnread();
    scrollToFirstUnread();
  }
}
</script>

<template>
  <div
    class="flex h-full flex-col"
    :style="{ height: listHeight ? `${listHeight}px` : undefined }"
  >
    <!-- 头部 -->
    <div class="chat-header">
      <div class="header-main">
        <span class="header-icon">
          <IconifyIcon icon="lucide:message-square-text" class="size-4" />
        </span>
        <div class="header-title-group">
          <span class="header-title">消息中心</span>
          <span
            class="provider-badge"
            :class="{ 'is-active': agentEnabled }"
            :title="modeLabel"
          >
            <span class="provider-dot"></span>
            {{ agentEnabled ? providerName || 'AI 助手' : 'AI 未启用' }}
          </span>
          <span v-if="agentEnabled && kbTotal" class="meta-pill">
            知识库 {{ kbTotal }}
          </span>
          <span v-if="unreadCount" class="meta-pill is-unread">
            未读 {{ unreadCount }}
          </span>
        </div>
      </div>
      <div class="header-actions">
        <span class="header-divider"></span>
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

    <div class="tab-bar">
      <NButton
        v-if="activeTab === 'chat'"
        size="small"
        quaternary
        class="session-trigger"
        aria-label="打开会话列表"
        @click="sessionDrawer = true"
      >
        <template #icon>
          <IconifyIcon icon="lucide:panel-left" class="size-4" />
        </template>
      </NButton>
      <div class="tab-buttons">
        <button
          type="button"
          :class="{ active: activeTab === 'chat' }"
          @click="switchTab('chat')"
        >
          AI 对话
        </button>
        <button
          type="button"
          :class="{ active: activeTab === 'notifications' }"
          @click="switchTab('notifications')"
        >
          系统通知
        </button>
      </div>
    </div>

    <div class="main-layout">
      <div v-if="activeTab === 'chat'" class="desktop-sidebar">
        <SessionSidebar
          :sessions="sessions"
          :current-session-id="currentSessionId"
          :loading="sessionsLoading"
          @create="createSession"
          @select="selectSession"
          @rename="renameSession"
          @delete="deleteSession"
        />
      </div>
      <div class="main-content">
        <!-- 消息区 -->
        <div
          ref="listRef"
          class="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
          @scroll="onListScroll"
        >
          <div class="mx-auto w-full max-w-3xl">
            <WelcomePanel
              v-if="visibleMessages.length === 0 && activeTab === 'chat'"
              :agent-enabled="agentEnabled"
              :provider-name="providerName"
              @prompt="send"
            />
            <template v-for="(msg, idx) in visibleMessages" :key="msg.id">
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
              <div
                v-if="showNewMarker(idx)"
                class="my-2 flex items-center gap-2"
              >
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
                class="message-block"
              >
                <ChatMessage
                  :role="msg.role"
                  :content="msg.content"
                  :image="msg.image"
                  :items="msg.items"
                  :url="msg.url"
                  :tool-events="msg.toolEvents"
                  :attachments="msg.attachments"
                  :reasoning="msg.reasoning"
                  :streaming="msg.streaming"
                  :usage="msg.usage"
                  @retry="retryMessage(msg)"
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
      </div>
    </div>

    <NDrawer v-model:show="sessionDrawer" placement="left" width="82%">
      <SessionSidebar
        :sessions="sessions"
        :current-session-id="currentSessionId"
        :loading="sessionsLoading"
        @create="createSession"
        @select="selectSession"
        @rename="renameSession"
        @delete="deleteSession"
      />
    </NDrawer>

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
      v-if="activeTab === 'chat'"
      class="border-t px-4 py-3"
      :style="{
        background: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
      }"
    >
      <div
        v-if="attachments.length"
        class="mx-auto mb-2 flex w-full max-w-3xl flex-wrap gap-1.5"
      >
        <span
          v-for="(item, index) in attachments"
          :key="`${item.name}-${index}`"
          class="composer-attachment"
        >
          <img
            v-if="item.image_data"
            :src="`data:${item.media_type || 'image/png'};base64,${item.image_data}`"
            :alt="item.name"
            class="composer-attachment-thumb"
          />
          <IconifyIcon v-else icon="lucide:file-text" class="size-3" />
          {{ item.name }}
          <button
            type="button"
            aria-label="移除附件"
            @click="removeAttachment(index)"
          >
            <IconifyIcon icon="lucide:x" class="size-3" />
          </button>
        </span>
      </div>
      <div class="mx-auto flex w-full max-w-3xl items-end gap-1.5">
        <input
          ref="attachmentInput"
          type="file"
          class="hidden"
          multiple
          @change="onAttachmentSelected"
        />
        <NButton
          quaternary
          aria-label="添加附件"
          title="支持任意文件，单文件最大 25 MB，最多 3 个"
          :disabled="!agentEnabled || attachments.length >= 3"
          @click="chooseAttachment"
        >
          <template #icon>
            <IconifyIcon icon="lucide:paperclip" class="size-4" />
          </template>
        </NButton>
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

      <!-- 本次会话参数：收纳到 Popover，保持输入区简洁 -->
      <div
        v-if="agentEnabled"
        class="mx-auto mt-2 flex w-full max-w-3xl items-center justify-end"
      >
        <NPopover trigger="click" placement="top-end" :show-arrow="false">
          <template #trigger>
            <button class="agent-options-trigger" type="button">
              <IconifyIcon icon="lucide:sliders-horizontal" class="size-3.5" />
              <span class="agent-options-model">{{
                modelName || providerName || 'AI 助手'
              }}</span>
              <span class="agent-options-sep">·</span>
              <span>{{ thinkingEnabled ? '思考开' : '思考关' }}</span>
              <IconifyIcon icon="lucide:chevron-up" class="size-3" />
            </button>
          </template>
          <div class="w-64 p-1">
            <div class="mb-2 text-xs font-semibold">本次对话参数</div>
            <div class="space-y-3">
              <div class="flex items-center justify-between text-xs">
                <span>Provider</span>
                <span class="opacity-70">{{ providerName || '-' }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span>模型</span>
                <span class="max-w-36 truncate opacity-70">{{
                  modelName || '-'
                }}</span>
              </div>
              <div class="flex items-center justify-between gap-2 text-xs">
                <span>推理强度</span>
                <NTooltip :disabled="reasoningEffort !== 'max'" placement="top">
                  <template #trigger>
                    <NSelect
                      size="tiny"
                      :value="reasoningEffort"
                      :options="reasoningOptions"
                      :render-label="renderReasoningLabel"
                      class="w-28"
                      @update:value="(v) => (reasoningEffort = v)"
                    />
                  </template>
                  {{ MAX_EFFORT_TIP }}
                </NTooltip>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span>深度思考</span>
                <NSwitch v-model:value="thinkingEnabled" size="small" />
              </div>
              <div class="flex items-center justify-between text-xs">
                <span>本次会话 Token</span>
                <span class="opacity-70">{{
                  sessionTokens.toLocaleString()
                }}</span>
              </div>
            </div>
          </div>
        </NPopover>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-header {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.header-main,
.header-title-group,
.provider-badge,
.header-actions {
  display: flex;
  align-items: center;
}

.header-main {
  gap: 10px;
  min-width: 0;
}

.header-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--tblr-primary);
  background: var(--tblr-primary-light);
  border: 1px solid hsl(var(--primary) / 14%);
  border-radius: 8px;
}

.header-title-group {
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
}

.header-title {
  margin-right: 2px;
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground));
  letter-spacing: -0.01em;
}

.provider-badge {
  gap: 5px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.provider-badge.is-active {
  color: var(--tblr-primary);
  background: var(--tblr-primary-light);
  border-color: hsl(var(--primary) / 18%);
}

.provider-dot {
  width: 5px;
  height: 5px;
  background: currentcolor;
  border-radius: 50%;
}

.meta-pill {
  padding: 2px 7px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 35%);
  border-radius: 999px;
}

.meta-pill.is-unread {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
}

.header-actions {
  flex-shrink: 0;
  gap: 2px;
}

.header-divider {
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background: hsl(var(--border));
}

.header-actions :deep(.n-button) {
  color: hsl(var(--muted-foreground));
}

.header-actions :deep(.n-button:hover) {
  color: var(--tblr-primary);
  background: var(--tblr-primary-light);
}

.composer-attachment {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  max-width: 220px;
  padding: 3px 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--muted) / 35%);
  border-radius: 6px;
}

.composer-attachment-thumb {
  width: 18px;
  height: 18px;
  object-fit: cover;
  border-radius: 3px;
}

.composer-attachment button {
  display: inline-flex;
  flex-shrink: 0;
  padding: 0;
  color: inherit;
  cursor: pointer;
  background: none;
  border: 0;
}

.agent-options-trigger {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 4px 9px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--muted) / 32%);
  border: 1px solid hsl(var(--border) / 80%);
  border-radius: 999px;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.agent-options-trigger:hover {
  color: var(--tblr-primary);
  background: var(--tblr-primary-light);
}

.agent-options-model {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--foreground) / 80%);
  white-space: nowrap;
}

.agent-options-sep {
  opacity: 0.4;
}

.tab-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.session-trigger {
  display: none;
}

.tab-buttons {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  background: hsl(var(--muted) / 40%);
  border-radius: 8px;
}

.tab-buttons button {
  padding: 4px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
}

.tab-buttons button.active {
  font-weight: 500;
  color: hsl(var(--primary));
  background: hsl(var(--card));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 8%);
}

.main-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}

.main-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.message-block {
  contain-intrinsic-size: auto 120px;
  content-visibility: auto;
}

@media (max-width: 768px) {
  .session-trigger {
    display: inline-flex;
  }

  .desktop-sidebar {
    display: none;
  }

  .tab-bar {
    padding: 6px 10px;
  }

  .chat-header {
    gap: 6px;
    padding: 8px 10px;
  }

  .header-icon {
    width: 26px;
    height: 26px;
  }

  .header-title {
    font-size: 14px;
  }

  .header-divider {
    margin: 0 2px;
  }
}
</style>
