<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  useMessage,
} from 'naive-ui';

import { getSystemLogsApi } from '#/api';
import { requestClient } from '#/api/request';
import PageHeader from '#/components/page/PageHeader.vue';

const message = useMessage();

const logs = ref<any[]>([]);
const availableSources = ref<string[]>([]);
const loading = ref(false);
const level = ref<null | string>(null);
const source = ref<null | string>(null);
const searchText = ref('');
const isPaused = ref(false);
const autoScroll = ref(true);
const listRef = ref<HTMLDivElement | null>(null);

const sseRef = ref<EventSource | null>(null);
const abortController = ref<AbortController | null>(null);
const refreshTimer = ref<null | number>(null);
const sseRetryCount = ref(0);
const MAX_SSE_RETRY = 3;

const levelOptions = [
  { label: '全部级别', value: '' },
  { label: 'DEBUG', value: 'DEBUG' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARNING', value: 'WARNING' },
  { label: 'ERROR', value: 'ERROR' },
];

const sourceOptions = computed(() => {
  const sources = new Set<string>(['', 'System']);
  for (const log of logs.value) {
    if (log.source) {
      sources.add(log.source);
    }
  }
  return [...sources]
    .toSorted((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((s) => ({ label: s || '全部来源', value: s }));
});
function getLevelConfig(levelVal: string) {
  switch (levelVal) {
    case 'DEBUG': {
      return { color: '#888', bg: 'rgba(136,136,136,0.08)', dot: '#aaa' };
    }
    case 'ERROR': {
      return { color: '#d93025', bg: 'rgba(217,48,37,0.08)', dot: '#d93025' };
    }
    case 'INFO': {
      return { color: '#22a558', bg: 'rgba(34,165,88,0.08)', dot: '#22a558' };
    }
    case 'WARNING': {
      return { color: '#e09400', bg: 'rgba(224,148,0,0.08)', dot: '#e09400' };
    }
    default: {
      return { color: '#888', bg: 'transparent', dot: '#aaa' };
    }
  }
}

const filteredLogs = computed(() => {
  let result = logs.value;
  if (level.value) {
    result = result.filter((l) => l.level === level.value);
  }
  if (source.value) {
    result = result.filter((l) => l.source === source.value);
  }
  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase();
    result = result.filter(
      (l) =>
        l.text?.toLowerCase().includes(q) ||
        l.source?.toLowerCase().includes(q) ||
        l.time?.toLowerCase().includes(q),
    );
  }
  return result;
});

function scrollToBottom() {
  if (!listRef.value) return;
  nextTick(() => {
    if (!autoScroll.value || !listRef.value) return;
    const el = listRef.value;
    el.scrollTop = el.scrollHeight;
  });
}

watch(() => filteredLogs.value.length, scrollToBottom);

async function fetchLogs() {
  if (isPaused.value) return;
  loading.value = true;
  try {
    const res = await getSystemLogsApi(
      level.value || undefined,
      source.value || undefined,
      1000,
    );
    const list = Array.isArray(res) ? res : [];
    logs.value = list;
    collectSources(list);
  } catch (error: any) {
    console.error('获取日志失败:', error);
  } finally {
    loading.value = false;
  }
}

function collectSources(list: any[]) {
  for (const item of list) {
    if (item.source && !availableSources.value.includes(item.source)) {
      availableSources.value.push(item.source);
    }
  }
}

function startSSE() {
  if (abortController.value) {
    abortController.value.abort();
  }
  abortController.value = new AbortController();
  const params: Record<string, string> = {};
  if (source.value) params.source = source.value;
  requestClient
    .requestSSE('/system/stream-logging', undefined, {
      method: 'GET',
      signal: abortController.value.signal,
      onMessage: (content: string) => {
        sseRetryCount.value = 0;
        if (isPaused.value) return;
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const json = trimmed.slice(5).trim();
          if (!json) continue;
          try {
            const data = JSON.parse(json);
            if (Array.isArray(data)) {
              data.forEach((item) => {
                collectSources([item]);
                const exists = logs.value.some(
                  (l) => l.time === item.time && l.text === item.text,
                );
                if (!exists) {
                  logs.value.push(item);
                }
              });
            } else if (data && typeof data === 'object') {
              collectSources([data]);
              const exists = logs.value.some(
                (l) => l.time === data.time && l.text === data.text,
              );
              if (!exists) {
                logs.value.push(data);
              }
            }
            if (logs.value.length > 1000) {
              logs.value = logs.value.slice(-1000);
            }
          } catch {
            // ignore invalid sse data
          }
        }
      },
      onEnd: () => {
        if (sseRetryCount.value <= MAX_SSE_RETRY && !isPaused.value) {
          sseRetryCount.value += 1;
          setTimeout(() => {
            if (!isPaused.value) {
              startSSE();
            }
          }, 2000);
        }
      },
    })
    .catch(() => {
      if (sseRetryCount.value <= MAX_SSE_RETRY && !isPaused.value) {
        sseRetryCount.value += 1;
        setTimeout(() => {
          if (!isPaused.value) {
            startSSE();
          }
        }, 2000);
      }
    });
}

function stopSSE() {
  if (sseRef.value) {
    sseRef.value.close();
    sseRef.value = null;
  }
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
}

function stopPolling() {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
}

function togglePause() {
  isPaused.value = !isPaused.value;
  if (isPaused.value) {
    stopSSE();
    stopPolling();
  } else {
    fetchLogs();
    startSSE();
  }
}

function clearLogs() {
  logs.value = [];
}

function exportLogs() {
  const text = filteredLogs.value
    .map((l) => `[${l.time}] [${l.level}] [${l.source}] ${l.text}`)
    .join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nas-tools-logs-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  message.success('日志已导出');
}

function handleLevelChange() {
  fetchLogs();
}

function handleSourceChange() {
  fetchLogs();
  stopSSE();
  startSSE();
}

onMounted(() => {
  fetchLogs();
  startSSE();
});

onUnmounted(() => {
  stopSSE();
  stopPolling();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="系统日志" subtitle="实时查看系统运行日志">
      <template #actions>
        <NSpace align="center">
          <NSpace align="center" size="small">
            <span class="text-sm" style="color: hsl(var(--muted-foreground))">
              自动滚动
            </span>
            <NSwitch v-model:value="autoScroll" size="small" />
          </NSpace>
          <NButton size="small" @click="togglePause">
            <template #icon>
              <IconifyIcon
                :icon="isPaused ? 'lucide:play' : 'lucide:pause'"
                class="size-4"
              />
            </template>
            {{ isPaused ? '继续' : '暂停' }}
          </NButton>
          <NButton size="small" @click="clearLogs">
            <template #icon>
              <IconifyIcon icon="lucide:trash-2" class="size-4" />
            </template>
            清空
          </NButton>
          <NButton size="small" @click="exportLogs">
            <template #icon>
              <IconifyIcon icon="lucide:download" class="size-4" />
            </template>
            导出
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <NSelect
        v-model:value="source"
        :options="sourceOptions"
        style="width: 140px"
        clearable
        placeholder="日志来源"
        size="small"
        @update:value="handleSourceChange"
      />
      <NSelect
        v-model:value="level"
        :options="levelOptions"
        style="width: 120px"
        clearable
        placeholder="日志级别"
        size="small"
        @update:value="handleLevelChange"
      />
      <NInput
        v-model:value="searchText"
        placeholder="搜索日志内容..."
        style="width: 220px"
        size="small"
        clearable
      >
        <template #prefix>
          <IconifyIcon icon="lucide:search" class="size-4" />
        </template>
      </NInput>
      <span class="text-xs" style="color: hsl(var(--muted-foreground))">
        共 {{ filteredLogs.length }} 条
      </span>
    </div>

    <NSpin :show="loading && logs.length === 0" class="mt-4">
      <div v-if="filteredLogs.length > 0" ref="listRef" class="log-list">
        <!-- 表头 -->
        <div class="log-header">
          <span class="h-time">时间</span>
          <span class="h-level">级别</span>
          <span class="h-source">来源</span>
          <span class="h-text">内容</span>
        </div>

        <!-- 日志内容 -->
        <div class="log-body">
          <div
            v-for="(logItem, index) in filteredLogs"
            :key="index"
            class="log-row"
            :class="{ alt: index % 2 === 1 }"
            :style="{ backgroundColor: getLevelConfig(logItem.level).bg }"
          >
            <span class="r-time">{{ logItem.time }}</span>
            <span class="r-level">
              <span
                class="level-dot"
                :style="{ backgroundColor: getLevelConfig(logItem.level).dot }"
              ></span>
              <span :style="{ color: getLevelConfig(logItem.level).color }">
                {{ logItem.level }}
              </span>
            </span>
            <span class="r-source">{{ logItem.source }}</span>
            <span class="r-text">{{ logItem.text }}</span>
          </div>
        </div>
      </div>
      <NEmpty v-else-if="!loading" description="暂无日志" />
    </NSpin>
  </div>
</template>

<style scoped>
.log-list {
  max-height: 600px;
  overflow-y: auto;
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  background-color: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.log-header {
  display: grid;
  grid-template-columns: 64px 72px 120px 1fr;
  gap: 8px;
  padding: 8px 16px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.log-body {
  display: flex;
  flex-direction: column;
}

.log-row {
  display: grid;
  grid-template-columns: 64px 72px 120px 1fr;
  gap: 8px;
  align-items: start;
  padding: 5px 16px;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  transition: background-color 0.1s;
}

.log-row:hover {
  background-color: hsl(var(--accent) / 25%) !important;
}

.log-row.alt {
  background-color: hsl(var(--muted) / 4%);
}

.h-time,
.r-time {
  min-width: 64px;
}

.h-level,
.r-level {
  min-width: 72px;
}

.h-source,
.r-source {
  min-width: 120px;
}

.r-time {
  padding-top: 1px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.r-level {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-top: 1px;
  font-size: 12px;
  font-weight: 600;
}

.level-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.r-source {
  padding-top: 1px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
}

.r-text {
  color: hsl(var(--foreground));
  word-break: break-all;
  white-space: pre-wrap;
}

@media (max-width: 640px) {
  .log-header {
    grid-template-columns: 52px 64px 90px 1fr;
    gap: 4px;
    padding: 6px 8px;
    font-size: 12px;
  }

  .log-row {
    grid-template-columns: 52px 64px 90px 1fr;
    gap: 4px;
    padding: 4px 8px;
    font-size: 12px;
  }

  .h-source,
  .r-source {
    min-width: 90px;
  }
}
</style>
