<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';

interface Props {
  downloadData: number[];
  labels: string[];
  uploadData: number[];
}

const props = defineProps<Props>();

const { formatSize } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

const COLORS = {
  download: 'hsl(200, 90%, 55%)',
  text: 'hsl(var(--card-foreground))',
  upload: 'hsl(24, 95%, 55%)',
};

function tooltipHtml(title: string, items: any[]): string {
  let result = `<div style="font-weight:600;margin-bottom:4px;color:${COLORS.text}">${title}</div>`;
  items.forEach((p: any) => {
    result += `<div style="display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
      <span style="color:${COLORS.text}">${p.seriesName}: ${formatSize(p.value)}</span>
    </div>`;
  });
  return result;
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
      data: ['上传量', '下载量'],
      top: 0,
    },
    series: [
      {
        barMaxWidth: 24,
        data: props.uploadData,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: COLORS.upload },
        name: '上传量',
        type: 'bar' as const,
      },
      {
        barMaxWidth: 24,
        data: props.downloadData,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: COLORS.download },
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
        interval: 0,
        rotate: 45,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      data: props.labels,
      type: 'category' as const,
    },
    yAxis: {
      axisLabel: {
        formatter: (value: number) => formatSize(value),
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

watch(
  () => [props.labels, props.uploadData, props.downloadData],
  () => {
    renderEcharts(buildOption() as any);
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
