<script lang="ts" setup>
import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NEmpty, NPopover, NSelect, NTag } from 'naive-ui';

import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';

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

/** 近30天趋势"只看站点"筛选 */
const focusSite = ref('');

const focusSiteOptions = computed(() => [
  { label: '全部站点', value: '' },
  ...props.statistics
    .map((i) => ({ label: i.site_name, value: i.site_name }))
    .toSorted((a, b) => a.label.localeCompare(b.label, 'zh')),
]);

// 图表点击：传 '' 表示清除，传站点名表示选中
function onSelectSite(site: string) {
  selectedSite.value = site;
}

const barLabels = computed(() => props.statistics.map((i) => i.site_name));
const barUploads = computed(() =>
  props.statistics.map((i) => parseSize(i.upload)),
);
const barDownloads = computed(() =>
  props.statistics.map((i) => parseSize(i.download)),
);

const uploadPieData = computed(() =>
  props.statistics
    .map((i) => ({ name: i.site_name, value: parseSize(i.upload) }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value),
);

const trendLabels = computed(() => props.historyData.map((i) => i[0]));
const trendUploads = computed(() => props.historyData.map((i) => i[1]));
const trendDownloads = computed(() => props.historyData.map((i) => i[2]));

const seedingRoseData = computed(() =>
  props.statistics
    .map((i) => ({ name: i.site_name, value: i.seeding_count || 0 }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value),
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
      class="chart-card-full"
    />

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="站点流量对比"
    >
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
      <SiteHistoryTrendChart
        v-if="historyData.length > 0"
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
      <SiteUploadPieChart
        v-if="uploadPieData.length > 0"
        :data="uploadPieData"
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
      <SiteSeedingRoseChart
        v-if="seedingRoseData.length > 0"
        :data="seedingRoseData"
        :selected-site="selectedSite"
        @select-site="onSelectSite"
      />
      <NEmpty v-else description="暂无做种数据" />
    </NCard>

    <NCard
      v-if="dailyData.series.length > 0"
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
              v-model:value="focusSite"
              :options="focusSiteOptions"
              clearable
              filterable
              placeholder="筛选站点"
              size="small"
              style="width: 11rem"
            />
          </NPopover>
        </div>
      </template>
      <SiteDailyLineChart
        :dates="dailyData.dates"
        :series="dailyData.series"
        :mode="dailyMode"
        :selected-site="selectedSite"
        :focus-site="focusSite"
        @select-site="onSelectSite"
        @update:focus-site="(v: string) => (focusSite = v)"
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
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 25%);
  border-radius: 0.5rem;
}

.filter-text {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.8125rem;
  color: hsl(var(--card-foreground));
}

.mode-toggle {
  display: flex;
  gap: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
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
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: none;
  transition: all 0.2s;
}

.mode-toggle button.active {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}

@media (max-width: 640px) {
  .charts-layout {
    grid-template-columns: 1fr;
  }
}
</style>
