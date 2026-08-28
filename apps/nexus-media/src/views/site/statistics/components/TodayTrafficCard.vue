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

const UPLOAD_COLOR = CHART_PALETTE[2]!;
const DOWNLOAD_COLOR = CHART_PALETTE[3]!;

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
        ratio: downVal > 0 ? upVal / downVal : upVal > 0 ? 99 : 0,
        upload: upVal,
      });
    }
  }
  siteItems.sort((a, b) => b.upload - a.upload);
  const ratio = down > 0 ? up / down : 0;
  const totalToday = up + down;
  const totalPrev = prevUp + prevDown;
  return {
    date: dates[lastIdx],
    download: down,
    downloadDelta: prevDown > 0 ? (down - prevDown) / prevDown : 0,
    prevTotal: totalPrev,
    ratio,
    sites: siteItems,
    totalDelta: totalPrev > 0 ? (totalToday - totalPrev) / totalPrev : 0,
    totalToday,
    upload: up,
    uploadDelta: prevUp > 0 ? (up - prevUp) / prevUp : 0,
  };
});

const maxSiteUpload = computed(() => {
  const sites = todayInfo.value?.sites || [];
  return sites.length > 0 ? Math.max(sites[0]!.upload, 1) : 1;
});

function buildOption() {
  const info = todayInfo.value;
  if (!info) return {};
  return {
    animation: true,
    animationDuration: 800,
    series: [
      {
        center: ['50%', '50%'],
        data: [
          {
            itemStyle: { color: UPLOAD_COLOR },
            name: '上传',
            value: info.upload,
          },
          {
            itemStyle: { color: DOWNLOAD_COLOR },
            name: '下载',
            value: info.download,
          },
        ],
        emphasis: { scale: true, scaleSize: 6 },
        itemStyle: {
          borderRadius: 8,
          borderColor: 'hsl(var(--card))',
          borderWidth: 3,
        },
        label: { show: false },
        labelLine: { show: false },
        radius: ['72%', '92%'],
        type: 'pie' as const,
      },
    ],
    tooltip: {
      formatter: (params: any) =>
        `<div style="font-weight:600;color:hsl(var(--card-foreground))">${params.name}</div>
         <div style="color:hsl(var(--card-foreground))">${formatSize(params.value)}</div>
         <div style="color:hsl(var(--muted-foreground))">占比 ${params.percent}%</div>`,
      trigger: 'item' as const,
    },
  };
}

onMounted(() => {
  renderEcharts(buildOption() as any);
});

let dataCacheKey = '';
watch(
  () => props.dailyData,
  (newVal) => {
    const key = getChartDataKey(newVal);
    if (key === dataCacheKey) return;
    dataCacheKey = key;
    updateData(buildOption() as any, true);
  },
  { deep: true },
);

function formatDelta(delta: number): string {
  const pct = Math.abs(delta * 100).toFixed(1);
  return `${pct}%`;
}
</script>

<template>
  <div v-if="todayInfo" class="today-card">
    <div class="today-header">
      <div class="today-title-wrap">
        <span class="today-title">今日流量</span>
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
          {{ formatDelta(todayInfo.totalDelta) }}
        </span>
      </div>
    </div>

    <div class="today-body">
      <!-- 环形图 + 中心分享率 -->
      <div class="donut-wrap">
        <EchartsUI
          ref="chartRef"
          height="100%"
          width="100%"
          class="donut-chart"
        />
        <div class="donut-center">
          <div class="donut-ratio">{{ todayInfo.ratio.toFixed(2) }}</div>
          <div class="donut-ratio-label">分享率</div>
        </div>
      </div>

      <!-- 上/下载统计 -->
      <div class="flow-stats">
        <div class="flow-stat flow-up">
          <div class="flow-icon">
            <IconifyIcon icon="lucide:arrow-up-right" class="size-4" />
          </div>
          <div class="flow-info">
            <div class="flow-label">今日上传</div>
            <div class="flow-value">
              {{ formatCompactSize(todayInfo.upload) }}
            </div>
          </div>
          <span
            class="delta-badge"
            :class="todayInfo.uploadDelta >= 0 ? 'delta-up' : 'delta-down'"
          >
            {{ todayInfo.uploadDelta >= 0 ? '+' : '-' }}
            {{ formatDelta(todayInfo.uploadDelta) }}
          </span>
        </div>
        <div class="flow-stat flow-down">
          <div class="flow-icon">
            <IconifyIcon icon="lucide:arrow-down-right" class="size-4" />
          </div>
          <div class="flow-info">
            <div class="flow-label">今日下载</div>
            <div class="flow-value">
              {{ formatCompactSize(todayInfo.download) }}
            </div>
          </div>
          <span
            class="delta-badge"
            :class="todayInfo.downloadDelta >= 0 ? 'delta-up' : 'delta-down'"
          >
            {{ todayInfo.downloadDelta >= 0 ? '+' : '-' }}
            {{ formatDelta(todayInfo.downloadDelta) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 各站点今日流量（按上传排序，可滚动） -->
    <div class="site-bars">
      <div class="site-bars-header">
        <span class="site-bars-title">各站点今日流量</span>
        <span v-if="todayInfo.sites.length > 0" class="site-bars-legend">
          <span class="legend-dot legend-up"></span>上传
          <span class="legend-dot legend-down"></span>下载
        </span>
      </div>
      <div v-if="todayInfo.sites.length > 0" class="site-bars-scroll">
        <div class="site-bar" v-for="site in todayInfo.sites" :key="site.name">
          <span class="site-name" :title="site.name">{{ site.name }}</span>
          <div class="site-track">
            <div
              class="site-fill site-fill-up"
              :style="{ width: `${(site.upload / maxSiteUpload) * 100}%` }"
              :title="`上传 ${formatSize(site.upload)}`"
            ></div>
            <div
              class="site-fill site-fill-down"
              :style="{ width: `${(site.download / maxSiteUpload) * 100}%` }"
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
              {{ site.ratio.toFixed(2) }}
            </span>
          </div>
        </div>
      </div>
      <div v-else class="site-empty">
        <IconifyIcon icon="lucide:info" class="size-4" />
        <span>今日暂无新增流量，站点数据每日 22:36 自动刷新</span>
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
  color: hsl(var(--card-foreground));
}

.today-body {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.5rem;
  align-items: center;
}

.donut-wrap {
  position: relative;
  width: 11rem;
  height: 11rem;
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

.donut-ratio {
  font-size: 1.75rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: hsl(var(--card-foreground));
}

.donut-ratio-label {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.05em;
}

.flow-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.flow-stat {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.875rem 1rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 0.75rem;
}

.flow-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.625rem;
}

.flow-up .flow-icon {
  color: hsl(160deg 75% 42%);
  background: hsl(160deg 75% 45% / 12%);
}

.flow-down .flow-icon {
  color: hsl(35deg 90% 48%);
  background: hsl(35deg 95% 55% / 12%);
}

.flow-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.flow-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.flow-value {
  margin-top: 0.125rem;
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

.site-bars {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border) / 60%);
}

.site-bars-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.site-bars-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.site-empty {
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

.site-bars-legend {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.legend-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.25rem;
  border-radius: 2px;
}

.legend-up {
  background: hsl(160deg 75% 45%);
}

.legend-down {
  background: hsl(35deg 95% 55%);
}

.site-bars-scroll {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 16rem;
  overflow-y: auto;
}

.site-bar {
  display: grid;
  grid-template-columns: 5.5rem 1fr 9.5rem;
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

@media (max-width: 640px) {
  .today-card {
    padding: 1rem;
  }

  .today-body {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .donut-wrap {
    width: 10rem;
    height: 10rem;
    margin: 0 auto;
  }

  .site-bar {
    grid-template-columns: 4.5rem 1fr 4rem;
  }
}
</style>
