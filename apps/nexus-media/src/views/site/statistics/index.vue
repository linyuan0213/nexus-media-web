<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { toPng } from 'html-to-image';
import { NButton, NCard, NPopover, NSelect, NSpace, NSpin } from 'naive-ui';

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
const refreshing = ref(false);
const capturing = ref(false);
const siteFilterList = ref<string[]>([]);
const showAllForCapture = ref(false);
const pageRef = ref<HTMLElement | null>(null);

const siteDetailModalShow = ref(false);
const siteDetailName = ref('');

const siteFilterOptions = computed(() =>
  statistics.value
    .map((i) => ({ label: i.site_name, value: i.site_name }))
    .toSorted((a, b) => a.label.localeCompare(b.label, 'zh')),
);

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
      tone: 'info',
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
      tone: 'cyan',
      value: s.avgRatio,
    },
    {
      icon: 'lucide:hard-drive',
      label: '总做种数',
      tone: 'purple',
      value: String(s.seeding),
    },
    {
      icon: 'lucide:sparkles',
      label: '总魔力值',
      tone: 'pink',
      value: Number(s.bonus).toFixed(0),
    },
    {
      icon: 'lucide:mail',
      label: '未读消息',
      tone: 'danger',
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
  const avgRatio = totalDownload > 0 ? totalUpload / totalDownload : 0;
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
  let items = [...statistics.value];
  if (siteFilterList.value.length > 0) {
    items = items.filter((i) => siteFilterList.value.includes(i.site_name));
  }
  return items;
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

async function handleScreenshot() {
  if (!pageRef.value) return;
  capturing.value = true;
  // 截图期间临时展开表格全部行（不受分页限制），完成后恢复
  showAllForCapture.value = true;
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    // html-to-image 按节点完整高度原生渲染（foreignObject），
    // 全页截图且 Naive UI 组件（NTag 等）不失真
    const dataUrl = await toPng(pageRef.value, {
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `站点数据统计-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
    notification.success('截图已保存');
  } catch (error: any) {
    notification.error('截图失败', {
      description: error?.message || '',
    });
  } finally {
    showAllForCapture.value = false;
    capturing.value = false;
  }
}

onMounted(() => {
  fetchData();
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div ref="pageRef" class="p-4 overflow-x-hidden">
    <PageHeader title="站点数据统计">
      <template #actions>
        <NSpace>
          <NButton size="small" :loading="capturing" @click="handleScreenshot">
            <template #icon>
              <IconifyIcon icon="lucide:camera" class="h-4 w-4" />
            </template>
            截图
          </NButton>
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
      <div
        v-for="card in summaryCards"
        :key="card.label"
        class="tbl-card stat-card"
      >
        <div class="stat-inner">
          <div class="stat-icon" :class="`tone-${card.tone}`">
            <IconifyIcon :icon="card.icon" class="h-5 w-5" />
          </div>
          <div class="stat-body">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </div>
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
        <template #header-extra>
          <NPopover placement="bottom-end" trigger="click">
            <template #trigger>
              <NButton size="tiny" quaternary circle type="primary">
                <template #icon>
                  <IconifyIcon icon="lucide:filter" class="h-4 w-4" />
                </template>
              </NButton>
            </template>
            <NSelect
              v-model:value="siteFilterList"
              :options="siteFilterOptions"
              multiple
              clearable
              filterable
              placeholder="筛选站点（可多选）"
              size="small"
              style="width: 13rem"
            />
          </NPopover>
        </template>
        <StatTable
          :data="sortedStatistics"
          :favicons="favicons"
          :is-mobile="isMobile"
          :show-all="showAllForCapture"
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
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-card {
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
  border-radius: var(--tblr-card-border-radius);
}

.tone-primary {
  color: var(--tblr-primary);
  background: rgb(var(--tblr-primary-rgb) / 10%);
}

.tone-success {
  color: var(--tblr-success);
  background: color-mix(in srgb, var(--tblr-success) 10%, transparent);
}

.tone-warning {
  color: var(--tblr-warning);
  background: color-mix(in srgb, var(--tblr-warning) 10%, transparent);
}

.tone-info {
  color: var(--tblr-info);
  background: color-mix(in srgb, var(--tblr-info) 10%, transparent);
}

.tone-cyan {
  color: var(--tblr-cyan);
  background: color-mix(in srgb, var(--tblr-cyan) 10%, transparent);
}

.tone-purple {
  color: var(--tblr-purple);
  background: color-mix(in srgb, var(--tblr-purple) 10%, transparent);
}

.tone-pink {
  color: var(--tblr-pink);
  background: color-mix(in srgb, var(--tblr-pink) 10%, transparent);
}

.tone-danger {
  color: var(--tblr-danger);
  background: color-mix(in srgb, var(--tblr-danger) 10%, transparent);
}

.stat-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-value {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1.125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  color: var(--tblr-text-heading);
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.stat-label {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--tblr-text-muted);
}

.table-card {
  margin-top: 1rem;
  background: var(--tblr-card-bg);
  border-color: var(--tblr-card-border-color);
  border-radius: var(--tblr-card-border-radius);
  box-shadow: var(--tblr-box-shadow-card);
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
  color: var(--tblr-text-heading);
}

@media (min-width: 768px) {
  .stats-overview {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1280px) {
  .stats-overview {
    grid-template-columns: repeat(8, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .stats-overview {
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .stat-card {
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
