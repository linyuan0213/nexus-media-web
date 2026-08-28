<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';

interface Props {
  downloadData: number[];
  labels: string[];
  selectedSite?: string;
  uploadData: number[];
}

const props = withDefaults(defineProps<Props>(), {
  selectedSite: '',
});

const emit = defineEmits<{
  selectSite: [site: string];
}>();

const { formatSize, getChartDataKey } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { getChartInstance, renderEcharts, updateData } = useEcharts(chartRef);

const COLORS = {
  download: 'hsl(200, 90%, 55%)',
  muted: 'hsl(var(--muted-foreground) / 0.3)',
  text: 'hsl(var(--card-foreground))',
  upload: 'hsl(24, 95%, 55%)',
};

function isDimmed(label: string): boolean {
  return props.selectedSite !== '' && label !== props.selectedSite;
}

function tooltipHtml(title: string, items: any[]): string {
  let result = `<div style="font-weight:600;margin-bottom:4px;color:${COLORS.text}">${title}</div>`;
  items.forEach((p: any) => {
    result += `<div style="display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
      <span style="color:${COLORS.text}">${p.seriesName}: ${formatSize(p.value)}</span>
    </div>`;
  });
  return result;
}

function buildOption() {
  const buildData = (values: number[], color: string) =>
    values.map((value, i) => ({
      itemStyle: isDimmed(props.labels[i] ?? '')
        ? { borderRadius: [4, 4, 0, 0], color: COLORS.muted }
        : { borderRadius: [4, 4, 0, 0], color },
      value,
    }));
  return {
    animationDurationUpdate: 0,
    grid: {
      bottom: 24,
      containLabel: true,
      left: 12,
      right: 12,
      top: 32,
    },
    legend: {
      data: ['上传量', '下载量'],
      top: 0,
    },
    series: [
      {
        barMaxWidth: 24,
        data: buildData(props.uploadData, COLORS.upload),
        name: '上传量',
        type: 'bar' as const,
      },
      {
        barMaxWidth: 24,
        data: buildData(props.downloadData, COLORS.download),
        name: '下载量',
        type: 'bar' as const,
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' as const },
      formatter: (params: any) => tooltipHtml(params[0].name, params),
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 45,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      data: props.labels,
      type: 'category' as const,
    },
    yAxis: {
      axisLabel: {
        formatter: (value: number) => formatSize(value),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: 'hsl(var(--border) / 0.5)',
          type: 'dashed' as const,
        },
      },
      type: 'value' as const,
    },
  };
}

function bindChartClick() {
  const inst = getChartInstance();
  if (!inst) return;
  inst.off('click');
  inst.on('click', (params: any) => {
    if (params?.componentType === 'legend') return;
    const site = params?.name;
    if (site) emit('selectSite', String(site));
  });
}

onMounted(() => {
  renderEcharts(buildOption() as any).then(() => bindChartClick());
});

let dataCacheKey = '';

watch(
  () => [
    props.labels,
    props.uploadData,
    props.downloadData,
    props.selectedSite,
  ],
  (newVal) => {
    const key = getChartDataKey(newVal);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    updateData(buildOption() as any);
    bindChartClick();
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
