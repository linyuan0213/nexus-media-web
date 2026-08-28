<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useSiteStats } from '#/composables/useSiteStats';
import { CHART_PALETTE } from '#/constants/chartColors';

interface DailySeries {
  download: number[];
  name: string;
  upload: number[];
}

interface Props {
  dailyData: { dates: string[]; series: DailySeries[] };
}

const props = defineProps<Props>();

const { formatCompactSize, formatSize, getChartDataKey } = useSiteStats();

const chartRef = ref<EchartsUIType>();
const { renderEcharts, updateData } = useEcharts(chartRef);

const TEXT_COLOR = 'hsl(var(--card-foreground))';

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

/** 环形图：各站点占今日总流量（上传+下载）比例 */
const donutData = computed(() => {
  const sites = todayInfo.value?.sites || [];
  return sites.map((s, i) => ({
    itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
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
          borderColor: 'hsl(var(--card))',
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
        `<div style="font-weight:600;color:${TEXT_COLOR}">${params.name}</div>
         <div style="color:${TEXT_COLOR}">流量：${formatSize(params.value)}</div>
         <div style="color:hsl(var(--muted-foreground))">占比：${params.percent}%</div>`,
      trigger: 'item' as const,
    },
  };
}

onMounted(() => {
  renderEcharts(buildDonutOption() as any);
});

let dataCacheKey = '';
watch(
  () => props.dailyData,
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
      <div class="today-title-wrap">
        <span class="today-title">今日流量 · 各站点排行</span>
        <span class="today-date">{{ todayInfo.date }}</span>
      </div>
      <div class="today-total-wrap">
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
  gap: 1rem;
  padding: 1.25rem;
  background:
    radial-gradient(
      120% 160% at 0% 0%,
      hsl(217deg 90% 58% / 6%),
      transparent 55%
    ),
    radial-gradient(
      120% 160% at 100% 100%,
      hsl(35deg 95% 55% / 5%),
      transparent 55%
    ),
    hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.875rem;
  box-shadow: 0 1px 2px hsl(0deg 0% 0% / 4%);
}

.today-header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.today-title-wrap {
  display: flex;
  gap: 0.625rem;
  align-items: baseline;
}

.today-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: hsl(var(--card-foreground));
  letter-spacing: 0.01em;
}

.today-date {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.today-total-wrap {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.today-total-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.today-total-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--card-foreground));
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
  color: hsl(160deg 75% 35%);
  background: hsl(160deg 75% 45% / 12%);
}

.delta-down {
  color: hsl(0deg 75% 55%);
  background: hsl(0deg 75% 55% / 12%);
}

.today-body {
  display: grid;
  grid-template-columns: 15rem 1fr;
  gap: 1.5rem;
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
  color: hsl(var(--card-foreground));
}

.donut-total-label {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
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
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.legend-pct {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground));
}

.donut-empty {
  padding: 0.5rem 0;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
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
  color: hsl(var(--card-foreground));
}

.sort-toggle {
  display: flex;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
}

.sort-toggle button {
  padding: 0.1875rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: none;
  transition: all 0.2s;
}

.sort-toggle button.active {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
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
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.site-track {
  position: relative;
  height: 0.625rem;
  overflow: hidden;
  background: hsl(var(--muted) / 40%);
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
  background: linear-gradient(90deg, hsl(160deg 75% 48%), hsl(175deg 80% 45%));
}

.site-fill-down {
  top: 50%;
  height: 50%;
  background: hsl(35deg 95% 55%);
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
  color: hsl(160deg 75% 40%);
}

.site-sep {
  color: hsl(var(--muted-foreground));
}

.site-down {
  color: hsl(35deg 90% 45%);
}

.site-ratio {
  padding: 0.0625rem 0.375rem;
  margin-left: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 0.375rem;
}

.ratio-ok {
  color: hsl(160deg 75% 35%);
  background: hsl(160deg 75% 45% / 12%);
}

.ratio-low {
  color: hsl(35deg 90% 45%);
  background: hsl(35deg 95% 55% / 12%);
}

.expand-btn {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  font-size: 0.75rem;
  color: hsl(var(--primary));
  cursor: pointer;
  background: transparent;
  border: none;
}

.expand-btn:hover {
  color: hsl(var(--primary) / 80%);
}

.bars-empty {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 30%);
  border: 1px dashed hsl(var(--border));
  border-radius: 0.625rem;
}

.summary-strip {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid hsl(var(--border) / 60%);
}

.summary-item {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.summary-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.summary-value {
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--card-foreground));
}

.summary-up {
  color: hsl(160deg 75% 40%);
}

.summary-down {
  color: hsl(35deg 90% 45%);
}

.mini-delta {
  font-size: 0.75rem;
  font-weight: 600;
}

.summary-divider {
  width: 1px;
  height: 1.25rem;
  background: hsl(var(--border));
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
  .today-card {
    padding: 1rem;
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
