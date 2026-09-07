<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';
import { useSiteStats } from '#/composables/useSiteStats';
import { CHART_PALETTE } from '#/constants/chartColors';

interface Props {
  colorMap?: Record<string, string>;
  data: Array<{ name: string; value: number }>;
  selectedSite?: string;
}

const props = withDefaults(defineProps<Props>(), {
  colorMap: () => ({}),
  selectedSite: '',
});

const emit = defineEmits<{
  selectSite: [site: string];
}>();

const { formatSize, getChartDataKey } = useSiteStats();
const { legendColor, textColor, isDark } = useChartTheme();

const chartRef = ref<EchartsUIType>();
const { getChartInstance, renderEcharts, updateData } = useEcharts(chartRef);

function truncateName(name: string): string {
  return name.length > 8 ? `${name.slice(0, 8)}…` : name;
}

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

function buildOption() {
  const legend = {
    bottom: 0,
    formatter: (name: string) => truncateName(name),
    itemGap: 8,
    left: 'center',
    textStyle: { color: legendColor.value, fontSize: 11 },
    type: 'scroll' as const,
  };
  const tooltip = {
    formatter: (params: any) =>
      `<div style="font-weight:600;color:${textColor.value}">${params.name}</div>
       <div style="color:${textColor.value}">上传量: ${formatSize(params.value)}</div>
       <div style="color:${textColor.value}">占比: ${params.percent}%</div>`,
    trigger: 'item' as const,
  };
  const data = props.data.map((d, i) => ({
    ...d,
    itemStyle: {
      color: props.colorMap[d.name] ?? CHART_PALETTE[i % CHART_PALETTE.length],
      opacity:
        props.selectedSite !== '' && d.name !== props.selectedSite ? 0.15 : 1,
    },
  }));
  return {
    animation: false,
    color: CHART_PALETTE,
    legend,
    series: [{ ...SERIES_BASE, data }],
    tooltip,
  };
}

function bindChartClick() {
  const inst = getChartInstance();
  if (!inst) return;
  inst.off('click');
  inst.on('click', (params: any) => {
    if (params?.componentType === 'legend') return;
    const site = String(params?.name ?? '');
    if (!site) return;
    emit('selectSite', site === props.selectedSite ? '' : site);
  });
}

onMounted(() => {
  renderEcharts(buildOption() as any).then(() => bindChartClick());
});

let dataCacheKey = '';

watch(
  () => [props.data, props.selectedSite, props.colorMap, isDark.value],
  (newVal) => {
    const key = getChartDataKey(newVal);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    updateData(buildOption() as any, true);
    bindChartClick();
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
