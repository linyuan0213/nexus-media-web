<script lang="ts" setup>
import type { DashboardApi, DownloaderSpeedStatistics } from '#/api';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { NCard, NEmpty, NSpin, NTag } from 'naive-ui';

import {
  getDashboardBrushTasksApi,
  getDashboardIndexerStatsApi,
  getDashboardLibraryApi,
  getDashboardSchedulerJobsApi,
  getDashboardSiteStatsApi,
  getDashboardSystemStatusApi,
  getDashboardTransferStatsApi,
  getDownloaderSpeedStatisticsApi,
  getMovieSubscriptionApi,
  getSiteDailyHistoryApi,
  getTvSubscriptionApi,
} from '#/api';
import { PluginSlot } from '#/plugin-framework';

import IndexerStatsChart from './components/IndexerStatsChart.vue';
import LatestMediaCard from './components/LatestMediaCard.vue';
import MediaPieChart from './components/MediaPieChart.vue';
import SiteBarChart from './components/SiteBarChart.vue';
import SiteRoseChart from './components/SiteRoseChart.vue';
import StatCard from './components/StatCard.vue';
import SystemStatusCard from './components/SystemStatusCard.vue';
import TrafficCard from './components/TrafficCard.vue';
import TransferLineChart from './components/TransferLineChart.vue';
import WelcomeHeader from './components/WelcomeHeader.vue';

const loading = ref(true);

// 系统状态
const systemStatus = ref<{
  cpu_percent: number;
  memory_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  python_version: string;
  uptime: number;
  version: string;
}>();

const sysUpdatedAt = ref(0);

// 媒体库
const libraryData = ref<DashboardApi.LibraryHome>();

// 入库统计
const transferDays = ref(30);
const transferStats = ref<DashboardApi.TransferStatistics>();

// 站点统计
const siteStats = ref<
  Array<{
    bonus: number | string;
    download: number | string;
    seeding_count: number;
    site_name: string;
    upload: number | string;
  }>
>([]);

// 索引器统计（次数/成功/失败/平均耗时）
const indexerStats = ref<{ stats: any[] }>();

// 刷流任务
const brushTasks = ref<any[]>([]);

// 调度任务
const schedulerJobs = ref<any[]>([]);

// 订阅数（电影+电视剧订阅总数）
const subscribeCount = ref(0);
const subscribeNewToday = ref(0);

// 订阅数趋势：今日新增订阅数（按条目 add_date 统计）
const subscribeTrend = computed(() => {
  const n = subscribeNewToday.value;
  return {
    text: n > 0 ? `+${n}` : '0',
    type: (n > 0 ? 'up' : 'neutral') as 'neutral' | 'up',
  };
});

// 站点每日流量增量：今 vs 昨（/site/sites/statistics/daily，按天增量）
const trafficDaily = ref<{
  dates: string[];
  series: Array<{ download: number[]; name: string; upload: number[] }>;
}>({ dates: [], series: [] });

type TrafficTrend = { text: string; type: 'down' | 'neutral' | 'up' };

function trafficDelta(cur: number, prev: number): TrafficTrend | undefined {
  if (cur === 0 && prev === 0) return undefined;
  const diff = cur - prev;
  if (diff === 0) return { text: '0', type: 'neutral' };
  const sign = diff > 0 ? '+' : '-';
  return {
    text: `${sign}${formatSize(Math.abs(diff))}`,
    type: diff > 0 ? 'up' : 'down',
  };
}

const uploadTrend = computed(() => {
  const d = trafficDaily.value;
  if (d.dates.length < 2 || d.series.length === 0) return undefined;
  const last = d.dates.length - 1;
  let cur = 0;
  let prev = 0;
  for (const s of d.series) {
    cur += s.upload[last] || 0;
    prev += s.upload[last - 1] || 0;
  }
  return trafficDelta(cur, prev);
});

const downloadTrend = computed(() => {
  const d = trafficDaily.value;
  if (d.dates.length < 2 || d.series.length === 0) return undefined;
  const last = d.dates.length - 1;
  let cur = 0;
  let prev = 0;
  for (const s of d.series) {
    cur += s.download[last] || 0;
    prev += s.download[last - 1] || 0;
  }
  return trafficDelta(cur, prev);
});

// 计算属性
const mediaCount = computed(() => {
  const c = libraryData.value?.media_counts || {};
  return {
    movie: Number(c.Movie) || 0,
    series: Number(c.Series) || 0,
    episode: Number(c.Episodes) || 0,
    song: Number(c.Music) || 0,
  };
});

const mediaPieData = computed(() => {
  const c = libraryData.value?.media_counts || {};
  return [
    { name: '电影', value: Number(c.Movie) || 0 },
    { name: '电视剧', value: Number(c.Series) || 0 },
    { name: '音乐', value: Number(c.Music) || 0 },
  ].filter((i) => i.value > 0);
});

const latestItems = computed(() =>
  ((libraryData.value?.latests as any[]) || []).slice(0, 12),
);

const siteRoseData = computed(() => {
  return siteStats.value
    .filter((s) => s.seeding_count > 0)
    .map((s) => ({ name: s.site_name, value: s.seeding_count }))
    .toSorted((a, b) => b.value - a.value)
    .slice(0, 8);
});

const indexerStatsData = computed(() => {
  const stats = indexerStats.value?.stats || [];
  return stats.map((s) => ({
    name: s.name,
    total: Number(s.total || 0),
    success: Number(s.success || 0),
    fail: Number(s.fail || 0),
    avg: Number(s.avg || 0),
  }));
});

const siteBarData = computed(() => {
  const items = siteStats.value
    .filter(
      (s) => parseSizeToBytes(s.upload) > 0 || parseSizeToBytes(s.download) > 0,
    )
    .toSorted(
      (a, b) =>
        parseSizeToBytes(b.upload) +
        parseSizeToBytes(b.download) -
        parseSizeToBytes(a.upload) -
        parseSizeToBytes(a.download),
    )
    .slice(0, 8);
  return {
    labels: items.map((s) => s.site_name),
    uploads: items.map((s) => parseSizeToBytes(s.upload)),
    downloads: items.map((s) => parseSizeToBytes(s.download)),
  };
});

const activeBrushCount = computed(() => {
  return brushTasks.value.filter((t) => t.state === 'Y').length;
});

const activeJobCount = computed(() => {
  return schedulerJobs.value.filter((j) => !j.paused).length;
});

const totalUpload = computed(() => {
  return siteStats.value.reduce(
    (sum, s) => sum + parseSizeToBytes(s.upload),
    0,
  );
});

const totalDownload = computed(() => {
  return siteStats.value.reduce(
    (sum, s) => sum + parseSizeToBytes(s.download),
    0,
  );
});

// 今日 vs 昨日差值趋势：返回徽标差值文案与方向
function dayTrend(
  nums: number[] | undefined,
  formatter: (n: number) => string,
) {
  if (!nums || nums.length === 0) return undefined;
  const today = nums.at(-1) ?? 0;
  const yesterday = nums.length > 1 ? (nums.at(-2) ?? 0) : 0;
  const diff = today - yesterday;
  let text = '0';
  let type: 'down' | 'neutral' | 'up' = 'neutral';
  if (diff > 0) {
    text = `+${formatter(diff)}`;
    type = 'up';
  } else if (diff < 0) {
    text = `-${formatter(-diff)}`;
    type = 'down';
  }
  return { text, type };
}

const movieTrend = computed(() =>
  dayTrend(transferStats.value?.movie_nums, (n) => `${n}`),
);
// 电视剧卡片按剧数口径，趋势用去重剧数
const seriesTrend = computed(() =>
  dayTrend(transferStats.value?.tv_series_nums, (n) => `${n} 部`),
);

function parseSizeToBytes(size?: number | string): number {
  if (size === undefined || size === null || size === '') return 0;
  if (typeof size === 'number') return size;
  const match = size.match(/^(\d+\.?\d*)\s*([KMGTPE]?B|TiB|GiB|MiB|KiB)?$/i);
  if (!match) return 0;
  const num = Number.parseFloat(match[1] || '');
  if (!Number.isFinite(num)) return 0;
  const unit = (match[2] || 'B').toUpperCase().replace(/IB$/, 'B');
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
    PB: 1024 ** 5,
    EB: 1024 ** 6,
  };
  return num * (multipliers[unit] || 1);
}

function formatSize(size?: number | string) {
  const bytes = parseSizeToBytes(size);
  if (bytes <= 0) return '0 GB';
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

async function fetchTransferStats() {
  try {
    transferStats.value = await getDashboardTransferStatsApi(
      transferDays.value,
    );
  } catch {
    // 静默失败
  }
}

function setTransferDays(days: number) {
  if (transferDays.value === days) return;
  transferDays.value = days;
  fetchTransferStats();
}

// 下载器实时速率负载（速率占用速度上限比例）
const downloaderStats = ref<DownloaderSpeedStatistics>();

async function fetchDownloaderStats() {
  try {
    downloaderStats.value = await getDownloaderSpeedStatisticsApi();
  } catch {
    // 静默失败
  }
}

async function fetchSystemStatus() {
  try {
    const res = (await getDashboardSystemStatusApi()) as any;
    systemStatus.value = res;
    sysUpdatedAt.value = Date.now();
  } catch {
    // 静默失败
  }
}

async function fetchData() {
  loading.value = true;
  try {
    const [
      sysRes,
      libRes,
      transferRes,
      siteRes,
      indexerRes,
      brushRes,
      jobRes,
      movieSubs,
      tvSubs,
      dailyTraffic,
    ] = await Promise.all([
      getDashboardSystemStatusApi(),
      getDashboardLibraryApi(),
      getDashboardTransferStatsApi(transferDays.value),
      getDashboardSiteStatsApi(),
      getDashboardIndexerStatsApi(),
      getDashboardBrushTasksApi(),
      getDashboardSchedulerJobsApi(),
      getMovieSubscriptionApi(),
      getTvSubscriptionApi(),
      // 拉 3 天：首日只作差分基线，最后两天才是“今日/昨日”真实增量
      getSiteDailyHistoryApi({ days: 3 }),
    ]);

    systemStatus.value = sysRes as any;
    sysUpdatedAt.value = Date.now();
    libraryData.value = libRes;
    transferStats.value = transferRes;

    siteStats.value = (siteRes || []) as any;
    trafficDaily.value = dailyTraffic || { dates: [], series: [] };
    indexerStats.value = indexerRes;
    brushTasks.value = brushRes || [];
    schedulerJobs.value = jobRes || [];
    subscribeCount.value =
      (Array.isArray(movieSubs) ? movieSubs.length : 0) +
      (Array.isArray(tvSubs) ? tvSubs.length : 0);
    // 今日新增订阅数：按条目 add_date 统计
    const todayStr = new Date().toISOString().slice(0, 10);
    subscribeNewToday.value =
      (Array.isArray(movieSubs) ? movieSubs : []).filter(
        (s: any) => String(s?.add_date || '').slice(0, 10) === todayStr,
      ).length +
      (Array.isArray(tvSubs) ? tvSubs : []).filter(
        (s: any) => String(s?.add_date || '').slice(0, 10) === todayStr,
      ).length;
    fetchDownloaderStats();
  } catch {
    // 静默失败
  } finally {
    loading.value = false;
  }
}

// 系统状态 30s 轮询（含下载器负载）：显式 setInterval，组件卸载清理
let sysTimer: null | ReturnType<typeof setInterval> = null;

onMounted(() => {
  fetchData();
  sysTimer = setInterval(() => {
    fetchSystemStatus();
    fetchDownloaderStats();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (sysTimer) clearInterval(sysTimer);
});
</script>

<template>
  <div class="p-4 lg:p-6">
    <NSpin :show="loading">
      <!-- 欢迎头 -->
      <WelcomeHeader
        :uptime="systemStatus?.uptime"
        :version="systemStatus?.version"
      />

      <!-- 核心指标卡片 -->
      <div
        class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 lg:gap-4"
      >
        <StatCard
          icon="lucide:film"
          title="电影"
          :value="mediaCount.movie"
          icon-color="var(--tblr-primary)"
          icon-bg="color-mix(in srgb, var(--tblr-primary) 10%, transparent)"
          to="/library"
          :trend="movieTrend?.text"
          :trend-type="movieTrend?.type"
        />
        <StatCard
          icon="lucide:tv"
          title="电视剧"
          :value="mediaCount.series"
          icon-color="var(--tblr-teal)"
          icon-bg="color-mix(in srgb, var(--tblr-teal) 10%, transparent)"
          to="/library"
          :trend="seriesTrend?.text"
          :trend-type="seriesTrend?.type"
        />
        <TrafficCard
          :upload="formatSize(totalUpload)"
          :download="formatSize(totalDownload)"
          :upload-trend="uploadTrend"
          :download-trend="downloadTrend"
          to="/site/statistics"
        />
        <StatCard
          icon="lucide:rss"
          title="订阅数"
          :value="subscribeCount"
          icon-color="var(--tblr-cyan)"
          icon-bg="color-mix(in srgb, var(--tblr-cyan) 10%, transparent)"
          to="/subscription/movie"
          :trend="subscribeTrend?.text"
          :trend-type="subscribeTrend?.type"
        />
        <StatCard
          icon="lucide:zap"
          title="刷流任务"
          :value="`${activeBrushCount} / ${brushTasks.length}`"
          icon-color="var(--tblr-purple)"
          icon-bg="color-mix(in srgb, var(--tblr-purple) 10%, transparent)"
          to="/brush"
          trend="活跃"
          trend-type="neutral"
        />
        <StatCard
          icon="lucide:clock"
          title="调度任务"
          :value="`${activeJobCount} / ${schedulerJobs.length}`"
          icon-color="var(--tblr-pink)"
          icon-bg="color-mix(in srgb, var(--tblr-pink) 10%, transparent)"
          to="/service/scheduler"
          trend="运行中"
          trend-type="neutral"
        />
      </div>

      <!-- 插件插槽: dashboard.home -->
      <PluginSlot target="dashboard.home" />

      <!-- 入库趋势 + 系统状态 -->
      <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <NCard
          class="chart-card lg:col-span-2"
          :bordered="false"
          :segmented="{ content: true }"
          title="入库趋势"
        >
          <template #header-extra>
            <div class="flex gap-1">
              <NTag
                v-for="d in [7, 30, 90]"
                :key="d"
                size="small"
                :bordered="false"
                :type="transferDays === d ? 'primary' : 'default'"
                class="cursor-pointer"
                @click="setTransferDays(d)"
              >
                {{ d }}天
              </NTag>
            </div>
          </template>
          <TransferLineChart
            v-if="transferStats && transferStats.labels?.length"
            :labels="transferStats.labels"
            :movie-data="transferStats.movie_nums"
            :tv-data="transferStats.tv_nums"
            :anime-data="transferStats.anime_nums"
          />
          <NEmpty v-else description="暂无入库数据" />
        </NCard>

        <SystemStatusCard
          :status="systemStatus"
          :storage="libraryData?.library_spaces"
          :downloader-online="downloaderStats?.online"
          :downloader-count="downloaderStats?.downloader_count ?? 0"
          :download-speed="downloaderStats?.download_speed ?? 0"
          :upload-speed="downloaderStats?.upload_speed ?? 0"
          :download-limit="downloaderStats?.download_limit"
          :upload-limit="downloaderStats?.upload_limit"
          :updated-at="sysUpdatedAt"
        />
      </div>

      <!-- 第二行图表 -->
      <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NCard
          class="chart-card"
          :bordered="false"
          :segmented="{ content: true }"
          title="媒体库分布"
        >
          <MediaPieChart v-if="mediaPieData.length > 0" :data="mediaPieData" />
          <NEmpty v-else description="暂无媒体库数据" />
        </NCard>

        <NCard
          class="chart-card"
          :bordered="false"
          :segmented="{ content: true }"
          title="站点做种分布"
        >
          <SiteRoseChart v-if="siteRoseData.length > 0" :data="siteRoseData" />
          <NEmpty v-else description="暂无站点数据" />
        </NCard>
      </div>

      <!-- 第三行图表 -->
      <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NCard
          class="chart-card"
          :bordered="false"
          :segmented="{ content: true }"
          title="站点流量排行"
        >
          <SiteBarChart
            v-if="siteBarData.labels.length > 0"
            :labels="siteBarData.labels"
            :upload-data="siteBarData.uploads"
            :download-data="siteBarData.downloads"
          />
          <NEmpty v-else description="暂无站点流量数据" />
        </NCard>

        <NCard
          class="chart-card"
          :bordered="false"
          :segmented="{ content: true }"
          title="索引器统计"
        >
          <template #header-extra>
            <NTag size="small" :bordered="false" type="info">24h</NTag>
          </template>
          <IndexerStatsChart
            v-if="indexerStatsData.length > 0"
            :data="indexerStatsData"
          />
          <NEmpty v-else description="暂无索引器数据" />
        </NCard>
      </div>

      <!-- 最近入库：整行海报墙 -->
      <NCard
        class="chart-card"
        :bordered="false"
        :segmented="{ content: true }"
        title="最近入库"
      >
        <template #header-extra>
          <NTag size="small" :bordered="false" type="info">最新 12 条</NTag>
        </template>
        <LatestMediaCard :items="latestItems" />
      </NCard>
    </NSpin>
  </div>
</template>

<style scoped>
/* 图表卡统一 Tabler 卡片外观 */
.chart-card {
  background: var(--tblr-card-bg);
  border: 1px solid var(--tblr-card-border-color);
  border-radius: var(--tblr-card-border-radius);
  box-shadow: var(--tblr-box-shadow-card);
}

.chart-card :deep(.n-card-header) {
  padding: 1rem 1.25rem 0.625rem;
}

.chart-card :deep(.n-card-header__main) {
  font-size: 0.875rem;
  font-weight: 600;
}

.chart-card :deep(.n-card__content) {
  padding: 0.75rem 1.25rem 1.25rem;
}

/* 空状态与图表等高对齐 */
.chart-card :deep(.n-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 16rem;
}
</style>
