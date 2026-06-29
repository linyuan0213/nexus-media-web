<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';

interface SeriesItem {
  download: number[];
  name: string;
  upload: number[];
}

interface Props {
  dates: string[];
  series: SeriesItem[];
  mode?: 'download' | 'upload';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'upload',
});

const { formatSize, getChartDataKey } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts, updateData } = useEcharts(chartRef);

const TEXT_COLOR = 'hsl(var(--card-foreground))';

const PALETTE = [
  'hsl(217, 90%, 58%)',
  'hsl(145, 75%, 42%)',
  'hsl(340, 85%, 58%)',
  'hsl(24, 95%, 55%)',
  'hsl(280, 70%, 60%)',
  'hsl(160, 75%, 45%)',
  'hsl(195, 85%, 45%)',
  'hsl(55, 90%, 50%)',
];

function getColor(index: number): string {
  return PALETTE[index % PALETTE.length] || PALETTE[0]!;
}

const activeSeries = computed(() => {
  return props.series.map((s, idx) => ({
    data: props.mode === 'upload' ? s.upload : s.download,
    itemStyle: { color: getColor(idx) },
    lineStyle: { width: 2 },
    name: s.name,
    showSymbol: true,
    smooth: true,
    symbolSize: 4,
    type: 'line' as const,
  }));
});

function buildOption() {
  return {
    animationDurationUpdate: 0,
    grid: {
      bottom: 36,
      containLabel: true,
      left: 12,
      right: 12,
      top: 40,
    },
    legend: {
      bottom: 0,
      itemGap: 12,
      left: 'center',
      textStyle: { fontSize: 11 },
      type: 'scroll' as const,
    },
    series: activeSeries.value,
    tooltip: {
      axisPointer: { type: 'line' as const },
      formatter: (params: any) => {
        let html = `<div style="font-weight:600;margin-bottom:4px;color:${TEXT_COLOR}">${params[0]?.name}</div>`;
        params.forEach((p: any) => {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span style="color:${TEXT_COLOR}">${p.seriesName}: ${formatSize(p.value)}</span>
          </div>`;
        });
        return html;
      },
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: {
        fontSize: 10,
        rotate: 30,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      data: props.dates,
      type: 'category' as const,
    },
    yAxis: {
      axisLabel: {
        fontSize: 10,
        formatter: (v: number) => formatSize(v),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: 'hsl(var(--border) / 0.5)',
          type: 'dashed' as const,
        },
      },
      type: 'value' as const,
    },
  };
}

onMounted(() => {
  renderEcharts(buildOption() as any);
});

let dataCacheKey = '';

watch(
  () => [props.dates, props.series, props.mode],
  (newVal) => {
    const key = getChartDataKey(newVal);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    updateData(buildOption() as any);
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
