<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { LifecycleApi } from '#/api/modules/lifecycle';

import { computed, h, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { useMediaQuery } from '@vueuse/core';
import {
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NPagination,
  NSelect,
  NSpin,
  NTag,
  NTimeline,
  NTimelineItem,
  useMessage,
} from 'naive-ui';

import {
  getLifecycleDetailApi,
  getLifecycleEpisodesApi,
  getLifecycleEventsApi,
  getLifecycleListApi,
  getLifecycleStatsApi,
} from '#/api/modules/lifecycle';
import PageHeader from '#/components/page/PageHeader.vue';

defineOptions({ name: 'MediaLifecycle' });

const message = useMessage();
const isMobile = useMediaQuery('(max-width: 768px)');
const drawerWidth = computed(() => (isMobile.value ? '100%' : 560));
const rows = ref<LifecycleApi.Item[]>([]);
const stats = ref<LifecycleApi.Stats>({
  total: 0,
  by_status: {},
  by_stage: {},
});
const total = ref(0);
const loading = ref(false);
const detailLoading = ref(false);
const eventsLoading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const stage = ref<null | string>(null);
const status = ref<null | string>(null);
const mediaType = ref<null | string>(null);
const drawerVisible = ref(false);
const selected = ref<LifecycleApi.Item | null>(null);
const events = ref<LifecycleApi.Event[]>([]);
const episodes = ref<LifecycleApi.Item[]>([]);

const stageOptions = [
  { label: '已识别', value: 'identified' },
  { label: '已订阅', value: 'subscribed' },
  { label: '搜索中', value: 'searching' },
  { label: '下载排队', value: 'download_queued' },
  { label: '下载中', value: 'downloading' },
  { label: '下载完成', value: 'downloaded' },
  { label: '转移排队', value: 'transfer_queued' },
  { label: '转移中', value: 'transferring' },
  { label: '转移完成', value: 'transferred' },
  { label: '刮削排队', value: 'scrape_queued' },
  { label: '刮削中', value: 'scraping' },
  { label: '刮削完成', value: 'scraped' },
  { label: '已入库', value: 'in_library' },
];
const statusOptions = [
  { label: '排队中', value: 'queued' },
  { label: '进行中', value: 'running' },
  { label: '已完成', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '重试中', value: 'retrying' },
  { label: '阻塞', value: 'blocked' },
  { label: '已取消', value: 'cancelled' },
  { label: '死信', value: 'dead' },
];
const mediaTypeOptions = [
  { label: '电影', value: 'movie' },
  { label: '剧集', value: 'tv' },
  { label: '动漫', value: 'anime' },
];
const stageMap = new Map(stageOptions.map((item) => [item.value, item.label]));
const statusMap = new Map(
  statusOptions.map((item) => [item.value, item.label]),
);

const isSeries = computed(
  () =>
    selected.value?.media_type === 'tv' ||
    selected.value?.media_type === 'anime',
);

const latestTask = computed(() => {
  for (let index = events.value.length - 1; index >= 0; index -= 1) {
    const payload = events.value[index]?.payload || {};
    if (payload.queue || payload.task_id) return payload;
  }
  return {};
});

const statCards = computed(() => {
  const values = stats.value.by_status || {};
  return [
    { label: '全部', value: stats.value.total, tone: 'primary' },
    { label: '进行中', value: values.running || 0, tone: 'info' },
    { label: '排队中', value: values.queued || 0, tone: 'warning' },
    { label: '失败', value: values.failed || 0, tone: 'danger' },
    { label: '已完成', value: values.succeeded || 0, tone: 'success' },
  ];
});

const columns = computed<DataTableColumns<LifecycleApi.Item>>(() => [
  {
    key: 'title',
    title: '媒体',
    minWidth: 250,
    render: (row) =>
      h('div', { class: 'lifecycle-media' }, [
        h(
          'div',
          { class: 'lifecycle-poster' },
          row.poster
            ? h('img', { src: row.poster, alt: row.title || '' })
            : h('span', (row.title || '?').slice(0, 1)),
        ),
        h('div', { class: 'lifecycle-media-copy' }, [
          h('div', { class: 'lifecycle-title' }, row.title || row.identity_id),
          h(
            'div',
            { class: 'lifecycle-subtitle' },
            `${typeLabel(row.media_type)} · ${row.year || '年份未知'}${
              row.season || row.episode
                ? ` · S${String(row.season).padStart(2, '0')}E${String(row.episode).padStart(2, '0')}`
                : ''
            }`,
          ),
        ]),
      ]),
  },
  {
    key: 'stage',
    title: '当前阶段',
    width: 120,
    render: (row) =>
      h(
        NTag,
        { size: 'small', bordered: false, type: stageTagType(row.status) },
        { default: () => stageMap.get(row.stage) || row.stage },
      ),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) =>
      h(
        NTag,
        { size: 'small', bordered: false, type: statusTagType(row.status) },
        { default: () => statusMap.get(row.status) || row.status },
      ),
  },
  {
    key: 'provider',
    title: '元数据来源',
    width: 120,
    render: (row) => row.source_provider || '—',
  },
  {
    key: 'elapsed',
    title: '当前阶段耗时',
    width: 120,
    render: (row) => formatDuration(row.elapsed_seconds),
  },
  {
    key: 'retry',
    title: '重试',
    width: 72,
    render: (row) => `${row.retry_count}/5`,
  },
  {
    key: 'error',
    title: '最近错误',
    minWidth: 180,
    render: (row) =>
      h(
        'span',
        { class: row.last_error ? 'lifecycle-error' : 'lifecycle-muted' },
        row.last_error || '—',
      ),
  },
  {
    key: 'action',
    title: '',
    width: 52,
    render: () =>
      h(
        'button',
        { class: 'lifecycle-open', type: 'button' },
        {
          default: () =>
            h(IconifyIcon, { icon: 'lucide:arrow-up-right', class: 'size-4' }),
        },
      ),
  },
]);

async function fetchData() {
  loading.value = true;
  try {
    const [list, statData] = await Promise.all([
      getLifecycleListApi({
        page: page.value,
        pagenum: pageSize.value,
        keyword: keyword.value || undefined,
        stage: stage.value || undefined,
        status: status.value || undefined,
        media_type: mediaType.value || undefined,
      }),
      getLifecycleStatsApi(),
    ]);
    rows.value = list?.items || [];
    total.value = list?.total || 0;
    stats.value = statData || { total: 0, by_status: {}, by_stage: {} };
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '媒体生命周期加载失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  void fetchData();
}

async function openDetail(row: LifecycleApi.Item) {
  selected.value = row;
  drawerVisible.value = true;
  detailLoading.value = true;
  eventsLoading.value = true;
  events.value = [];
  try {
    const params = { season: row.season, episode: row.episode };
    const [detail, timeline, seriesRows] = await Promise.all([
      getLifecycleDetailApi(row.identity_id, params),
      getLifecycleEventsApi(row.identity_id, { ...params, limit: 200 }),
      getLifecycleEpisodesApi(row.identity_id),
    ]);
    if (detail) selected.value = detail;
    events.value = timeline || [];
    episodes.value = seriesRows || [];
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '生命周期详情加载失败');
  } finally {
    detailLoading.value = false;
    eventsLoading.value = false;
  }
}

async function selectEpisode(row: LifecycleApi.Item) {
  selected.value = row;
  eventsLoading.value = true;
  try {
    const params = { season: row.season, episode: row.episode };
    const [detail, timeline] = await Promise.all([
      getLifecycleDetailApi(row.identity_id, params),
      getLifecycleEventsApi(row.identity_id, { ...params, limit: 200 }),
    ]);
    if (detail) selected.value = detail;
    events.value = timeline || [];
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '生命周期详情加载失败');
  } finally {
    eventsLoading.value = false;
  }
}

function rowProps(row: LifecycleApi.Item) {
  return {
    style: 'cursor: pointer;',
    onClick: () => void openDetail(row),
  };
}

function typeLabel(value: string) {
  return mediaTypeOptions.find((item) => item.value === value)?.label || value;
}

function stageTagType(value: string) {
  if (value === 'succeeded') return 'success';
  if (value === 'failed' || value === 'dead') return 'error';
  if (value === 'queued' || value === 'retrying') return 'warning';
  if (value === 'running') return 'info';
  return 'default';
}

function statusTagType(value: string) {
  return stageTagType(value === 'succeeded' ? 'succeeded' : value);
}

function formatDuration(seconds: number) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTime(value: null | string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function onPageChange(value: number) {
  page.value = value;
  void fetchData();
}

onMounted(() => {
  void fetchData();
});
</script>

<template>
  <div class="lifecycle-page">
    <PageHeader
      title="媒体流转"
      subtitle="追踪媒体从识别、下载、转移到刮削入库的完整生命周期"
    >
      <template #actions>
        <NButton size="small" :loading="loading" @click="fetchData">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <div class="lifecycle-stats">
      <div
        v-for="card in statCards"
        :key="card.label"
        class="lifecycle-stat"
        :data-tone="card.tone"
      >
        <span class="lifecycle-stat-label">{{ card.label }}</span>
        <span class="lifecycle-stat-value">{{ card.value }}</span>
      </div>
    </div>

    <div class="lifecycle-toolbar">
      <NInput
        v-model:value="keyword"
        clearable
        placeholder="搜索标题或编号"
        style="width: 240px"
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <IconifyIcon icon="lucide:search" class="size-4 opacity-50" />
        </template>
      </NInput>
      <NSelect
        v-model:value="stage"
        :options="stageOptions"
        clearable
        placeholder="全部阶段"
        style="width: 150px"
        @update:value="handleSearch"
      />
      <NSelect
        v-model:value="status"
        :options="statusOptions"
        clearable
        placeholder="全部状态"
        style="width: 130px"
        @update:value="handleSearch"
      />
      <NSelect
        v-model:value="mediaType"
        :options="mediaTypeOptions"
        clearable
        placeholder="全部类型"
        style="width: 120px"
        @update:value="handleSearch"
      />
      <NButton type="primary" size="small" @click="handleSearch">查询</NButton>
    </div>

    <div class="lifecycle-table-wrap">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        :row-key="
          (row: LifecycleApi.Item) =>
            `${row.identity_id}:${row.season}:${row.episode}`
        "
        :scroll-x="1050"
        :bordered="false"
        :single-line="false"
        :row-props="rowProps"
        size="small"
      />
      <NEmpty v-if="!loading && rows.length === 0" description="暂无流转记录" />
    </div>

    <div class="lifecycle-footer">
      <span class="lifecycle-muted">共 {{ total }} 条</span>
      <NPagination
        v-model:page="page"
        :page-size="pageSize"
        :item-count="total"
        @update:page="onPageChange"
      />
    </div>

    <NDrawer
      v-model:show="drawerVisible"
      :width="drawerWidth"
      placement="right"
    >
      <NDrawerContent closable title="流转详情">
        <NSpin :show="detailLoading">
          <template v-if="selected">
            <div class="detail-heading">
              <div class="detail-poster">
                <img v-if="selected.poster" :src="selected.poster" alt="" />
                <IconifyIcon v-else icon="lucide:film" class="size-8" />
              </div>
              <div>
                <div class="detail-eyebrow">
                  {{ typeLabel(selected.media_type) }} ·
                  {{ selected.year || '年份未知' }}
                </div>
                <h3 class="detail-title">
                  {{ selected.title || selected.identity_id }}
                </h3>
                <div class="detail-meta">
                  {{ selected.source_provider || '未知来源' }} ·
                  {{ selected.content_profile || 'default' }}
                </div>
              </div>
            </div>

            <NDescriptions :column="isMobile ? 1 : 2" bordered size="small">
              <NDescriptionsItem label="当前阶段">
                <NTag
                  size="small"
                  :bordered="false"
                  :type="stageTagType(selected.status)"
                >
                  {{ stageMap.get(selected.stage) || selected.stage }}
                </NTag>
              </NDescriptionsItem>
              <NDescriptionsItem label="状态">
                <NTag
                  size="small"
                  :bordered="false"
                  :type="statusTagType(selected.status)"
                >
                  {{ statusMap.get(selected.status) || selected.status }}
                </NTag>
              </NDescriptionsItem>
              <NDescriptionsItem label="Trace ID">
                {{ selected.trace_id || '—' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="重试次数">
                {{ selected.retry_count }}/5
              </NDescriptionsItem>
              <NDescriptionsItem label="当前阶段耗时">
                {{ formatDuration(selected.elapsed_seconds) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="最近事件">
                {{ formatTime(selected.last_event_at) }}
              </NDescriptionsItem>
              <NDescriptionsItem label="当前队列">
                {{ latestTask.queue || '—' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="任务 ID">
                {{ latestTask.task_id || '—' }}
              </NDescriptionsItem>
              <NDescriptionsItem label="季 / 集" :span="2">
                {{ selected.season || 0 }} / {{ selected.episode || 0 }}
              </NDescriptionsItem>
              <NDescriptionsItem
                v-if="selected.last_error"
                label="最近错误"
                :span="2"
              >
                <span class="lifecycle-error">{{ selected.last_error }}</span>
              </NDescriptionsItem>
            </NDescriptions>

            <div v-if="isSeries && episodes.length > 1" class="episode-section">
              <div class="timeline-heading">
                <span>剧集矩阵</span>
                <span class="lifecycle-muted">{{ episodes.length }} 集</span>
              </div>
              <div class="episode-grid">
                <button
                  v-for="episode in episodes"
                  :key="`${episode.season}:${episode.episode}`"
                  type="button"
                  class="episode-cell"
                  :class="{
                    active:
                      episode.season === selected.season &&
                      episode.episode === selected.episode,
                  }"
                  @click="selectEpisode(episode)"
                >
                  <span class="episode-code">
                    S{{ String(episode.season).padStart(2, '0') }}E{{
                      String(episode.episode).padStart(2, '0')
                    }}
                  </span>
                  <span class="episode-status" :data-status="episode.status">
                    {{ statusMap.get(episode.status) || episode.status }}
                  </span>
                </button>
              </div>
            </div>

            <div class="timeline-heading">
              <span>生命周期时间线</span>
              <span class="lifecycle-muted">{{ events.length }} 个事件</span>
            </div>
            <NSpin :show="eventsLoading">
              <NTimeline v-if="events.length > 0">
                <NTimelineItem
                  v-for="event in events"
                  :key="event.id"
                  :type="statusTagType(event.status)"
                  :title="stageMap.get(event.stage) || event.stage"
                  :time="formatTime(event.occurred_at)"
                >
                  <div class="timeline-message">
                    {{ event.message || event.event_type }}
                  </div>
                </NTimelineItem>
              </NTimeline>
              <NEmpty v-else description="暂无时间线事件" />
            </NSpin>
          </template>
        </NSpin>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.lifecycle-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lifecycle-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}

.lifecycle-stat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.8rem 0.95rem;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.lifecycle-stat::after {
  position: absolute;
  right: 0.9rem;
  bottom: 0;
  left: 0.9rem;
  height: 2px;
  content: '';
  background: hsl(var(--primary));
}

.lifecycle-stat[data-tone='success']::after {
  background: hsl(var(--success));
}

.lifecycle-stat[data-tone='warning']::after {
  background: hsl(var(--warning));
}

.lifecycle-stat[data-tone='danger']::after {
  background: hsl(var(--destructive));
}

.lifecycle-stat[data-tone='info']::after {
  background: hsl(var(--info));
}

.lifecycle-stat-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.lifecycle-stat-value {
  font-size: 1.35rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--card-foreground));
}

.lifecycle-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.lifecycle-table-wrap {
  min-height: 240px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.lifecycle-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
}

.lifecycle-media {
  display: flex;
  gap: 0.65rem;
  align-items: center;
}

.lifecycle-poster {
  display: flex;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 46px;
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 4px;
}

.lifecycle-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lifecycle-media-copy {
  min-width: 0;
}

.lifecycle-title {
  overflow: hidden;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lifecycle-subtitle {
  margin-top: 2px;
  overflow: hidden;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lifecycle-error {
  color: hsl(var(--destructive));
}

.lifecycle-muted {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.lifecycle-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.lifecycle-open:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.detail-heading {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  padding-bottom: 1rem;
}

.detail-poster {
  display: flex;
  flex: 0 0 72px;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 96px;
  overflow: hidden;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 6px;
}

.detail-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-eyebrow {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.detail-title {
  margin: 0.15rem 0 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.detail-meta {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.episode-section {
  margin-top: 0.25rem;
}

.episode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 0.4rem;
}

.episode-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.4rem 0.5rem;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.episode-cell:hover,
.episode-cell.active {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.episode-code {
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--card-foreground));
}

.episode-status {
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
}

.episode-status[data-status='failed'],
.episode-status[data-status='dead'] {
  color: hsl(var(--destructive));
}

.episode-status[data-status='succeeded'] {
  color: hsl(var(--success));
}

.timeline-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 1.25rem 0 0.75rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.timeline-message {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 900px) {
  .lifecycle-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lifecycle-toolbar :deep(.n-input),
  .lifecycle-toolbar :deep(.n-select) {
    flex: 1 1 140px;
    width: auto !important;
  }
}

@media (max-width: 640px) {
  .lifecycle-stat {
    padding: 0.65rem 0.75rem;
  }

  .lifecycle-stat-value {
    font-size: 1.1rem;
  }

  .lifecycle-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
