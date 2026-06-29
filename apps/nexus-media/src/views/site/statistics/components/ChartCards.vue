<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';

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

const { renderEcharts: renderBar, updateData: updateBar } =
  useEcharts(chartBarRef);
const { renderEcharts: renderPie, updateData: updatePie } =
  useEcharts(chartPieRef);
const { renderEcharts: renderTrend, updateData: updateTrend } =
  useEcharts(chartTrendRef);
const { renderEcharts: renderRose, updateData: updateRose } =
  useEcharts(chartRoseRef);

const hasHistoryData = () => props.historyData.length > 0;
const hasUploadData = () =>
  props.statistics.some((s) => parseSize(s.upload) > 0);
const hasSeedingData = () =>
  props.statistics.some((s) => (s.seeding_count || 0) > 0);

const colors = getThemeColors();

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

function buildBarOption() {
  if (props.statistics.length === 0) return null;
  const sites = props.statistics.map((i) => i.site_name);
  const uploads = props.statistics.map((i) => parseSize(i.upload));
  const downloads = props.statistics.map((i) => parseSize(i.download));

  return {
    grid: {
      bottom: '15%',
      containLabel: true,
      left: '3%',
      right: '4%',
      top: '10%',
    },
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
        type: 'bar' as const,
      },
      {
        barMaxWidth: 24,
        data: downloads,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: colors.warning },
        name: '下载量',
        type: 'bar' as const,
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' as const },
      formatter: (params: any) => tooltipHtml(params[0].name, params),
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: {
        color: colors.mutedForeground,
        interval: 0,
        rotate: 45,
      },
      axisLine: { lineStyle: { color: colors.border } },
      data: sites,
      type: 'category' as const,
    },
    yAxis: {
      axisLabel: {
        color: colors.mutedForeground,
        formatter: (value: number) => formatSize(value),
      },
      name: '流量',
      nameTextStyle: { color: colors.mutedForeground },
      splitLine: {
        lineStyle: { color: colors.border, type: 'dashed' as const },
      },
      type: 'value' as const,
    },
  };
}

function buildPieOption() {
  if (!hasUploadData()) return null;
  const data = props.statistics
    .map((i) => ({ name: i.site_name, value: parseSize(i.upload) }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value);

  return {
    color: getChartPalette(data.length),
    legend: {
      bottom: 20,
      orient: 'vertical' as const,
      right: 10,
      textStyle: { color: colors.cardForeground },
      top: 20,
      type: 'scroll' as const,
    },
    series: [
      {
        avoidLabelOverlap: false,
        center: ['35%', '50%'],
        data,
        emphasis: {
          label: {
            color: colors.cardForeground,
            fontSize: 14,
            fontWeight: 'bold' as const,
            show: true,
          },
        },
        itemStyle: {
          borderColor: colors.card,
          borderRadius: 8,
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        name: '上传量分布',
        radius: ['40%', '70%'],
        type: 'pie' as const,
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `<div style="font-weight:600">${params.name}</div>
         <div>上传量: ${formatSize(params.value)}</div>
         <div>占比: ${params.percent}%</div>`,
      trigger: 'item' as const,
    },
  };
}

function buildTrendOption() {
  if (!hasHistoryData()) return null;
  const sites = props.historyData.map((i) => i[0]);
  const uploads = props.historyData.map((i) => i[1]);
  const downloads = props.historyData.map((i) => i[2]);

  return {
    grid: {
      bottom: '15%',
      containLabel: true,
      left: '3%',
      right: '4%',
      top: '10%',
    },
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
        type: 'bar' as const,
      },
      {
        barMaxWidth: 20,
        data: downloads,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: colors.destructive },
        name: '近7天下载',
        type: 'bar' as const,
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' as const },
      formatter: (params: any) => tooltipHtml(params[0].name, params),
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: {
        color: colors.mutedForeground,
        interval: 0,
        rotate: 45,
      },
      axisLine: { lineStyle: { color: colors.border } },
      data: sites,
      type: 'category' as const,
    },
    yAxis: {
      axisLabel: {
        color: colors.mutedForeground,
        formatter: (value: number) => formatSize(value),
      },
      name: '近7天增量',
      nameTextStyle: { color: colors.mutedForeground },
      splitLine: {
        lineStyle: { color: colors.border, type: 'dashed' as const },
      },
      type: 'value' as const,
    },
  };
}

function buildRoseOption() {
  if (!hasSeedingData()) return null;
  const data = props.statistics
    .map((i) => ({ name: i.site_name, value: i.seeding_count || 0 }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value);

  return {
    color: getChartPalette(data.length),
    legend: {
      bottom: 20,
      orient: 'vertical' as const,
      right: 10,
      textStyle: { color: colors.cardForeground },
      top: 20,
      type: 'scroll' as const,
    },
    series: [
      {
        center: ['35%', '50%'],
        data,
        emphasis: {
          label: {
            color: colors.cardForeground,
            fontSize: 13,
            fontWeight: 'bold' as const,
            show: true,
          },
        },
        itemStyle: {
          borderColor: colors.card,
          borderRadius: 6,
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        name: '做种分布',
        radius: [20, 100],
        roseType: 'area' as const,
        type: 'pie' as const,
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `<div style="font-weight:600">${params.name}</div>
         <div>做种数: ${params.value}</div>
         <div>占比: ${params.percent}%</div>`,
      trigger: 'item' as const,
    },
  };
}

function renderAllCharts() {
  const bar = buildBarOption();
  const pie = buildPieOption();
  const trend = buildTrendOption();
  const rose = buildRoseOption();
  if (bar) renderBar(bar);
  if (pie) renderPie(pie);
  if (trend) renderTrend(trend);
  if (rose) renderRose(rose);
}

function updateAllCharts() {
  const bar = buildBarOption();
  const pie = buildPieOption();
  const trend = buildTrendOption();
  const rose = buildRoseOption();
  if (bar) updateBar(bar);
  if (pie) updatePie(pie);
  if (trend) updateTrend(trend);
  if (rose) updateRose(rose);
}

onMounted(() => {
  renderAllCharts();
});

watch(
  () => [props.statistics, props.historyData],
  () => {
    updateAllCharts();
  },
  { deep: true },
);
</script>

<template>
  <div class="charts-layout">
    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="站点流量对比"
    >
      <EchartsUI
        v-if="statistics.length > 0"
        ref="chartBarRef"
        class="h-64 w-full"
      />
      <NEmpty v-else description="暂无站点流量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="上传量分布"
    >
      <EchartsUI v-if="hasUploadData()" ref="chartPieRef" class="h-64 w-full" />
      <NEmpty v-else description="暂无上传量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="近7天流量增量"
    >
      <EchartsUI
        v-if="hasHistoryData()"
        ref="chartTrendRef"
        class="h-64 w-full"
      />
      <NEmpty v-else description="暂无近7天流量数据" />
    </NCard>

    <NCard
      :bordered="false"
      :segmented="{ content: true }"
      class="chart-card"
      title="做种数分布（玫瑰图）"
    >
      <EchartsUI
        v-if="hasSeedingData()"
        ref="chartRoseRef"
        class="h-64 w-full"
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
