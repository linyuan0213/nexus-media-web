<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';

interface IndexerStat {
  name: string;
  total: number;
  success: number;
  fail: number;
  avg: number;
}

const props = defineProps<{ data: IndexerStat[] }>();

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
const { mutedColor, borderColor, textColor } = useChartTheme();

const successColor = 'hsl(160, 72%, 45%)';
const failColor = 'hsl(0, 70%, 55%)';
const avgColor = 'hsl(217, 90%, 58%)';

function buildOption() {
  const sorted = [...props.data].toSorted(
    (a, b) => Number(b.total || 0) - Number(a.total || 0),
  );
  const names = sorted.map((d) => d.name);
  const successValues = sorted.map((d) => Number(d.success || 0));
  const failValues = sorted.map((d) => Number(d.fail || 0));
  const avgValues = sorted.map((d) => Number(d.avg || 0));

  return {
    grid: {
      bottom: 24,
      containLabel: true,
      left: 12,
      right: 44,
      top: 40,
    },
    legend: {
      data: ['成功', '失败', '平均耗时'],
      textStyle: { color: mutedColor.value },
      top: 0,
    },
    series: [
      {
        barMaxWidth: 18,
        data: successValues,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            colorStops: [
              { color: successColor, offset: 0 },
              { color: 'hsl(160, 72%, 62%)', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
          },
        },
        name: '成功',
        type: 'bar',
      },
      {
        barMaxWidth: 18,
        data: failValues,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            colorStops: [
              { color: failColor, offset: 0 },
              { color: 'hsl(0, 70%, 66%)', offset: 1 },
            ],
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
          },
        },
        name: '失败',
        type: 'bar',
      },
      {
        data: avgValues,
        itemStyle: { color: avgColor },
        label: {
          color: mutedColor.value,
          fontSize: 10,
          formatter: (p: any) => (p.value > 0 ? `${p.value}s` : ''),
          position: 'top' as const,
          show: true,
        },
        lineStyle: { color: avgColor, width: 2 },
        name: '平均耗时',
        symbol: 'circle' as const,
        symbolSize: 6,
        type: 'line',
        yAxisIndex: 1,
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        const first = list[0];
        if (!first) return '';
        const idx = first.dataIndex;
        const d = sorted[idx];
        if (!d) return '';
        const calls = Number(d.success || 0) + Number(d.fail || 0);
        const rate =
          calls > 0 ? Math.round((Number(d.success || 0) / calls) * 1000) / 10 : 0;
        const dot = (color: string, label: string, value: string) =>
          `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
             <span style="display:inline-flex;align-items:center;gap:6px">
               <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>${label}
             </span>
             <span style="font-weight:600">${value}</span>
           </div>`;
        return [
          `<div style="font-weight:700;margin-bottom:4px">${d.name}</div>`,
          dot(successColor, '成功', `${d.success} 次`),
          dot(failColor, '失败', `${d.fail} 次`),
          dot(avgColor, '平均耗时', `${Number(d.avg || 0).toFixed(1)}s`),
          `<div style="border-top:1px solid hsla(0,0%,60%,.25);margin:4px 0"></div>`,
          dot('transparent', '调用', `${calls} 次`),
          dot('transparent', '成功率', `${rate}%`),
        ].join('');
      },
      textStyle: { color: textColor.value },
      trigger: 'axis' as const,
    },
    xAxis: {
      axisLabel: { color: mutedColor.value, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      data: names,
      type: 'category' as const,
    },
    yAxis: [
      {
        axisLabel: { color: mutedColor.value, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        name: '次数',
        nameTextStyle: { color: mutedColor.value },
        splitLine: { lineStyle: { color: borderColor.value, type: 'dashed' } },
        type: 'value' as const,
      },
      {
        axisLabel: {
          color: mutedColor.value,
          fontSize: 11,
          formatter: '{value}s',
        },
        axisLine: { show: false },
        axisTick: { show: false },
        name: '耗时',
        nameTextStyle: { color: mutedColor.value },
        splitLine: { show: false },
        type: 'value' as const,
      },
    ],
  };
}

onMounted(() => {
  renderEcharts(buildOption() as any);
});

watch(
  () => [
    props.data,
    mutedColor.value,
    borderColor.value,
    textColor.value,
  ],
  () => {
    renderEcharts(buildOption() as any);
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
