<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useChartTheme } from '#/composables/useChartTheme';
import { useSiteStats } from '#/composables/useSiteStats';
import { CHART_PALETTE } from '#/constants/chartColors';

interface DailySeries {
  download: number[];
  name: string;
  upload: number[];
}

interface Props {
  colorMap?: Record<string, string>;
  dailyData: { dates: string[]; series: DailySeries[] };
}

const props = withDefaults(defineProps<Props>(), {
  colorMap: () => ({}),
});

const { formatCompactSize, formatSize, getChartDataKey } = useSiteStats();
const { textColor, isDark } = useChartTheme();

const chartRef = ref<EchartsUIType>();
const { renderEcharts, updateData } = useEcharts(chartRef);

const sliceBorderColor = computed(() => (isDark.value ? '#16202f' : '#ffffff'));

const sortMode = ref<'download' | 'upload'>('upload');
const showAll = ref(false);
const TOP_COUNT = 10;

const todayInfo = computed(() => {
  const { dates, series } = props.dailyData;
  if (dates.length === 0 || series.length === 0) return null;
  const lastIdx = dates.length - 1;
  const prevIdx = dates.length - 2;
  let up = 0;
  let down = 0;
  let prevUp = 0;
  let prevDown = 0;
  const siteItems: Array<{
    download: number;
    name: string;
    ratio: number;
    upload: number;
  }> = [];
  for (const s of series) {
    const upVal = s.upload[lastIdx] || 0;
    const downVal = s.download[lastIdx] || 0;
    up += upVal;
    down += downVal;
    prevUp += prevIdx >= 0 ? s.upload[prevIdx] || 0 : 0;
    prevDown += prevIdx >= 0 ? s.download[prevIdx] || 0 : 0;
    if (upVal > 0 || downVal > 0) {
      siteItems.push({
        download: downVal,
        name: s.name,
        ratio: downVal > 0 ? upVal / downVal : upVal > 0 ? Infinity : 0,
        upload: upVal,
      });
    }
  }
  const ratio = down > 0 ? up / down : 0;
  const totalToday = up + down;
  const totalPrev = prevUp + prevDown;
  return {
    date: dates[lastIdx],
    download: down,
    downloadDelta: prevDown > 0 ? (down - prevDown) / prevDown : 0,
    downloadNew: prevDown === 0 && down > 0,
    prevTotal: totalPrev,
    ratio,
    sites: siteItems,
    totalDelta: totalPrev > 0 ? (totalToday - totalPrev) / totalPrev : 0,
    totalNew: totalPrev === 0 && totalToday > 0,
    totalToday,
    upload: up,
    uploadDelta: prevUp > 0 ? (up - prevUp) / prevUp : 0,
    uploadNew: prevUp === 0 && up > 0,
  };
});

/** 排序后展示的站点 */
const sortedSites = computed(() => {
  const sites = [...(todayInfo.value?.sites || [])];
  return sites.toSorted((a, b) =>
    sortMode.value === 'upload' ? b.upload - a.upload : b.download - a.download,
  );
});

const visibleSites = computed(() => {
  const sites = sortedSites.value;
  return showAll.value ? sites : sites.slice(0, TOP_COUNT);
});

const collapsedCount = computed(() => {
  const total = sortedSites.value.length;
  return total > TOP_COUNT ? total - TOP_COUNT : 0;
});

const maxBarValue = computed(() => {
  const sites = visibleSites.value;
  if (sites.length === 0) return 1;
  return Math.max(...sites.map((s) => Math.max(s.upload, s.download)), 1);
});

/** 环形图：各站点占今日总流量（上传+下载）比例，颜色与其他图表一致 */
const donutData = computed(() => {
  const sites = todayInfo.value?.sites || [];
  return sites.map((s, i) => ({
    itemStyle: {
      color: props.colorMap[s.name] ?? CHART_PALETTE[i % CHART_PALETTE.length],
    },
    name: s.name,
    value: s.upload + s.download,
  }));
});

const donutTotal = computed(() => todayInfo.value?.totalToday || 0);

function buildDonutOption() {
  return {
    animation: true,
    animationDuration: 800,
    color: CHART_PALETTE,
    series: [
      {
        center: ['50%', '50%'],
        data: donutData.value,
        emphasis: { scale: true, scaleSize: 6 },
        itemStyle: {
          borderRadius: 6,
          borderColor: sliceBorderColor.value,
          borderWidth: 1.5,
        },
        label: { show: false },
        labelLine: { show: false },
        radius: ['60%', '84%'],
        type: 'pie' as const,
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `<div style="font-weight:600;color:${textColor.value}">${params.name}</div>
         <div style="color:${textColor.value}">流量：${formatSize(params.value)}</div>
         <div style="color:#656d77">占比：${params.percent}%</div>`,
      trigger: 'item' as const,
    },
  };
}

onMounted(() => {
  renderEcharts(buildDonutOption() as any);
});

let dataCacheKey = '';
watch(
  () => [props.dailyData, props.colorMap, isDark.value],
  (newVal) => {
    const key = getChartDataKey(newVal);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    updateData(buildDonutOption() as any, true);
  },
  { deep: true },
);

function formatDelta(delta: number): string {
  const pct = Math.abs(delta * 100).toFixed(1);
  return `${pct}%`;
}

function formatDeltaLabel(delta: number, isNew: boolean): string {
  if (isNew) return '新增';
  const sign = delta >= 0 ? '+' : '-';
  return `${sign}${formatDelta(delta)}`;
}

function getLegendEntries(): Array<{
  color: string;
  name: string;
  pct: string;
}> {
  const total = donutTotal.value;
  if (!total || donutData.value.length === 0) return [];
  const entries = donutData.value.map((d) => ({
    color: d.itemStyle.color || CHART_PALETTE[0]!,
    name: d.name,
    pct: `${((d.value / total) * 100).toFixed(1)}%`,
  }));
  return entries.slice(0, 5);
}
</script>

<template>
  <div v-if="todayInfo" class="today-card">
    <div class="today-header">
      <span class="today-title">今日流量 · 各站点排行</span>
      <div class="today-total-wrap">
        <span class="today-date">{{ todayInfo.date }}</span>
        <span class="today-total-label">今日总量</span>
        <span class="today-total-value">
          {{ formatCompactSize(todayInfo.totalToday) }}
        </span>
        <span
          class="delta-badge"
          :class="todayInfo.totalDelta >= 0 ? 'delta-up' : 'delta-down'"
        >
          <IconifyIcon
            :icon="
              todayInfo.totalDelta >= 0
                ? 'lucide:trending-up'
                : 'lucide:trending-down'
            "
            class="size-3.5"
          />
          {{ formatDeltaLabel(todayInfo.totalDelta, todayInfo.totalNew) }}
        </span>
      </div>
    </div>

    <div class="today-body">
      <!-- 左侧：流量占比环形图 -->
      <div class="donut-column">
        <div class="donut-wrap">
          <EchartsUI
            ref="chartRef"
            height="100%"
            width="100%"
            class="donut-chart"
          />
          <div class="donut-center">
            <div class="donut-total">
              {{ formatCompactSize(donutTotal) }}
            </div>
            <div class="donut-total-label">今日流量</div>
          </div>
        </div>
        <div class="donut-legend">
          <div
            v-for="entry in getLegendEntries()"
            :key="entry.name"
            class="legend-item"
          >
            <span
              class="legend-swatch"
              :style="{ background: entry.color }"
            ></span>
            <span class="legend-name">{{ entry.name }}</span>
            <span class="legend-pct">{{ entry.pct }}</span>
          </div>
          <div v-if="todayInfo.sites.length === 0" class="donut-empty">
            今日暂无新增流量
          </div>
        </div>
      </div>

      <!-- 右侧：各站点上传/下载排行 -->
      <div class="bars-column">
        <div class="bars-toolbar">
          <span class="bars-title">各站点流量</span>
          <div class="sort-toggle">
            <button
              :class="{ active: sortMode === 'upload' }"
              @click="sortMode = 'upload'"
            >
              按上传
            </button>
            <button
              :class="{ active: sortMode === 'download' }"
              @click="sortMode = 'download'"
            >
              按下载
            </button>
          </div>
        </div>

        <div v-if="visibleSites.length > 0" class="bars-scroll">
          <div class="site-bar" v-for="site in visibleSites" :key="site.name">
            <span class="site-name" :title="site.name">{{ site.name }}</span>
            <div class="site-track">
              <div
                class="site-fill site-fill-up"
                :style="{
                  width: `${(site.upload / maxBarValue) * 100}%`,
                }"
                :title="`上传 ${formatSize(site.upload)}`"
              ></div>
              <div
                class="site-fill site-fill-down"
                :style="{
                  width: `${(site.download / maxBarValue) * 100}%`,
                }"
                :title="`下载 ${formatSize(site.download)}`"
              ></div>
            </div>
            <div class="site-nums">
              <span class="site-up">{{ formatCompactSize(site.upload) }}</span>
              <span class="site-sep">/</span>
              <span class="site-down">{{
                formatCompactSize(site.download)
              }}</span>
              <span
                class="site-ratio"
                :class="site.ratio >= 1 ? 'ratio-ok' : 'ratio-low'"
              >
                {{ Number.isFinite(site.ratio) ? site.ratio.toFixed(2) : '∞' }}
              </span>
            </div>
          </div>
          <button
            v-if="collapsedCount > 0"
            class="expand-btn"
            @click="showAll = true"
          >
            <IconifyIcon icon="lucide:chevron-down" class="size-3.5" />
            展开其余 {{ collapsedCount }} 个站点
          </button>
        </div>
        <div v-else class="bars-empty">
          <IconifyIcon icon="lucide:inbox" class="size-4" />
          <span>今日暂无新增流量，站点数据每日 22:36 自动刷新</span>
        </div>
      </div>
    </div>

    <!-- 底部汇总条 -->
    <div class="summary-strip">
      <div class="summary-item">
        <span class="summary-label">今日上传</span>
        <span class="summary-value summary-up">
          {{ formatCompactSize(todayInfo.upload) }}
        </span>
        <span
          class="mini-delta"
          :class="todayInfo.uploadDelta >= 0 ? 'delta-up' : 'delta-down'"
        >
          {{ formatDeltaLabel(todayInfo.uploadDelta, todayInfo.uploadNew) }}
        </span>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-label">今日下载</span>
        <span class="summary-value summary-down">
          {{ formatCompactSize(todayInfo.download) }}
        </span>
        <span
          class="mini-delta"
          :class="todayInfo.downloadDelta >= 0 ? 'delta-up' : 'delta-down'"
        >
          {{ formatDeltaLabel(todayInfo.downloadDelta, todayInfo.downloadNew) }}
        </span>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-label">分享率</span>
        <span class="summary-value">{{ todayInfo.ratio.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.today-card {
  display: flex;
  flex-direction: column;
  background: var(--tblr-card-bg);
  border: 1px solid var(--tblr-card-border-color);
  border-radius: var(--tblr-card-border-radius);
  box-shadow: var(--tblr-box-shadow-card);
}

.today-header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.625rem;
}

.today-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--tblr-text-heading);
}

.today-body {
  display: grid;
  grid-template-columns: 15rem 1fr;
  gap: 1.5rem;
  padding: 0.75rem 1.25rem 1.25rem;
}

.today-date {
  font-size: 0.75rem;
  color: var(--tblr-text-muted);
}

.today-total-wrap {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.today-total-label {
  font-size: 0.75rem;
  color: var(--tblr-text-muted);
}

.today-total-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--tblr-text-heading);
}

.delta-badge {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-radius: 999px;
}

.delta-up {
  color: var(--tblr-success);
  background: color-mix(in srgb, var(--tblr-success) 12%, transparent);
}

.delta-down {
  color: var(--tblr-danger);
  background: color-mix(in srgb, var(--tblr-danger) 12%, transparent);
}

.donut-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}

.donut-wrap {
  position: relative;
  width: 12rem;
  height: 12rem;
}

.donut-chart {
  width: 100%;
  height: 100%;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.donut-total {
  font-size: 1.125rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--tblr-text-heading);
}

.donut-total-label {
  font-size: 0.6875rem;
  color: var(--tblr-text-muted);
  letter-spacing: 0.05em;
}

.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;
}

.legend-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.75rem;
}

.legend-swatch {
  flex-shrink: 0;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
}

.legend-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--tblr-text-heading);
  white-space: nowrap;
}

.legend-pct {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--tblr-text-muted);
}

.donut-empty {
  padding: 0.5rem 0;
  font-size: 0.75rem;
  color: var(--tblr-text-muted);
}

.bars-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.bars-toolbar {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.bars-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--tblr-text-heading);
}

.sort-toggle {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--tblr-card-border-color);
  border-radius: 0.375rem;
}

.sort-toggle button {
  padding: 0.1875rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--tblr-text-muted);
  cursor: pointer;
  background: var(--tblr-card-bg);
  border: none;
  transition: all 0.2s;
}

.sort-toggle button.active {
  color: #fff;
  background: var(--tblr-primary);
}

.bars-scroll {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  max-height: 20rem;
  overflow-y: auto;
}

.site-bar {
  display: grid;
  grid-template-columns: 5.5rem 1fr 10rem;
  gap: 0.75rem;
  align-items: center;
}

.site-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.75rem;
  color: var(--tblr-text-heading);
  white-space: nowrap;
}

.site-track {
  position: relative;
  height: 0.625rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--tblr-text-muted) 15%, transparent);
  border-radius: 999px;
}

.site-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.site-fill-up {
  background: linear-gradient(90deg, var(--tblr-success), var(--tblr-teal));
}

.site-fill-down {
  top: 50%;
  height: 50%;
  background: var(--tblr-warning);
}

.site-nums {
  display: flex;
  gap: 0.25rem;
  align-items: baseline;
  justify-content: flex-end;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.site-up {
  font-weight: 600;
  color: var(--tblr-success);
}

.site-sep {
  color: var(--tblr-text-muted);
}

.site-down {
  color: var(--tblr-warning);
}

.site-ratio {
  padding: 0.0625rem 0.375rem;
  margin-left: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 0.375rem;
}

.ratio-ok {
  color: var(--tblr-success);
  background: color-mix(in srgb, var(--tblr-success) 12%, transparent);
}

.ratio-low {
  color: var(--tblr-warning);
  background: color-mix(in srgb, var(--tblr-warning) 12%, transparent);
}

.expand-btn {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  font-size: 0.75rem;
  color: var(--tblr-primary);
  cursor: pointer;
  background: transparent;
  border: none;
}

.expand-btn:hover {
  color: color-mix(in srgb, var(--tblr-primary) 80%, transparent);
}

.bars-empty {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  font-size: 0.75rem;
  color: var(--tblr-text-muted);
  background: color-mix(in srgb, var(--tblr-text-muted) 8%, transparent);
  border: 1px dashed var(--tblr-card-border-color);
  border-radius: 0.625rem;
}

.summary-strip {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid
    color-mix(in srgb, var(--tblr-card-border-color) 60%, transparent);
}

.summary-item {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--tblr-text-muted);
}

.summary-value {
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--tblr-text-heading);
}

.summary-up {
  color: var(--tblr-success);
}

.summary-down {
  color: var(--tblr-warning);
}

.mini-delta {
  font-size: 0.75rem;
  font-weight: 600;
}

.summary-divider {
  width: 1px;
  height: 1.25rem;
  background: var(--tblr-card-border-color);
}

@media (max-width: 768px) {
  .today-body {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .donut-wrap {
    width: 10rem;
    height: 10rem;
  }

  .donut-legend {
    flex-flow: row wrap;
    justify-content: center;
  }

  .legend-item {
    min-width: 6.5rem;
  }

  .site-bar {
    grid-template-columns: 4.5rem 1fr 8.5rem;
  }

  .summary-strip {
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
  }

  .summary-divider {
    display: none;
  }
}

@media (max-width: 640px) {
  .today-header {
    padding: 0.875rem 1rem 0.5rem;
  }

  .today-body {
    padding: 0.75rem 1rem 1rem;
  }

  .today-total-value {
    font-size: 1.0625rem;
  }

  .site-bar {
    grid-template-columns: 3.5rem 1fr 7rem;
    gap: 0.5rem;
  }

  .site-nums {
    gap: 0.125rem;
  }

  .site-ratio {
    display: none;
  }
}
</style>
