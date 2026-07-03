<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSelect } from 'naive-ui';

import { getBrushEventsApi, getBrushTasksApi } from '#/api/modules/brush';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

interface EventRow {
  ID: number;
  TASK_NAME: string;
  TORRENT_NAME: string;
  ACTION: string;
  REASON: string;
  DOWNLOADER_NAME: string;
  SITE_NAME: string;
  CREATED_AT: string;
}

const loading = ref(false);
const rows = ref<EventRow[]>([]);
const total = ref(0);
const page = ref(1);
const filterTaskId = ref<number | undefined>(undefined);
const filterAction = ref<string | undefined>(undefined);
const tasks = ref<Array<{ label: string; value: number }>>([]);

async function fetchEvents() {
  loading.value = true;
  try {
    const res = await getBrushEventsApi({
      task_id: filterTaskId.value,
      action: filterAction.value,
      page: page.value,
      page_size: 50,
    });
    const data = (res as any)?.data || res || {};
    rows.value = data.rows || [];
    total.value = data.total || 0;
  } catch {
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadTasks() {
  const res = await getBrushTasksApi();
  const list = Array.isArray(res) ? res : (res as any)?.data || [];
  tasks.value = list.map((t: any) => ({
    label: t.name || `任务 ${t.id}`,
    value: t.id,
  }));
}

function onFilterChange() {
  page.value = 1;
  fetchEvents();
}

function loadMore() {
  page.value += 1;
  fetchEvents();
}

function indicatorClass(action: string) {
  if (action === 'delete') return 'indicator-delete';
  if (action === 'stop') return 'indicator-stop';
  return 'indicator-download';
}

function actionTag(action: string): [string, string] {
  if (action === 'delete') return ['删种', 'text-delete'];
  if (action === 'stop') return ['停种', 'text-stop'];
  return ['进种', 'text-download'];
}

onMounted(async () => {
  await loadTasks();
  fetchEvents();
});
</script>

<template>
  <div class="page-root">
    <PageHeader title="事件日志" subtitle="记录进种、删种、停种的触发原因">
      <template #actions>
        <NButton text size="small" @click="fetchEvents">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-3.5" />
          </template>
        </NButton>
      </template>
    </PageHeader>

    <div class="filter-bar">
      <NSelect
        v-model:value="filterTaskId"
        :options="[{ label: '全部任务', value: undefined }, ...tasks]"
        placeholder="按任务筛选"
        clearable
        size="small"
        class="filter-select"
        @update:value="onFilterChange()"
      />
      <NSelect
        v-model:value="filterAction"
        :options="[
          { label: '全部操作', value: undefined },
          { label: '删种', value: 'delete' },
          { label: '停种', value: 'stop' },
          { label: '进种', value: 'download' },
        ]"
        placeholder="按操作筛选"
        clearable
        size="small"
        class="filter-select"
        @update:value="onFilterChange()"
      />
      <span class="filter-summary">共 {{ total }} 条</span>
    </div>

    <div v-if="rows.length > 0" class="event-list">
      <div v-for="row in rows" :key="row.ID" class="event-card">
        <div class="event-indicator" :class="indicatorClass(row.ACTION)"></div>
        <div class="event-body">
          <div class="event-header">
            <span class="event-action" :class="actionTag(row.ACTION)[1]">
              {{ actionTag(row.ACTION)[0] }}
            </span>
            <span class="event-reason">{{ row.REASON }}</span>
            <span class="event-time">{{ row.CREATED_AT }}</span>
          </div>
          <div class="event-torrent" :title="row.TORRENT_NAME">
            {{ row.TORRENT_NAME }}
          </div>
          <div class="event-meta">
            <span class="meta-item">
              <IconifyIcon icon="lucide:zap" class="meta-icon" />
              {{ row.TASK_NAME }}
            </span>
            <span class="meta-sep">·</span>
            <span class="meta-item">{{ row.DOWNLOADER_NAME }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-item">{{ row.SITE_NAME }}</span>
          </div>
        </div>
      </div>

      <div v-if="rows.length < total" class="load-more">
        <NButton text size="small" @click="loadMore"> 加载更多 </NButton>
      </div>
    </div>

    <EmptyState
      v-else
      title="暂无事件日志"
      subtitle="刷流任务执行进种、删种或停种后将在此显示"
    />
  </div>
</template>

<style scoped>
.page-root {
  padding: 1rem;
}

/* ---- filter bar ---- */
.filter-bar {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  margin-bottom: 1rem;
}

.filter-select {
  width: 150px;
}

.filter-summary {
  margin-left: auto;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* ---- event list ---- */
.event-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.event-card {
  display: flex;
  gap: 0;
  border-bottom: 1px solid hsl(var(--border));
  transition: background 0.12s;
}

.event-card:first-child {
  border-top: 1px solid hsl(var(--border));
}

.event-card:hover {
  background: hsl(var(--accent) / 30%);
}

/* ---- left indicator bar ---- */
.event-indicator {
  flex-shrink: 0;
  width: 3px;
}

.indicator-delete {
  background: hsl(var(--destructive) / 60%);
}

.indicator-stop {
  background: hsl(var(--warning) / 60%);
}

.indicator-download {
  background: hsl(var(--success) / 60%);
}

/* ---- content ---- */
.event-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.625rem 0.75rem;
}

.event-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.event-action {
  flex-shrink: 0;
  padding: 0.0625rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 3px;
}

.text-delete {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
}

.text-stop {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 8%);
}

.text-download {
  color: hsl(var(--success));
  background: hsl(var(--success) / 8%);
}

.event-reason {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.event-time {
  flex-shrink: 0;
  margin-left: auto;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.event-torrent {
  padding-left: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.event-meta {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  padding-left: 0.125rem;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.meta-item {
  display: flex;
  gap: 0.1875rem;
  align-items: center;
}

.meta-icon {
  font-size: 0.625rem;
  opacity: 0.6;
}

.meta-sep {
  opacity: 0.35;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid hsl(var(--border));
}
</style>
