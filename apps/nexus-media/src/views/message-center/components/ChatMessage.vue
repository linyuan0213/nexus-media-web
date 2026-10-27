<script lang="ts" setup>
import type { AgentApi } from '#/api/modules/agent';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import MarkdownIt from 'markdown-it';
import { NButton, NModal, NSpin, NTooltip, useMessage } from 'naive-ui';

import { readAgentDoc } from '#/api/modules/agent';

const props = defineProps<{
  attachments?: AgentApi.ChatAttachment[];
  content: string;
  image?: string;
  items?: AgentApi.ListItem[];
  reasoning?: string;
  role: 'assistant' | 'system' | 'user';
  streaming?: boolean;
  time?: string;
  toolEvents?: AgentApi.ChatEvent[];
  url?: string;
  usage?: number;
}>();

const emit = defineEmits<{ retry: [] }>();

function formatUsage(tokens?: number) {
  if (!tokens) return '';
  return tokens >= 1000
    ? `${(tokens / 1000).toFixed(1)}k tokens`
    : `${tokens} tokens`;
}
const message = useMessage();
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.content);
    message.success('已复制回答');
  } catch {
    message.error('复制失败');
  }
}

// 表格外层套横向滚动容器：移动端宽表格不撑破气泡/视口
md.renderer.rules.table_open = () => '<div class="agent-md-table-wrap"><table>';
md.renderer.rules.table_close = () => '</table></div>';

const rendered = computed(() => {
  if (props.role === 'user') return '';
  return md.render(props.content || '');
});

const isUser = computed(() => props.role === 'user');
const isSystem = computed(() => props.role === 'system');

// 思考过程：可折叠面板，把 tool_call/tool_result 配成步骤列表
const thinkingOpen = ref(false);
const thinkingPinned = ref(false);

function toggleThinking() {
  thinkingOpen.value = !thinkingOpen.value;
  thinkingPinned.value = true;
}

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

const expandedTools = ref<number[]>([]);

function hasToolDetail(step: ToolStep) {
  return Boolean(
    step.call.parameters && Object.keys(step.call.parameters).length > 0,
  );
}

function toggleToolDetail(index: number) {
  expandedTools.value = expandedTools.value.includes(index)
    ? expandedTools.value.filter((item) => item !== index)
    : [...expandedTools.value, index];
}

const _TOOL_META: Record<string, { icon: string; label: string }> = {
  browser_fetch: { icon: 'lucide:globe', label: '获取网页' },
  web_fetch: { icon: 'lucide:globe', label: '获取网页' },
  web_search: { icon: 'lucide:search', label: '搜索网页' },
  media_search: { icon: 'lucide:search', label: '搜索影视资源' },
  media_detail: { icon: 'lucide:film', label: '查询影视详情' },
  knowledge_search: { icon: 'lucide:book-open', label: '检索知识库' },
  kb_search: { icon: 'lucide:book-open', label: '检索知识库' },
  python_exec: { icon: 'lucide:terminal', label: '运行 Python 代码' },
  run_python: { icon: 'lucide:terminal', label: '运行 Python 代码' },
  download_add: { icon: 'lucide:download', label: '添加下载' },
  download_list: { icon: 'lucide:list', label: '查看下载任务' },
  download_action: { icon: 'lucide:download', label: '操作下载任务' },
  subscribe_create: { icon: 'lucide:heart', label: '创建订阅' },
  subscribe_list: { icon: 'lucide:list', label: '查看订阅' },
  site_status: { icon: 'lucide:server', label: '查询站点状态' },
  system_status: { icon: 'lucide:activity', label: '检查系统状态' },
  stats_summary: { icon: 'lucide:chart-column', label: '汇总运行统计' },
  logs_query: { icon: 'lucide:scroll-text', label: '查询系统日志' },
  config_get: { icon: 'lucide:settings-2', label: '读取系统配置' },
  config_set: { icon: 'lucide:settings-2', label: '修改系统配置' },
  config_apply_manifest: { icon: 'lucide:file-cog', label: '应用配置清单' },
  plugin_list: { icon: 'lucide:puzzle', label: '查看插件列表' },
  plugin_run: { icon: 'lucide:play', label: '运行插件任务' },
  brush_status: { icon: 'lucide:refresh-cw', label: '查询刷流任务' },
  scheduler_list: { icon: 'lucide:calendar-clock', label: '查看计划任务' },
  scheduler_run: { icon: 'lucide:play', label: '运行计划任务' },
};

function toolTitle(step: ToolStep) {
  const tool = step.call.tool || '';
  return _TOOL_META[tool]?.label || tool.replaceAll('_', ' ');
}

function toolIcon(step: ToolStep) {
  const tool = step.call.tool || '';
  return (
    _TOOL_META[tool]?.icon ||
    (stepStatus(step) === 'pending' ? 'lucide:loader-2' : 'lucide:wrench')
  );
}

function toolSubtitle(step: ToolStep) {
  const status = stepStatus(step);
  if (status === 'pending') return '执行中…';
  if (status === 'confirm') return '等待确认';
  if (status === 'error') return step.result?.result_summary || '执行失败';
  return step.result?.result_summary || '已完成';
}

const toolSummary = computed(() => {
  const labels = [...new Set(toolSteps.value.map(toolTitle))];
  return labels.slice(0, 2).join('、') + (labels.length > 2 ? ' 等' : '');
});

function stepDuration(step: ToolStep) {
  if (!step.call.ts || !step.result?.ts) return '';
  const duration = Math.max(0, (step.result.ts - step.call.ts) * 1000);
  return duration >= 1000
    ? `${(duration / 1000).toFixed(1)}s`
    : `${Math.round(duration)}ms`;
}

function toolDetail(step: ToolStep) {
  return JSON.stringify(
    {
      arguments: step.call.parameters || {},
      success: step.result?.success,
      duration: stepDuration(step) || undefined,
      result: step.result?.result_summary || undefined,
    },
    null,
    2,
  );
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

// 回答完成后自动收起过程区，让最终回答成为视觉主体；用户手动展开后保持
watch(
  () => props.streaming,
  (streaming, previous) => {
    if (previous && !streaming && !thinkingPinned.value) {
      thinkingOpen.value = false;
    }
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

function hideBrokenImg(event: Event) {
  (event.target as HTMLElement).style.display = 'none';
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
              @error="hideBrokenImg"
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
        <!-- 单图通知消息：企业微信图文卡片样式——图片横幅在上，文字区在下 -->
        <div
          v-else-if="image"
          class="mb-2 w-full max-w-[420px] overflow-hidden rounded-xl border"
          :style="{
            borderColor: 'hsl(var(--border))',
            background: 'hsl(var(--card))',
          }"
        >
          <a
            :href="url || image"
            target="_blank"
            rel="noreferrer"
            class="block"
          >
            <img
              :src="image"
              class="h-36 w-full object-cover"
              alt="消息图片"
              @error="hideBrokenImg"
            />
          </a>
          <div
            v-if="content"
            class="agent-sys-firstline whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed"
            :style="{ color: 'hsl(var(--card-foreground))' }"
          >
            {{ content }}
          </div>
        </div>
        <div
          v-else-if="!items?.length"
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
      <div v-if="attachments?.length" class="user-attachments">
        <template
          v-for="(file, index) in attachments"
          :key="`${file.name}-${index}`"
        >
          <img
            v-if="file.image_data"
            :src="`data:${file.media_type || 'image/png'};base64,${file.image_data}`"
            :alt="file.name"
            class="user-attachment-image"
          />
          <div v-else class="user-attachment-file">
            <IconifyIcon icon="lucide:file-text" class="size-4 shrink-0" />
            <span class="truncate">{{ file.name }}</span>
            <span v-if="file.size" class="shrink-0 opacity-70">
              {{
                file.size > 1048576
                  ? `${(file.size / 1048576).toFixed(1)} MB`
                  : `${Math.ceil(file.size / 1024)} KB`
              }}
            </span>
          </div>
        </template>
      </div>
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
        <div v-if="toolSteps.length > 0 || reasoning" class="thinking-shell">
          <button
            class="thinking-trigger"
            :class="{ 'is-open': thinkingOpen }"
            :aria-expanded="thinkingOpen"
            aria-controls="thinking-panel"
            @click="toggleThinking"
          >
            <IconifyIcon
              :icon="streaming ? 'lucide:loader-2' : 'lucide:brain'"
              class="thinking-trigger-icon"
              :class="{ 'animate-spin': streaming }"
            />
            <span>{{
              toolSteps.length ? `使用 ${toolSteps.length} 个工具` : '思考过程'
            }}</span>
            <span v-if="toolSummary" class="thinking-task"
              >，{{ toolSummary }}</span
            >
            <span v-else-if="streaming" class="thinking-live-dot"></span>
            <IconifyIcon
              icon="lucide:chevron-down"
              class="thinking-chevron"
              :class="{ 'rotate-180': thinkingOpen }"
            />
          </button>

          <div v-if="thinkingOpen" id="thinking-panel" class="thinking-panel">
            <div v-if="reasoning" class="thinking-reasoning">
              <div class="thinking-caption">
                <IconifyIcon icon="lucide:sparkles" class="size-3" />
                分析
              </div>
              <div class="thinking-reasoning-copy">{{ reasoning }}</div>
            </div>

            <div v-if="toolSteps.length > 0" class="thinking-tool-section">
              <div class="thinking-tool-list">
                <div
                  v-for="(s, i) in toolSteps"
                  :key="i"
                  class="thinking-tool-item"
                >
                  <button
                    class="thinking-tool-step"
                    :class="`is-${stepStatus(s)}`"
                    type="button"
                    @click="toggleToolDetail(i)"
                  >
                    <span class="thinking-tool-status">
                      <IconifyIcon
                        :icon="toolIcon(s)"
                        class="size-3.5"
                        :class="{ 'animate-spin': stepStatus(s) === 'pending' }"
                      />
                    </span>
                    <span class="thinking-tool-main">
                      <span class="thinking-tool-title">{{
                        toolTitle(s)
                      }}</span>
                      <span class="thinking-tool-subtitle">{{
                        toolSubtitle(s)
                      }}</span>
                    </span>
                    <span v-if="stepDuration(s)" class="thinking-tool-duration">
                      {{ stepDuration(s) }}
                    </span>
                    <IconifyIcon
                      v-if="hasToolDetail(s)"
                      icon="lucide:chevron-down"
                      class="thinking-tool-chevron"
                      :class="{ 'rotate-180': expandedTools.includes(i) }"
                    />
                  </button>
                  <pre
                    v-if="expandedTools.includes(i)"
                    class="thinking-tool-detail"
                    >{{ toolDetail(s) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="rendered && (reasoning || toolSteps.length > 0)"
          class="answer-caption"
        >
          <IconifyIcon icon="lucide:message-circle" class="size-3" />
          回答
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
        <div v-if="!streaming && rendered && !isUser" class="message-actions">
          <NTooltip v-if="usage" placement="top">
            <template #trigger>
              <span class="message-usage">
                <IconifyIcon icon="lucide:activity" class="size-3" />
                {{ formatUsage(usage) }} tokens
              </span>
            </template>
            本轮 Token 用量
          </NTooltip>
          <span v-if="usage" class="action-divider"></span>
          <NTooltip placement="top">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                circle
                aria-label="复制回答"
                @click="copyContent"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:copy" class="size-3.5" />
                </template>
              </NButton>
            </template>
            复制回答
          </NTooltip>
          <NTooltip placement="top">
            <template #trigger>
              <NButton
                size="tiny"
                quaternary
                circle
                aria-label="重新发送"
                @click="emit('retry')"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:rotate-cw" class="size-3.5" />
                </template>
              </NButton>
            </template>
            重新发送
          </NTooltip>
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

.agent-md {
  min-width: 0;
  overflow-wrap: break-word;
}

.agent-md-table-wrap {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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

/* 思考与工具调用：低对比度摘要 + 主题色状态 */
.thinking-shell {
  max-width: 780px;
  margin-bottom: 8px;
}

.thinking-trigger {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--tblr-primary);
  cursor: pointer;
  background: var(--tblr-primary-light);
  border: 1px solid hsl(var(--primary) / 18%);
  border-radius: 999px;
  transition:
    background 0.16s ease,
    border-color 0.16s ease;
}

.thinking-trigger:hover,
.thinking-trigger.is-open {
  background: hsl(var(--primary) / 13%);
  border-color: hsl(var(--primary) / 28%);
}

.thinking-trigger-icon {
  width: 14px;
  height: 14px;
}

.thinking-task {
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.thinking-live-dot {
  width: 5px;
  height: 5px;
  background: var(--tblr-primary);
  border-radius: 50%;
  animation: pulse 1.4s ease-in-out infinite;
}

.thinking-chevron {
  width: 13px;
  height: 13px;
  margin-left: 1px;
  transition: transform 0.18s ease;
}

.thinking-panel {
  padding: 9px 11px;
  margin-top: 5px;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border) / 80%);
  border-left: 2px solid hsl(var(--primary) / 38%);
  border-radius: 8px;
}

.thinking-reasoning {
  padding-bottom: 9px;
}

.thinking-reasoning + .thinking-tool-section {
  padding-top: 9px;
  border-top: 1px solid hsl(var(--border));
}

.thinking-caption {
  display: flex;
  gap: 5px;
  align-items: center;
  margin-bottom: 5px;
  font-size: 10px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.04em;
}

.thinking-count-badge {
  padding: 0 5px;
  font-size: 10px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 60%);
  border-radius: 999px;
}

.thinking-reasoning-copy {
  font-size: 12px;
  line-height: 1.65;
  color: hsl(var(--foreground) / 72%);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.thinking-tool-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.thinking-tool-item {
  position: relative;
  min-width: 0;
}

.thinking-tool-item:not(:last-child)::before {
  position: absolute;
  top: 28px;
  bottom: -4px;
  left: 16px;
  content: '';
  border-left: 1px dashed hsl(var(--border));
}

.thinking-tool-step {
  display: flex;
  gap: 9px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 6px 5px;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 7px;
}

.thinking-tool-step:hover {
  background: hsl(var(--muted) / 35%);
}

.thinking-tool-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.thinking-tool-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.thinking-tool-subtitle {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.thinking-tool-chevron {
  flex-shrink: 0;
  width: 11px;
  height: 11px;
  color: hsl(var(--muted-foreground));
  transition: transform 0.16s ease;
}

.thinking-tool-detail {
  padding: 6px 8px;
  margin: 2px 4px 5px 38px;
  overflow-x: auto;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  white-space: pre-wrap;
  background: hsl(var(--card) / 70%);
  border-radius: 5px;
}

.thinking-tool-status {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--tblr-primary);
  background: var(--tblr-primary-light);
  border: 1px solid hsl(var(--border));
  border-radius: 50%;
}

.thinking-tool-step.is-error .thinking-tool-status {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
}

.thinking-tool-step.is-confirm .thinking-tool-status {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.thinking-tool-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
  background: transparent;
}

.thinking-tool-duration {
  flex-shrink: 0;
  font-size: 9px;
  color: hsl(var(--muted-foreground));
}

.thinking-tool-note {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 10px;
}

.thinking-tool-note.is-warning {
  color: hsl(var(--warning));
}

.thinking-tool-note.is-error {
  color: hsl(var(--destructive));
}

.user-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.user-attachment-image {
  width: 180px;
  max-width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: 8px;
}

.user-attachment-file {
  display: flex;
  gap: 5px;
  align-items: center;
  max-width: 260px;
  padding: 5px 8px;
  font-size: 11px;
  background: hsl(var(--primary-foreground) / 14%);
  border-radius: 6px;
}

.answer-caption {
  display: flex;
  gap: 5px;
  align-items: center;
  margin: 2px 0 5px 2px;
  font-size: 10px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.04em;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 1;
  }
}

.message-actions {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  margin-top: 7px;
  opacity: 0.58;
  transition: opacity 0.16s ease;
}

.message-actions:hover {
  opacity: 1;
}

.message-usage {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 7px;
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  cursor: default;
  background: hsl(var(--muted) / 38%);
  border-radius: 999px;
}

.action-divider {
  width: 1px;
  height: 12px;
  margin: 0 3px;
  background: hsl(var(--border));
}

.message-actions :deep(.n-button) {
  color: hsl(var(--muted-foreground));
}

.message-actions :deep(.n-button:hover) {
  color: var(--tblr-primary);
  background: var(--tblr-primary-light);
}

@media (max-width: 640px) {
  .message-actions {
    opacity: 1;
  }
}
</style>
