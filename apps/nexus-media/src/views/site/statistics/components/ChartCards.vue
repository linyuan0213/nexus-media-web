<script lang="ts" setup>
import { NCard, NEmpty } from 'naive-ui';

import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';

import SiteDailyLineChart from './SiteDailyLineChart.vue';
import SiteHistoryTrendChart from './SiteHistoryTrendChart.vue';
import SiteSeedingRoseChart from './SiteSeedingRoseChart.vue';
import SiteTrafficBarChart from './SiteTrafficBarChart.vue';
import SiteUploadPieChart from './SiteUploadPieChart.vue';

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

const hasHistoryData = () => props.historyData.length > 0;
const hasUploadData = () =>
  props.statistics.some((s) => parseSize(s.upload) > 0);
const hasSeedingData = () =>
  props.statistics.some((s) => (s.seeding_count || 0) > 0);
</script>

<template>
  <div class="charts-layout">
    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="站点流量对比"
    >
      <SiteTrafficBarChart v-if="statistics.length > 0" :data="statistics" />
      <NEmpty v-else description="暂无站点流量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="上传量分布"
    >
      <SiteUploadPieChart v-if="hasUploadData()" :data="statistics" />
      <NEmpty v-else description="暂无上传量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="近7天流量增量"
    >
      <SiteHistoryTrendChart v-if="hasHistoryData()" :data="historyData" />
      <NEmpty v-else description="暂无近7天流量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="做种数分布（玫瑰图）"
    >
      <SiteSeedingRoseChart v-if="hasSeedingData()" :data="statistics" />
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
      </template>
      <SiteDailyLineChart
        :dates="dailyData.dates"
        :series="dailyData.series"
        :mode="dailyMode"
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

.chart-card :deep(.n-card__content) {
  overflow: hidden;
}

.chart-card-full {
  grid-column: 1 / -1;
}

.mode-toggle {
  display: flex;
  gap: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
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
