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
const { renderEcharts: renderDetail } = useEcharts(chartDetailRef);

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
        const textColor = colors.cardForeground;
        let result = `<div style="font-weight:600;margin-bottom:4px;color:${textColor}">${params[0].name}</div>`;
        params.forEach((p: any) => {
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
        name: '数量',
        position: 'right',
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
        itemStyle: { color: colors.success },
        areaStyle: { color: colors.success, opacity: 0.1 },
        yAxisIndex: 0,
      },
      {
        name: '下载',
        type: 'line',
        data: downloads,
        smooth: true,
        showSymbol: false,
        itemStyle: { color: colors.destructive },
        areaStyle: { color: colors.destructive, opacity: 0.1 },
        yAxisIndex: 0,
      },
      {
        name: '做种数',
        type: 'line',
        data: seedings,
        smooth: true,
        showSymbol: false,
        itemStyle: { color: colors.primary },
        yAxisIndex: 1,
      },
      {
        name: '做种体积',
        type: 'line',
        data: seedingSizes,
        smooth: true,
        showSymbol: false,
        itemStyle: { color: colors.warning },
        yAxisIndex: 0,
      },
      {
        name: '积分',
        type: 'line',
        data: bonuses,
        smooth: true,
        showSymbol: false,
        itemStyle: { color: colors.primary },
        yAxisIndex: 1,
      },
    ],
  });
}

watch(
  () => [props.show, props.siteName],
  ([show]) => {
    if (show) fetchActivity();
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
