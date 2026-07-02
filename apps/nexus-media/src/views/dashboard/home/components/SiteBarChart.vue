<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';
interface Props {
  labels: string[];
  uploadData: number[];
  downloadData: number[];
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const { mutedColor, borderColor } = useChartTheme();

function formatBytes(val: number): string {
  if (val >= 1024 ** 4) return `${(val / 1024 ** 4).toFixed(1)}TB`;
  if (val >= 1024 ** 3) return `${(val / 1024 ** 3).toFixed(1)}GB`;
  if (val >= 1024 ** 2) return `${(val / 1024 ** 2).toFixed(1)}MB`;
  if (val >= 1024) return `${(val / 1024).toFixed(1)}KB`;
  return `${val}B`;
}

function buildOption() {
  const uploadColor = 'hsl(24, 95%, 55%)';
  const downloadColor = 'hsl(210, 80%, 55%)';

  return {
    grid: {
      bottom: 24,
      containLabel: true,
      left: 12,
      right: 12,
      top: 40,
    },
    legend: {
      data: ['上传', '下载'],
      textStyle: { color: mutedColor.value },
      top: 0,
    },
    series: [
      {
        barGap: '20%',
        barMaxWidth: 28,
        data: props.uploadData,
        emphasis: { itemStyle: { color: uploadColor } },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            colorStops: [
              { color: uploadColor, offset: 0 },
              { color: 'hsl(24, 95%, 65%)', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
          },
        },
        label: {
          formatter: (p: any) => formatBytes(p.value as number),
          position: 'top' as const,
          show: true,
          color: mutedColor.value,
          fontSize: 10,
        },
        name: '上传',
        type: 'bar',
      },
      {
        barGap: '20%',
        barMaxWidth: 28,
        data: props.downloadData,
        emphasis: { itemStyle: { color: downloadColor } },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            colorStops: [
              { color: downloadColor, offset: 0 },
              { color: 'hsl(210, 80%, 65%)', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
          },
        },
        label: {
          formatter: (p: any) => formatBytes(p.value as number),
          position: 'top' as const,
          show: true,
          color: mutedColor.value,
          fontSize: 10,
        },
        name: '下载',
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params];
        let html = `<div style="font-weight:600;margin-bottom:4px">${items[0]?.name}</div>`;
        items.forEach((p: any) => {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: ${formatBytes(p.value)}</span>
          </div>`;
        });
        return html;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: { color: mutedColor.value },
      axisLine: { show: false },
      axisTick: { show: false },
      data: props.labels,
      type: 'category' as const,
    },
    yAxis: {
      axisLabel: {
        color: mutedColor.value,
        formatter: (v: number) => formatBytes(v),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: borderColor.value, type: 'dashed' } },
      type: 'value',
    },
  };
}

onMounted(() => {
  renderEcharts(buildOption() as any);
});

watch(
  () => [
    props.labels,
    props.uploadData,
    props.downloadData,
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
