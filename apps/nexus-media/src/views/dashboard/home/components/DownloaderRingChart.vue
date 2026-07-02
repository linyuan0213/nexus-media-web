<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { pickColors } from '#/constants/chartColors';

interface Props {
  data: Array<{ name: string; value: number }>;
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function buildOption() {
  return {
    legend: {
      itemGap: 8,
      itemWidth: 10,
      itemHeight: 10,
      orient: 'vertical',
      right: 0,
      top: 'middle',
      type: 'scroll' as const,
    },
    series: [
      {
        animationDelay() {
          return Math.random() * 100;
        },
        animationEasing: 'exponentialInOut',
        animationType: 'scale',
        avoidLabelOverlap: true,
        color: pickColors(props.data.length),
        data: props.data,
        emphasis: {
          label: {
            formatter: '{b}\n{d}%',
            fontSize: 14,
            fontWeight: 'bold',
            show: true,
          },
          labelLine: {
            length: 12,
            length2: 8,
            lineStyle: {
              width: 1.5,
            },
            show: true,
            smooth: true,
          },
          scale: true,
          scaleSize: 8,
        },
        itemStyle: {
          borderRadius: 6,
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        name: '索引器统计',
        radius: ['45%', '72%'],
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c} ({d}%)',
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
  <EchartsUI ref="chartRef" class="h-80 w-full" />
</template>
