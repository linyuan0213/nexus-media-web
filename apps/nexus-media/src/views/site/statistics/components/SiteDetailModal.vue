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

/** 积分曲线独立色（青色），与做种数蓝色区分 */
const BONUS_COLOR = 'hsl(188, 80%, 55%)';

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

  const option = {
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
      // 禁用默认点击隐藏，改为点击图例选中单条曲线
      selectedMode: false,
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
        itemStyle: { color: colors.success },
        lineStyle: { opacity: isDimmed('上传') ? 0.15 : 1 },
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
        itemStyle: { color: colors.destructive },
        lineStyle: { opacity: isDimmed('下载') ? 0.15 : 1 },
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
        itemStyle: { color: colors.primary },
        lineStyle: { opacity: isDimmed('做种数') ? 0.15 : 1 },
        yAxisIndex: 1,
      },
      {
        name: '做种体积',
        type: 'line',
        data: seedingSizes,
        smooth: true,
        showSymbol: false,
        emphasis: { disabled: true },
        itemStyle: { color: colors.warning },
        lineStyle: { opacity: isDimmed('做种体积') ? 0.15 : 1 },
        yAxisIndex: 0,
      },
      {
        name: '积分',
        type: 'line',
        data: bonuses,
        smooth: true,
        showSymbol: false,
        emphasis: { disabled: true },
        itemStyle: { color: BONUS_COLOR },
        lineStyle: { opacity: isDimmed('积分') ? 0.15 : 1 },
        yAxisIndex: 2,
      },
    ],
  };

  // 通过 renderEcharts 渲染；lineStyle.opacity 控制折线透明度实现置灰
  renderDetail(option as any).then(() => {
    bindDetailChart(uploads, downloads, seedings, seedingSizes, bonuses);
  });
}

function bindDetailChart(
  uploads: number[],
  downloads: number[],
  seedings: number[],
  seedingSizes: number[],
  bonuses: number[],
) {
  const inst = getChartInstance();
  if (!inst) return;

  // zrender 底层事件绑定（inst.on('click') 在弹窗场景可能不触发）
  const zr = inst.getZr();
  if (zr) {
    zr.off('click');
    zr.on('click', (event: any) => {
      if (!event || typeof event.offsetX !== 'number') return;
      handleSelectClick(
        {
          componentType: 'zr',
          offsetX: event.offsetX,
          offsetY: event.offsetY,
        },
        inst,
        uploads,
        downloads,
        seedings,
        seedingSizes,
        bonuses,
      );
    });
  }
  // 点击选中单条曲线（或图例项），其余置灰；再次点击同一条恢复
  inst.off('click');
  inst.on('click', (params: any) => {
    handleSelectClick(
      params,
      inst,
      uploads,
      downloads,
      seedings,
      seedingSizes,
      bonuses,
    );
  });
}

function handleSelectClick(
  params: any,
  inst: any,
  uploads: number[],
  downloads: number[],
  seedings: number[],
  seedingSizes: number[],
  bonuses: number[],
) {
  if (params?.componentType === 'legend') {
    const clicked = String(params?.name ?? '');
    if (!clicked) return;
    selectedSeries.value = selectedSeries.value === clicked ? '' : clicked;
    renderDetailChart();
    return;
  }
  let name = String(params?.seriesName ?? '');
  if (!name && params?.offsetX != null && params?.offsetY != null) {
    try {
      const names = ['上传', '下载', '做种数', '做种体积', '积分'];
      const allVals = [uploads, downloads, seedings, seedingSizes, bonuses];
      let best = '';
      let bestDist = Number.POSITIVE_INFINITY;
      names.forEach((n, idx) => {
        // 逐系列转换：使用该系列自己的 y 轴刻度换算点击值，避免跨轴比较错误
        const coord = inst.convertFromPixel({ seriesIndex: idx }, [
          params.offsetX,
          params.offsetY,
        ]);
        if (
          !coord ||
          !Array.isArray(coord) ||
          coord.length < 2 ||
          coord[0] == null ||
          coord[1] == null
        ) {
          return;
        }
        const xIndex = Math.round(coord[0]);
        const clickedValue = coord[1];
        const vals = allVals[idx];
        if (!vals || vals[xIndex] == null) return;
        const dist = Math.abs(clickedValue - vals[xIndex]);
        const max = Math.max(...vals);
        const min = Math.min(...vals);
        // 该系列自身跨度 12% 内才算命中
        if (dist <= (max - min) * 0.12 && dist < bestDist) {
          bestDist = dist;
          best = n;
        }
      });
      if (best) {
        name = best;
      }
    } catch {
      // 忽略坐标转换异常
    }
  }
  if (!name) return;
  selectedSeries.value = selectedSeries.value === name ? '' : name;
  renderDetailChart();
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
