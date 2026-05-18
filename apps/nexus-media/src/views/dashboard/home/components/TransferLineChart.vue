<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface Props {
  labels: string[];
  movieData: number[];
  tvData: number[];
  animeData: number[];
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function buildOption() {
  return {
    grid: {
      bottom: 24,
      containLabel: true,
      left: 12,
      right: 12,
      top: 32,
    },
    legend: {
      data: ['电影', '电视剧', '动漫'],
      top: 0,
    },
    series: [
      {
        areaStyle: { opacity: 0.15 },
        data: props.movieData,
        itemStyle: { color: 'hsl(217, 90%, 58%)' },
        lineStyle: { width: 2 },
        name: '电影',
        showSymbol: false,
        smooth: true,
        type: 'line',
      },
      {
        areaStyle: { opacity: 0.15 },
        data: props.tvData,
        itemStyle: { color: 'hsl(145, 75%, 42%)' },
        lineStyle: { width: 2 },
        name: '电视剧',
        showSymbol: false,
        smooth: true,
        type: 'line',
      },
      {
        areaStyle: { opacity: 0.15 },
        data: props.animeData,
        itemStyle: { color: 'hsl(340, 85%, 58%)' },
        lineStyle: { width: 2 },
        name: '动漫',
        showSymbol: false,
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: {
      axisPointer: { type: 'line' },
      trigger: 'axis',
    },
    xAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      boundaryGap: false,
      data: props.labels,
      type: 'category',
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: 'hsl(var(--border) / 0.5)',
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

onMounted(() => {
  renderEcharts(buildOption());
});

watch(() => [props.labels, props.movieData, props.tvData, props.animeData], () => {
  renderEcharts(buildOption());
}, { deep: true });
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
