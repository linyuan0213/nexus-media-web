<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';

interface Props {
  data: Array<{ name: string; value: number }>;
}

const props = defineProps<Props>();

const MEDIA_COLORS: Record<string, string> = {
  电影: 'hsl(26, 85%, 65%)',
  电视剧: 'hsl(201, 66%, 57%)',
  动漫: 'hsl(346, 74%, 67%)',
  音乐: 'hsl(165, 70%, 42%)',
};

const FALLBACK_COLOR = 'hsl(201, 66%, 57%)';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const { legendColor, mutedColor, titleColor } = useChartTheme();

const total = computed(() =>
  props.data.reduce((s, d) => s + Number(d.value), 0),
);

function buildOption() {
  return {
    color: Object.values(MEDIA_COLORS),
    legend: {
      bottom: 8,
      icon: 'roundRect',
      itemGap: 20,
      itemHeight: 8,
      itemWidth: 20,
      left: 'center',
      textStyle: { color: legendColor.value, fontSize: 12 },
    },
    series: [
      {
        animationType: 'scale',
        avoidLabelOverlap: true,
        center: ['50%', '45%'],
        data: props.data.map((d) => ({
          name: d.name,
          value: Number(d.value),
          itemStyle: { color: MEDIA_COLORS[d.name] ?? FALLBACK_COLOR },
        })),
        emphasis: {
          focus: 'self',
          scale: true,
          scaleSize: 4,
        },
        itemStyle: { borderRadius: 4 },
        label: { show: false },
        labelLine: { show: false },
        padAngle: 2,
        radius: ['68%', '88%'],
        type: 'pie',
      },
    ],
    title: {
      itemGap: 4,
      left: 'center',
      subtext: '媒体总数',
      subtextStyle: {
        color: mutedColor.value,
        fontSize: 11,
        fontWeight: 'normal',
      },
      text:
        total.value > 9999
          ? `${(total.value / 10_000).toFixed(1)}万`
          : String(total.value),
      textStyle: {
        color: titleColor.value,
        fontSize: 22,
        fontWeight: '700',
      },
      top: '34%',
    },
    tooltip: {
      formatter: (p: any) =>
        `<strong>${p.name}</strong><br/>数量：${p.value}<br/>占比：${p.percent}%`,
      trigger: 'item' as const,
    },
  };
}

onMounted(() => renderEcharts(buildOption() as any));
watch(
  () => [props.data, legendColor.value, mutedColor.value, titleColor.value],
  () => renderEcharts(buildOption() as any),
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
