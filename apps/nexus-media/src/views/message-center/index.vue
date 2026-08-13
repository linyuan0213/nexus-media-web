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
  interactMessage,
  streamAgentChat,
  streamMessages,
} from '#/api/modules/agent';
import { getAllSystemConfigApi } from '#/api/modules/system';

import ChatMessage from './components/ChatMessage.vue';
import ConfirmCard from './components/ConfirmCard.vue';
import WelcomePanel from './components/WelcomePanel.vue';

interface Message {
  id: number;
  role: 'assistant' | 'system' | 'user';
  content: string;
  image?: string;
  items?: AgentApi.ListItem[];
  reasoning?: string;
  url?: string;
  toolEvents?: AgentApi.ChatEvent[];
  streaming?: boolean;
}

const messages = ref<Message[]>([]);
const input = ref('');
const sending = ref(false);
const agentEnabled = ref(false);
const providerName = ref('');
const kbTotal = ref(0);
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
let streamReconnectTimer: null | number = null;
let placeholderId: null | number = null;

const STREAM_CURSOR_KEY = 'nexus-agent-stream-cursor';

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

function scrollToBottom() {
  nextTick(() => {
    const el = listRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
}

function pushMessage(msg: Omit<Message, 'id'>): Message {
  const item = { ...msg, id: ++msgSeq };
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
        // 命令占位替换：收到回复/通知时移除"正在处理…"
        if (placeholderId != null) {
          messages.value = messages.value.filter((m) => m.id !== placeholderId);
          placeholderId = null;
        }
        const title = item.title?.trim();
        const content = item.content?.trim();
        pushMessage({
          role: 'system',
          content: content ? `${title}\n${content}` : title,
          image: item.image || '',
          items: item.items || [],
          url: item.url || '',
        });
      },
      onEnd: () => {
        // 断线重连（页面销毁时由 signal 终止，不再重连）
        if (!streamAbort.value?.signal.aborted) {
          streamReconnectTimer = window.setTimeout(startMessageStream, 3000);
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
                (ev.step != null ? t.step === ev.step : t.tool === ev.tool),
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
  const merged: (Omit<Message, 'id'> & { ts: number; _sort: number })[] = [];
  try {
    const res: any = await getConversation('');
    const list = res?.messages || [];
    let order = 0;
    for (const m of list) {
      if (m.role === 'user' || m.role === 'assistant') {
        merged.push({
          role: m.role,
          content: m.content || '',
          ts: Number(m.ts) || 0,
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
        content: content ? `${title}\n${content}` : title,
        image: item.image || '',
        items: item.items || [],
        url: item.url || '',
        ts: Number(item.ts) || 0,
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
    const { ts: _ts, _sort: _sort, ...rest } = m;
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

onMounted(() => {
  streamCursor = loadStreamCursor();
  window.addEventListener('storage', onStorageSync);
  window.addEventListener('resize', measureListHeight);
  fetchStatus();
  measureListHeight();
  restoreTimeline();
  startMessageStream();
});

onBeforeUnmount(() => {
  window.removeEventListener('storage', onStorageSync);
  window.removeEventListener('resize', measureListHeight);
  chatAbort.value?.abort();
  streamAbort.value?.abort();
  if (streamReconnectTimer) clearTimeout(streamReconnectTimer);
});
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
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
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
    >
      <div class="mx-auto w-full max-w-3xl">
        <WelcomePanel
          v-if="messages.length === 0"
          :agent-enabled="agentEnabled"
          :provider-name="providerName"
          @prompt="send"
        />
        <template v-for="msg in messages" :key="msg.id">
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
