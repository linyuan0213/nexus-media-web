<script lang="ts" setup>
import { ref, computed, h, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';

import {
  NButton,
  NCard,
  NSpace,
  NSpin,
  NTag,
  NDataTable,
  NSelect,
  NModal,
  useNotification,
} from 'naive-ui';

import {
  getSiteStatisticsApi,
  getSiteHistoryApi,
  getSiteFaviconsApi,
  getSiteActivityApi,
  getSiteDailyHistoryApi,
  refreshSiteStatisticsApi,
} from '#/api/modules/site';
import SiteDailyLineChart from './components/SiteDailyLineChart.vue';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import SiteLogo from './SiteLogo.vue';

interface StatisticsItem {
  site_name: string;
  upload: string;
  download: string;
  ratio: string;
  seeding_size: string;
  seeding_count: number;
  bonus: string;
  leeching_count?: number;
  message_count?: number;
}

const notification = useNotification();
const loading = ref(false);
const screenWidth = ref(window.innerWidth);
const isMobile = computed(() => screenWidth.value < 768);
const statistics = ref<StatisticsItem[]>([]);
const historyData = ref<[string, number, number][]>([]);
const dailyData = ref<{ dates: string[]; series: Array<{ name: string; upload: number[]; download: number[] }> }>({ dates: [], series: [] });
const dailyMode = ref<'upload' | 'download'>('upload');
const favicons = ref<Record<string, string>>({});
const sortBy = ref('');
const refreshing = ref(false);

const chartBarRef = ref<any>(null);
const chartPieRef = ref<any>(null);
const chartTrendRef = ref<any>(null);
const chartRoseRef = ref<any>(null);

const { renderEcharts: renderBar } = useEcharts(chartBarRef);
const { renderEcharts: renderPie } = useEcharts(chartPieRef);
const { renderEcharts: renderTrend } = useEcharts(chartTrendRef);
const { renderEcharts: renderRose } = useEcharts(chartRoseRef);

const siteDetailModalShow = ref(false);
const siteDetailName = ref('');
const siteDetailLoading = ref(false);
const siteActivityData = ref<[number, number, number, number, number, number][]>([]);
const chartDetailRef = ref<any>(null);
const renderDetail: (option: any) => void = useEcharts(chartDetailRef).renderEcharts;

const sortOptions = [
  { label: '默认排序', value: '' },
  { label: '按上传量', value: 'upload' },
  { label: '按下载量', value: 'download' },
  { label: '按做种数', value: 'seeding_count' },
  { label: '按分享率', value: 'ratio' },
  { label: '按魔力值', value: 'bonus' },
];

function getFavicon(name: string): string {
  const data = favicons.value[name];
  if (!data) return '';
  if (data.startsWith('data:') || data.startsWith('http')) return data;
  return `${data}`;
}

function getFaviconFallback(name: string): string {
  return `https://www.google.com/s2/favicons?domain=${name.toLowerCase()}.com&sz=64`;
}

function getFaviconExternalUrl(name: string): string {
  const domainMap: Record<string, string> = {
    '0magnet': '0magnet.com',
    '1377x': 'www.1377x.to',
    'acgrip': 'acg.rip',
    'dmhy': 'dmhy.org',
    'mikanani': 'mikanani.me',
    'nyaa': 'nyaa.si',
  };
  const domain = domainMap[name.toLowerCase()] || `${name.toLowerCase()}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function handleOpenSiteDetail(row: StatisticsItem) {
  siteDetailName.value = row.site_name;
  siteDetailModalShow.value = true;
  fetchSiteActivity(row.site_name);
}

async function handleRefresh() {
  refreshing.value = true;
  try {
    await refreshSiteStatisticsApi();
    notification.success({ content: '站点数据刷新已启动', description: '数据正在后台刷新中，请稍候重新查看' });
  } catch (err: any) {
    notification.error({ content: '刷新失败', description: err?.message || '' });
  } finally {
    refreshing.value = false;
  }
}

async function handleRefreshSite(siteName: string) {
  try {
    await refreshSiteStatisticsApi([siteName]);
    notification.success({ content: `${siteName} 刷新已启动`, description: '数据正在后台刷新中，请稍候重新查看' });
  } catch (err: any) {
    notification.error({ content: '刷新失败', description: err?.message || '' });
  }
}

async function fetchSiteActivity(name: string) {
  siteDetailLoading.value = true;
  try {
    const res: any = await getSiteActivityApi(name);
    const dataset = res?.dataset || [];
    siteActivityData.value = dataset.length > 1 ? dataset.slice(1) : [];
    await nextTick();
    renderDetailChart();
  } catch (err: any) {
    notification.error({ content: '获取站点统计失败', description: err?.message || '' });
  } finally {
    siteDetailLoading.value = false;
  }
}

function renderDetailChart() {
  if (!siteActivityData.value.length) return;
  const dates = siteActivityData.value.map(i => {
    const d = new Date(i[0]);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const uploads = siteActivityData.value.map(i => i[1]);
  const downloads = siteActivityData.value.map(i => i[2]);
  const bonuses = siteActivityData.value.map(i => i[3]);
  const seedings = siteActivityData.value.map(i => i[4]);
  const seedingSizes = siteActivityData.value.map(i => i[5]);
  const colors = getThemeColors();

  renderDetail({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = `<div style="font-weight:600;margin-bottom:4px">${params[0].name}</div>`;
        params.forEach((p: any) => {
          let val = p.value;
          if (p.seriesName === '做种体积') val = formatSize(val);
          else if (p.seriesName !== '做种数' && p.seriesName !== '积分') val = formatSize(val);
          result += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: ${val}</span>
          </div>`;
        });
        return result;
      },
    },
    legend: {
      data: ['上传', '下载', '做种数', '做种体积', '积分'],
      bottom: 0,
      textStyle: { color: getThemeColor('--card-foreground') },
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
        color: getThemeColor('--muted-foreground'),
      },
      axisLine: { lineStyle: { color: getThemeColor('--border') } },
    },
    yAxis: [
      {
        type: 'value',
        name: '流量',
        position: 'left',
        nameTextStyle: { color: getThemeColor('--muted-foreground') },
        axisLabel: {
          color: getThemeColor('--muted-foreground'),
          formatter: (value: number) => formatSize(value),
        },
        splitLine: { lineStyle: { color: getThemeColor('--border'), type: 'dashed' } },
      },
      {
        type: 'value',
        name: '数量',
        position: 'right',
        nameTextStyle: { color: getThemeColor('--muted-foreground') },
        axisLabel: { color: getThemeColor('--muted-foreground') },
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
        itemStyle: { color: getThemeColor('--primary') },
        yAxisIndex: 1,
      },
    ],
  });
}

function getColumns(isMobile: boolean): any[] {
  const baseColumns = [
    {
      title: '站点',
      key: 'site_name',
      width: isMobile ? 100 : 150,
      fixed: 'left' as const,
      render(row: any) {
        return h('div', { class: 'site-cell' }, [
          h(SiteLogo, {
            src: getFavicon(row.site_name),
            fallback: getFaviconFallback(row.site_name),
            name: row.site_name,
            url: row.url,
          }),
          h('span', { class: 'site-cell-name' }, row.site_name),
        ]);
      },
    },
    {
      title: '等级',
      key: 'user_level',
      width: isMobile ? 60 : 80,
      render(row: StatisticsItem) {
        return row.user_level || '-';
      },
    },
    {
      title: '上传',
      key: 'upload',
      width: isMobile ? 90 : 110,
      sorter: (a, b) => parseSize(a.upload) - parseSize(b.upload),
    },
    {
      title: '下载',
      key: 'download',
      width: isMobile ? 90 : 110,
      sorter: (a, b) => parseSize(a.download) - parseSize(b.download),
    },
    {
      title: '分享率',
      key: 'ratio',
      width: isMobile ? 75 : 90,
      render(row: StatisticsItem) {
        const ratio = parseFloat(row.ratio);
        let type: any = 'default';
        if (ratio >= 5) type = 'success';
        else if (ratio >= 1) type = 'warning';
        else if (ratio > 0) type = 'error';
          return h(NTag, { size: 'small', type }, () => row.ratio);
        },
        sorter: (a, b) => parseFloat(a.ratio) - parseFloat(b.ratio),
      },
    {
      title: '做种',
      key: 'seeding_count',
      width: isMobile ? 70 : 85,
      sorter: (a, b) => (a.seeding_count || 0) - (b.seeding_count || 0),
    },
  ];

  const extraColumns = isMobile ? [] : [
    {
      title: '做种大小',
      key: 'seeding_size',
      width: 110,
    },
    {
      title: '魔力值',
      key: 'bonus',
      width: 100,
      sorter: (a, b) => parseFloat(a.bonus) - parseFloat(b.bonus),
    },
    {
      title: '消息',
      key: 'message_count',
      width: 70,
      render(row: StatisticsItem) {
        if (!row.message_count) return h('span', { class: 'text-muted' }, '-');
        return h(NTag, { size: 'small', type: 'error' }, () => String(row.message_count));
      },
    },
  ];

  return [
    ...baseColumns,
    ...extraColumns,
    {
      title: '操作',
      key: 'actions',
      width: isMobile ? 75 : 90,
      fixed: 'right' as const,
      render(row: StatisticsItem) {
        return h('div', { class: 'flex items-center gap-1' }, [
          h(NButton, {
            text: true,
            size: 'small',
            onClick: () => handleRefreshSite(row.site_name),
            title: '刷新站点数据',
          }, () => [
            h(IconifyIcon, { icon: 'lucide:refresh-cw', class: 'h-3.5 w-3.5' }),
          ]),
          h(NButton, {
            text: true,
            size: 'small',
            onClick: () => handleOpenSiteDetail(row),
            title: '查看统计趋势',
          }, () => [
            h(IconifyIcon, { icon: 'lucide:line-chart', class: 'h-3.5 w-3.5' }),
          ]),
        ]);
      },
    },
  ];
}

const columns = computed(() => getColumns(isMobile.value));

function parseSize(sizeInput: string | number): number {
  if (sizeInput == null) return 0;
  if (typeof sizeInput === 'number') return sizeInput;
  const match = String(sizeInput).match(/^(\d+(?:\.\d+)?)\s*(TB|GB|MB|KB|B)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]!);
  const unit = match[2]!.toUpperCase();
  const units: Record<string, number> = { TB: 1024 ** 4, GB: 1024 ** 3, MB: 1024 ** 2, KB: 1024, B: 1 };
  return val * (units[unit] || 1);
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}

function parseNumber(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

const summary = computed(() => {
  const items = statistics.value;
  if (!items.length) return null;
  const totalUpload = items.reduce((sum, i) => sum + parseSize(i.upload), 0);
  const totalDownload = items.reduce((sum, i) => sum + parseSize(i.download), 0);
  const totalSeeding = items.reduce((sum, i) => sum + (i.seeding_count || 0), 0);
  const totalBonus = items.reduce((sum, i) => sum + parseNumber(i.bonus), 0);
  const totalMessages = items.reduce((sum, i) => sum + (i.message_count || 0), 0);
  const avgRatio = items.reduce((sum, i) => sum + parseNumber(i.ratio), 0) / items.length;
  const activeSites = items.filter(i => parseSize(i.upload) > 0 || parseSize(i.download) > 0).length;

  return {
    total: items.length,
    active: activeSites,
    upload: totalUpload,
    download: totalDownload,
    seeding: totalSeeding,
    bonus: totalBonus,
    messages: totalMessages,
    avgRatio: avgRatio.toFixed(2),
  };
});

function getThemeColor(varName: string): string {
  const root = document.documentElement;
  const val = getComputedStyle(root).getPropertyValue(varName).trim();
  return val ? `hsl(${val})` : '';
}

function getThemeColors(): { success: string; warning: string; primary: string; destructive: string; muted: string } {
  return {
    success: getThemeColor('--success'),
    warning: getThemeColor('--warning'),
    primary: getThemeColor('--primary'),
    destructive: getThemeColor('--destructive'),
    muted: getThemeColor('--muted-foreground'),
  };
}

const sortedStatistics = computed(() => {
  const items = [...statistics.value];
  if (!sortBy.value) return items;
  return items.sort((a, b) => {
    const field = sortBy.value;
    let av: number, bv: number;
    if (field === 'upload' || field === 'download' || field === 'seeding_size') {
      av = parseSize((a as any)[field]);
      bv = parseSize((b as any)[field]);
    } else if (field === 'ratio' || field === 'bonus') {
      av = parseNumber((a as any)[field]);
      bv = parseNumber((b as any)[field]);
    } else {
      av = (a as any)[field] || 0;
      bv = (b as any)[field] || 0;
    }
    return bv - av; // 默认降序
  });
});

async function fetchData() {
  loading.value = true;
  try {
    const [statsRes, historyRes, dailyRes, favRes]: any = await Promise.all([
      getSiteStatisticsApi({}),
      getSiteHistoryApi({ days: 7 }),
      getSiteDailyHistoryApi({ days: 30 }),
      getSiteFaviconsApi(),
    ]);
    statistics.value = Array.isArray(statsRes) ? statsRes : (statsRes?.data || []);
    const hdata = historyRes?.dataset || [];
    historyData.value = hdata.length > 1 ? hdata.slice(1) : [];
    dailyData.value = dailyRes || { dates: [], series: [] };
    const favData = (typeof favRes === 'object' && !Array.isArray(favRes)) ? favRes : (favRes?.data || {});
    favicons.value = favData;
    await nextTick();
    renderAllCharts();
  } catch (err: any) {
    notification.error({ content: '获取数据失败', description: err?.message || '' });
  } finally {
    loading.value = false;
  }
}

function renderAllCharts() {
  renderBarChart();
  renderPieChart();
  renderTrendChart();
  renderRoseChart();
}

function renderBarChart() {
  if (!statistics.value.length) return;
  const sites = statistics.value.map(i => i.site_name);
  const uploads = statistics.value.map(i => parseSize(i.upload));
  const downloads = statistics.value.map(i => parseSize(i.download));
  const colors = getThemeColors();

  renderBar({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let result = `<div style="font-weight:600;margin-bottom:4px">${params[0].name}</div>`;
        params.forEach((p: any) => {
          result += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: ${formatSize(p.value)}</span>
          </div>`;
        });
        return result;
      },
    },
    legend: {
      data: ['上传量', '下载量'],
      bottom: 0,
      textStyle: { color: getThemeColor('--card-foreground') },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sites,
      axisLabel: {
        rotate: 45,
        interval: 0,
        color: getThemeColor('--muted-foreground'),
      },
      axisLine: { lineStyle: { color: getThemeColor('--border') } },
    },
    yAxis: {
      type: 'value',
      name: '流量',
      nameTextStyle: { color: getThemeColor('--muted-foreground') },
      axisLabel: {
        color: getThemeColor('--muted-foreground'),
        formatter: (value: number) => formatSize(value),
      },
      splitLine: { lineStyle: { color: getThemeColor('--border'), type: 'dashed' } },
    },
    series: [
      {
        name: '上传量',
        type: 'bar',
        data: uploads,
        itemStyle: { color: colors.success, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
      {
        name: '下载量',
        type: 'bar',
        data: downloads,
        itemStyle: { color: colors.warning, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  });
}

function renderPieChart() {
  if (!statistics.value.length) return;
  const data = statistics.value
    .map(i => ({ name: i.site_name, value: parseSize(i.upload) }))
    .filter(i => i.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!data.length) return;

  renderPie({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `<div style="font-weight:600">${params.name}</div>
                <div>上传量: ${formatSize(params.value)}</div>
                <div>占比: ${params.percent}%</div>`;
      },
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 10,
      top: 20,
      bottom: 20,
      textStyle: { color: getThemeColor('--card-foreground') },
    },
    series: [
      {
        name: '上传量分布',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: getThemeColor('--card'),
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: getThemeColor('--card-foreground'),
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        labelLine: { show: false },
        data,
      },
    ],
  });
}

function renderTrendChart() {
  if (!historyData.value.length) return;
  const sites = historyData.value.map(i => i[0]);
  const uploads = historyData.value.map(i => i[1]);
  const downloads = historyData.value.map(i => i[2]);
  const colors = getThemeColors();

  renderTrend({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let result = `<div style="font-weight:600;margin-bottom:4px">${params[0].name}</div>`;
        params.forEach((p: any) => {
          result += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: ${formatSize(p.value)}</span>
          </div>`;
        });
        return result;
      },
    },
    legend: {
      data: ['近7天上传', '近7天下载'],
      bottom: 0,
      textStyle: { color: getThemeColor('--card-foreground') },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sites,
      axisLabel: {
        rotate: 45,
        interval: 0,
        color: getThemeColor('--muted-foreground'),
      },
      axisLine: { lineStyle: { color: getThemeColor('--border') } },
    },
    yAxis: {
      type: 'value',
      name: '近7天增量',
      nameTextStyle: { color: getThemeColor('--muted-foreground') },
      axisLabel: {
        color: getThemeColor('--muted-foreground'),
        formatter: (value: number) => formatSize(value),
      },
      splitLine: { lineStyle: { color: getThemeColor('--border'), type: 'dashed' } },
    },
    series: [
      {
        name: '近7天上传',
        type: 'bar',
        data: uploads,
        itemStyle: { color: colors.primary, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: '近7天下载',
        type: 'bar',
        data: downloads,
        itemStyle: { color: colors.destructive, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20,
      },
    ],
  });
}

function renderRoseChart() {
  if (!statistics.value.length) return;
  const data = statistics.value
    .map(i => ({ name: i.site_name, value: i.seeding_count || 0 }))
    .filter(i => i.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!data.length) return;

  renderRose({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `<div style="font-weight:600">${params.name}</div>
                <div>做种数: ${params.value}</div>
                <div>占比: ${params.percent}%</div>`;
      },
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 10,
      top: 20,
      bottom: 20,
      textStyle: { color: getThemeColor('--card-foreground') },
    },
    series: [
      {
        name: '做种分布',
        type: 'pie',
        radius: [20, 100],
        center: ['35%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 6,
          borderColor: getThemeColor('--card'),
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            color: getThemeColor('--card-foreground'),
          },
        },
        data,
      },
    ],
  });
}

watch(sortBy, () => {
  fetchData();
});

function onResize() {
  screenWidth.value = window.innerWidth;
}

onMounted(() => {
  fetchData();
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <div class="p-4 overflow-x-hidden">
    <PageHeader title="站点数据统计">
      <template #actions>
        <NSpace>
          <NSelect
            v-model:value="sortBy"
            :options="sortOptions"
            style="width: 140px"
            size="small"
          />
          <NButton size="small" :loading="refreshing" @click="handleRefresh">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            刷新
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <!-- 指标卡片 -->
    <div v-if="summary" class="stats-overview">
      <NCard size="small" class="stat-card">
        <div class="stat-icon">
          <IconifyIcon icon="lucide:globe" class="h-5 w-5" />
        </div>
        <div class="stat-value">{{ summary.total }}</div>
        <div class="stat-label">站点总数</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-success">
          <IconifyIcon icon="lucide:activity" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-success">{{ summary.active }}</div>
        <div class="stat-label">活跃站点</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-primary">
          <IconifyIcon icon="lucide:arrow-up" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-primary">{{ formatSize(summary.upload) }}</div>
        <div class="stat-label">总上传</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-warning">
          <IconifyIcon icon="lucide:arrow-down" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-warning">{{ formatSize(summary.download) }}</div>
        <div class="stat-label">总下载</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-info">
          <IconifyIcon icon="lucide:bar-chart-3" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-info">{{ summary.avgRatio }}</div>
        <div class="stat-label">平均分享率</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-success">
          <IconifyIcon icon="lucide:hard-drive" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-success">{{ summary.seeding }}</div>
        <div class="stat-label">总做种数</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-purple">
          <IconifyIcon icon="lucide:sparkles" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-purple">{{ summary.bonus.toFixed(0) }}</div>
        <div class="stat-label">总魔力值</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-error">
          <IconifyIcon icon="lucide:mail" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-error">{{ summary.messages }}</div>
        <div class="stat-label">未读消息</div>
      </NCard>
    </div>

    <NSpin :show="loading">
      <!-- 图表区域 Row 1 -->
      <div v-if="statistics.length > 0" class="chart-row">
        <NCard size="small" class="chart-card">
          <template #header>
            <div class="chart-header">
              <IconifyIcon icon="lucide:bar-chart-2" class="h-4 w-4" />
              <span>站点流量对比</span>
            </div>
          </template>
          <EchartsUI ref="chartBarRef" height="320px" />
        </NCard>
        <NCard size="small" class="chart-card">
          <template #header>
            <div class="chart-header">
              <IconifyIcon icon="lucide:pie-chart" class="h-4 w-4" />
              <span>上传量分布</span>
            </div>
          </template>
          <EchartsUI ref="chartPieRef" height="320px" />
        </NCard>
      </div>

      <!-- 图表区域 Row 2 -->
      <div v-if="statistics.length > 0" class="chart-row">
        <NCard size="small" class="chart-card">
          <template #header>
            <div class="chart-header">
              <IconifyIcon icon="lucide:trending-up" class="h-4 w-4" />
              <span>近7天流量增量</span>
            </div>
          </template>
          <EchartsUI ref="chartTrendRef" height="320px" />
        </NCard>
        <NCard size="small" class="chart-card">
          <template #header>
            <div class="chart-header">
              <IconifyIcon icon="lucide:flower-2" class="h-4 w-4" />
              <span>做种数分布（玫瑰图）</span>
            </div>
          </template>
          <EchartsUI ref="chartRoseRef" height="320px" />
        </NCard>
      </div>

      <!-- 图表区域 Row 3：每日流量趋势 -->
      <div v-if="dailyData.series.length > 0" class="chart-row">
        <NCard size="small" class="chart-card-full">
          <template #header>
            <div class="chart-header">
              <div class="flex items-center gap-2">
                <IconifyIcon icon="lucide:activity" class="h-4 w-4" />
                <span>近30天各站点流量趋势</span>
              </div>
              <div class="mode-toggle">
                <button
                  :class="{ active: dailyMode === 'upload' }"
                  @click="dailyMode = 'upload'"
                >上传</button>
                <button
                  :class="{ active: dailyMode === 'download' }"
                  @click="dailyMode = 'download'"
                >下载</button>
              </div>
            </div>
          </template>
          <SiteDailyLineChart
            :dates="dailyData.dates"
            :series="dailyData.series"
            :mode="dailyMode"
          />
        </NCard>
      </div>

      <!-- 数据表格 -->
      <NCard v-if="statistics.length > 0" size="small" class="mt-4">
        <template #header>
          <div class="chart-header">
            <IconifyIcon icon="lucide:table" class="h-4 w-4" />
            <span>站点详细数据</span>
          </div>
        </template>
        <NDataTable
          :columns="columns"
          :data="sortedStatistics"
          :pagination="{ pageSize: 20 }"
          :bordered="false"
          size="small"
          striped
          :scroll-x="isMobile ? 500 : 1000"
        />
      </NCard>

      <EmptyState
        v-else-if="!loading"
        title="暂无数据"
        subtitle="没有找到站点统计数据，请检查站点是否已配置数据统计功能"
      />
    </NSpin>

    <!-- 站点统计详情弹窗 -->
    <NModal
      v-model:show="siteDetailModalShow"
      :title="`${siteDetailName} - 统计趋势`"
      preset="card"
      class="w-full max-w-[900px]"
      :bordered="false"
      :segmented="{ content: true }"
    >
      <NSpin :show="siteDetailLoading">
        <div v-if="siteActivityData.length > 0">
          <EchartsUI ref="chartDetailRef" height="420px" />
        </div>
        <EmptyState
          v-else
          title="暂无历史数据"
          subtitle="该站点暂无统计数据记录"
        />
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped>
.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-card {
  text-align: center;
  position: relative;
  overflow: hidden;
}

.stat-card :deep(.n-card__content) {
  padding: 1rem 0.75rem;
}

.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  background-color: hsl(var(--accent));
  color: hsl(var(--primary));
  margin-bottom: 0.5rem;
}

.stat-icon-success {
  background-color: hsl(var(--success) / 0.15);
  color: hsl(var(--success));
}

.stat-icon-warning {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.stat-icon-primary {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}

.stat-icon-info {
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.stat-icon-purple {
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.stat-icon-error {
  background-color: hsl(var(--destructive) / 0.15);
  color: hsl(var(--destructive));
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--card-foreground));
  line-height: 1.2;
}

.stat-success {
  color: hsl(var(--success));
}

.stat-warning {
  color: hsl(var(--warning));
}

.stat-primary {
  color: hsl(var(--primary));
}

.stat-info {
  color: hsl(var(--primary));
}

.stat-purple {
  color: hsl(var(--primary));
}

.stat-error {
  color: hsl(var(--destructive));
}

.stat-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.25rem;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 100%;
}

.chart-card :deep(.n-card__content) {
  padding: 0.5rem;
}

.chart-card-full {
  grid-column: 1 / -1;
}

.chart-card-full :deep(.n-card__content) {
  padding: 0.5rem;
}

@media (max-width: 768px) {
  .chart-card :deep(.n-card__content) {
    padding: 0.375rem;
  }
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  overflow: hidden;
}

.chart-header > span,
.chart-header > div:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.mode-toggle {
  display: flex;
  gap: 0;
  border-radius: 0.375rem;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
}

.mode-toggle button {
  padding: 0.125rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: hsl(var(--card));
  color: hsl(var(--muted-foreground));
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-toggle button.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* 站点表格中的 logo */
.site-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.site-cell-name {
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

@media (max-width: 768px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .stat-card :deep(.n-card__content) {
    padding: 0.625rem 0.375rem;
  }

  .stat-value {
    font-size: 0.9375rem;
  }

  .stat-label {
    font-size: 0.6875rem;
  }

  .stat-icon {
    width: 1.75rem;
    height: 1.75rem;
  }

  .chart-row {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .chart-header {
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .mode-toggle button {
    padding: 0.125rem 0.5rem;
    font-size: 0.6875rem;
  }
}

@media (max-width: 640px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .site-cell {
    gap: 0.5rem;
  }

  .site-cell-name {
    font-size: 0.8125rem;
  }
}
</style>
