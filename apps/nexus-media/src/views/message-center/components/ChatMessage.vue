<script lang="ts" setup>
import type { AgentApi } from '#/api/modules/agent';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import MarkdownIt from 'markdown-it';
import { NModal, NSpin, useMessage } from 'naive-ui';

import { readAgentDoc } from '#/api/modules/agent';

const props = defineProps<{
  content: string;
  image?: string;
  items?: AgentApi.ListItem[];
  reasoning?: string;
  role: 'assistant' | 'system' | 'user';
  streaming?: boolean;
  time?: string;
  toolEvents?: AgentApi.ChatEvent[];
  url?: string;
}>();

const message = useMessage();
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const rendered = computed(() => {
  if (props.role === 'user') return '';
  return md.render(props.content || '');
});

const isUser = computed(() => props.role === 'user');
const isSystem = computed(() => props.role === 'system');

// 思考过程：可折叠面板，把 tool_call/tool_result 配成步骤列表
const thinkingOpen = ref(false);

interface ToolStep {
  call: AgentApi.ChatEvent;
  result?: AgentApi.ChatEvent;
}

const toolSteps = computed<ToolStep[]>(() => {
  const steps: ToolStep[] = [];
  for (const ev of props.toolEvents || []) {
    if (ev.type === 'tool_call') {
      steps.push({ call: ev });
    } else if (ev.type === 'tool_result') {
      // 优先按 step 配对（同名工具多次调用时可靠），无 step 时回退到最近未配对同名调用
      const match =
        (ev.step != null &&
          steps.find((s) => !s.result && s.call.step === ev.step)) ||
        steps.find((s) => !s.result && s.call.tool === ev.tool);
      if (match) {
        match.result = ev;
      } else {
        steps.push({
          call: { ...ev, tool: ev.tool || '', type: 'tool_call' },
          result: ev,
        });
      }
    }
  }
  return steps;
});

function stepStatus(s: ToolStep): 'confirm' | 'error' | 'pending' | 'success' {
  if (s.result?.need_confirm) return 'confirm';
  if (s.result && !s.result.success) return 'error';
  if (s.result) return 'success';
  return 'pending';
}

function stepIcon(s: ToolStep): string {
  switch (stepStatus(s)) {
    case 'confirm': {
      return 'lucide:shield-alert';
    }
    case 'error': {
      return 'lucide:x';
    }
    case 'success': {
      return 'lucide:check';
    }
    default: {
      return 'lucide:loader-2';
    }
  }
}

function stepColor(s: ToolStep): string {
  switch (stepStatus(s)) {
    case 'confirm': {
      return 'hsl(var(--warning))';
    }
    case 'error': {
      return 'hsl(var(--destructive))';
    }
    case 'success': {
      return 'hsl(var(--success))';
    }
    default: {
      return 'hsl(var(--primary))';
    }
  }
}

// 工具步骤一出现即自动展开，让思考过程立即可见（用户可随时折叠）
watch(toolSteps, (steps) => {
  if (steps.length > 0) thinkingOpen.value = true;
});

// 推理文本先于工具步骤到达，同样自动展开
watch(
  () => props.reasoning,
  (r) => {
    if (r) thinkingOpen.value = true;
  },
);

// 内置文档查看器：拦截 .md 链接，弹窗渲染
const docOpen = ref(false);
const docLoading = ref(false);
const docName = ref('');
const docContent = ref('');

function openDoc(name: string) {
  docName.value = name;
  docOpen.value = true;
  docLoading.value = true;
  docContent.value = '';
  readAgentDoc(name)
    .then((res) => {
      docContent.value = res?.content ?? '（文档为空）';
    })
    .catch((error: any) => {
      message.error(error?.message || '文档读取失败');
      docOpen.value = false;
    })
    .finally(() => {
      docLoading.value = false;
    });
}

function onContentClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href') || '';
  // 仅拦截 .md 文档链接（docs/xxx.md 或 xxx.md，支持 #锚点），外部 http 链接放行
  if (/^https?:\/\//i.test(href)) return;
  const match = href.match(/([^\\/]+\.md)(?:#.*)?$/i);
  if (match?.[1]) {
    event.preventDefault();
    event.stopPropagation();
    openDoc(match[1]);
  }
}
</script>

<template>
  <div
    class="mb-3 flex w-full"
    :class="[isUser ? 'justify-end' : 'justify-start']"
  >
    <!-- 系统/通知消息 -->
    <div
      v-if="isSystem"
      class="flex max-w-full items-start gap-2 text-xs leading-relaxed"
      :style="{ color: 'hsl(var(--muted-foreground))' }"
    >
      <IconifyIcon icon="lucide:bell" class="mt-0.5 size-3.5 shrink-0" />
      <div class="min-w-0 flex-1">
        <!-- 列表消息：每条结果一张横向卡片（海报 + 序号 + 标题 + 元信息） -->
        <div v-if="items?.length" class="space-y-1.5">
          <div
            class="agent-sys-firstline whitespace-pre-wrap rounded-xl border px-3 py-2"
            :style="{
              background: 'hsl(var(--card))',
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--card-foreground))',
            }"
          >
            {{ content }}
          </div>
          <a
            v-for="it in items"
            :key="it.index"
            :href="it.url || url || '#'"
            target="_blank"
            rel="noreferrer"
            class="flex items-center gap-2.5 rounded-lg border p-2 transition-colors hover:opacity-85"
            :style="{
              borderColor: 'hsl(var(--border))',
              background: 'hsl(var(--card))',
            }"
          >
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              :style="{
                background: 'hsl(var(--primary) / 0.12)',
                color: 'hsl(var(--primary))',
              }"
            >
              {{ it.index }}
            </span>
            <img
              v-if="it.image"
              :src="it.image"
              alt=""
              loading="lazy"
              class="size-10 shrink-0 rounded object-cover"
            />
            <div class="min-w-0 flex-1">
              <div
                class="truncate text-sm font-medium"
                :style="{ color: 'hsl(var(--foreground))' }"
              >
                {{ it.title }}
              </div>
              <div class="truncate">
                <template v-if="it.year">{{ it.year }}</template>
                <template v-if="it.type"> · {{ it.type }}</template>
                <template v-if="it.vote"> · {{ it.vote }}</template>
              </div>
            </div>
            <IconifyIcon
              icon="lucide:chevron-right"
              class="size-4 shrink-0"
              :style="{ color: 'hsl(var(--muted-foreground))' }"
            />
          </a>
        </div>
        <!-- 单图通知消息 -->
        <a
          v-else-if="image"
          :href="url || image"
          target="_blank"
          rel="noreferrer"
          class="mb-2 inline-block overflow-hidden rounded-lg border"
          :style="{ borderColor: 'hsl(var(--border))' }"
        >
          <img :src="image" class="max-h-44 w-auto max-w-full" alt="消息图片" />
        </a>
        <div
          v-if="!items?.length"
          class="agent-sys-firstline whitespace-pre-wrap rounded-xl border px-3 py-2"
          :style="{
            background: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--card-foreground))',
          }"
        >
          {{ content }}
        </div>
      </div>
    </div>

    <!-- 用户气泡 -->
    <div
      v-else-if="isUser"
      class="max-w-[88%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm sm:max-w-[80%] sm:px-4"
      :style="{
        background: 'hsl(var(--primary))',
        color: 'hsl(var(--primary-foreground))',
      }"
    >
      <div class="whitespace-pre-wrap break-words">{{ content }}</div>
    </div>

    <!-- 助手气泡 -->
    <div
      v-else
      class="flex max-w-[92%] items-start gap-2 sm:max-w-[85%] sm:gap-2.5"
    >
      <div
        class="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full"
        :style="{
          background: 'hsl(var(--primary) / 0.12)',
          color: 'hsl(var(--primary))',
        }"
      >
        <IconifyIcon icon="lucide:bot" class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <!-- 思考过程（可折叠） -->
        <div v-if="toolSteps.length > 0 || reasoning" class="mb-1.5">
          <button
            class="flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-opacity hover:opacity-80"
            :style="{
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--muted-foreground))',
              background: 'hsl(var(--muted) / 0.4)',
            }"
            :aria-expanded="thinkingOpen"
            aria-controls="thinking-panel"
            @click="thinkingOpen = !thinkingOpen"
          >
            <IconifyIcon
              :icon="streaming ? 'lucide:loader-2' : 'lucide:brain'"
              class="size-3.5 shrink-0"
              :class="{ 'animate-spin': streaming }"
              :style="{ color: 'hsl(var(--primary))' }"
            />
            <span class="shrink-0">思考过程</span>
            <span v-if="toolSteps.length > 0" class="shrink-0"
              >· {{ toolSteps.length }} 步</span
            >
            <span
              v-else-if="streaming"
              class="flex shrink-0 items-center gap-1"
            >
              <span
                class="inline-block size-1.5 animate-pulse rounded-full"
                :style="{ background: 'hsl(var(--primary))' }"
              ></span>
            </span>
            <IconifyIcon
              icon="lucide:chevron-down"
              class="ml-0.5 size-3 shrink-0 transition-transform"
              :class="{ 'rotate-180': thinkingOpen }"
            />
          </button>
          <div
            v-if="thinkingOpen"
            id="thinking-panel"
            class="mt-1.5 space-y-1 rounded-md border px-2 py-1.5"
            :style="{
              borderColor: 'hsl(var(--border))',
              background: 'hsl(var(--muted) / 0.25)',
            }"
          >
            <div
              v-if="reasoning"
              class="whitespace-pre-wrap break-words text-xs leading-relaxed"
              :style="{ color: 'hsl(var(--muted-foreground))' }"
            >
              {{ reasoning }}
            </div>
            <div
              v-for="(s, i) in toolSteps"
              :key="i"
              class="flex min-w-0 items-center gap-1.5 text-xs"
              :style="{ color: 'hsl(var(--muted-foreground))' }"
            >
              <IconifyIcon
                :icon="stepIcon(s)"
                class="size-3.5 shrink-0"
                :class="{ 'animate-spin': stepStatus(s) === 'pending' }"
                :style="{ color: stepColor(s) }"
              />
              <span class="truncate">{{ s.call.tool }}</span>
              <span
                v-if="s.result?.need_confirm"
                class="ml-auto shrink-0"
                :style="{ color: 'hsl(var(--warning))' }"
              >
                待确认
              </span>
              <span
                v-else-if="s.result && !s.result.success"
                class="ml-auto shrink-0"
                :style="{ color: 'hsl(var(--destructive))' }"
              >
                失败
              </span>
            </div>
          </div>
        </div>
        <div
          v-if="rendered || (streaming && toolSteps.length === 0)"
          class="rounded-2xl rounded-tl-sm border px-4 py-2.5 text-sm"
          :style="{
            background: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--card-foreground))',
          }"
        >
          <!-- eslint-disable vue/no-v-html -- markdown-it 以 html:false 渲染，原始 HTML 已转义，无 XSS 风险 -->
          <div
            v-if="rendered"
            class="agent-md prose-sm max-w-none break-words"
            v-html="rendered"
            @click="onContentClick"
          ></div>
          <!-- eslint-enable vue/no-v-html -->
          <div
            v-else-if="streaming && toolSteps.length === 0"
            class="flex items-center gap-1.5 text-xs"
            :style="{ color: 'hsl(var(--muted-foreground))' }"
          >
            <span
              class="inline-block size-2 animate-pulse rounded-full"
              :style="{ background: 'hsl(var(--primary))' }"
            ></span>
            正在思考…
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -- markdown-it 以 html:false 渲染，原始 HTML 已转义，无 XSS 风险 -->
          <span
            v-if="streaming && rendered"
            class="ml-1 inline-block size-2 animate-pulse rounded-full"
            :style="{ background: 'hsl(var(--primary))' }"
          ></span>
        </div>
      </div>
    </div>
  </div>

  <!-- 内置文档查看器 -->
  <NModal
    v-model:show="docOpen"
    preset="card"
    :title="docName"
    style="max-width: 720px"
    class="max-h-[80vh]"
  >
    <div class="max-h-[65vh] overflow-y-auto">
      <NSpin :show="docLoading">
        <!-- eslint-disable vue/no-v-html -- markdown-it 以 html:false 渲染，原始 HTML 已转义，无 XSS 风险 -->
        <div
          v-if="docContent"
          class="agent-md prose-sm max-w-none break-words"
          v-html="md.render(docContent)"
          @click="onContentClick"
        ></div>
        <!-- eslint-enable vue/no-v-html -->
      </NSpin>
    </div>
  </NModal>
</template>

<style>
.agent-sys-firstline::first-line {
  font-weight: 500;
}

.agent-md table {
  width: 100%;
  font-size: 12px;
  border-collapse: collapse;
}

.agent-md th,
.agent-md td {
  padding: 4px 8px;
  text-align: left;
  border: 1px solid hsl(var(--border));
}

.agent-md th {
  background: hsl(var(--muted) / 50%);
}

.agent-md pre {
  padding: 8px;
  overflow-x: auto;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.agent-md code {
  font-size: 12px;
}

.agent-md a {
  color: hsl(var(--primary));
  text-decoration: underline;
}

.agent-md h1,
.agent-md h2,
.agent-md h3 {
  margin: 8px 0 4px;
  font-weight: 600;
}

.agent-md ul,
.agent-md ol {
  padding-left: 18px;
  margin: 4px 0;
}
</style>
