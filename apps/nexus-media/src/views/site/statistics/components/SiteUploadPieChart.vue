<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';

interface Props {
  data: StatisticsItem[];
}

const props = defineProps<Props>();

const { formatSize, getChartPalette, getThemeColors, parseSize } =
  useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

const colors = getThemeColors();

function buildOption() {
  const chartData = props.data
    .map((i) => ({ name: i.site_name, value: parseSize(i.upload) }))
    .filter((i) => i.value > 0)
    .toSorted((a, b) => b.value - a.value);

  return {
    color: getChartPalette(chartData.length),
    legend: {
      bottom: 20,
      orient: 'vertical' as const,
      right: 10,
      textStyle: { color: colors.cardForeground },
      top: 20,
      type: 'scroll' as const,
    },
    series: [
      {
        avoidLabelOverlap: false,
        center: ['35%', '50%'],
        data: chartData,
        emphasis: {
          label: {
            color: colors.cardForeground,
            fontSize: 14,
            fontWeight: 'bold' as const,
            show: true,
          },
        },
        itemStyle: {
          borderColor: colors.card,
          borderRadius: 8,
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        name: '上传量分布',
        radius: ['40%', '70%'],
        type: 'pie' as const,
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `<div style="font-weight:600">${params.name}</div>
         <div>上传量: ${formatSize(params.value)}</div>
         <div>占比: ${params.percent}%</div>`,
      trigger: 'item' as const,
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
