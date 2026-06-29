<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';

interface Props {
  data: Array<{ name: string; value: number }>;
}

const props = defineProps<Props>();

const { getChartPalette } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

const TEXT_COLOR = 'hsl(var(--card-foreground))';

function buildOption() {
  return {
    color: getChartPalette(props.data.length),
    legend: {
      bottom: 0,
      itemGap: 8,
      left: 'center',
      textStyle: { fontSize: 11 },
      type: 'scroll' as const,
    },
    series: [
      {
        center: ['50%', '45%'],
        data: props.data,
        emphasis: {
          label: {
            formatter: '{b}\n{c}',
            show: true,
          },
          labelLine: {
            lineStyle: { width: 1.5 },
            show: true,
            smooth: true,
          },
          scale: true,
          scaleSize: 8,
        },
        itemStyle: {
          borderRadius: 4,
        },
        label: { show: false },
        labelLine: { show: false },
        radius: [16, 100],
        roseType: 'area' as const,
        type: 'pie' as const,
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `<div style="font-weight:600;color:${TEXT_COLOR}">${params.name}</div>
         <div style="color:${TEXT_COLOR}">做种数: ${params.value}</div>
         <div style="color:${TEXT_COLOR}">占比: ${params.percent}%</div>`,
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
