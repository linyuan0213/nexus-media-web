<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';
import { CHART_PALETTE } from '#/constants/chartColors';

interface SeriesItem {
  download: number[];
  name: string;
  upload: number[];
}

interface Props {
  dates: string[];
  focusSite?: string;
  mode?: 'download' | 'upload';
  selectedSite?: string;
  series: SeriesItem[];
}

const props = withDefaults(defineProps<Props>(), {
  focusSite: '',
  mode: 'upload',
  selectedSite: '',
});

const emit = defineEmits<{
  selectSite: [site: string];
  'update:focusSite': [site: string];
}>();

const { formatSize, getChartDataKey } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { getChartInstance, renderEcharts, updateData } = useEcharts(chartRef);

const TEXT_COLOR = 'hsl(var(--card-foreground))';

function getColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length] || CHART_PALETTE[0]!;
}

function isDimmed(name: string): boolean {
  return props.selectedSite !== '' && name !== props.selectedSite;
}

const activeSeries = computed(() => {
  return props.series.map((s, idx) => {
    const dimmed = isDimmed(s.name);
    return {
      data: props.mode === 'upload' ? s.upload : s.download,
      itemStyle: { color: getColor(idx), opacity: dimmed ? 0.15 : 1 },
      lineStyle: { opacity: dimmed ? 0.15 : 1, width: 2 },
      name: s.name,
      showSymbol: true,
      smooth: true,
      symbolSize: 4,
      type: 'line' as const,
    };
  });
});

function buildOption() {
  const selected: Record<string, boolean> = {};
  for (const s of props.series) {
    selected[s.name] = props.focusSite === '' || props.focusSite === s.name;
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

function bindChartClick() {
  const inst = getChartInstance();
  if (!inst) return;
  inst.off('click');
  inst.on('click', (params: any) => {
    if (params?.componentType === 'legend') return;
    let site = String(params?.seriesName ?? '');
    // 未点中曲线时，按点击位置解析最近的系列（曲线细不易点中）
    if (!site && params?.offsetX != null && params?.offsetY != null) {
      try {
        const coord = inst.convertFromPixel({ gridIndex: 0 }, [
          params.offsetX,
          params.offsetY,
        ]);
        if (
          coord &&
          Array.isArray(coord) &&
          coord.length >= 2 &&
          coord[0] != null &&
          coord[1] != null
        ) {
          const xIndex = Math.round(coord[0]);
          const clickedValue = coord[1];
          let bestSite = '';
          let bestDist = Number.POSITIVE_INFINITY;
          let span = 0;
          for (const s of props.series) {
            const vals = props.mode === 'upload' ? s.upload : s.download;
            const v = vals[xIndex];
            if (v == null) continue;
            const dist = Math.abs(clickedValue - v);
            if (dist < bestDist) {
              bestDist = dist;
              bestSite = s.name;
            }
            const max = Math.max(...vals);
            const min = Math.min(...vals);
            span = Math.max(span, max - min);
          }
          // 容差：数据跨度的 12% 以内才视为命中，避免远处空白误触
          if (bestSite && bestDist <= span * 0.12) {
            site = bestSite;
          }
        }
      } catch {
        // 忽略坐标转换异常
      }
    }
    if (!site) return;
    emit('selectSite', site === props.selectedSite ? '' : site);
  });
}

onMounted(() => {
  renderEcharts(buildOption() as any).then(() => bindChartClick());
});

let dataCacheKey = '';

watch(
  () => [
    props.dates,
    props.series,
    props.mode,
    props.selectedSite,
    props.focusSite,
  ],
  (newVal) => {
    const key = getChartDataKey(newVal);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    refresh();
    bindChartClick();
  },
  { deep: true },
);
</script>

<template>
  <EchartsUI ref="chartRef" class="h-56 w-full" />
</template>
