<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { NSelect } from 'naive-ui';

import { useSiteStats } from '#/composables/useSiteStats';
import { CHART_PALETTE } from '#/constants/chartColors';

interface SeriesItem {
  download: number[];
  name: string;
  upload: number[];
}

interface Props {
  dates: string[];
  series: SeriesItem[];
  mode?: 'download' | 'upload';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'upload',
});

const { formatSize, getChartDataKey } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts, updateData } = useEcharts(chartRef);

const TEXT_COLOR = 'hsl(var(--card-foreground))';

/** 聚焦站点，空串表示全部显示 */
const focusSite = ref('');

const focusOptions = computed(() => [
  { label: '全部站点', value: '' },
  ...props.series.map((s) => ({ label: s.name, value: s.name })),
]);

function getColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length] || CHART_PALETTE[0]!;
}

const activeSeries = computed(() => {
  return props.series.map((s, idx) => ({
    data: props.mode === 'upload' ? s.upload : s.download,
    itemStyle: { color: getColor(idx) },
    lineStyle: { width: 2 },
    name: s.name,
    showSymbol: true,
    smooth: true,
    symbolSize: 4,
    type: 'line' as const,
  }));
});

function buildOption() {
  const selected: Record<string, boolean> = {};
  for (const s of props.series) {
    selected[s.name] = focusSite.value === '' || focusSite.value === s.name;
  }
  return {
    animationDurationUpdate: 0,
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
      selected,
      textStyle: { fontSize: 11 },
      type: 'scroll' as const,
    },
    series: activeSeries.value,
    tooltip: {
      axisPointer: { type: 'line' as const },
      formatter: (params: any) => {
        let html = `<div style="font-weight:600;margin-bottom:4px;color:${TEXT_COLOR}">${params[0]?.name}</div>`;
        params.forEach((p: any) => {
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span style="color:${TEXT_COLOR}">${p.seriesName}: ${formatSize(p.value)}</span>
          </div>`;
        });
        return html;
      },
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: {
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
        fontSize: 10,
        formatter: (v: number) => formatSize(v),
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

function refresh() {
  updateData(buildOption() as any);
}

onMounted(() => {
  renderEcharts(buildOption() as any);
});

let dataCacheKey = '';

watch(
  () => [props.dates, props.series, props.mode],
  (newVal) => {
    const key = getChartDataKey(newVal);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    refresh();
  },
  { deep: true },
);

watch(focusSite, () => refresh());
</script>

<template>
  <div class="chart-wrap">
    <div class="chart-toolbar">
      <NSelect
        v-model:value="focusSite"
        :options="focusOptions"
        class="focus-select"
        size="small"
      />
    </div>
    <EchartsUI ref="chartRef" class="h-56 w-full" />
  </div>
</template>

<style scoped>
.chart-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.chart-toolbar {
  display: flex;
  justify-content: flex-end;
}

.focus-select {
  width: 10rem;
}
</style>
