<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';
import { CHART_PALETTE } from '#/constants/chartColors';

interface Props {
  data: Array<{ name: string; value: number }>;
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const { legendColor } = useChartTheme();

function buildOption() {
  return {
    legend: {
      bottom: 0,
      itemGap: 12,
      left: 'center',
      textStyle: { color: legendColor.value, fontSize: 11 },
      type: 'scroll' as const,
    },
    series: [
      {
        center: ['50%', '42%'],
        color: CHART_PALETTE,
        data: props.data,
        itemStyle: { borderRadius: 4 },
        emphasis: { scale: true, scaleSize: 6 },
        label: { show: false },
        radius: [16, 100],
        roseType: 'area',
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c}',
      trigger: 'item' as const,
    },
  };
}

onMounted(() => renderEcharts(buildOption() as any));
watch(
  () => [props.data, legendColor.value],
  () => renderEcharts(buildOption() as any),
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
