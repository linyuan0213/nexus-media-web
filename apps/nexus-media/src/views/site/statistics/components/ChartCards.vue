<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { NCard, NEmpty } from 'naive-ui';

import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';

import SiteDailyLineChart from './SiteDailyLineChart.vue';

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

const { formatSize, getChartPalette, getThemeColors, parseSize } =
  useSiteStats();

const chartBarRef = ref<any>(null);
const chartPieRef = ref<any>(null);
const chartTrendRef = ref<any>(null);
const chartRoseRef = ref<any>(null);

const { renderEcharts: renderBar } = useEcharts(chartBarRef);
const { renderEcharts: renderPie } = useEcharts(chartPieRef);
const { renderEcharts: renderTrend } = useEcharts(chartTrendRef);
const { renderEcharts: renderRose } = useEcharts(chartRoseRef);

const hasHistoryData = () => props.historyData.length > 0;
const hasUploadData = () =>
  props.statistics.some((s) => parseSize(s.upload) > 0);
const hasSeedingData = () =>
  props.statistics.some((s) => (s.seeding_count || 0) > 0);

function commonGrid(bottom = '15%') {
  return {
    bottom,
    containLabel: true,
    left: '3%',
    right: '4%',
    top: '10%',
  };
}

function commonXAxis(data: string[]) {
  return {
    axisLabel: {
      color: getThemeColors().mutedForeground,
      interval: 0,
      rotate: 45,
    },
    axisLine: { lineStyle: { color: getThemeColors().border } },
    data,
    type: 'category' as const,
  };
}

function commonYAxis(name?: string) {
  return {
    axisLabel: {
      color: getThemeColors().mutedForeground,
      formatter: (value: number) => formatSize(value),
    },
    name,
    nameTextStyle: { color: getThemeColors().mutedForeground },
    splitLine: {
      lineStyle: {
        color: getThemeColors().border,
        type: 'dashed' as const,
      },
    },
    type: 'value' as const,
  };
}

function tooltipHtml(title: string, items: any[]): string {
  let result = `<div style="font-weight:600;margin-bottom:4px">${title}</div>`;
  items.forEach((p: any) => {
    result += `<div style="display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
      <span>${p.seriesName}: ${formatSize(p.value)}</span>
    </div>`;
  });
  return result;
}

function renderAllCharts() {
  renderBarChart();
  renderPieChart();
  renderTrendChart();
  renderRoseChart();
}

function renderBarChart() {
  if (props.statistics.length === 0) return;
  const sites = props.statistics.map((i) => i.site_name);
  const uploads = props.statistics.map((i) => parseSize(i.upload));
  const downloads = props.statistics.map((i) => parseSize(i.download));
  const colors = getThemeColors();

  renderBar({
    grid: commonGrid(),
    legend: {
      bottom: 0,
      data: ['上传量', '下载量'],
      textStyle: { color: colors.cardForeground },
    },
    series: [
      {
        barMaxWidth: 24,
        data: uploads,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: colors.success },
        name: '上传量',
        type: 'bar',
      },
      {
        barMaxWidth: 24,
        data: downloads,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: colors.warning },
        name: '下载量',
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => tooltipHtml(params[0].name, params),
      trigger: 'axis',
    },
    xAxis: commonXAxis(sites),
    yAxis: commonYAxis('流量'),
  });
}

function renderPieChart() {
  if (!hasUploadData()) return;
  const data = props.statistics
    .map((i) => ({ name: i.site_name, value: parseSize(i.upload) }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value);

  const palette = getChartPalette(data.length);

  renderPie({
    color: palette,
    legend: {
      bottom: 20,
      orient: 'vertical',
      right: 10,
      textStyle: { color: getThemeColors().cardForeground },
      top: 20,
      type: 'scroll',
    },
    series: [
      {
        avoidLabelOverlap: false,
        center: ['35%', '50%'],
        data,
        emphasis: {
          label: {
            color: getThemeColors().cardForeground,
            fontSize: 14,
            fontWeight: 'bold',
            show: true,
          },
        },
        itemStyle: {
          borderColor: getThemeColors().card,
          borderRadius: 8,
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        name: '上传量分布',
        radius: ['40%', '70%'],
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `<div style="font-weight:600">${params.name}</div>
         <div>上传量: ${formatSize(params.value)}</div>
         <div>占比: ${params.percent}%</div>`,
      trigger: 'item',
    },
  });
}

function renderTrendChart() {
  if (!hasHistoryData()) return;
  const sites = props.historyData.map((i) => i[0]);
  const uploads = props.historyData.map((i) => i[1]);
  const downloads = props.historyData.map((i) => i[2]);
  const colors = getThemeColors();

  renderTrend({
    grid: commonGrid(),
    legend: {
      bottom: 0,
      data: ['近7天上传', '近7天下载'],
      textStyle: { color: colors.cardForeground },
    },
    series: [
      {
        barMaxWidth: 20,
        data: uploads,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: colors.primary },
        name: '近7天上传',
        type: 'bar',
      },
      {
        barMaxWidth: 20,
        data: downloads,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: colors.destructive },
        name: '近7天下载',
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => tooltipHtml(params[0].name, params),
      trigger: 'axis',
    },
    xAxis: commonXAxis(sites),
    yAxis: commonYAxis('近7天增量'),
  });
}

function renderRoseChart() {
  if (!hasSeedingData()) return;
  const data = props.statistics
    .map((i) => ({ name: i.site_name, value: i.seeding_count || 0 }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value);

  const palette = getChartPalette(data.length);

  renderRose({
    color: palette,
    legend: {
      bottom: 20,
      orient: 'vertical',
      right: 10,
      textStyle: { color: getThemeColors().cardForeground },
      top: 20,
      type: 'scroll',
    },
    series: [
      {
        center: ['35%', '50%'],
        data,
        emphasis: {
          label: {
            color: getThemeColors().cardForeground,
            fontSize: 13,
            fontWeight: 'bold',
            show: true,
          },
        },
        itemStyle: {
          borderColor: getThemeColors().card,
          borderRadius: 6,
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        name: '做种分布',
        radius: [20, 100],
        roseType: 'area',
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `<div style="font-weight:600">${params.name}</div>
         <div>做种数: ${params.value}</div>
         <div>占比: ${params.percent}%</div>`,
      trigger: 'item',
    },
  });
}

watch(
  () => [props.statistics, props.historyData],
  () => {
    renderAllCharts();
  },
  { deep: true },
);

onMounted(() => {
  renderAllCharts();
});
</script>

<template>
  <div class="charts-layout">
    <NCard size="small" class="chart-card">
      <template #header>
        <div class="chart-header">
          <div class="chart-title">
            <IconifyIcon icon="lucide:bar-chart-2" class="h-4 w-4" />
            <span>站点流量对比</span>
          </div>
        </div>
      </template>
      <EchartsUI
        v-if="statistics.length > 0"
        ref="chartBarRef"
        class="h-80 w-full"
      />
      <NEmpty v-else description="暂无站点流量数据" />
    </NCard>

    <NCard size="small" class="chart-card">
      <template #header>
        <div class="chart-header">
          <div class="chart-title">
            <IconifyIcon icon="lucide:pie-chart" class="h-4 w-4" />
            <span>上传量分布</span>
          </div>
        </div>
      </template>
      <EchartsUI v-if="hasUploadData()" ref="chartPieRef" class="h-80 w-full" />
      <NEmpty v-else description="暂无上传量数据" />
    </NCard>

    <NCard size="small" class="chart-card">
      <template #header>
        <div class="chart-header">
          <div class="chart-title">
            <IconifyIcon icon="lucide:trending-up" class="h-4 w-4" />
            <span>近7天流量增量</span>
          </div>
        </div>
      </template>
      <EchartsUI
        v-if="hasHistoryData()"
        ref="chartTrendRef"
        class="h-80 w-full"
      />
      <NEmpty v-else description="暂无近7天流量数据" />
    </NCard>

    <NCard size="small" class="chart-card">
      <template #header>
        <div class="chart-header">
          <div class="chart-title">
            <IconifyIcon icon="lucide:flower-2" class="h-4 w-4" />
            <span>做种数分布（玫瑰图）</span>
          </div>
        </div>
      </template>
      <EchartsUI
        v-if="hasSeedingData()"
        ref="chartRoseRef"
        class="h-80 w-full"
      />
      <NEmpty v-else description="暂无做种数据" />
    </NCard>

    <NCard
      v-if="dailyData.series.length > 0"
      size="small"
      class="chart-card chart-card-full"
    >
      <template #header>
        <div class="chart-header">
          <div class="chart-title">
            <IconifyIcon icon="lucide:activity" class="h-4 w-4" />
            <span>近30天各站点流量趋势</span>
          </div>
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
  padding: 0.5rem;
}

.chart-card-full {
  grid-column: 1 / -1;
}

.chart-header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.chart-title {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
