<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface Props {
  data: Array<{ name: string; value: number }>;
}

const props = defineProps<Props>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function buildOption() {
  return {
    legend: {
      bottom: 0,
      itemGap: 12,
      left: 'center',
    },
    series: [
      {
        animationDelay() {
          return Math.random() * 100;
        },
        animationEasing: 'exponentialInOut',
        animationType: 'scale',
        avoidLabelOverlap: false,
        color: [
          'hsl(215, 70%, 58%)',
          'hsl(280, 55%, 58%)',
          'hsl(25, 75%, 58%)',
        ],
        data: props.data,
        emphasis: {
          label: {
            formatter: '{b}\n{c}',
            fontSize: 14,
            fontWeight: 'bold',
            show: true,
          },
          labelLine: {
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
          borderRadius: 10,
        },
        label: {
          show: false,
        },
        labelLine: {
          show: false,
        },
        name: '媒体库分布',
        radius: ['40%', '70%'],
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c} ({d}%)',
      trigger: 'item',
    },
  };
}

onMounted(() => {
  renderEcharts(buildOption());
});

watch(() => props.data, () => {
  renderEcharts(buildOption());
}, { deep: true });
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
