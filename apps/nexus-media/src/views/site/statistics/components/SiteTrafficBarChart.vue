<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';

interface Props {
  data: StatisticsItem[];
}

const props = defineProps<Props>();

const { formatSize, getThemeColors, parseSize } = useSiteStats();

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
  const sites = props.data.map((i) => i.site_name);
  const uploads = props.data.map((i) => parseSize(i.upload));
  const downloads = props.data.map((i) => parseSize(i.download));

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
