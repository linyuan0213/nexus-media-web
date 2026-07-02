<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';
import { CHART_PALETTE } from '#/constants/chartColors';

interface Props {
  data: Array<{ name: string; value: number }>;
  title: string;
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const { mutedColor, textColor } = useChartTheme();

function buildOption() {
  const sorted = [...props.data].toSorted((a, b) => a.value - b.value);
  const names = sorted.map((d) => d.name);
  const values = sorted.map((d) => d.value);

  return {
    grid: {
      containLabel: true,
      left: 12,
      right: 40,
      top: 4,
      bottom: 4,
    },
    series: [
      {
        barCategoryGap: '30%' as const,
        color: CHART_PALETTE.slice(0, values.length),
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: CHART_PALETTE[i % CHART_PALETTE.length],
          },
        })),
        label: {
          formatter: '{c}',
          position: 'right' as const,
          show: true,
          color: mutedColor.value,
          fontSize: 12,
        },
        name: props.title,
        type: 'bar',
      },
    ],
    tooltip: {
      formatter: '{b}: {c}',
      trigger: 'item' as const,
    },
    xAxis: {
      axisLabel: { color: mutedColor.value as any, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      type: 'value' as const,
    },
    yAxis: {
      axisLabel: { color: textColor.value, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
      data: names,
      inverse: true,
      type: 'category' as const,
    },
  };
}

onMounted(() => renderEcharts(buildOption() as any));
watch(
  () => [props.data, mutedColor.value, textColor.value],
  () => renderEcharts(buildOption() as any),
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
