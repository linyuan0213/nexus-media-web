<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NSelect, NSpace, NSpin } from 'naive-ui';

import {
  getSiteDailyHistoryApi,
  getSiteFaviconsApi,
  getSiteHistoryApi,
  getSiteStatisticsApi,
  refreshSiteStatisticsApi,
} from '#/api/modules/site';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';
import { useAppNotification } from '#/utils/notify';

import ChartCards from './components/ChartCards.vue';
import SiteDetailModal from './components/SiteDetailModal.vue';
import StatTable from './components/StatTable.vue';

const notification = useAppNotification();
const { formatCompactSize, parseNumber, parseSize } = useSiteStats();

const loading = ref(false);
const screenWidth = ref(window.innerWidth);
const isMobile = computed(() => screenWidth.value < 768);
const statistics = ref<StatisticsItem[]>([]);
const historyData = ref<[string, number, number][]>([]);
const dailyData = ref<{
  dates: string[];
  series: Array<{ download: number[]; name: string; upload: number[] }>;
}>({ dates: [], series: [] });
const dailyMode = ref<'download' | 'upload'>('upload');
const favicons = ref<Record<string, string>>({});
const sortBy = ref('');
const refreshing = ref(false);

const siteDetailModalShow = ref(false);
const siteDetailName = ref('');

const sortOptions = [
  { label: '默认排序', value: '' },
  { label: '按上传量', value: 'upload' },
  { label: '按下载量', value: 'download' },
  { label: '按做种数', value: 'seeding_count' },
  { label: '按分享率', value: 'ratio' },
  { label: '按魔力值', value: 'bonus' },
];

const summaryCards = computed(() => {
  if (!summary.value) return [];
  const s = summary.value;
  return [
    {
      icon: 'lucide:globe',
      label: '站点总数',
      tone: 'primary',
      value: String(s.total),
    },
    {
      icon: 'lucide:activity',
      label: '活跃站点',
      tone: 'success',
      value: String(s.active),
    },
    {
      icon: 'lucide:arrow-up',
      label: '总上传',
      tone: 'success',
      value: formatCompactSize(s.upload),
    },
    {
      icon: 'lucide:arrow-down',
      label: '总下载',
      tone: 'warning',
      value: formatCompactSize(s.download),
    },
    {
      icon: 'lucide:bar-chart-3',
      label: '平均分享率',
      tone: 'primary',
      value: s.avgRatio,
    },
    {
      icon: 'lucide:hard-drive',
      label: '总做种数',
      tone: 'success',
      value: String(s.seeding),
    },
    {
      icon: 'lucide:sparkles',
      label: '总魔力值',
      tone: 'primary',
      value: Number(s.bonus).toFixed(0),
    },
    {
      icon: 'lucide:mail',
      label: '未读消息',
      tone: 'destructive',
      value: String(s.messages),
    },
  ];
});

const summary = computed(() => {
  const items = statistics.value;
  if (items.length === 0) return null;
  const totalUpload = items.reduce((sum, i) => sum + parseSize(i.upload), 0);
  const totalDownload = items.reduce(
    (sum, i) => sum + parseSize(i.download),
    0,
  );
  const totalSeeding = items.reduce(
    (sum, i) => sum + (i.seeding_count || 0),
    0,
  );
  const totalBonus = items.reduce((sum, i) => sum + parseNumber(i.bonus), 0);
  const totalMessages = items.reduce(
    (sum, i) => sum + (i.message_count || 0),
    0,
  );
  const avgRatio =
    items.reduce((sum, i) => sum + parseNumber(i.ratio), 0) / items.length;
  const activeSites = items.filter(
    (i) => parseSize(i.upload) > 0 || parseSize(i.download) > 0,
  ).length;

  return {
    active: activeSites,
    avgRatio: avgRatio.toFixed(2),
    bonus: totalBonus,
    download: totalDownload,
    messages: totalMessages,
    seeding: totalSeeding,
    total: items.length,
    upload: totalUpload,
  };
});

const sortedStatistics = computed(() => {
  const items = [...statistics.value];
  if (!sortBy.value) return items;
  return items.toSorted((a, b) => {
    const field = sortBy.value;
    let av: number;
    let bv: number;
    if (
      field === 'upload' ||
      field === 'download' ||
      field === 'seeding_size'
    ) {
      av = parseSize((a as any)[field]);
      bv = parseSize((b as any)[field]);
    } else if (field === 'ratio' || field === 'bonus') {
      av = parseNumber((a as any)[field]);
      bv = parseNumber((b as any)[field]);
    } else {
      av = (a as any)[field] || 0;
      bv = (b as any)[field] || 0;
    }
    return bv - av;
  });
});

async function handleRefresh() {
  refreshing.value = true;
  try {
    await refreshSiteStatisticsApi();
    notification.success('站点数据刷新已启动', {
      description: '数据正在后台刷新中，请稍候重新查看',
    });
  } catch (error: any) {
    notification.error('刷新失败', {
      description: error?.message || '',
    });
  } finally {
    refreshing.value = false;
  }
}

async function handleRefreshSite(siteName: string) {
  try {
    await refreshSiteStatisticsApi([siteName]);
    notification.success(`${siteName} 刷新已启动`, {
      description: '数据正在后台刷新中，请稍候重新查看',
    });
  } catch (error: any) {
    notification.error('刷新失败', {
      description: error?.message || '',
    });
  }
}

function handleOpenSiteDetail(row: StatisticsItem) {
  siteDetailName.value = row.site_name;
  siteDetailModalShow.value = true;
}

async function fetchData() {
  loading.value = true;
  try {
    const [statsRes, historyRes, dailyRes, favRes]: any = await Promise.all([
      getSiteStatisticsApi({}),
      getSiteHistoryApi({ days: 7 }),
      getSiteDailyHistoryApi({ days: 30 }),
      getSiteFaviconsApi(),
    ]);
    statistics.value = Array.isArray(statsRes)
      ? statsRes
      : statsRes?.data || [];
    const hdata = historyRes?.dataset || [];
    historyData.value = hdata.length > 1 ? hdata.slice(1) : [];
    dailyData.value = dailyRes || { dates: [], series: [] };
    const favData =
      typeof favRes === 'object' && !Array.isArray(favRes)
        ? favRes
        : favRes?.data || {};
    favicons.value = favData;
  } catch (error: any) {
    notification.error('获取数据失败', {
      description: error?.message || '',
    });
  } finally {
    loading.value = false;
  }
}

function onResize() {
  screenWidth.value = window.innerWidth;
}

watch(sortBy, () => {
  fetchData();
});

onMounted(() => {
  fetchData();
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="p-4 overflow-x-hidden">
    <PageHeader title="站点数据统计">
      <template #actions>
        <NSpace>
          <NSelect
            v-model:value="sortBy"
            :options="sortOptions"
            style="width: 140px"
            size="small"
          />
          <NButton size="small" :loading="refreshing" @click="handleRefresh">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            刷新
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <div v-if="summary" class="stats-overview">
      <NCard
        v-for="card in summaryCards"
        :key="card.label"
        size="small"
        class="stat-card"
      >
        <div class="stat-inner">
          <div class="stat-icon" :class="`stat-icon-${card.tone}`">
            <IconifyIcon :icon="card.icon" class="h-5 w-5" />
          </div>
          <div class="stat-body">
            <div class="stat-value" :class="`stat-${card.tone}`">
              {{ card.value }}
            </div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </NCard>
    </div>

    <NSpin :show="loading">
      <ChartCards
        v-if="statistics.length > 0"
        :statistics="statistics"
        :history-data="historyData"
        :daily-data="dailyData"
        v-model:daily-mode="dailyMode"
      />

      <NCard v-if="statistics.length > 0" size="small" class="table-card">
        <template #header>
          <div class="section-header">
            <IconifyIcon icon="lucide:table" class="h-4 w-4" />
            <span>站点详细数据</span>
          </div>
        </template>
        <StatTable
          :data="sortedStatistics"
          :favicons="favicons"
          :is-mobile="isMobile"
          @refresh="handleRefreshSite"
          @detail="handleOpenSiteDetail"
        />
      </NCard>

      <EmptyState
        v-else-if="!loading"
        title="暂无数据"
        subtitle="没有找到站点统计数据，请检查站点是否已配置数据统计功能"
      />
    </NSpin>

    <SiteDetailModal
      v-model:show="siteDetailModalShow"
      :site-name="siteDetailName"
    />
  </div>
</template>

<style scoped>
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-card :deep(.n-card__content) {
  padding: 0.875rem 1rem;
}

.stat-inner {
  display: flex;
  gap: 0.875rem;
  align-items: center;
}

.stat-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 12%);
  border-radius: 0.625rem;
}

.stat-icon-success {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 12%);
}

.stat-icon-warning {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 12%);
}

.stat-icon-destructive {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 12%);
}

.stat-icon-primary {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 12%);
}

.stat-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.25;
  color: hsl(var(--card-foreground));
}

.stat-success {
  color: hsl(var(--success));
}

.stat-warning {
  color: hsl(var(--warning));
}

.stat-destructive {
  color: hsl(var(--destructive));
}

.stat-primary {
  color: hsl(var(--primary));
}

.stat-label {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.table-card {
  margin-top: 1rem;
}

.table-card :deep(.n-card__content) {
  padding: 0.5rem;
}

.section-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

@media (max-width: 1024px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .stat-card :deep(.n-card__content) {
    padding: 0.625rem 0.5rem;
  }

  .stat-inner {
    gap: 0.5rem;
  }

  .stat-icon {
    width: 2rem;
    height: 2rem;
  }

  .stat-value {
    font-size: 0.9375rem;
  }

  .stat-label {
    font-size: 0.6875rem;
  }

  .table-card {
    margin-top: 0.75rem;
  }
}
</style>
