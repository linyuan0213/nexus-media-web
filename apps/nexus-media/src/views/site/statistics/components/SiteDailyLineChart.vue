<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface SeriesItem {
  name: string;
  upload: number[];
  download: number[];
}

interface Props {
  dates: string[];
  series: SeriesItem[];
  mode?: 'download' | 'upload';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'upload',
});

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function getSeriesColor(idx: number, total: number): string {
  // 色相均匀分布在 0-360 色环上，确保任意数量站点颜色不重复
  const hue = Math.round((idx * 360) / Math.max(total, 1)) % 360;
  // 饱和度和亮度固定，保证颜色鲜艳且可读
  return `hsl(${hue}, 80%, 50%)`;
}

function formatBytes(val: number): string {
  if (val >= 1024 ** 4) return `${(val / 1024 ** 4).toFixed(1)}TB`;
  if (val >= 1024 ** 3) return `${(val / 1024 ** 3).toFixed(1)}GB`;
  if (val >= 1024 ** 2) return `${(val / 1024 ** 2).toFixed(1)}MB`;
  if (val >= 1024) return `${(val / 1024).toFixed(1)}KB`;
  return `${val}B`;
}

const activeSeries = computed(() => {
  return props.series.map((s, idx) => ({
    name: s.name,
    type: 'line' as const,
    smooth: true,
    showSymbol: true,
    symbolSize: 4,
    lineStyle: { width: 2 },
    itemStyle: { color: getSeriesColor(idx, props.series.length) },
    data: props.mode === 'upload' ? s.upload : s.download,
  }));
});

function buildOption() {
  return {
    grid: {
      bottom: 36,
      containLabel: true,
      left: 12,
      right: 12,
      top: 40,
    },
    legend: {
      bottom: 0,
      itemGap: 12,
      left: 'center',
      textStyle: { fontSize: 11 },
      type: 'scroll' as const,
    },
    series: activeSeries.value,
    tooltip: {
      axisPointer: { type: 'line' as const },
      formatter: (params: any) => {
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0]?.name}</div>`;
        params.forEach((p: any) => {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: ${formatBytes(p.value)}</span>
          </div>`;
        });
        return html;
      },
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: {
        color: 'hsl(var(--muted-foreground))',
        fontSize: 10,
        rotate: 30,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      data: props.dates,
      type: 'category' as const,
    },
    yAxis: {
      axisLabel: {
        color: 'hsl(var(--muted-foreground))',
        fontSize: 10,
        formatter: (v: number) => formatBytes(v),
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

onMounted(() => {
  renderEcharts(buildOption());
});

watch(
  () => [props.dates, props.series, props.mode],
  () => {
    renderEcharts(buildOption());
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-72 w-full" />
</template>
