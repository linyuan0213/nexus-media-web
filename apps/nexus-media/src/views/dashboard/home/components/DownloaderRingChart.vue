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
          'hsl(217, 90%, 58%)',
          'hsl(340, 85%, 58%)',
          'hsl(160, 75%, 45%)',
          'hsl(35, 95%, 55%)',
        ],
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
        name: '下载器统计',
        radius: ['45%', '72%'],
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
