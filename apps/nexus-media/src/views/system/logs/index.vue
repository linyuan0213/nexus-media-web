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

import {
  exportSystemLogsApi,
  getSystemLogsApi,
  getSystemLogSourcesApi,
  searchSystemLogsApi,
} from '#/api';
import { requestClient } from '#/api/request';
import PageHeader from '#/components/page/PageHeader.vue';

const message = useMessage();

const PAGE_SIZE = 1000;

const logs = ref<any[]>([]);
const availableSources = ref<string[]>([]);
const loading = ref(false);
const level = ref<null | string>(null);
const source = ref<null | string>(null);
const searchText = ref('');
const isPaused = ref(false);
const autoScroll = ref(true);
const listRef = ref<HTMLDivElement | null>(null);

const searchTotal = ref(0);
const searchTruncated = ref(false);
const searchPage = ref(1);

const sseRef = ref<EventSource | null>(null);
const abortController = ref<AbortController | null>(null);
const sseRetryCount = ref(0);
const MAX_SSE_RETRY = 3;
let searchDebounce: null | number = null;

const levelOptions = [
  { label: '全部级别', value: '' },
  { label: 'DEBUG', value: 'DEBUG' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARNING', value: 'WARNING' },
  { label: 'ERROR', value: 'ERROR' },
];

// 来源下拉由稳定累积的来源集合驱动（服务器全量 + 实时增量），
// 避免随日志流每次刷新重建选项导致下拉闪烁无法选中
const sourceOptions = computed(() => {
  const values = new Set<string>(['', ...availableSources.value]);
  return [...values]
    .toSorted((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((s) => ({ label: s || '全部来源', value: s }));
});

// 任一筛选条件生效即进入全量搜索模式（磁盘文件），否则实时流模式
const isFiltering = computed(() => {
  return !!searchText.value.trim() || !!level.value || !!source.value;
});

const hasMore = computed(() => {
  return isFiltering.value && logs.value.length < searchTotal.value;
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

function scrollToBottom() {
  nextTick(() => {
    if (!autoScroll.value || !listRef.value) return;
    const el = listRef.value;
    el.scrollTop = el.scrollHeight;
  });
}

watch(() => logs.value.length, scrollToBottom);

function collectSources(items: any[]) {
  for (const item of items) {
    const src = item?.source;
    if (src && !availableSources.value.includes(src)) {
      availableSources.value.push(src);
    }
  }
}

async function fetchLogs() {
  if (isPaused.value || isFiltering.value) return;
  loading.value = true;
  try {
    const res = await getSystemLogsApi(undefined, undefined, 1000);
    const list = Array.isArray(res) ? res : [];
    logs.value = list;
    collectSources(list);
  } catch (error: any) {
    console.error('获取日志失败:', error);
  } finally {
    loading.value = false;
  }
}

async function fetchSearch(page = 1) {
  if (!isFiltering.value) return;
  loading.value = true;
  try {
    const res = await searchSystemLogsApi({
      keyword: searchText.value.trim() || undefined,
      level: level.value || undefined,
      source: source.value || undefined,
      page,
      page_size: PAGE_SIZE,
    });
    const items = res?.items ?? [];
    logs.value = page <= 1 ? items : [...logs.value, ...items];
    searchTotal.value = res?.total ?? items.length;
    searchTruncated.value = Boolean(res?.truncated);
    searchPage.value = page;
    collectSources(items);
  } catch (error: any) {
    console.error('搜索日志失败:', error);
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  fetchSearch(searchPage.value + 1);
}

function startSSE() {
  // 搜索/筛选模式下不建立实时流，避免未过滤日志污染搜索结果
  if (isFiltering.value) return;
  if (abortController.value) {
    abortController.value.abort();
  }
  abortController.value = new AbortController();
  requestClient
    .requestSSE('/system/stream-logging', undefined, {
      method: 'GET',
      signal: abortController.value.signal,
      onMessage: (content: string) => {
        sseRetryCount.value = 0;
        if (isPaused.value || isFiltering.value) return;
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const json = trimmed.slice(5).trim();
          if (!json) continue;
          try {
            const data = JSON.parse(json);
            const appendItems = (items: any[]) => {
              collectSources(items);
              for (const item of items) {
                const exists = logs.value.some(
                  (l) => l.time === item.time && l.text === item.text,
                );
                if (!exists) {
                  logs.value.push(item);
                }
              }
            };
            if (Array.isArray(data)) {
              appendItems(data);
            } else if (data && typeof data === 'object') {
              appendItems([data]);
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

function togglePause() {
  isPaused.value = !isPaused.value;
  if (isPaused.value) {
    stopSSE();
  } else if (isFiltering.value) {
    fetchSearch(searchPage.value);
  } else {
    sseRetryCount.value = 0;
    fetchLogs();
    startSSE();
  }
}

function clearLogs() {
  logs.value = [];
}

async function exportLogs() {
  loading.value = true;
  try {
    const blob: Blob = await exportSystemLogsApi({
      keyword: searchText.value.trim() || undefined,
      level: level.value || undefined,
      source: source.value || undefined,
    });
    if (blob.type.includes('application/json')) {
      const err = JSON.parse(await blob.text());
      message.error(err?.message || err?.msg || '导出失败');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-media-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('日志已导出');
  } catch (error: any) {
    message.error(error?.message || '导出失败');
  } finally {
    loading.value = false;
  }
}

// 筛选条件变化：进入/退出全量搜索模式
watch([level, source], () => {
  if (searchDebounce) {
    window.clearTimeout(searchDebounce);
  }
  if (isFiltering.value) {
    stopSSE();
    fetchSearch(1);
  } else {
    sseRetryCount.value = 0;
    fetchLogs();
    startSSE();
  }
});

// 关键词输入防抖：搜索模式刷新结果，清空后回到实时模式
watch(searchText, () => {
  if (searchDebounce) {
    window.clearTimeout(searchDebounce);
  }
  searchDebounce = window.setTimeout(() => {
    if (isFiltering.value) {
      stopSSE();
      fetchSearch(1);
    } else {
      sseRetryCount.value = 0;
      fetchLogs();
      startSSE();
    }
  }, 400);
});

onMounted(async () => {
  getSystemLogSourcesApi()
    .then((list) => {
      if (Array.isArray(list)) {
        for (const s of list) {
          if (s && !availableSources.value.includes(s)) {
            availableSources.value.push(s);
          }
        }
      }
    })
    .catch(() => {});
  sseRetryCount.value = 0;
  fetchLogs();
  startSSE();
});

onUnmounted(() => {
  if (searchDebounce) {
    window.clearTimeout(searchDebounce);
  }
  stopSSE();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="系统日志" subtitle="实时查看与全文搜索系统运行日志">
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
      />
      <NSelect
        v-model:value="level"
        :options="levelOptions"
        style="width: 120px"
        clearable
        placeholder="日志级别"
        size="small"
      />
      <NInput
        v-model:value="searchText"
        placeholder="搜索全部日志..."
        style="width: 220px"
        size="small"
        clearable
      >
        <template #prefix>
          <IconifyIcon icon="lucide:search" class="size-4" />
        </template>
      </NInput>
      <span class="text-xs" style="color: hsl(var(--muted-foreground))">
        <template v-if="isFiltering">
          {{ searchTruncated ? '≥' : '共' }} {{ searchTotal }} 条
          <template v-if="searchTruncated">（结果过多，仅展示前 20000 条）</template>
          <template v-else>（已搜索全部日志）</template>
        </template>
        <template v-else>共 {{ logs.length }} 条</template>
      </span>
      <NButton
        v-if="hasMore"
        size="tiny"
        secondary
        :loading="loading"
        @click="loadMore"
      >
        加载更多
      </NButton>
    </div>

    <NSpin :show="loading && logs.length === 0" class="mt-4">
      <div v-if="logs.length > 0" ref="listRef" class="log-list">
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
            v-for="(logItem, index) in logs"
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
  overflow: auto;
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  background-color: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.log-header,
.log-row {
  min-width: 640px;
}

.log-header {
  display: grid;
  grid-template-columns: 150px 72px 120px 1fr;
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
  grid-template-columns: 150px 72px 120px 1fr;
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
  min-width: 150px;
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
    grid-template-columns: 110px 64px 90px 1fr;
    gap: 4px;
    padding: 6px 8px;
    font-size: 12px;
  }

  .log-row {
    grid-template-columns: 110px 64px 90px 1fr;
    gap: 4px;
    padding: 4px 8px;
    font-size: 12px;
  }

  .h-time,
  .r-time {
    min-width: 110px;
  }

  .h-source,
  .r-source {
    min-width: 90px;
  }
}
</style>
