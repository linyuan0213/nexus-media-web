<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface Props {
  labels: string[];
  uploadData: number[];
  downloadData: number[];
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function formatBytes(val: number): string {
  if (val >= 1024 ** 4) return `${(val / 1024 ** 4).toFixed(1)}TB`;
  if (val >= 1024 ** 3) return `${(val / 1024 ** 3).toFixed(1)}GB`;
  if (val >= 1024 ** 2) return `${(val / 1024 ** 2).toFixed(1)}MB`;
  if (val >= 1024) return `${(val / 1024).toFixed(1)}KB`;
  return `${val}B`;
}

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
      data: ['上传', '下载'],
      top: 0,
    },
    series: [
      {
        barMaxWidth: 24,
        data: props.uploadData,
        itemStyle: { color: 'hsl(24, 95%, 55%)', borderRadius: [4, 4, 0, 0] },
        name: '上传',
        type: 'bar',
      },
      {
        barMaxWidth: 24,
        data: props.downloadData,
        itemStyle: { color: 'hsl(200, 90%, 55%)', borderRadius: [4, 4, 0, 0] },
        name: '下载',
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0]?.name}</div>`;
        params.forEach((p: any) => {
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
      axisLine: { show: false },
      axisTick: { show: false },
      data: props.labels,
      type: 'category',
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: (v: number) => formatBytes(v),
      },
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

watch(() => [props.labels, props.uploadData, props.downloadData], () => {
  renderEcharts(buildOption());
}, { deep: true });
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
