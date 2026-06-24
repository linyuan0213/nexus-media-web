<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { NCard, NEmpty, NSpin, NTag } from 'naive-ui';

import {
  getDashboardBrushTasksApi,
  getDashboardIndexerStatsApi,
  getDashboardLibraryApi,
  getDashboardSchedulerJobsApi,
  getDashboardSiteStatsApi,
  getDashboardSystemStatusApi,
  getDashboardTransferStatsApi,
} from '#/api';
import { PluginSlot } from '#/plugin-framework';

import DownloaderRingChart from './components/DownloaderRingChart.vue';
import MediaPieChart from './components/MediaPieChart.vue';
import SiteBarChart from './components/SiteBarChart.vue';
import SiteRoseChart from './components/SiteRoseChart.vue';
import StatCard from './components/StatCard.vue';
import TransferLineChart from './components/TransferLineChart.vue';
import WelcomeHeader from './components/WelcomeHeader.vue';

const loading = ref(true);

// 系统状态
const systemStatus = ref<{ uptime: number; version: string }>();

// 媒体库
const libraryData = ref<{
  library_spaces: {
    free_space: string;
    total_space: string;
    used_percent: number;
    used_space: string;
  };
  media_counts: Record<string, number>;
}>();

// 入库统计
const transferStats = ref<{
  anime_nums: number[];
  labels: string[];
  movie_nums: number[];
  tv_nums: number[];
}>();

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

// 索引器统计
const indexerStats = ref<{ stats: any[] }>();

// 刷流任务
const brushTasks = ref<any[]>([]);

// 调度任务
const schedulerJobs = ref<any[]>([]);

// 计算属性
const mediaCount = computed(() => {
  const c = libraryData.value?.media_counts || {};
  return {
    movie: c.Movie || 0,
    series: c.Series || 0,
    episode: c.Episodes || 0,
    song: c.Music || 0,
  };
});

const mediaPieData = computed(() => {
  const c = libraryData.value?.media_counts || {};
  return [
    { name: '电影', value: c.Movie || 0 },
    { name: '电视剧', value: c.Series || 0 },
    { name: '音乐', value: c.Music || 0 },
  ].filter((i) => i.value > 0);
});

const siteRoseData = computed(() => {
  return siteStats.value
    .filter((s) => s.seeding_count > 0)
    .map((s) => ({ name: s.site_name, value: s.seeding_count }))
    .toSorted((a, b) => b.value - a.value)
    .slice(0, 8);
});

const downloaderRingData = computed(() => {
  const stats = indexerStats.value?.stats || [];
  return stats.map((s) => ({ name: s.name, value: s.total }));
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

async function fetchData() {
  loading.value = true;
  try {
    const [sysRes, libRes, transferRes, siteRes, indexerRes, brushRes, jobRes] =
      await Promise.all([
        getDashboardSystemStatusApi(),
        getDashboardLibraryApi(),
        getDashboardTransferStatsApi(30),
        getDashboardSiteStatsApi(),
        getDashboardIndexerStatsApi(),
        getDashboardBrushTasksApi(),
        getDashboardSchedulerJobsApi(),
      ]);

    systemStatus.value = sysRes as any;
    const mc = (libRes as any)?.media_counts || {};
    libraryData.value = {
      media_counts: {
        Movie: mc.Movie || 0,
        Series: mc.Series || 0,
        Music: mc.Music || 0,
        Episodes: mc.Episodes || 0,
        User: mc.User || 0,
      },
      library_spaces: ((libRes as any)?.library_spaces || {}) as any,
    };
    transferStats.value = transferRes;
    siteStats.value = (siteRes || []) as any;
    indexerStats.value = indexerRes;
    brushTasks.value = brushRes || [];
    schedulerJobs.value = jobRes || [];
  } catch {
    // 静默失败
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
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
          icon-color="hsl(210, 80%, 55%)"
          icon-bg="hsl(210, 80%, 95%)"
        />
        <StatCard
          icon="lucide:tv"
          title="电视剧"
          :value="mediaCount.series"
          icon-color="hsl(155, 65%, 40%)"
          icon-bg="hsl(155, 65%, 93%)"
        />
        <StatCard
          icon="lucide:rss"
          title="刷流任务"
          :value="`${activeBrushCount} / ${brushTasks.length}`"
          icon-color="hsl(280, 70%, 55%)"
          icon-bg="hsl(280, 70%, 95%)"
        />
        <StatCard
          icon="lucide:arrow-up"
          title="上传量"
          :value="formatSize(totalUpload)"
          icon-color="hsl(24, 95%, 55%)"
          icon-bg="hsl(24, 95%, 96%)"
        />
        <StatCard
          icon="lucide:arrow-down"
          title="下载量"
          :value="formatSize(totalDownload)"
          icon-color="hsl(200, 90%, 55%)"
          icon-bg="hsl(200, 90%, 96%)"
        />
        <StatCard
          icon="lucide:clock"
          title="调度任务"
          :value="`${activeJobCount} / ${schedulerJobs.length}`"
          icon-color="hsl(340, 80%, 55%)"
          icon-bg="hsl(340, 80%, 95%)"
        />
      </div>

      <!-- 插件插槽: dashboard.home -->
      <PluginSlot target="dashboard.home" />

      <!-- 入库趋势折线图 -->
      <NCard
        class="mb-6"
        :bordered="false"
        :segmented="{ content: true }"
        title="最近30天入库趋势"
      >
        <TransferLineChart
          v-if="transferStats && transferStats.labels?.length"
          :labels="transferStats.labels"
          :movie-data="transferStats.movie_nums"
          :tv-data="transferStats.tv_nums"
          :anime-data="transferStats.anime_nums"
        />
        <NEmpty v-else description="暂无入库数据" />
      </NCard>

      <!-- 第二行图表 -->
      <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NCard
          :bordered="false"
          :segmented="{ content: true }"
          title="媒体库分布"
        >
          <MediaPieChart v-if="mediaPieData.length > 0" :data="mediaPieData" />
          <NEmpty v-else description="暂无媒体库数据" />
        </NCard>

        <NCard
          :bordered="false"
          :segmented="{ content: true }"
          title="站点做种分布"
        >
          <SiteRoseChart v-if="siteRoseData.length > 0" :data="siteRoseData" />
          <NEmpty v-else description="暂无站点数据" />
        </NCard>
      </div>

      <!-- 第三行图表 -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NCard
          :bordered="false"
          :segmented="{ content: true }"
          title="索引器统计"
        >
          <template #header-extra>
            <NTag size="small" :bordered="false" type="info">24h</NTag>
          </template>
          <DownloaderRingChart
            v-if="downloaderRingData.length > 0"
            :data="downloaderRingData"
          />
          <NEmpty v-else description="暂无索引器数据" />
        </NCard>

        <NCard
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
      </div>
    </NSpin>
  </div>
</template>
