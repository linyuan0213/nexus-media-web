<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NEmpty, NPopover, NSelect, NTag } from 'naive-ui';

import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';
import { CHART_PALETTE } from '#/constants/chartColors';

import SiteDailyLineChart from './SiteDailyLineChart.vue';
import SiteHistoryTrendChart from './SiteHistoryTrendChart.vue';
import SiteSeedingRoseChart from './SiteSeedingRoseChart.vue';
import SiteTrafficBarChart from './SiteTrafficBarChart.vue';
import SiteUploadPieChart from './SiteUploadPieChart.vue';
import TodayTrafficCard from './TodayTrafficCard.vue';

interface DailySeries {
  download: number[];
  name: string;
  upload: number[];
}

interface Props {
  dailyData: { dates: string[]; series: DailySeries[] };
  dailyMode: 'download' | 'upload';
  historyData: [string, number, number][];
  statistics: StatisticsItem[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:dailyMode': [mode: 'download' | 'upload'];
}>();

const { parseSize } = useSiteStats();

/** 站点联动选中项，空串表示未筛选 */
const selectedSite = ref('');

/** 近30天趋势"只看站点"多选筛选 */
const focusSites = ref<string[]>([]);

/** 30天趋势：过滤全程零增量的站点 */
const activeDailySeries = computed(() =>
  props.dailyData.series.filter(
    (s) => s.upload.some((v) => v > 0) || s.download.some((v) => v > 0),
  ),
);

/** 站点多时趋势图默认聚焦流量 Top5，避免面条图 */
watch(
  activeDailySeries,
  (series) => {
    if (focusSites.value.length > 0 || series.length <= 5) return;
    focusSites.value = series
      .map((s) => ({
        name: s.name,
        total:
          s.upload.reduce((a, b) => a + b, 0) +
          s.download.reduce((a, b) => a + b, 0),
      }))
      .toSorted((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((s) => s.name);
  },
  { immediate: true },
);

const focusSiteOptions = computed(() =>
  activeDailySeries.value
    .map((s) => ({ label: s.name, value: s.name }))
    .toSorted((a, b) => a.label.localeCompare(b.label, 'zh')),
);

// 图表点击：传 '' 表示清除，传站点名表示选中
function onSelectSite(site: string) {
  selectedSite.value = site;
}

const BAR_TOP_N = 12;
const PIE_TOP_N = 8;

/** 全局站点颜色映射：按总流量排名分配，保证同一站点在所有图表中颜色一致 */
const siteColorMap = computed(() => {
  const ranked = props.statistics
    .map((i) => ({
      name: i.site_name,
      total: parseSize(i.upload) + parseSize(i.download),
    }))
    .toSorted((a, b) => b.total - a.total);
  const map: Record<string, string> = {};
  ranked.forEach((s, i) => {
    map[s.name] = CHART_PALETTE[i % CHART_PALETTE.length]!;
  });
  return map;
});

const barData = computed(() =>
  props.statistics
    .map((i) => ({
      download: parseSize(i.download),
      name: i.site_name,
      upload: parseSize(i.upload),
    }))
    .toSorted((a, b) => b.upload + b.download - (a.upload + a.download))
    .slice(0, BAR_TOP_N),
);

const barLabels = computed(() => barData.value.map((i) => i.name));
const barUploads = computed(() => barData.value.map((i) => i.upload));
const barDownloads = computed(() => barData.value.map((i) => i.download));

const uploadPieData = computed(() =>
  props.statistics
    .map((i) => ({ name: i.site_name, value: parseSize(i.upload) }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value)
    .slice(0, PIE_TOP_N),
);

/** 近7天增量：过滤零增量站点、按总量降序、仅展示 Top 12 */
const trendData = computed(() =>
  props.historyData
    .filter((i) => i[1] > 0 || i[2] > 0)
    .toSorted((a, b) => b[1] + b[2] - (a[1] + a[2]))
    .slice(0, BAR_TOP_N),
);
const trendLabels = computed(() => trendData.value.map((i) => i[0]));
const trendUploads = computed(() => trendData.value.map((i) => i[1]));
const trendDownloads = computed(() => trendData.value.map((i) => i[2]));
const hasTrendData = computed(() => trendData.value.length > 0);

const seedingRoseData = computed(() =>
  props.statistics
    .map((i) => ({ name: i.site_name, value: i.seeding_count || 0 }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value)
    .slice(0, PIE_TOP_N),
);
</script>

<template>
  <div class="charts-layout">
    <div v-if="selectedSite" class="filter-bar">
      <span class="filter-text">
        已聚焦：<NTag size="small" :bordered="false">{{ selectedSite }}</NTag>
      </span>
      <NButton size="tiny" quaternary type="primary" @click="selectedSite = ''">
        清除筛选
      </NButton>
    </div>

    <TodayTrafficCard
      v-if="dailyData.series.length > 0"
      :daily-data="dailyData"
      :color-map="siteColorMap"
      class="chart-card-full"
    />

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="站点流量对比"
    >
      <template #header-extra>
        <NTag size="small" :bordered="false" type="info">Top 12</NTag>
      </template>
      <SiteTrafficBarChart
        v-if="statistics.length > 0"
        :labels="barLabels"
        :selected-site="selectedSite"
        :upload-data="barUploads"
        :download-data="barDownloads"
        @select-site="onSelectSite"
      />
      <NEmpty v-else description="暂无站点流量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="近7天流量增量"
    >
      <template #header-extra>
        <NTag size="small" :bordered="false" type="info">Top 12</NTag>
      </template>
      <SiteHistoryTrendChart
        v-if="hasTrendData"
        :labels="trendLabels"
        :upload-data="trendUploads"
        :download-data="trendDownloads"
        :selected-site="selectedSite"
        @select-site="onSelectSite"
      />
      <NEmpty v-else description="暂无近7天流量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="上传量分布"
    >
      <template #header-extra>
        <NTag size="small" :bordered="false" type="info">Top 8</NTag>
      </template>
      <SiteUploadPieChart
        v-if="uploadPieData.length > 0"
        :data="uploadPieData"
        :color-map="siteColorMap"
        :selected-site="selectedSite"
        @select-site="onSelectSite"
      />
      <NEmpty v-else description="暂无上传量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="做种数分布"
    >
      <template #header-extra>
        <NTag size="small" :bordered="false" type="info">Top 8</NTag>
      </template>
      <SiteSeedingRoseChart
        v-if="seedingRoseData.length > 0"
        :data="seedingRoseData"
        :color-map="siteColorMap"
        :selected-site="selectedSite"
        @select-site="onSelectSite"
      />
      <NEmpty v-else description="暂无做种数据" />
    </NCard>

    <NCard
      v-if="activeDailySeries.length > 0"
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card chart-card-full"
      title="近30天各站点流量趋势"
    >
      <template #header-extra>
        <div class="chart-actions">
          <div class="mode-toggle">
            <button
              :class="{ active: dailyMode === 'upload' }"
              @click="emit('update:dailyMode', 'upload')"
            >
              上传
            </button>
            <button
              :class="{ active: dailyMode === 'download' }"
              @click="emit('update:dailyMode', 'download')"
            >
              下载
            </button>
          </div>
          <NPopover placement="bottom-end" trigger="click">
            <template #trigger>
              <NButton size="tiny" quaternary circle type="primary">
                <template #icon>
                  <IconifyIcon icon="lucide:filter" class="h-4 w-4" />
                </template>
              </NButton>
            </template>
            <NSelect
              v-model:value="focusSites"
              :options="focusSiteOptions"
              multiple
              clearable
              filterable
              placeholder="筛选站点（可多选）"
              size="small"
              style="width: 13rem"
            />
          </NPopover>
        </div>
      </template>
      <SiteDailyLineChart
        :dates="dailyData.dates"
        :series="activeDailySeries"
        :mode="dailyMode"
        :selected-site="selectedSite"
        :focus-sites="focusSites"
        :color-map="siteColorMap"
        @select-site="onSelectSite"
      />
    </NCard>
  </div>
</template>

<style scoped>
.charts-layout {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  width: 100%;
  max-width: 100%;
}

.chart-card {
  background: var(--tblr-card-bg);
  border-color: var(--tblr-card-border-color);
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

.chart-card :deep(.n-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 16rem;
}

.chart-card-full {
  grid-column: 1 / -1;
}

.filter-bar {
  display: flex;
  grid-column: 1 / -1;
  gap: 0.625rem;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  background: rgb(var(--tblr-primary-rgb) / 8%);
  border: 1px solid rgb(var(--tblr-primary-rgb) / 25%);
  border-radius: var(--tblr-card-border-radius);
}

.filter-text {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.8125rem;
  color: var(--tblr-text-heading);
}

.mode-toggle {
  display: flex;
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--tblr-card-border-color);
  border-radius: 0.375rem;
}

.chart-actions {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.mode-toggle button {
  padding: 0.125rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--tblr-text-muted);
  cursor: pointer;
  background: var(--tblr-card-bg);
  border: none;
  transition: all 0.2s;
}

.mode-toggle button.active {
  color: #fff;
  background: var(--tblr-primary);
}

@media (max-width: 768px) {
  .charts-layout {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
}
</style>
