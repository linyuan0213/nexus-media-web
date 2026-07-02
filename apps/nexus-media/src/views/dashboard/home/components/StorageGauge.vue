<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';
interface Props {
  freeSpace: string;
  totalSpace: string;
  usedPercent: number;
  usedSpace: string;
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const { borderColor, mutedColor } = useChartTheme();

function buildOption() {
  const pct = Math.min(100, Math.max(0, Number(props.usedPercent) || 0));
  const color =
    pct > 90
      ? 'hsl(0, 84%, 60%)'
      : pct > 75
        ? 'hsl(24, 95%, 55%)'
        : 'hsl(160, 75%, 45%)';

  return {
    series: [
      {
        type: 'gauge',
        radius: '80%',
        center: ['50%', '50%'],
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        splitNumber: 10,
        axisLine: {
          show: true,
          lineStyle: {
            width: 16,
            color: [
              [pct / 100, color],
              [1, borderColor.value],
            ],
          },
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          color: mutedColor.value,
          fontSize: 22,
          fontWeight: 'bold',
          offsetCenter: [0, '40%'],
        },
        data: [{ value: pct }],
      },
    ],
  };
}

onMounted(() => {
  renderEcharts(buildOption() as any);
});

watch(
  () => [props.usedPercent, mutedColor.value, borderColor.value],
  () => {
    renderEcharts(buildOption() as any);
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <EchartsUI ref="chartRef" class="mx-auto h-52 w-52" />
    <div
      class="mt-1 text-center text-xs"
      style="color: hsl(var(--muted-foreground))"
    >
      {{ usedSpace }} / {{ totalSpace }} · 剩余 {{ freeSpace }}
    </div>
  </div>
</template>
