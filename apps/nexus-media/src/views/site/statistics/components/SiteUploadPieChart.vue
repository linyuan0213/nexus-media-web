<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';
import { CHART_PALETTE } from '#/constants/chartColors';

interface Props {
  data: Array<{ name: string; value: number }>;
}

const props = defineProps<Props>();

const { formatSize, getChartDataKey } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts, updateData } = useEcharts(chartRef);

const TEXT_COLOR = 'hsl(var(--card-foreground))';

const SERIES_BASE = {
  center: ['50%', '45%'],
  emphasis: {
    label: {
      formatter: (params: any) => `${params.name}\n${formatSize(params.value)}`,
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
  itemStyle: { borderRadius: 4 },
  label: { show: false },
  labelLine: { show: false },
  name: '上传量分布',
  progressive: false,
  progressiveThreshold: Infinity,
  radius: [16, 100],
  type: 'pie' as const,
};

const LEGEND = {
  bottom: 0,
  itemGap: 8,
  left: 'center',
  textStyle: { fontSize: 11 },
  type: 'scroll' as const,
};

const TOOLTIP = {
  formatter: (params: any) =>
    `<div style="font-weight:600;color:${TEXT_COLOR}">${params.name}</div>
     <div style="color:${TEXT_COLOR}">上传量: ${formatSize(params.value)}</div>
     <div style="color:${TEXT_COLOR}">占比: ${params.percent}%</div>`,
  trigger: 'item' as const,
};

function buildOption() {
  return {
    animation: false,
    color: CHART_PALETTE,
    legend: LEGEND,
    series: [{ ...SERIES_BASE, data: props.data }],
    tooltip: TOOLTIP,
  };
}

onMounted(() => {
  renderEcharts(buildOption() as any);
});

let dataCacheKey = '';

watch(
  () => props.data,
  (newData) => {
    const key = getChartDataKey(newData);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    updateData(buildOption() as any, true);
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
