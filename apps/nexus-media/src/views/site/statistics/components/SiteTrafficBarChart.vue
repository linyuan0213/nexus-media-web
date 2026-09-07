<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';
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
const { legendColor, mutedColor, textColor, isDark, borderColor } =
  useChartTheme();

const chartRef = ref<EchartsUIType>();
const { getChartInstance, renderEcharts } = useEcharts(chartRef);

let lastClickId: null | string = null;

// 与全站口径一致：上传 success / 下载 warning
const COLORS = {
  download: '#f76707',
  upload: '#2fb344',
};

const dimColor = computed(() => (isDark.value ? '#4a5058' : '#c3c8cf'));

function isDimmed(label: string): boolean {
  return props.selectedSite !== '' && label !== props.selectedSite;
}

function truncateName(name: string): string {
  return name.length > 6 ? `${name.slice(0, 6)}…` : name;
}

function tooltipHtml(title: string, items: any[]): string {
  let result = `<div style="font-weight:600;margin-bottom:4px;color:${textColor.value}">${title}</div>`;
  items.forEach((p: any) => {
    result += `<div style="display:flex;align-items:center;gap:6px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
      <span style="color:${textColor.value}">${p.seriesName}: ${formatSize(p.value)}</span>
    </div>`;
  });
  return result;
}

function buildOption() {
  const mkData = (values: number[], seriesColor: string) =>
    values.map((value, i) => ({
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: isDimmed(props.labels[i] ?? '') ? dimColor.value : seriesColor,
      },
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
      data: [
        { itemStyle: { color: COLORS.upload }, name: '上传量' },
        { itemStyle: { color: COLORS.download }, name: '下载量' },
      ],
      textStyle: { color: legendColor.value, fontSize: 11 },
      top: 0,
    },
    series: [
      {
        barMaxWidth: 24,
        data: mkData(props.uploadData, COLORS.upload),
        emphasis: { disabled: true },
        itemStyle: { borderRadius: [4, 4, 0, 0], color: COLORS.upload },
        name: '上传量',
        type: 'bar' as const,
      },
      {
        barMaxWidth: 24,
        data: mkData(props.downloadData, COLORS.download),
        emphasis: { disabled: true },
        itemStyle: { borderRadius: [4, 4, 0, 0], color: COLORS.download },
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
        color: mutedColor.value,
        fontSize: 10,
        formatter: (name: string) => truncateName(name),
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
        color: mutedColor.value,
        formatter: (value: number) => formatSize(value),
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: borderColor.value,
          type: 'dashed' as const,
        },
      },
      type: 'value' as const,
    },
  };
}

function refresh() {
  // 不 clear 原地更新，避免重绘闪烁；setOption 默认合并模式会更新每项样式
  renderEcharts(buildOption() as any, false).then(() => {
    bindChartClick();
  });
}

function bindChartClick() {
  const inst = getChartInstance();
  if (!inst) return;
  inst.off('click');
  inst.on('click', (params: any) => {
    if (params?.componentType === 'legend') return;
    const site = String(params?.name ?? '');
    if (!site) return;
    const id = `${params.seriesIndex}:${params.dataIndex}`;
    if (site === props.selectedSite) {
      if (lastClickId === id) {
        emit('selectSite', '');
        lastClickId = null;
      } else {
        lastClickId = id;
      }
    } else {
      emit('selectSite', site);
      lastClickId = id;
    }
  });
}

onMounted(() => {
  refresh();
});

let dataCacheKey = '';

watch(
  () => [
    props.labels,
    props.uploadData,
    props.downloadData,
    props.selectedSite,
    isDark.value,
  ],
  (newVal) => {
    const key = getChartDataKey(newVal);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    // 每次变化都 clear 全量重绘，确保置灰样式完整应用
    refresh();
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-64 w-full" />
</template>
