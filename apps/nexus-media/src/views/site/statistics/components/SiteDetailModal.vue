<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { NModal, NSpin } from 'naive-ui';

import { getSiteActivityApi } from '#/api/modules/site';
import EmptyState from '#/components/empty/EmptyState.vue';
import { useSiteStats } from '#/composables/useSiteStats';
import { useAppNotification } from '#/utils/notify';

interface Props {
  show: boolean;
  siteName: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const notification = useAppNotification();
const { formatSize, getThemeColors } = useSiteStats();

const loading = ref(false);
const activityData = ref<[number, number, number, number, number, number][]>(
  [],
);
const chartDetailRef = ref<any>(null);
const { getChartInstance, renderEcharts: renderDetail } =
  useEcharts(chartDetailRef);

/** 选中的单条曲线名，空串表示全部显示 */
const selectedSeries = ref('');

function isDimmed(name: string): boolean {
  return selectedSeries.value !== '' && selectedSeries.value !== name;
}

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
});

async function fetchActivity() {
  if (!props.siteName) return;
  loading.value = true;
  try {
    const res: any = await getSiteActivityApi(props.siteName);
    const dataset = res?.dataset || [];
    activityData.value = dataset.length > 1 ? dataset.slice(1) : [];
    await nextTick();
    renderDetailChart();
  } catch (error: any) {
    notification.error('获取站点统计失败', {
      description: error?.message || '',
    });
  } finally {
    loading.value = false;
  }
}

function renderDetailChart() {
  if (activityData.value.length === 0) return;
  const dates = activityData.value.map((i) => {
    const d = new Date(i[0]);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const uploads = activityData.value.map((i) => i[1]);
  const downloads = activityData.value.map((i) => i[2]);
  const bonuses = activityData.value.map((i) => i[3]);
  const seedings = activityData.value.map((i) => i[4]);
  const seedingSizes = activityData.value.map((i) => i[5]);
  const colors = getThemeColors();

  renderDetail({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        const items = selectedSeries.value
          ? list.filter((p: any) => p.seriesName === selectedSeries.value)
          : list;
        if (items.length === 0) return '';
        const textColor = colors.cardForeground;
        let result = `<div style="font-weight:600;margin-bottom:4px;color:${textColor}">${items[0].name}</div>`;
        items.forEach((p: any) => {
          let val: number | string = p.value;
          if (p.seriesName === '做种体积') val = formatSize(val as number);
          else if (p.seriesName !== '做种数' && p.seriesName !== '积分')
            val = formatSize(val as number);
          result += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span style="color:${textColor}">${p.seriesName}: ${val}</span>
          </div>`;
        });
        return result;
      },
    },
    legend: {
      data: ['上传', '下载', '做种数', '做种体积', '积分'],
      bottom: 0,
      textStyle: { color: colors.cardForeground },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '18%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        rotate: 45,
        interval: Math.floor(dates.length / 10),
        color: colors.mutedForeground,
      },
      axisLine: { lineStyle: { color: colors.border } },
    },
    yAxis: [
      {
        type: 'value',
        name: '流量',
        position: 'left',
        nameTextStyle: { color: colors.mutedForeground },
        axisLabel: {
          color: colors.mutedForeground,
          formatter: (value: number) => formatSize(value),
        },
        splitLine: {
          lineStyle: { color: colors.border, type: 'dashed' },
        },
      },
      {
        type: 'value',
        name: '做种数',
        position: 'right',
        nameTextStyle: { color: colors.mutedForeground },
        axisLabel: { color: colors.mutedForeground },
        splitLine: { show: false },
      },
      {
        type: 'value',
        name: '积分',
        position: 'right',
        offset: 60,
        nameTextStyle: { color: colors.mutedForeground },
        axisLabel: { color: colors.mutedForeground },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '上传',
        type: 'line',
        data: uploads,
        smooth: true,
        showSymbol: false,
        emphasis: { disabled: true },
        itemStyle: {
          color: colors.success,
          opacity: isDimmed('上传') ? 0.15 : 1,
        },
        areaStyle: {
          color: colors.success,
          opacity: isDimmed('上传') ? 0.02 : 0.1,
        },
        yAxisIndex: 0,
      },
      {
        name: '下载',
        type: 'line',
        data: downloads,
        smooth: true,
        showSymbol: false,
        emphasis: { disabled: true },
        itemStyle: {
          color: colors.destructive,
          opacity: isDimmed('下载') ? 0.15 : 1,
        },
        areaStyle: {
          color: colors.destructive,
          opacity: isDimmed('下载') ? 0.02 : 0.1,
        },
        yAxisIndex: 0,
      },
      {
        name: '做种数',
        type: 'line',
        data: seedings,
        smooth: true,
        showSymbol: false,
        emphasis: { disabled: true },
        itemStyle: {
          color: colors.primary,
          opacity: isDimmed('做种数') ? 0.15 : 1,
        },
        yAxisIndex: 1,
      },
      {
        name: '做种体积',
        type: 'line',
        data: seedingSizes,
        smooth: true,
        showSymbol: false,
        emphasis: { disabled: true },
        itemStyle: {
          color: colors.warning,
          opacity: isDimmed('做种体积') ? 0.15 : 1,
        },
        yAxisIndex: 0,
      },
      {
        name: '积分',
        type: 'line',
        data: bonuses,
        smooth: true,
        showSymbol: false,
        emphasis: { disabled: true },
        itemStyle: {
          color: colors.primary,
          opacity: isDimmed('积分') ? 0.15 : 1,
        },
        yAxisIndex: 2,
      },
    ],
  });

  // 点击单条曲线选中，其余置灰；再次点击同一条恢复
  nextTick(() => {
    const inst = getChartInstance();
    if (!inst) return;
    inst.off('click');
    inst.on('click', (params: any) => {
      if (params?.componentType === 'legend') return;
      let name = String(params?.seriesName ?? '');
      if (!name && params?.offsetX != null && params?.offsetY != null) {
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
            const names = ['上传', '下载', '做种数', '做种体积', '积分'];
            const allVals = [
              uploads,
              downloads,
              seedings,
              seedingSizes,
              bonuses,
            ];
            let best = '';
            let bestDist = Number.POSITIVE_INFINITY;
            let span = 0;
            names.forEach((n, idx) => {
              const vals = allVals[idx];
              if (!vals) return;
              const v = vals[xIndex];
              if (v == null) return;
              const dist = Math.abs(clickedValue - v);
              if (dist < bestDist) {
                bestDist = dist;
                best = n;
              }
              const max = Math.max(...vals);
              const min = Math.min(...vals);
              span = Math.max(span, max - min);
            });
            if (best && bestDist <= span * 0.12) {
              name = best;
            }
          }
        } catch {
          // 忽略坐标转换异常
        }
      }
      if (!name) return;
      selectedSeries.value = selectedSeries.value === name ? '' : name;
      renderDetailChart();
    });

    // 图例隐藏某条曲线时，同步隐藏对应右侧坐标轴名称，避免残留
    inst.off('legendselectchanged');
    inst.on('legendselectchanged', (params: any) => {
      const sel: Record<string, boolean> = params?.selected || {};
      inst.setOption({
        yAxis: [
          {},
          { name: sel['做种数'] === false ? '' : '做种数' },
          { name: sel['积分'] === false ? '' : '积分' },
        ],
      });
    });
  });
}

watch(
  () => [props.show, props.siteName],
  ([show]) => {
    if (show) {
      selectedSeries.value = '';
      fetchActivity();
    }
  },
);
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="`${siteName} - 统计趋势`"
    preset="card"
    :style="{ width: '900px', maxWidth: '900px' }"
    :bordered="false"
    :segmented="{ content: true }"
  >
    <NSpin :show="loading">
      <div v-if="activityData.length > 0">
        <EchartsUI ref="chartDetailRef" height="420px" />
      </div>
      <EmptyState
        v-else
        title="暂无历史数据"
        subtitle="该站点暂无统计数据记录"
      />
    </NSpin>
  </NModal>
</template>
