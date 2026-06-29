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

const { formatSize, generateChartColor, getThemeColors } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts, updateData } = useEcharts(chartRef);

const colors = getThemeColors();

const activeSeries = computed(() => {
  return props.series.map((s, idx) => ({
    data: props.mode === 'upload' ? s.upload : s.download,
    itemStyle: {
      color: generateChartColor(idx, props.series.length),
    },
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
      textStyle: { color: colors.cardForeground, fontSize: 11 },
      type: 'scroll' as const,
    },
    series: activeSeries.value,
    tooltip: {
      axisPointer: { type: 'line' as const },
      formatter: (params: any) => {
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0]?.name}</div>`;
        params.forEach((p: any) => {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: ${formatSize(p.value)}</span>
          </div>`;
        });
        return html;
      },
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: {
        color: colors.mutedForeground,
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
        color: colors.mutedForeground,
        fontSize: 10,
        formatter: (v: number) => formatSize(v),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: colors.border,
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

watch(
  () => [props.dates, props.series, props.mode],
  () => {
    updateData(buildOption() as any);
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-80 w-full" />
</template>
