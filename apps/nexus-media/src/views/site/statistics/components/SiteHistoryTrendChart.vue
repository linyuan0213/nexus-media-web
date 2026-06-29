<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';

interface Props {
  data: [string, number, number][];
}

const props = defineProps<Props>();

const { formatSize, getThemeColors } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

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

function buildOption() {
  const sites = props.data.map((i) => i[0]);
  const uploads = props.data.map((i) => i[1]);
  const downloads = props.data.map((i) => i[2]);

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

onMounted(() => {
  renderEcharts(buildOption() as any);
});

watch(
  () => props.data,
  () => {
    renderEcharts(buildOption() as any);
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
