<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { LifecycleApi } from '#/api/modules/lifecycle';

import { computed, h, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { useMediaQuery } from '@vueuse/core';
import {
  NButton,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NPagination,
  NSelect,
  NSkeleton,
  NSpin,
  NTimeline,
  NTimelineItem,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  getLifecycleDetailApi,
  getLifecycleEpisodesApi,
  getLifecycleEventsApi,
  getLifecycleListApi,
  getLifecycleStatsApi,
} from '#/api/modules/lifecycle';
import MediaPoster from '#/components/media/MediaPoster.vue';
import PageHeader from '#/components/page/PageHeader.vue';

defineOptions({ name: 'MediaLifecycle' });

const message = useMessage();
const route = useRoute();
const isMobile = useMediaQuery('(max-width: 768px)');
const drawerWidth = computed(() => (isMobile.value ? '100%' : 640));
const rows = ref<LifecycleApi.Item[]>([]);
const stats = ref<LifecycleApi.Stats>({
  total: 0,
  by_status: {},
  by_stage: {},
});
const total = ref(0);
const loading = ref(false);
const loadError = ref('');
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
const activeEpisode = ref<null | { episode: number; season: number }>(null);
const events = ref<LifecycleApi.Event[]>([]);
const episodes = ref<LifecycleApi.Item[]>([]);
const activeSeason = ref<null | number>(null);

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
const lifecyclePhases = [
  {
    label: '识别',
    icon: 'lucide:scan-search',
    stages: ['identified', 'subscribed', 'searching'],
  },
  {
    label: '下载',
    icon: 'lucide:download',
    stages: ['download_queued', 'downloading', 'downloaded'],
  },
  {
    label: '转移',
    icon: 'lucide:folder-input',
    stages: ['transfer_queued', 'transferring', 'transferred'],
  },
  {
    label: '刮削',
    icon: 'lucide:sparkles',
    stages: ['scrape_queued', 'scraping', 'scraped'],
  },
  { label: '入库', icon: 'lucide:library', stages: ['in_library'] },
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
const hasFilters = computed(
  () =>
    Boolean(keyword.value.trim()) ||
    Boolean(stage.value) ||
    Boolean(status.value) ||
    Boolean(mediaType.value),
);
const activeFilterCount = computed(
  () =>
    [stage.value, status.value, mediaType.value].filter(Boolean).length +
    (keyword.value.trim() ? 1 : 0),
);
const latestTask = computed(() => {
  for (let index = events.value.length - 1; index >= 0; index -= 1) {
    const payload = events.value[index]?.payload || {};
    if (payload.queue || payload.task_id) return payload;
  }
  return {};
});
const currentPhaseIndex = computed(() =>
  selected.value ? phaseIndexForStage(selected.value.stage) : -1,
);
const stageProgress = computed(() =>
  selected.value ? itemProgress(selected.value) : 0,
);
const seasonOptions = computed(() =>
  [...new Set(episodes.value.map((item) => item.season || 0))].sort(
    (left, right) => left - right,
  ),
);
const visibleEpisodes = computed(() =>
  activeSeason.value === null
    ? episodes.value
    : episodes.value.filter(
        (item) => (item.season || 0) === activeSeason.value,
      ),
);
const completedEpisodes = computed(
  () =>
    visibleEpisodes.value.filter(
      (item) => item.stage === 'in_library' && item.status === 'succeeded',
    ).length,
);
const rangeStart = computed(() =>
  total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1,
);
const rangeEnd = computed(() =>
  Math.min(page.value * pageSize.value, total.value),
);
const statCards = computed(() => {
  const values = stats.value.by_status || {};
  return [
    {
      label: '全部任务',
      value: stats.value.total,
      tone: 'primary',
      status: null,
      icon: 'lucide:layers-3',
      note: '完整生命周期',
    },
    {
      label: '进行中',
      value: values.running || 0,
      tone: 'info',
      status: 'running',
      icon: 'lucide:play',
      note: '正在自动流转',
    },
    {
      label: '排队中',
      value: values.queued || 0,
      tone: 'warning',
      status: 'queued',
      icon: 'lucide:hourglass',
      note: '等待队列调度',
    },
    {
      label: '失败',
      value: values.failed || 0,
      tone: 'danger',
      status: 'failed',
      icon: 'lucide:alert-triangle',
      note: '需要检查处理',
    },
    {
      label: '已完成',
      value: values.succeeded || 0,
      tone: 'success',
      status: 'succeeded',
      icon: 'lucide:check',
      note: '已完成入库',
    },
  ];
});

const columns = computed<DataTableColumns<LifecycleApi.Item>>(() => {
  const items: DataTableColumns<LifecycleApi.Item> = [
    {
      key: 'title',
      title: '媒体',
      minWidth: 320,
      maxWidth: 420,
      render: (row) =>
        h('div', { class: 'lifecycle-media' }, [
          h(
            'div',
            {
              class: 'lifecycle-poster',
              style: {
                display: 'flex',
                flex: '0 0 38px',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '52px',
                overflow: 'hidden',
              },
            },
            row.poster
              ? h(MediaPoster, {
                  src: row.poster,
                  contentProfile: row.content_profile,
                  alt: row.title || '',
                  lazy: true,
                  style: {
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  },
                })
              : h('span', (row.title || '?').slice(0, 1)),
          ),
          h('div', { class: 'lifecycle-media-copy' }, [
            h(
              NTooltip,
              { trigger: 'hover', placement: 'top-start', delay: 250 },
              {
                trigger: () =>
                  h(
                    'div',
                    {
                      class: 'lifecycle-title',
                      title: row.title || row.identity_id,
                    },
                    row.title || row.identity_id,
                  ),
                default: () =>
                  h(
                    'div',
                    { class: 'lifecycle-title-tooltip' },
                    row.title || row.identity_id,
                  ),
              },
            ),
            h(
              'div',
              { class: 'lifecycle-subtitle' },
              `${typeLabel(row.media_type)} · ${row.year || '年份未知'}${
                row.episode_count > 1
                  ? ` · ${row.episode_count} 集 · 订阅 ${row.subscribed_episodes || 0} · 入库 ${row.in_library_episodes}`
                  : row.season || row.episode
                    ? ` · S${String(row.season).padStart(2, '0')}E${String(row.episode).padStart(2, '0')}`
                    : ''
              }`,
            ),
            h('div', { class: 'lifecycle-identity' }, row.identity_id),
          ]),
        ]),
    },
    {
      key: 'provider',
      title: '元数据来源',
      width: 130,
      render: (row) =>
        h('div', { class: 'provider-cell' }, [
          h('span', (row.source_provider || '未知来源').toUpperCase()),
          h('small', row.content_profile || 'default'),
        ]),
    },
    {
      key: 'stage',
      title: '当前阶段',
      width: 154,
      render: (row) => {
        const phaseIndex = phaseIndexForStage(row.stage);
        const phase = lifecyclePhases[phaseIndex];
        return h('div', { class: 'stage-cell' }, [
          h('div', { class: 'stage-line' }, [
            h(
              'span',
              { class: 'stage-index' },
              String(Math.max(1, phaseIndex + 1)).padStart(2, '0'),
            ),
            h(
              'span',
              {
                class: 'stage-badge',
                'data-tone': stageTagType(row.status),
              },
              phase?.label || stageMap.get(row.stage) || row.stage,
            ),
          ]),
          h(
            'div',
            {
              class: 'mini-progress',
              'aria-label': `生命周期进度 ${itemProgress(row)}%`,
            },
            [h('span', { style: { width: `${itemProgress(row)}%` } })],
          ),
        ]);
      },
    },
    {
      key: 'status',
      title: '入库状态',
      width: 106,
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'elapsed',
      title: '阶段耗时',
      width: 108,
      render: (row) =>
        h('div', { class: 'duration-cell' }, [
          h('span', formatDuration(row.elapsed_seconds)),
          h('small', `最近 ${formatTime(row.last_event_at)}`),
        ]),
    },
    {
      key: 'error',
      title: '最近错误',
      minWidth: 180,
      maxWidth: 260,
      render: (row) =>
        h(
          'span',
          {
            class: row.last_error
              ? 'lifecycle-error error-text'
              : 'lifecycle-muted',
            title: row.last_error || undefined,
          },
          row.last_error || '—',
        ),
    },
    {
      key: 'action',
      title: '',
      width: 52,
      render: () =>
        h(
          'span',
          { class: 'lifecycle-open', 'aria-hidden': 'true' },
          h(IconifyIcon, { icon: 'lucide:arrow-up-right', class: 'size-4' }),
        ),
    },
  ];
  const order = [
    'title',
    'provider',
    'stage',
    'status',
    'elapsed',
    'error',
    'action',
  ];
  return [...items].sort(
    (left, right) =>
      order.indexOf(String((left as any).key)) -
      order.indexOf(String((right as any).key)),
  );
});

async function fetchData() {
  loading.value = true;
  loadError.value = '';
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
    loadError.value =
      error?.response?.data?.detail || '媒体生命周期加载失败，请稍后重试';
    message.error(loadError.value);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  page.value = 1;
  void fetchData();
}

function clearFilters() {
  keyword.value = '';
  stage.value = null;
  status.value = null;
  mediaType.value = null;
  handleSearch();
}

function selectStat(value: null | string) {
  status.value = value !== null && status.value === value ? null : value;
  handleSearch();
}

async function openDetail(row: LifecycleApi.Item) {
  selected.value = row;
  activeSeason.value = row.season || null;
  episodes.value = [];
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
    if (detail && (seriesRows?.length || 0) <= 1) selected.value = detail;
    events.value = timeline || [];
    episodes.value = seriesRows || [];
    if (activeSeason.value === null && seasonOptions.value.length > 0) {
      activeSeason.value = seasonOptions.value[0] ?? null;
    }
    const firstPending =
      episodes.value.find((item) => item.missing) ||
      episodes.value.find((item) => item.stage !== 'in_library') ||
      episodes.value[0];
    if (firstPending) {
      activeEpisode.value = {
        season: firstPending.season || 0,
        episode: firstPending.episode || 0,
      };
    }
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '生命周期详情加载失败');
  } finally {
    detailLoading.value = false;
    eventsLoading.value = false;
  }
}

async function selectEpisode(row: LifecycleApi.Item) {
  activeEpisode.value = { season: row.season || 0, episode: row.episode || 0 };
  activeSeason.value = row.season || null;
  if (row.missing || row.inferred) {
    events.value = [];
    eventsLoading.value = false;
    return;
  }
  eventsLoading.value = true;
  try {
    const params = { season: row.season, episode: row.episode };
    const [detail, timeline] = await Promise.all([
      getLifecycleDetailApi(row.identity_id, params),
      getLifecycleEventsApi(row.identity_id, { ...params, limit: 200 }),
    ]);
    if (detail && episodes.value.length <= 1) selected.value = detail;
    events.value = timeline || [];
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '生命周期详情加载失败');
  } finally {
    eventsLoading.value = false;
  }
}

function selectSeason(season: number) {
  activeSeason.value = season;
  if (activeEpisode.value?.season === season) return;
  const firstEpisode = episodes.value.find(
    (item) => (item.season || 0) === season,
  );
  if (firstEpisode) void selectEpisode(firstEpisode);
}

function isSelectedRow(row: LifecycleApi.Item) {
  return (
    drawerVisible.value &&
    selected.value?.identity_id === row.identity_id &&
    selected.value.season === row.season &&
    selected.value.episode === row.episode
  );
}

function rowProps(row: LifecycleApi.Item) {
  return {
    class: isSelectedRow(row) ? 'is-selected' : '',
    tabindex: 0,
    'aria-label': `查看 ${row.title || row.identity_id} 流转详情`,
    onClick: () => void openDetail(row),
    onKeydown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void openDetail(row);
      }
    },
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

function statusTone(value: string) {
  if (value === 'succeeded') return 'succeeded';
  if (value === 'failed' || value === 'dead') return 'failed';
  if (value === 'queued' || value === 'retrying') return 'queued';
  if (value === 'running') return 'running';
  if (value === 'blocked') return 'blocked';
  return 'default';
}

function renderStatusBadge(value: string) {
  return h(
    'span',
    { class: 'status-badge', 'data-status': statusTone(value) },
    [
      h('span', { class: 'status-dot', 'aria-hidden': 'true' }),
      statusMap.get(value) || value,
    ],
  );
}

function phaseIndexForStage(value: string) {
  return lifecyclePhases.findIndex((phase) => phase.stages.includes(value));
}

function phaseState(index: number) {
  const current = currentPhaseIndex.value;
  if (
    selected.value?.stage === 'in_library' &&
    selected.value.status === 'succeeded'
  ) {
    return 'complete';
  }
  if (index < current) return 'complete';
  if (index === current) {
    if (
      selected.value?.status === 'failed' ||
      selected.value?.status === 'dead'
    )
      return 'failed';
    if (selected.value?.status === 'cancelled') return 'paused';
    return 'current';
  }
  return 'upcoming';
}

function itemProgress(item: LifecycleApi.Item) {
  if (item.stage === 'in_library' && item.status === 'succeeded') return 100;
  return Math.max(0, Math.min(100, Math.round(item.progress || 0)));
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

async function openIdentityFromQuery() {
  const identity = String(route.query.identity_id || '');
  if (!identity) return;
  try {
    let detail = await getLifecycleDetailApi(identity);
    if (!detail) {
      const list = await getLifecycleEpisodesApi(identity);
      detail = list?.[0] || null;
    }
    if (detail) await openDetail(detail);
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '生命周期详情加载失败');
  }
}

onMounted(async () => {
  if (route.query.keyword) keyword.value = String(route.query.keyword);
  await fetchData();
  await openIdentityFromQuery();
});

watch(
  () => route.query.identity_id,
  (identity) => {
    if (identity) void openIdentityFromQuery();
  },
);
</script>

<template>
  <div class="lifecycle-page">
    <PageHeader
      title="媒体流转"
      subtitle="集中追踪识别、下载、转移与入库状态，快速定位需要介入的任务"
    >
      <template #actions>
        <NButton :loading="loading" @click="fetchData">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          刷新状态
        </NButton>
      </template>
    </PageHeader>

    <section class="lifecycle-stats" aria-label="流转状态统计">
      <button
        v-for="(card, index) in statCards"
        :key="card.label"
        type="button"
        class="lifecycle-stat"
        :class="{ active: status === card.status }"
        :data-tone="card.tone"
        :aria-pressed="status === card.status"
        @click="selectStat(card.status)"
      >
        <span class="stat-label">
          <span>{{ card.label }}</span>
          <span class="stat-index">{{
            String(index + 1).padStart(2, '0')
          }}</span>
        </span>
        <span class="stat-main">
          <span class="stat-icon">
            <IconifyIcon :icon="card.icon" class="size-4" />
          </span>
          <strong>{{ card.value }}</strong>
          <span class="stat-unit">项</span>
        </span>
        <span class="stat-note">
          {{ card.note }}
          <IconifyIcon icon="lucide:arrow-right" class="size-3" />
        </span>
      </button>
    </section>

    <section class="lifecycle-workspace" aria-labelledby="records-title">
      <div class="section-heading">
        <div class="section-title-group">
          <h2 id="records-title">流转记录</h2>
          <span class="result-count">{{ total }} 条记录</span>
        </div>
        <span v-if="hasFilters" class="filter-result">
          <IconifyIcon icon="lucide:list-filter" class="size-3.5" />
          已应用 {{ activeFilterCount }} 项筛选
        </span>
      </div>

      <div class="lifecycle-toolbar">
        <div class="toolbar-heading">
          <span class="toolbar-title">
            <IconifyIcon icon="lucide:sliders-horizontal" class="size-4" />
            筛选条件
          </span>
          <button
            v-if="hasFilters"
            type="button"
            class="clear-filter"
            @click="clearFilters"
          >
            <IconifyIcon icon="lucide:rotate-ccw" class="size-3.5" />
            重置筛选
          </button>
        </div>
        <div class="filter-controls">
          <NInput
            v-model:value="keyword"
            class="filter-search"
            clearable
            placeholder="搜索标题或媒体编号"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:search" class="size-4 opacity-50" />
            </template>
          </NInput>
          <NSelect
            v-model:value="stage"
            class="filter-select"
            :options="stageOptions"
            clearable
            placeholder="全部阶段"
            @update:value="handleSearch"
          />
          <NSelect
            v-model:value="status"
            class="filter-select"
            :options="statusOptions"
            clearable
            placeholder="全部状态"
            @update:value="handleSearch"
          />
          <NSelect
            v-model:value="mediaType"
            class="filter-select"
            :options="mediaTypeOptions"
            clearable
            placeholder="全部类型"
            @update:value="handleSearch"
          />
          <NButton
            class="filter-submit"
            type="primary"
            :loading="loading"
            @click="handleSearch"
          >
            <template #icon>
              <IconifyIcon icon="lucide:search" class="size-4" />
            </template>
            查询
          </NButton>
        </div>
      </div>

      <div v-if="loadError" class="load-error" role="alert">
        <span class="error-state-icon">
          <IconifyIcon icon="lucide:circle-alert" class="size-5" />
        </span>
        <div>
          <strong>暂时无法加载流转记录</strong>
          <p>{{ loadError }}</p>
        </div>
        <NButton size="small" :loading="loading" @click="fetchData">
          重新加载
        </NButton>
      </div>

      <div v-if="isMobile" class="lifecycle-mobile-list">
        <div
          v-if="loading && rows.length === 0 && !loadError"
          class="mobile-skeletons"
          aria-busy="true"
          aria-label="正在加载媒体流转"
        >
          <NSkeleton v-for="index in 4" :key="index" height="150px" />
        </div>
        <template v-else>
          <button
            v-for="row in rows"
            :key="`${row.identity_id}:${row.season}:${row.episode}`"
            type="button"
            class="lifecycle-mobile-card"
            :class="{ active: isSelectedRow(row) }"
            @click="openDetail(row)"
          >
            <div class="mobile-card-head">
              <div class="lifecycle-poster mobile-poster">
                <MediaPoster
                  v-if="row.poster"
                  :src="row.poster"
                  :content-profile="row.content_profile"
                  :alt="row.title || ''"
                  style="
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                  "
                />
                <span v-else>{{ (row.title || '?').slice(0, 1) }}</span>
              </div>
              <div class="mobile-card-copy">
                <div class="lifecycle-title">
                  {{ row.title || row.identity_id }}
                </div>
                <div class="lifecycle-subtitle">
                  {{ typeLabel(row.media_type) }} ·
                  {{ row.year || '年份未知' }}
                  <template v-if="row.episode_count > 1">
                    · {{ row.episode_count }} 集 · 订阅
                    {{ row.subscribed_episodes || 0 }} · 入库
                    {{ row.in_library_episodes }}
                  </template>
                  <template v-else-if="row.season || row.episode">
                    · S{{ String(row.season).padStart(2, '0') }}E{{
                      String(row.episode).padStart(2, '0')
                    }}
                  </template>
                </div>
                <div class="mobile-card-tags">
                  <span
                    class="stage-badge"
                    :data-tone="stageTagType(row.status)"
                  >
                    {{ stageMap.get(row.stage) || row.stage }}
                  </span>
                  <span
                    class="status-badge"
                    :data-status="statusTone(row.status)"
                  >
                    <span class="status-dot" aria-hidden="true"></span>
                    {{ statusMap.get(row.status) || row.status }}
                  </span>
                </div>
              </div>
              <span class="mobile-card-arrow">
                <IconifyIcon icon="lucide:chevron-right" class="size-4" />
              </span>
            </div>
            <div class="mobile-progress">
              <span :style="{ width: `${itemProgress(row)}%` }"></span>
            </div>
            <div class="mobile-card-foot">
              <span>
                <IconifyIcon icon="lucide:database" class="size-3.5" />
                {{ row.source_provider || '未知来源' }}
              </span>
              <span>
                <IconifyIcon icon="lucide:timer" class="size-3.5" />
                {{ formatDuration(row.elapsed_seconds) }}
              </span>
              <span>重试 {{ row.retry_count }}/5</span>
            </div>
            <div v-if="row.last_error" class="mobile-card-error">
              <IconifyIcon icon="lucide:circle-alert" class="size-3.5" />
              <span>{{ row.last_error }}</span>
            </div>
          </button>
        </template>
      </div>

      <div v-else class="lifecycle-table-wrap">
        <div
          v-if="loading && rows.length === 0 && !loadError"
          class="table-skeletons"
          aria-busy="true"
          aria-label="正在加载媒体流转"
        >
          <NSkeleton v-for="index in 6" :key="index" height="74px" />
        </div>
        <NDataTable
          v-else-if="rows.length > 0 || loading"
          :columns="columns"
          :data="rows"
          :loading="loading"
          :row-key="
            (row: LifecycleApi.Item) =>
              `${row.identity_id}:${row.season}:${row.episode}`
          "
          :scroll-x="1080"
          :bordered="false"
          :single-line="false"
          :row-props="rowProps"
          size="small"
        />
      </div>

      <div
        v-if="!loading && rows.length === 0 && !loadError"
        class="lifecycle-empty"
      >
        <NEmpty description="未找到流转记录">
          <template #icon>
            <IconifyIcon icon="lucide:inbox" class="size-10" />
          </template>
          <template #extra>
            <p class="empty-description">
              调整关键词或筛选条件，查看其他媒体任务。
            </p>
            <NButton v-if="hasFilters" size="small" @click="clearFilters">
              清除全部筛选
            </NButton>
          </template>
        </NEmpty>
      </div>

      <div v-if="total > 0" class="lifecycle-footer">
        <span class="lifecycle-muted">
          显示 {{ rangeStart }}–{{ rangeEnd }}，共 {{ total }} 条
        </span>
        <NPagination
          v-model:page="page"
          :page-size="pageSize"
          :item-count="total"
          :page-slot="isMobile ? 5 : 7"
          @update:page="onPageChange"
        />
      </div>
    </section>

    <NDrawer
      v-model:show="drawerVisible"
      :width="drawerWidth"
      placement="right"
    >
      <NDrawerContent class="lifecycle-drawer" closable>
        <template #header>
          <div class="drawer-heading">
            <span>LIFECYCLE INSPECTOR</span>
            <strong>流转详情</strong>
          </div>
        </template>
        <NSpin :show="detailLoading">
          <template v-if="selected">
            <section class="detail-hero">
              <div class="detail-heading">
                <div class="detail-poster">
                  <MediaPoster
                    v-if="selected.poster"
                    :src="selected.poster"
                    :content-profile="selected.content_profile"
                    :alt="selected.title || ''"
                    style="
                      display: block;
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                    "
                  />
                  <IconifyIcon v-else icon="lucide:film" class="size-8" />
                </div>
                <div class="detail-copy">
                  <div class="detail-eyebrow">
                    {{ typeLabel(selected.media_type) }} ·
                    {{ selected.year || '年份未知' }}
                    <span>{{ selected.identity_id }}</span>
                  </div>
                  <h2 class="detail-title">
                    {{ selected.title || selected.identity_id }}
                  </h2>
                  <div class="detail-meta">
                    <span>{{ selected.source_provider || '未知来源' }}</span>
                    <span>{{ selected.content_profile || 'default' }}</span>
                  </div>
                </div>
              </div>

              <div class="current-stage-row">
                <div>
                  <span class="stage-caption">CURRENT STAGE / 当前阶段</span>
                  <div class="current-stage">
                    {{ stageMap.get(selected.stage) || selected.stage }}
                  </div>
                </div>
                <span
                  class="status-badge"
                  :data-status="statusTone(selected.status)"
                >
                  <span class="status-dot" aria-hidden="true"></span>
                  {{ statusMap.get(selected.status) || selected.status }}
                </span>
              </div>

              <div class="detail-progress-head">
                <span>生命周期进度</span>
                <strong>{{ stageProgress }}%</strong>
              </div>
              <div
                class="detail-progress"
                role="progressbar"
                :aria-valuenow="stageProgress"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span :style="{ width: `${stageProgress}%` }"></span>
              </div>

              <ol class="stage-stepper" aria-label="媒体生命周期阶段">
                <li
                  v-for="(phase, index) in lifecyclePhases"
                  :key="phase.label"
                  :class="phaseState(index)"
                >
                  <span class="step-marker">
                    <IconifyIcon
                      v-if="phaseState(index) === 'complete'"
                      icon="lucide:check"
                      class="size-3.5"
                    />
                    <IconifyIcon
                      v-else-if="phaseState(index) === 'failed'"
                      icon="lucide:x"
                      class="size-3.5"
                    />
                    <IconifyIcon v-else :icon="phase.icon" class="size-3.5" />
                  </span>
                  <span class="step-label">{{ phase.label }}</span>
                </li>
              </ol>
            </section>

            <section class="detail-section" aria-labelledby="archive-title">
              <div class="detail-section-heading">
                <h3 id="archive-title">任务档案</h3>
                <span>TRACE ARCHIVE</span>
              </div>
              <div class="archive-grid">
                <div class="archive-item full">
                  <span class="archive-icon">
                    <IconifyIcon icon="lucide:fingerprint" class="size-4" />
                  </span>
                  <div>
                    <span class="archive-label">Trace ID</span>
                    <code :title="selected.trace_id || '—'">
                      {{ selected.trace_id || '—' }}
                    </code>
                  </div>
                </div>
                <div class="archive-item">
                  <span class="archive-icon">
                    <IconifyIcon icon="lucide:list-tree" class="size-4" />
                  </span>
                  <div>
                    <span class="archive-label">当前队列</span>
                    <code :title="latestTask.queue || '—'">
                      {{ latestTask.queue || '—' }}
                    </code>
                  </div>
                </div>
                <div class="archive-item">
                  <span class="archive-icon">
                    <IconifyIcon icon="lucide:hash" class="size-4" />
                  </span>
                  <div>
                    <span class="archive-label">任务 ID</span>
                    <code :title="latestTask.task_id || '—'">
                      {{ latestTask.task_id || '—' }}
                    </code>
                  </div>
                </div>
              </div>

              <dl class="metadata-grid">
                <div>
                  <dt>重试次数</dt>
                  <dd>{{ selected.retry_count }} / 5</dd>
                </div>
                <div>
                  <dt>当前阶段耗时</dt>
                  <dd>{{ formatDuration(selected.elapsed_seconds) }}</dd>
                </div>
                <div>
                  <dt>最近事件</dt>
                  <dd>{{ formatTime(selected.last_event_at) }}</dd>
                </div>
                <div>
                  <dt>季 / 集</dt>
                  <dd>
                    {{
                      selected.episode_count > 1
                        ? `第 ${selected.season || 1} 季`
                        : `${selected.season || 0} / ${selected.episode || 0}`
                    }}
                  </dd>
                </div>
                <div>
                  <dt>总集数</dt>
                  <dd>{{ selected.episode_count }} 集</dd>
                </div>
                <div>
                  <dt>订阅完成</dt>
                  <dd>
                    {{ selected.subscribed_episodes || 0 }} /
                    {{ selected.episode_count }} 集
                  </dd>
                </div>
                <div>
                  <dt>已入库</dt>
                  <dd>
                    {{ selected.in_library_episodes }} /
                    {{ selected.episode_count }} 集
                  </dd>
                </div>
              </dl>

              <div v-if="selected.last_error" class="error-banner">
                <IconifyIcon icon="lucide:circle-alert" class="size-5" />
                <div>
                  <strong>最近一次异常</strong>
                  <p>{{ selected.last_error }}</p>
                </div>
              </div>
            </section>

            <section
              v-if="isSeries && episodes.length > 1"
              class="detail-section"
              aria-labelledby="matrix-title"
            >
              <div class="detail-section-heading">
                <h3 id="matrix-title">剧集矩阵</h3>
                <span>{{ episodes.length }} EPISODES</span>
              </div>
              <div
                v-if="seasonOptions.length > 1"
                class="season-tabs"
                role="tablist"
                aria-label="选择季度"
              >
                <button
                  v-for="season in seasonOptions"
                  :key="season"
                  type="button"
                  role="tab"
                  :aria-selected="activeSeason === season"
                  :class="{ active: activeSeason === season }"
                  @click="selectSeason(season)"
                >
                  第 {{ season }} 季
                </button>
              </div>
              <div class="matrix-summary">
                <span>第 {{ activeSeason || 0 }} 季 · 单集流转状态</span>
                <strong>
                  {{ completedEpisodes }} / {{ visibleEpisodes.length }} 已入库
                </strong>
              </div>
              <div class="episode-grid" role="group" aria-label="单集进度">
                <button
                  v-for="episode in visibleEpisodes"
                  :key="`${episode.season}:${episode.episode}`"
                  type="button"
                  class="episode-cell"
                  :class="{
                    active:
                      episode.season === activeEpisode?.season &&
                      episode.episode === activeEpisode?.episode,
                  }"
                  :data-status="
                    episode.missing
                      ? 'missing'
                      : episode.inferred
                        ? 'inferred'
                        : statusTone(episode.status)
                  "
                  :aria-label="`S${String(episode.season).padStart(2, '0')}E${String(episode.episode).padStart(2, '0')}，${episode.missing ? '未下载' : episode.inferred ? '已订阅' : statusMap.get(episode.status) || episode.status}`"
                  :aria-pressed="
                    episode.season === activeEpisode?.season &&
                    episode.episode === activeEpisode?.episode
                  "
                  @click="selectEpisode(episode)"
                >
                  <span class="episode-code">
                    E{{ String(episode.episode).padStart(2, '0') }}
                  </span>
                  <span class="episode-status">
                    {{
                      episode.missing
                        ? '未下载'
                        : episode.inferred
                          ? '已订阅'
                          : statusMap.get(episode.status) || episode.status
                    }}
                  </span>
                </button>
              </div>
              <div class="matrix-legend" aria-label="剧集状态图例">
                <span data-status="succeeded">已完成</span>
                <span data-status="running">进行中</span>
                <span data-status="queued">排队中</span>
                <span data-status="missing">未下载</span>
                <span data-status="inferred">已订阅</span>
                <span data-status="failed">异常</span>
              </div>
            </section>

            <section class="detail-section" aria-labelledby="timeline-title">
              <div class="detail-section-heading">
                <h3 id="timeline-title">生命周期时间线</h3>
                <span>{{ events.length }} EVENTS</span>
              </div>
              <div v-if="isSeries" class="episode-context">
                正在查看
                <strong>
                  S{{ String(selected.season).padStart(2, '0') }}E{{
                    String(selected.episode).padStart(2, '0')
                  }}
                </strong>
                的独立流转轨迹
              </div>
              <NSpin :show="eventsLoading">
                <div
                  v-if="eventsLoading && events.length === 0"
                  class="timeline-skeletons"
                >
                  <NSkeleton v-for="index in 3" :key="index" height="58px" />
                </div>
                <NTimeline v-else-if="events.length > 0" class="event-timeline">
                  <NTimelineItem
                    v-for="event in events"
                    :key="event.id"
                    :type="statusTagType(event.status)"
                    :time="formatTime(event.occurred_at)"
                  >
                    <template #header>
                      <div class="timeline-event-head">
                        <span>{{
                          stageMap.get(event.stage) || event.stage
                        }}</span>
                        <span
                          class="status-badge compact"
                          :data-status="statusTone(event.status)"
                        >
                          <span class="status-dot" aria-hidden="true"></span>
                          {{ statusMap.get(event.status) || event.status }}
                        </span>
                      </div>
                    </template>
                    <div class="timeline-message">
                      {{ event.message || event.event_type }}
                    </div>
                    <div class="timeline-event-type">
                      {{ event.event_type }}
                    </div>
                  </NTimelineItem>
                </NTimeline>
                <NEmpty
                  v-else
                  class="timeline-empty"
                  description="暂无时间线事件"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:history" class="size-8" />
                  </template>
                </NEmpty>
              </NSpin>
            </section>
          </template>
        </NSpin>
        <template v-if="selected" #footer>
          <div class="drawer-footer">
            <span>{{ selected.identity_id }}</span>
            <span>更新于 {{ formatTime(selected.last_event_at) }}</span>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.lifecycle-page {
  --stat-color: hsl(var(--primary));

  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 16px;
  animation: page-reveal 0.4s ease-out both;
}

.lifecycle-heading {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0 0.5rem;
}

.heading-copy {
  min-width: 0;
}

.heading-eyebrow {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.4rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: hsl(var(--primary));
  letter-spacing: 0.14em;
}

.eyebrow-line {
  width: 1.25rem;
  height: 1px;
  background: hsl(var(--primary));
}

.lifecycle-heading h1 {
  margin: 0;
  font-size: 1.65rem;
  font-weight: 650;
  line-height: 1.3;
  color: hsl(var(--foreground));
  letter-spacing: -0.025em;
}

.lifecycle-heading p {
  margin: 0.4rem 0 0;
  font-size: 0.8rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.heading-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.75rem;
  align-items: center;
}

.monitor-label {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  padding-right: 0.75rem;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
  border-right: 1px solid hsl(var(--border));
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
  min-width: 0;
  min-height: 126px;
  padding: 0.9rem 1rem 0.85rem;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 3%);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.lifecycle-stat::after {
  position: absolute;
  right: calc(100% - 1rem);
  bottom: -1px;
  left: 1rem;
  height: 2px;
  content: '';
  background: var(--stat-color);
  border-radius: 2px;
  transition: right 0.25s ease;
}

.lifecycle-stat:hover {
  border-color: hsl(var(--primary) / 45%);
  transform: translateY(-1px);
}

.lifecycle-stat:hover::after,
.lifecycle-stat.active::after {
  right: 1rem;
}

.lifecycle-stat.active {
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 65%);
}

.lifecycle-stat:focus-visible,
.lifecycle-mobile-card:focus-visible,
.episode-cell:focus-visible,
.season-tabs button:focus-visible,
.clear-filter:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

.lifecycle-stat[data-tone='info'] {
  --stat-color: hsl(var(--primary));
}

.lifecycle-stat[data-tone='warning'] {
  --stat-color: hsl(var(--warning));
}

.lifecycle-stat[data-tone='danger'] {
  --stat-color: hsl(var(--destructive));
}

.lifecycle-stat[data-tone='success'] {
  --stat-color: hsl(var(--success));
}

.stat-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.72rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.stat-index {
  font-family: monospace;
  font-size: 0.6rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

.stat-main {
  display: flex;
  gap: 0.45rem;
  align-items: baseline;
  margin-top: 0.65rem;
}

.stat-main strong {
  font-size: 1.75rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: hsl(var(--foreground));
  letter-spacing: -0.04em;
}

.stat-icon {
  display: inline-flex;
  align-items: center;
  align-self: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  margin-right: 0.15rem;
  color: var(--stat-color);
  background: hsl(var(--accent));
  border-radius: calc(var(--radius) - 2px);
}

.stat-unit {
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
}

.stat-note {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.65rem;
  margin-top: auto;
  overflow: hidden;
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.stat-note .iconify {
  flex: 0 0 auto;
  color: var(--stat-color);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.lifecycle-stat:hover .stat-note .iconify,
.lifecycle-stat.active .stat-note .iconify {
  opacity: 1;
}

.lifecycle-workspace {
  min-width: 0;
}

.section-heading {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.section-title-group {
  display: flex;
  gap: 0.65rem;
  align-items: baseline;
}

.section-title-group h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.result-count,
.filter-result {
  font-size: 0.68rem;
  color: hsl(var(--muted-foreground));
}

.filter-result {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
}

.lifecycle-toolbar {
  margin-bottom: 0.75rem;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.toolbar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 0 0.85rem;
  border-bottom: 1px solid hsl(var(--border) / 70%);
}

.toolbar-title {
  display: inline-flex;
  gap: 0.45rem;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.toolbar-title .iconify {
  color: hsl(var(--primary));
}

.clear-filter {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  padding: 0.25rem 0;
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
}

.clear-filter:hover {
  color: hsl(var(--primary));
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
}

.filter-search {
  flex: 1 1 250px;
  min-width: 210px;
  max-width: 330px;
}

.filter-select {
  flex: 0 1 142px;
  min-width: 118px;
}

.filter-submit {
  margin-left: auto;
}

.load-error {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.8rem 1rem;
  margin-bottom: 0.75rem;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 6%);
  border: 1px solid hsl(var(--destructive) / 25%);
  border-radius: var(--radius);
}

.load-error > div {
  flex: 1;
  min-width: 0;
}

.load-error strong {
  font-size: 0.75rem;
  font-weight: 600;
}

.load-error p {
  margin: 0.15rem 0 0;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.error-state-icon {
  display: inline-flex;
  flex: 0 0 auto;
}

.lifecycle-table-wrap {
  min-height: 240px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 3%);
}

.lifecycle-table-wrap :deep(.n-data-table-th) {
  height: 40px;
  font-size: 0.65rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.035em;
  background: hsl(var(--accent) / 55%);
}

.lifecycle-table-wrap :deep(.n-data-table-td) {
  height: 76px;
  padding: 0.7rem 0.8rem;
  font-size: 0.72rem;
  transition: background-color 0.18s ease;
}

.lifecycle-table-wrap :deep(.n-data-table-tr) {
  cursor: pointer;
}

.lifecycle-table-wrap :deep(.n-data-table-tr:focus-visible) {
  outline: 2px solid hsl(var(--primary));
  outline-offset: -2px;
}

.lifecycle-table-wrap :deep(.n-data-table-tr:hover .n-data-table-td) {
  background: hsl(var(--accent) / 70%);
}

.lifecycle-table-wrap :deep(.is-selected .n-data-table-td) {
  background: hsl(var(--primary) / 6%);
}

.lifecycle-table-wrap :deep(.is-selected .n-data-table-td:first-child) {
  box-shadow: inset 3px 0 hsl(var(--primary));
}

.table-skeletons,
.mobile-skeletons,
.timeline-skeletons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
}

.lifecycle-media {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}

.lifecycle-poster {
  display: flex;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 52px;
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border: 1px solid hsl(var(--border) / 65%);
  border-radius: calc(var(--radius) - 3px);
}

.lifecycle-poster :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lifecycle-media-copy {
  min-width: 0;
}

.lifecycle-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
  transition: color 0.18s ease;
}

.lifecycle-table-wrap :deep(.n-data-table-tr:hover) .lifecycle-title {
  color: hsl(var(--primary));
}

.lifecycle-subtitle {
  margin-top: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.lifecycle-identity {
  margin-top: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  font-size: 0.58rem;
  color: hsl(var(--muted-foreground) / 75%);
  white-space: nowrap;
}

.stage-line {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.stage-index {
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

.stage-cell {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: flex-start;
}

.stage-badge {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 22px;
  padding: 0.15rem 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.65rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
  background: hsl(var(--accent));
  border-radius: calc(var(--radius) - 3px);
}

.stage-badge[data-tone='info'] {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.stage-badge[data-tone='success'] {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.stage-badge[data-tone='warning'] {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.stage-badge[data-tone='error'] {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
}

.mini-progress {
  width: 64px;
  height: 3px;
  overflow: hidden;
  background: hsl(var(--accent));
  border-radius: 999px;
}

.mini-progress span {
  display: block;
  height: 100%;
  background: hsl(var(--primary));
  border-radius: inherit;
}

.status-badge {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-height: 23px;
  padding: 0.18rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--accent));
  border-radius: calc(var(--radius) - 3px);
}

.status-dot {
  width: 5px;
  height: 5px;
  background: currentcolor;
  border-radius: 50%;
}

.status-badge[data-status='running'] {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.status-badge[data-status='queued'] {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.status-badge[data-status='succeeded'] {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.status-badge[data-status='failed'],
.status-badge[data-status='blocked'] {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
}

.status-badge.compact {
  min-height: 20px;
  padding: 0.1rem 0.4rem;
  font-size: 0.6rem;
}

.provider-cell,
.duration-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  color: hsl(var(--foreground));
}

.provider-cell span,
.duration-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-cell small,
.duration-cell small {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.58rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.duration-cell span,
.retry-value {
  font-variant-numeric: tabular-nums;
}

.lifecycle-error {
  color: hsl(var(--destructive));
}

.error-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 0.65rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
}

.lifecycle-muted {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.lifecycle-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.lifecycle-table-wrap :deep(.n-data-table-tr:hover) .lifecycle-open {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 7%);
  border-color: hsl(var(--primary) / 40%);
}

.lifecycle-footer {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 0.65rem 0.9rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
}

.lifecycle-empty {
  display: grid;
  place-items: center;
  min-height: 260px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.lifecycle-empty :deep(.n-empty__icon) {
  color: hsl(var(--primary));
}

.empty-description {
  margin: 0 0 0.75rem;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.lifecycle-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-height: 240px;
}

.lifecycle-mobile-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  padding: 0.85rem;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 3%);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.lifecycle-mobile-card:active,
.lifecycle-mobile-card.active {
  background: hsl(var(--primary) / 4%);
  border-color: hsl(var(--primary) / 60%);
}

.mobile-card-head {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  min-width: 0;
}

.mobile-poster {
  flex: 0 0 44px;
  width: 44px;
  height: 60px;
}

.mobile-card-copy {
  flex: 1;
  min-width: 0;
}

.mobile-card-arrow {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  align-self: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
  border-radius: 50%;
}

.mobile-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.mobile-progress {
  height: 3px;
  overflow: hidden;
  background: hsl(var(--accent));
  border-radius: 999px;
}

.mobile-progress span {
  display: block;
  height: 100%;
  background: hsl(var(--primary));
}

.mobile-card-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.85rem;
  align-items: center;
  padding-top: 0.6rem;
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
  border-top: 1px solid hsl(var(--border) / 70%);
}

.mobile-card-foot span {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
}

.mobile-card-error {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  padding: 0.5rem 0.6rem;
  font-size: 0.65rem;
  line-height: 1.5;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 6%);
  border-radius: calc(var(--radius) - 3px);
}

.mobile-card-error .iconify {
  flex: 0 0 auto;
  margin-top: 0.1rem;
}

.mobile-card-error span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.lifecycle-drawer :deep(.n-drawer-body-content) {
  padding: 0;
}

.lifecycle-drawer :deep(.n-drawer-header) {
  min-height: 58px;
  padding: 0.65rem 1.25rem;
  border-bottom: 1px solid hsl(var(--border));
}

.lifecycle-drawer :deep(.n-drawer-footer) {
  padding: 0;
}

.drawer-heading {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.drawer-heading span {
  font-size: 0.55rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.12em;
}

.drawer-heading strong {
  font-size: 0.85rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.detail-hero {
  padding: 1.4rem 1.5rem 1.25rem;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.detail-heading {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.detail-poster {
  display: flex;
  flex: 0 0 78px;
  align-items: center;
  justify-content: center;
  width: 78px;
  height: 106px;
  overflow: hidden;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 1px);
}

.detail-poster :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-copy {
  min-width: 0;
}

.detail-eyebrow {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.5rem;
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
}

.detail-eyebrow span {
  font-family: monospace;
  overflow-wrap: anywhere;
}

.detail-title {
  margin: 0.35rem 0 0;
  font-size: 1.45rem;
  font-weight: 650;
  line-height: 1.3;
  color: hsl(var(--foreground));
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.65rem;
}

.detail-meta span {
  padding: 0.15rem 0.45rem;
  font-size: 0.6rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
  border-radius: calc(var(--radius) - 3px);
}

.current-stage-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 1.4rem;
}

.stage-caption {
  display: block;
  margin-bottom: 0.2rem;
  font-size: 0.55rem;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.06em;
}

.current-stage {
  font-size: 1.15rem;
  font-weight: 600;
  color: hsl(var(--primary));
}

.detail-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
  font-size: 0.62rem;
  color: hsl(var(--muted-foreground));
}

.detail-progress-head strong {
  font-family: monospace;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.detail-progress {
  height: 4px;
  margin-top: 0.4rem;
  overflow: hidden;
  background: hsl(var(--accent));
  border-radius: 999px;
}

.detail-progress span {
  display: block;
  height: 100%;
  background: hsl(var(--primary));
  border-radius: inherit;
  transition: width 0.35s ease;
}

.stage-stepper {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding: 0;
  margin: 1.1rem 0 0;
  list-style: none;
}

.stage-stepper li {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
  color: hsl(var(--muted-foreground));
}

.stage-stepper li:not(:last-child)::after {
  position: absolute;
  top: 13px;
  left: calc(50% + 17px);
  width: calc(100% - 34px);
  height: 1px;
  content: '';
  background: hsl(var(--border));
}

.step-marker {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 50%;
}

.step-label {
  font-size: 0.62rem;
}

.stage-stepper li.complete .step-marker {
  color: hsl(var(--success-foreground));
  background: hsl(var(--success));
  border-color: hsl(var(--success));
}

.stage-stepper li.complete:not(:last-child)::after {
  background: hsl(var(--success) / 45%);
}

.stage-stepper li.complete .step-label {
  color: hsl(var(--success));
}

.stage-stepper li.current .step-marker {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 4px hsl(var(--primary) / 8%);
}

.stage-stepper li.current .step-label {
  font-weight: 600;
  color: hsl(var(--primary));
}

.stage-stepper li.failed .step-marker {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
  border-color: hsl(var(--destructive));
}

.stage-stepper li.failed .step-label {
  color: hsl(var(--destructive));
}

.stage-stepper li.paused .step-marker {
  color: hsl(var(--warning));
  border-color: hsl(var(--warning));
}

.detail-section {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
}

.detail-section:last-child {
  border-bottom: 0;
}

.detail-section-heading {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.detail-section-heading h3 {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.detail-section-heading > span {
  font-size: 0.55rem;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.06em;
}

.archive-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.archive-item {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  min-width: 0;
  padding: 0.65rem 0.7rem;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border) / 75%);
  border-radius: calc(var(--radius) - 2px);
}

.archive-item.full {
  grid-column: 1 / -1;
}

.archive-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: calc(var(--radius) - 3px);
}

.archive-item > div {
  min-width: 0;
}

.archive-label {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.58rem;
  color: hsl(var(--muted-foreground));
}

.archive-item code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.65rem;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1.25rem;
  margin: 1rem 0 0;
}

.metadata-grid > div {
  min-width: 0;
}

.metadata-grid dt {
  margin-bottom: 0.2rem;
  font-size: 0.6rem;
  color: hsl(var(--muted-foreground));
}

.metadata-grid dd {
  margin: 0;
  font-size: 0.68rem;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
}

.error-banner {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  padding: 0.7rem 0.8rem;
  margin-top: 1rem;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 6%);
  border: 1px solid hsl(var(--destructive) / 25%);
  border-left: 3px solid hsl(var(--destructive));
  border-radius: calc(var(--radius) - 2px);
}

.error-banner .iconify {
  flex: 0 0 auto;
  margin-top: 0.05rem;
}

.error-banner strong {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.65rem;
  font-weight: 600;
}

.error-banner p {
  margin: 0;
  font-size: 0.65rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.season-tabs {
  display: flex;
  gap: 0.4rem;
  padding-bottom: 0.2rem;
  margin-bottom: 0.8rem;
  overflow-x: auto;
}

.season-tabs button {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0.3rem 0.65rem;
  font-size: 0.62rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
}

.season-tabs button:hover,
.season-tabs button.active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 6%);
  border-color: hsl(var(--primary) / 55%);
}

.matrix-summary {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.65rem;
  font-size: 0.62rem;
  color: hsl(var(--muted-foreground));
}

.matrix-summary strong {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.episode-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.45rem;
}

.episode-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  min-height: 50px;
  padding: 0.4rem 0.45rem 0.55rem;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.episode-cell::after {
  position: absolute;
  right: 0.4rem;
  bottom: 0.25rem;
  left: 0.4rem;
  height: 2px;
  content: '';
  background: hsl(var(--border));
  border-radius: 2px;
}

.episode-cell:hover {
  border-color: hsl(var(--primary));
  transform: translateY(-1px);
}

.episode-cell.active {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 10%);
}

.episode-code {
  font-family: monospace;
  font-size: 0.68rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.episode-status {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.52rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.episode-cell[data-status='succeeded']::after {
  background: hsl(var(--success));
}

.episode-cell[data-status='succeeded'] .episode-status {
  color: hsl(var(--success));
}

.episode-cell[data-status='running']::after {
  background: hsl(var(--primary));
}

.episode-cell[data-status='running'] .episode-status {
  color: hsl(var(--primary));
}

.episode-cell[data-status='missing']::after {
  background: hsl(var(--muted-foreground) / 45%);
}

.episode-cell[data-status='missing'] .episode-status {
  color: hsl(var(--muted-foreground));
}

.episode-cell[data-status='inferred']::after {
  background: hsl(var(--primary) / 45%);
}

.episode-cell[data-status='inferred'] .episode-status {
  color: hsl(var(--primary));
}

.episode-cell[data-status='queued']::after {
  background: hsl(var(--warning));
}

.episode-cell[data-status='failed']::after,
.episode-cell[data-status='blocked']::after {
  background: hsl(var(--destructive));
}

.episode-cell[data-status='failed'] .episode-status,
.episode-cell[data-status='blocked'] .episode-status {
  color: hsl(var(--destructive));
}

.matrix-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.matrix-legend span {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  font-size: 0.55rem;
  color: hsl(var(--muted-foreground));
}

.matrix-legend span::before {
  width: 8px;
  height: 2px;
  content: '';
  background: hsl(var(--border));
}

.matrix-legend span[data-status='succeeded']::before {
  background: hsl(var(--success));
}

.matrix-legend span[data-status='running']::before {
  background: hsl(var(--primary));
}

.matrix-legend span[data-status='queued']::before {
  background: hsl(var(--warning));
}

.matrix-legend span[data-status='failed']::before {
  background: hsl(var(--destructive));
}

.episode-context {
  padding: 0.5rem 0.65rem;
  margin: -0.2rem 0 1rem;
  font-size: 0.62rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--primary) / 5%);
  border-left: 2px solid hsl(var(--primary));
  border-radius: 0 calc(var(--radius) - 3px) calc(var(--radius) - 3px) 0;
}

.episode-context strong {
  margin: 0 0.25rem;
  font-weight: 600;
  color: hsl(var(--primary));
}

.event-timeline {
  margin-top: 0.2rem;
}

.event-timeline :deep(.n-timeline-item-timeline) {
  width: 16px;
}

.event-timeline :deep(.n-timeline-item-content) {
  padding-bottom: 1.1rem;
}

.event-timeline :deep(.n-timeline-item-content__meta) {
  margin-top: 0.25rem;
  font-size: 0.58rem;
}

.timeline-event-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.65rem;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.timeline-message {
  margin-top: 0.35rem;
  font-size: 0.65rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.timeline-event-type {
  margin-top: 0.25rem;
  font-family: monospace;
  font-size: 0.55rem;
  color: hsl(var(--muted-foreground) / 75%);
}

.timeline-empty {
  padding: 1.5rem 0;
}

.drawer-footer {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 0.5rem 1.25rem;
  font-size: 0.55rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
}

.drawer-footer span:first-child {
  font-family: monospace;
}

@keyframes page-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1100px) {
  .lifecycle-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .lifecycle-stat:nth-child(5) {
    grid-column: span 2;
  }

  .filter-controls {
    flex-wrap: wrap;
  }

  .filter-search {
    flex: 1 1 260px;
    max-width: none;
  }

  .filter-select {
    flex: 1 1 130px;
  }
}

@media (max-width: 768px) {
  .lifecycle-page {
    gap: 1rem;
    padding: 12px;
  }

  .lifecycle-heading {
    gap: 0.75rem;
    padding-top: 0;
  }

  .lifecycle-heading h1 {
    font-size: 1.4rem;
  }

  .lifecycle-heading p {
    max-width: 480px;
    font-size: 0.72rem;
  }

  .heading-eyebrow {
    font-size: 0.55rem;
  }

  .monitor-label {
    display: none;
  }

  .lifecycle-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .lifecycle-stat,
  .lifecycle-stat:nth-child(5) {
    grid-column: auto;
    min-height: 108px;
    padding: 0.75rem 0.8rem;
  }

  .lifecycle-stat:nth-child(5) {
    grid-column: 1 / -1;
    min-height: 82px;
  }

  .lifecycle-stat:nth-child(5) .stat-main {
    margin-top: 0.45rem;
  }

  .stat-main strong {
    font-size: 1.5rem;
  }

  .stat-note {
    padding-top: 0.5rem;
  }

  .filter-controls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    padding: 0.65rem;
  }

  .filter-search {
    grid-column: 1 / -1;
    width: 100%;
    min-width: 0;
    max-width: none;
  }

  .filter-select {
    width: 100%;
    min-width: 0;
  }

  .filter-submit {
    grid-column: 1 / -1;
    width: 100%;
    margin-left: 0;
  }

  .lifecycle-footer {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
    padding: 0.75rem;
    border-top: 1px solid hsl(var(--border));
    border-radius: var(--radius);
  }

  .lifecycle-footer :deep(.n-pagination) {
    justify-content: center;
    overflow-x: auto;
  }

  .lifecycle-footer .lifecycle-muted {
    text-align: center;
  }

  .detail-hero,
  .detail-section {
    padding-right: 1rem;
    padding-left: 1rem;
  }

  .detail-poster {
    flex-basis: 68px;
    width: 68px;
    height: 92px;
  }

  .detail-title {
    font-size: 1.25rem;
  }

  .episode-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .drawer-footer {
    padding-right: 1rem;
    padding-left: 1rem;
  }
}

@media (max-width: 420px) {
  .lifecycle-heading {
    align-items: flex-start;
  }

  .heading-actions .n-button {
    min-width: 34px;
    padding: 0 0.55rem;
  }

  .lifecycle-heading p {
    max-width: 250px;
  }

  .toolbar-heading {
    padding: 0 0.65rem;
  }

  .detail-heading {
    gap: 0.75rem;
  }

  .detail-poster {
    flex-basis: 60px;
    width: 60px;
    height: 82px;
  }

  .detail-title {
    font-size: 1.1rem;
  }

  .archive-grid {
    grid-template-columns: 1fr;
  }

  .archive-item.full {
    grid-column: auto;
  }

  .metadata-grid {
    gap: 0.75rem;
  }

  .episode-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .drawer-footer {
    flex-direction: column;
    gap: 0.15rem;
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lifecycle-page,
  .lifecycle-stat,
  .episode-cell,
  .detail-progress span {
    transition: none;
    animation: none;
  }
}
</style>

<style>
/* 动态 h() 单元格不继承 scoped data-v，这里单独提供样式 */
.lifecycle-table-wrap .n-data-table-td:first-child {
  max-width: 340px;
}

.lifecycle-table-wrap .lifecycle-media {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

.lifecycle-table-wrap .lifecycle-poster {
  display: flex;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 52px;
  overflow: hidden;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border: 1px solid hsl(var(--border) / 65%);
  border-radius: calc(var(--radius) - 3px);
}

.lifecycle-table-wrap .lifecycle-poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lifecycle-table-wrap .lifecycle-media-copy {
  flex: 1 1 0;
  width: 0;
  min-width: 0;
}

.lifecycle-title-tooltip {
  max-width: 520px;
  font-size: 0.78rem;
  line-height: 1.55;
  white-space: normal;
}

.lifecycle-table-wrap .lifecycle-title {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.lifecycle-table-wrap .lifecycle-subtitle,
.lifecycle-table-wrap .lifecycle-identity {
  margin-top: 0.18rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.65rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.lifecycle-table-wrap .lifecycle-identity {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.58rem;
  opacity: 0.7;
}

.lifecycle-table-wrap .stage-cell {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: flex-start;
}

.lifecycle-table-wrap .stage-line {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.lifecycle-table-wrap .stage-index {
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

.lifecycle-table-wrap .stage-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0.15rem 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.65rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
  background: hsl(var(--accent));
  border-radius: 999px;
}

.lifecycle-table-wrap .stage-badge[data-tone='success'] {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.lifecycle-table-wrap .stage-badge[data-tone='info'] {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.lifecycle-table-wrap .stage-badge[data-tone='warning'] {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.lifecycle-table-wrap .stage-badge[data-tone='error'] {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
}

.lifecycle-table-wrap .mini-progress {
  width: 74px;
  height: 3px;
  overflow: hidden;
  background: hsl(var(--accent));
  border-radius: 999px;
}

.lifecycle-table-wrap .mini-progress span {
  display: block;
  height: 100%;
  background: hsl(var(--primary));
  border-radius: inherit;
}

.lifecycle-table-wrap .status-badge {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  min-height: 23px;
  padding: 0.18rem 0.5rem;
  font-size: 0.65rem;
  white-space: nowrap;
  border-radius: 999px;
}

.lifecycle-table-wrap .status-badge[data-status='success'] {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.lifecycle-table-wrap .status-badge[data-status='info'] {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.lifecycle-table-wrap .status-badge[data-status='warning'] {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.lifecycle-table-wrap .status-badge[data-status='error'] {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
}

.lifecycle-table-wrap .status-dot {
  width: 5px;
  height: 5px;
  background: currentcolor;
  border-radius: 50%;
}

.lifecycle-table-wrap .provider-cell,
.lifecycle-table-wrap .duration-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.lifecycle-table-wrap .provider-cell span,
.lifecycle-table-wrap .duration-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.7rem;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.lifecycle-table-wrap .provider-cell small,
.lifecycle-table-wrap .duration-cell small {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.58rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.lifecycle-table-wrap .lifecycle-error,
.lifecycle-table-wrap .lifecycle-muted {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.7rem;
  white-space: nowrap;
}

.lifecycle-table-wrap .lifecycle-error {
  color: hsl(var(--destructive));
}

.lifecycle-table-wrap .lifecycle-muted {
  color: hsl(var(--muted-foreground));
}

.lifecycle-table-wrap .lifecycle-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}
</style>
