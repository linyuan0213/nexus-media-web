<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { NCard } from 'naive-ui';

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

const {
  formatSize,
  getChartPalette,
  getThemeColor,
  getThemeColors,
  parseSize,
} = useSiteStats();

const chartBarRef = ref<any>(null);
const chartPieRef = ref<any>(null);
const chartTrendRef = ref<any>(null);
const chartRoseRef = ref<any>(null);

const { renderEcharts: renderBar } = useEcharts(chartBarRef);
const { renderEcharts: renderPie } = useEcharts(chartPieRef);
const { renderEcharts: renderTrend } = useEcharts(chartTrendRef);
const { renderEcharts: renderRose } = useEcharts(chartRoseRef);

const chartTooltipColor = computed(() => getThemeColor('--foreground'));

function commonGrid(bottom = '15%') {
  return {
    left: '3%',
    right: '4%',
    bottom,
    top: '10%',
    containLabel: true,
  };
}

function commonXAxis(data: string[]) {
  return {
    type: 'category' as const,
    data,
    axisLabel: {
      rotate: 45,
      interval: 0,
      color: getThemeColor('--muted-foreground'),
    },
    axisLine: { lineStyle: { color: getThemeColor('--border') } },
  };
}

function commonYAxis(name?: string) {
  return {
    type: 'value' as const,
    name,
    nameTextStyle: { color: getThemeColor('--muted-foreground') },
    axisLabel: {
      color: getThemeColor('--muted-foreground'),
      formatter: (value: number) => formatSize(value),
    },
    splitLine: {
      lineStyle: { color: getThemeColor('--border'), type: 'dashed' as const },
    },
  };
}

function tooltipHtml(title: string, items: any[]): string {
  let result = `<div style="font-weight:600;margin-bottom:4px;color:${chartTooltipColor.value}">${title}</div>`;
  items.forEach((p: any) => {
    result += `<div style="display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
      <span style="color:${chartTooltipColor.value}">${p.seriesName}: ${formatSize(p.value)}</span>
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
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => tooltipHtml(params[0].name, params),
    },
    legend: {
      data: ['上传量', '下载量'],
      bottom: 0,
      textStyle: { color: colors.cardForeground },
    },
    grid: commonGrid(),
    xAxis: commonXAxis(sites),
    yAxis: commonYAxis('流量'),
    series: [
      {
        name: '上传量',
        type: 'bar',
        data: uploads,
        itemStyle: { color: colors.success, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
      {
        name: '下载量',
        type: 'bar',
        data: downloads,
        itemStyle: { color: colors.warning, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  });
}

function renderPieChart() {
  if (props.statistics.length === 0) return;
  const data = props.statistics
    .map((i) => ({ name: i.site_name, value: parseSize(i.upload) }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value);

  if (data.length === 0) return;

  const palette = getChartPalette(data.length);

  renderPie({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `<div style="font-weight:600;color:${chartTooltipColor.value}">${params.name}</div>
                <div style="color:${chartTooltipColor.value}">上传量: ${formatSize(params.value)}</div>
                <div style="color:${chartTooltipColor.value}">占比: ${params.percent}%</div>`;
      },
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 10,
      top: 20,
      bottom: 20,
      textStyle: { color: getThemeColor('--card-foreground') },
    },
    color: palette,
    series: [
      {
        name: '上传量分布',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: getThemeColor('--card'),
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: getThemeColor('--card-foreground'),
          },
        },
        labelLine: { show: false },
        data,
      },
    ],
  });
}

function renderTrendChart() {
  if (props.historyData.length === 0) return;
  const sites = props.historyData.map((i) => i[0]);
  const uploads = props.historyData.map((i) => i[1]);
  const downloads = props.historyData.map((i) => i[2]);
  const colors = getThemeColors();

  renderTrend({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => tooltipHtml(params[0].name, params),
    },
    legend: {
      data: ['近7天上传', '近7天下载'],
      bottom: 0,
      textStyle: { color: colors.cardForeground },
    },
    grid: commonGrid(),
    xAxis: commonXAxis(sites),
    yAxis: commonYAxis('近7天增量'),
    series: [
      {
        name: '近7天上传',
        type: 'bar',
        data: uploads,
        itemStyle: { color: colors.primary, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: '近7天下载',
        type: 'bar',
        data: downloads,
        itemStyle: { color: colors.destructive, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20,
      },
    ],
  });
}

function renderRoseChart() {
  if (props.statistics.length === 0) return;
  const data = props.statistics
    .map((i) => ({ name: i.site_name, value: i.seeding_count || 0 }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value);

  if (data.length === 0) return;

  const palette = getChartPalette(data.length);

  renderRose({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `<div style="font-weight:600;color:${chartTooltipColor.value}">${params.name}</div>
                <div style="color:${chartTooltipColor.value}">做种数: ${params.value}</div>
                <div style="color:${chartTooltipColor.value}">占比: ${params.percent}%</div>`;
      },
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 10,
      top: 20,
      bottom: 20,
      textStyle: { color: getThemeColor('--card-foreground') },
    },
    color: palette,
    series: [
      {
        name: '做种分布',
        type: 'pie',
        radius: [20, 100],
        center: ['35%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 6,
          borderColor: getThemeColor('--card'),
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: getThemeColor('--card-foreground'),
          },
        },
        data,
      },
    ],
  });
}

watch(
  () => [props.statistics, props.historyData],
  async () => {
    await nextTick();
    renderAllCharts();
  },
  { deep: true },
);
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
      <EchartsUI ref="chartBarRef" height="320px" />
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
      <EchartsUI ref="chartPieRef" height="320px" />
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
      <EchartsUI ref="chartTrendRef" height="320px" />
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
      <EchartsUI ref="chartRoseRef" height="320px" />
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

@media (max-width: 768px) {
  .charts-layout {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .chart-card :deep(.n-card__content) {
    padding: 0.375rem;
  }

  .chart-header {
    gap: 0.375rem;
  }

  .mode-toggle button {
    padding: 0.125rem 0.5rem;
    font-size: 0.6875rem;
  }
}
</style>
