<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';

interface Props {
  labels: string[];
  movieData: number[];
  tvData: number[];
  animeData: number[];
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const { mutedColor, borderColor } = useChartTheme();

const SERIES_CONFIG = [
  { name: '电影', dataKey: 'movieData' as const, color: 'hsl(26, 85%, 65%)' },
  { name: '电视剧', dataKey: 'tvData' as const, color: 'hsl(201, 66%, 57%)' },
  { name: '动漫', dataKey: 'animeData' as const, color: 'hsl(346, 74%, 67%)' },
];

function toTransparent(hsl: string): string {
  const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (m) return `hsla(${m[1]}, ${m[2]}%, ${m[3]}%, 0)`;
  return hsl;
}

function buildOption() {
  return {
    grid: {
      bottom: 24,
      containLabel: true,
      left: 12,
      right: 12,
      top: 40,
    },
    legend: {
      data: SERIES_CONFIG.map((s) => s.name),
      top: 0,
    },
    series: SERIES_CONFIG.map((s) => ({
      areaStyle: {
        color: {
          colorStops: [
            { color: s.color, offset: 0 },
            { color: toTransparent(s.color), offset: 1 },
          ],
          type: 'linear',
          x: 0,
          x2: 0,
          y: 0,
          y2: 1,
        },
      },
      data: props[s.dataKey],
      emphasis: { focus: 'series' },
      itemStyle: { color: s.color },
      lineStyle: { width: 2.5 },
      name: s.name,
      showSymbol: false,
      smooth: true,
      stack: 'total',
      type: 'line',
    })),
    tooltip: {
      axisPointer: { type: 'shadow' },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: mutedColor.value as any },
      axisLine: { show: false },
      axisTick: { show: false },
      boundaryGap: false,
      data: props.labels,
      type: 'category' as const,
    },
    yAxis: {
      axisLabel: { color: mutedColor.value as any },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: borderColor.value,
          type: 'dashed',
        },
      },
      type: 'value' as const,
    },
  };
}

onMounted(() => {
  renderEcharts(buildOption() as any);
});

watch(
  () => [
    props.labels,
    props.movieData,
    props.tvData,
    props.animeData,
    mutedColor.value,
    borderColor.value,
  ],
  () => {
    renderEcharts(buildOption() as any);
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
