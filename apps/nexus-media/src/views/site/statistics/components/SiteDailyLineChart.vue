<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';

interface SeriesItem {
  name: string;
  upload: number[];
  download: number[];
}

interface Props {
  dates: string[];
  series: SeriesItem[];
  mode?: 'download' | 'upload';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'upload',
});

const { formatSize, generateChartColor, getThemeColor } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

const activeSeries = computed(() => {
  return props.series.map((s, idx) => ({
    name: s.name,
    type: 'line' as const,
    smooth: true,
    showSymbol: true,
    symbolSize: 4,
    lineStyle: { width: 2 },
    itemStyle: {
      color: generateChartColor(idx, props.series.length),
    },
    data: props.mode === 'upload' ? s.upload : s.download,
  }));
});

function buildOption() {
  return {
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
      textStyle: { color: getThemeColor('--card-foreground'), fontSize: 11 },
      type: 'scroll' as const,
    },
    series: activeSeries.value,
    tooltip: {
      axisPointer: { type: 'line' as const },
      formatter: (params: any) => {
        const textColor = getThemeColor('--card-foreground');
        let html = `<div style="font-weight:600;margin-bottom:4px;color:${textColor}">${params[0]?.name}</div>`;
        params.forEach((p: any) => {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span style="color:${textColor}">${p.seriesName}: ${formatSize(p.value)}</span>
          </div>`;
        });
        return html;
      },
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: {
        color: getThemeColor('--muted-foreground'),
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
        color: getThemeColor('--muted-foreground'),
        fontSize: 10,
        formatter: (v: number) => formatSize(v),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: getThemeColor('--border'),
          type: 'dashed' as const,
        },
      },
      type: 'value' as const,
    },
  };
}

onMounted(() => {
  renderEcharts(buildOption());
});

watch(
  () => [props.dates, props.series, props.mode],
  () => {
    renderEcharts(buildOption());
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-72 w-full" />
</template>
