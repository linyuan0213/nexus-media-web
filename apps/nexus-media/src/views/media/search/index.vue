<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';

import {
  NButton,
  NCard,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NProgress,
  NCollapse,
  NCollapseItem,
  NDropdown,
  NModal,
  NForm,
  NFormItem,
  useNotification,
} from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import { webSearchApi, getSearchResultApi, searchMediaApi } from '#/api';
import { getProgressApi } from '#/api/modules/system';
import {
  downloadSearchResultApi,
  getDownloadSettingsApi,
  getDownloadDirsApi,
} from '#/api/modules/download';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

interface TorrentItem {
  id: string;
  seeders: number;
  enclosure: string;
  site: string;
  torrent_name: string;
  description: string;
  pageurl: string;
  uploadvalue: number;
  downloadvalue: number;
  size: string;
  respix: string;
  restype: string;
  reseffect: string;
  releasegroup: string;
  video_encode: string;
  labels: string[];
}

interface UniqueGroup {
  unique_info: Record<string, any>;
  torrent_list: TorrentItem[];
}

interface GroupItem {
  group_info: { respix: string; restype: string };
  group_total: number;
  group_torrents: Record<string, UniqueGroup>;
}

interface FilterState {
  season: string[];
  site: string[];
  releasegroup: string[];
  free: string[];
  video: string[];
}

interface SearchResult {
  title: string;
  key: string;
  tmdbid: string;
  type: string;
  year: string;
  vote: string;
  poster: string;
  overview: string;
  fav: string;
  rssid: string | null;
  filter: {
    season?: string[];
    site: string[];
    releasegroup: string[];
    free: Array<{ name: string; value: string }>;
    video?: string[];
  };
  // 后端排序后变成 [[SE_key, SE_dict], ...]
  torrent_dict: Array<[string, Record<string, GroupItem>]>;
}

interface SearchResultWithFilter extends SearchResult {
  activeFilters: FilterState;
}

const route = useRoute();
const notification = useNotification();

/** 图片 URL 处理：后端已统一转换代理路径，直接使用 */
function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return src;
}

const loading = ref(false);
const keyword = ref('');
const searchtype = ref<'tmdb' | 'douban' | ''>('tmdb');

// 显示模式：empty | media(普通搜索媒体结果) | torrent(种子结果)
const displayMode = ref<'empty' | 'media' | 'torrent'>('empty');

// 普通搜索的媒体词条结果
interface MediaItem {
  id: string | number;
  title: string;
  year?: string;
  type?: string;
  media_type?: string;
  vote?: string | number;
  image?: string;
  poster?: string;
  overview?: string;
  tmdb_id?: string | number;
}
const mediaResults = ref<MediaItem[]>([]);

// 种子搜索结果
const results = ref<SearchResultWithFilter[]>([]);
const resultCount = ref(0);
const searchProgress = ref(0);
const searchProgressText = ref('');
let progressTimer: ReturnType<typeof setInterval> | null = null;

const filterExpanded = ref<Record<string, boolean>>({});

function toggleFilterPanel(key: string) {
  filterExpanded.value[key] = !filterExpanded.value[key];
}

function activeFilterCount(item: SearchResultWithFilter): number {
  return Object.values(item.activeFilters).reduce((sum, arr) => sum + arr.length, 0);
}

// 高级搜索模态框
const advancedModalVisible = ref(false);
const advancedForm = ref({
  name: '',
  year: '',
  type: '',
  season: '',
});
const advancedTypeOptions = [
  { label: '电影', value: 'MOV' },
  { label: '电视剧', value: 'TV' },
];

// 下载模态框
const downloadModalVisible = ref(false);
const downloadModalLoading = ref(false);
const downloadTorrentId = ref('');
const downloadSettings = ref<Array<{ label: string; value: string }>>([]);
const downloadDirs = ref<Array<{ label: string; value: string }>>([{ label: '自动', value: '' }]);
const selectedDownloadSetting = ref('');
const selectedDownloadDir = ref('');

async function pollSearchProgress() {
  try {
    const res: any = await getProgressApi('search');
    if (res) {
      searchProgress.value = Math.min(res.value || 0, 100);
      searchProgressText.value = res.text || '';
      if (searchProgress.value >= 100) {
        stopProgressPoll();
        await loadSearchResults();
      }
    }
  } catch { }
}

function startProgressPoll() {
  stopProgressPoll();
  searchProgress.value = 0;
  searchProgressText.value = '正在处理...';
  progressTimer = setInterval(pollSearchProgress, 1000);
}

function stopProgressPoll() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

const typeOptions = [
  { label: '全部来源', value: '' },
  { label: 'TMDB', value: 'tmdb' },
  { label: '豆瓣', value: 'douban' },
];

/** 普通搜索：搜索媒体词条 */
async function handleSearch() {
  if (!keyword.value.trim()) return;
  displayMode.value = 'media';
  mediaResults.value = [];
  loading.value = true;
  try {
    const res: any = await searchMediaApi({
      keyword: keyword.value,
      searchtype: searchtype.value,
    });
    // requestClient 在 code===0 时自动解包返回 data，所以 res 直接是数组
    mediaResults.value = Array.isArray(res) ? res : (res?.data || []);
  } catch (err: any) {
    notification.error({ content: '搜索失败', description: err?.message || '未知错误' });
  } finally {
    loading.value = false;
  }
}

/** 点击媒体卡片 → 触发种子搜索 */
async function handleMediaSearch(media: MediaItem) {
  displayMode.value = 'torrent';
  results.value = [];
  loading.value = true;
  startProgressPoll();
  try {
    await webSearchApi({
      search_word: media.title,
      tmdbid: String(media.tmdb_id || media.id || ''),
      media_type: media.type || media.media_type || '',
    });
  } catch (err: any) {
    loading.value = false;
    stopProgressPoll();
    notification.error({ content: '搜索失败', description: err?.message || '未知错误' });
  }
}

/** 高级搜索：直接搜索种子 */
async function handleAdvancedSearch() {
  if (!advancedForm.value.name.trim()) return;
  advancedModalVisible.value = false;
  displayMode.value = 'torrent';
  keyword.value = advancedForm.value.name;
  results.value = [];
  loading.value = true;
  startProgressPoll();
  try {
    await webSearchApi({
      search_word: advancedForm.value.name,
      tmdbid: '',
      media_type: advancedForm.value.type,
    });
  } catch (err: any) {
    loading.value = false;
    stopProgressPoll();
    notification.error({ content: '搜索失败', description: err?.message || '未知错误' });
  }
}

async function loadSearchResults() {
  loading.value = true;
  results.value = [];
  try {
    const res: any = await getSearchResultApi();
    const searchData = res?.result || {};
    if (typeof searchData === 'object') {
      results.value = Object.entries(searchData).map(([, item]: [string, any]) => ({
        title: item.title,
        key: item.key,
        tmdbid: item.tmdbid,
        type: item.type,
        year: item.year,
        vote: item.vote,
        poster: item.poster,
        overview: item.overview,
        fav: item.fav,
        rssid: item.rssid,
        filter: item.filter || { site: [], releasegroup: [], free: [] },
        torrent_dict: item.torrent_dict || [],
        activeFilters: { season: [], site: [], releasegroup: [], free: [], video: [] },
      }));
      resultCount.value = res?.total || results.value.length;
    }
  } finally {
    loading.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleSearch();
  }
}

onMounted(() => {
  const s = route.query.s as string;
  const from = route.query.from as string;
  if (s) {
    keyword.value = s;
    displayMode.value = 'torrent';
    results.value = [];
    loading.value = true;
    startProgressPoll();
    if (from !== 'discovery' && from !== 'detail') {
      // 非探索页跳转时才触发搜索；探索页已在外部触发过
      webSearchApi({ search_word: s }).catch((err: any) => {
        loading.value = false;
        stopProgressPoll();
        notification.error({ content: '搜索失败', description: err?.message || '未知错误' });
      });
    }
  }
});

onUnmounted(() => {
  stopProgressPoll();
});

function getTypeColor(type: string) {
  return type === '电影' ? 'success' : 'info';
}

function hasFilters(item: SearchResultWithFilter) {
  const f = item.filter;
  return (f.season && f.season.length > 0) ||
    f.site.length > 0 ||
    f.releasegroup.length > 0 ||
    f.free.length > 0 ||
    (f.video && f.video.length > 0);
}

function getFreeBadgeStyle(upload: number, download: number) {
  if (download === 0) return { background: 'hsl(var(--success)/0.15)', color: 'hsl(var(--success))' };
  if (download < 1) return { background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))' };
  if (upload < 1) return { background: 'hsl(var(--chart-2)/0.15)', color: 'hsl(var(--chart-2))' };
  return {};
}

function getFreeBadgeText(upload: number, download: number) {
  if (download === 0) return 'FREE';
  if (download < 1) return `${Math.round(download * 100)}%DL`;
  if (upload < 1) return `${Math.round(upload * 100)}%UL`;
  return '';
}

function getTorrentDropdownOptions(torrent: TorrentItem) {
  const opts: any[] = [];
  if (torrent.enclosure && torrent.enclosure.startsWith('http')) {
    opts.push({ label: '下载种子文件', key: 'enclosure' });
  }
  opts.push({ label: '查看种子详情', key: 'pageurl' });
  return opts;
}

function handleTorrentDropdown(torrent: TorrentItem, key: string) {
  if (key === 'enclosure') {
    window.open(torrent.enclosure, '_blank');
  } else if (key === 'pageurl') {
    window.open(torrent.pageurl, '_blank');
  }
}

// ---- 过滤逻辑 ----
function toggleFilter(item: SearchResultWithFilter, category: keyof FilterState, value: string) {
  const idx = results.value.findIndex(r => r.key === item.key);
  if (idx === -1) return;
  const target = results.value[idx]!;
  const arr = [...target.activeFilters[category]];
  const aIdx = arr.indexOf(value);
  if (aIdx > -1) {
    arr.splice(aIdx, 1);
  } else {
    arr.push(value);
  }
  results.value[idx] = {
    ...target,
    activeFilters: { ...target.activeFilters, [category]: arr },
  };
}

function resetFilters(item: SearchResultWithFilter) {
  const idx = results.value.findIndex(r => r.key === item.key);
  if (idx === -1) return;
  const target = results.value[idx]!;
  results.value[idx] = {
    ...target,
    activeFilters: { season: [], site: [], releasegroup: [], free: [], video: [] },
  };
}

function isFilterActive(item: SearchResultWithFilter, category: keyof FilterState, value: string) {
  return item.activeFilters[category].includes(value);
}

function torrentMatchesFreeFilter(torrent: TorrentItem, filterValue: string) {
  const parts = filterValue.split(' ');
  if (parts.length !== 2) return false;
  const expectedUp = parseFloat(parts[0]!);
  const expectedDown = parseFloat(parts[1]!);
  return (
    Math.abs(torrent.uploadvalue - expectedUp) < 0.001 &&
    Math.abs(torrent.downloadvalue - expectedDown) < 0.001
  );
}

function filteredTorrentDict(item: SearchResultWithFilter): Array<[string, Record<string, GroupItem>]> {
  const af = item.activeFilters;
  const hasActive = af.season.length || af.site.length || af.releasegroup.length || af.free.length || af.video.length;
  if (!hasActive) return item.torrent_dict;

  return item.torrent_dict
    .filter(([seKey]) => {
      if (af.season.length === 0) return true;
      return af.season.some(s => seKey.includes(s));
    })
    .map(([seKey, seDict]): [string, Record<string, GroupItem>] => {
      const filteredGroups: Record<string, GroupItem> = {};
      for (const [gKey, group] of Object.entries(seDict)) {
        let groupTotal = 0;
        const filteredTorrents: Record<string, UniqueGroup> = {};
        for (const [uKey, unique] of Object.entries(group.group_torrents)) {
          const list = unique.torrent_list.filter((t) => {
            if (af.site.length && !af.site.includes(t.site)) return false;
            if (af.releasegroup.length && !af.releasegroup.includes(t.releasegroup || '未知')) return false;
            if (af.free.length && !af.free.some(fv => torrentMatchesFreeFilter(t, fv))) return false;
            if (af.video.length && !af.video.includes(t.video_encode || '')) return false;
            return true;
          });
          if (list.length) {
            groupTotal += list.length;
            filteredTorrents[uKey] = { ...unique, torrent_list: list };
          }
        }
        if (Object.keys(filteredTorrents).length) {
          filteredGroups[gKey] = {
            ...group,
            group_total: groupTotal,
            group_torrents: filteredTorrents,
          };
        }
      }
      return [seKey, filteredGroups];
    })
    .filter(([, seDict]) => Object.keys(seDict).length > 0);
}

// 下载模态框
async function openDownloadModal(torrentId: string) {
  downloadTorrentId.value = torrentId;
  downloadModalVisible.value = true;
  downloadModalLoading.value = true;
  selectedDownloadSetting.value = '';
  selectedDownloadDir.value = '';
  downloadDirs.value = [{ label: '自动', value: '' }];
  downloadSettings.value = [];
  try {
    const settingsRes: any = await getDownloadSettingsApi();
    if (settingsRes && Array.isArray(settingsRes)) {
      downloadSettings.value = settingsRes.map((s: any) => ({
        label: s.name || String(s.id),
        value: String(s.id),
      }));
    } else if (settingsRes && typeof settingsRes === 'object') {
      downloadSettings.value = Object.entries(settingsRes).map(([sid, s]: [string, any]) => ({
        label: s.name || sid,
        value: String(s.id || sid),
      }));
    }
    // 默认选中第一项并加载对应目录
    if (downloadSettings.value.length) {
      const first = downloadSettings.value[0]!.value;
      selectedDownloadSetting.value = first;
      await loadDownloadDirs(first);
    }
  } catch {
    downloadSettings.value = [];
  } finally {
    downloadModalLoading.value = false;
  }
}

async function loadDownloadDirs(val: string) {
  downloadDirs.value = [{ label: '自动', value: '' }];
  if (!val) return;
  try {
    const dirsRes: any = await getDownloadDirsApi(val);
    if (dirsRes && Array.isArray(dirsRes) && dirsRes.length) {
      downloadDirs.value = [{ label: '自动', value: '' }, ...dirsRes.map((d: string) => ({ label: d, value: d }))];
    }
  } catch { }
}

async function onDownloadSettingChange(val: string | null) {
  selectedDownloadSetting.value = val || '';
  selectedDownloadDir.value = '';
  await loadDownloadDirs(val || '');
}

async function confirmDownload() {
  if (!downloadTorrentId.value) return;
  downloadModalLoading.value = true;
  try {
    await downloadSearchResultApi(
      downloadTorrentId.value,
      selectedDownloadDir.value || undefined,
      selectedDownloadSetting.value || undefined,
    );
    notification.success({ content: '下载任务已提交', duration: 2000 });
    downloadModalVisible.value = false;
  } catch (err: any) {
    notification.error({ content: '下载失败', description: err?.message || '未知错误' });
  } finally {
    downloadModalLoading.value = false;
  }
}
</script>

<template>
  <div class="p-4">
    <PageHeader title="资源搜索">
      <template #actions>
        <div v-if="resultCount > 0" style="font-size: 0.875rem; color: hsl(var(--muted-foreground));">
          共搜索到 {{ resultCount }} 条记录
        </div>
      </template>
    </PageHeader>

    <!-- 搜索框 -->
    <NCard class="mb-4" size="small">
      <NSpace align="center" wrap>
        <NInput v-model:value="keyword" placeholder="输入电影/剧集名称" clearable style="width: 300px"
          @keydown="handleKeydown" />
        <NSelect v-model:value="searchtype" :options="typeOptions" style="width: 140px" />
        <NButton type="primary" :loading="loading && displayMode === 'media'" @click="handleSearch">
          搜索
        </NButton>
        <NButton @click="advancedModalVisible = true">
          高级搜索
        </NButton>
      </NSpace>
    </NCard>

    <!-- 普通搜索：媒体词条结果 -->
    <NSpin v-if="displayMode === 'media'" :show="loading">
      <div v-if="mediaResults.length > 0" class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
        <div v-for="media in mediaResults" :key="media.id"
          class="cursor-pointer relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
          @click="handleMediaSearch(media)">
          <div style="aspect-ratio: 2/3; background: hsl(var(--muted));">
            <img :src="getImgUrl(media.image || media.poster)" class="w-full h-full object-cover" alt=""
              @error="(e: any) => { e.target.src = '/static/img/no-image.png'; }" />
          </div>
          <span v-if="media.media_type || media.type"
            class="absolute top-1.5 left-1.5 text-white text-[10px] px-1.5 py-0.5 rounded"
            :class="(media.media_type || media.type) === '电影' ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--info))]'">
            {{ media.media_type || media.type }}
          </span>
          <span v-if="media.vote && media.vote !== '0.0' && media.vote !== '0'"
            style="position: absolute; top: 0.375rem; right: 0.375rem; font-size: 10px; padding: 0.125rem 0.375rem; border-radius: 0.25rem; background: hsl(var(--warning)); color: hsl(var(--warning-foreground));">
            {{ media.vote }}
          </span>
          <div class="absolute bottom-0 left-0 right-0 p-2 text-white"
            style="background: linear-gradient(transparent, rgba(0,0,0,0.75));">
            <div class="text-sm font-bold truncate">{{ media.title }}</div>
            <div class="flex items-center gap-2 text-xs mt-0.5">
              <span v-if="media.year">{{ media.year }}</span>
            </div>
          </div>
          <div
            class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
            style="background: rgba(0,0,0,0.5);">
            <NButton size="small" type="primary" round>搜索资源</NButton>
          </div>
        </div>
      </div>
      <NEmpty v-else-if="!loading && keyword" description="未找到相关媒体" />
    </NSpin>

    <!-- 种子搜索：进度 + 结果 -->
    <template v-else-if="displayMode === 'torrent'">
      <!-- 搜索进度提示 -->
      <div v-if="loading && !results.length" class="my-8">
        <NSpin show>
          <div class="text-center">
            <div class="text-lg mb-2">正在搜索「{{ keyword }}」</div>
            <NProgress type="line" :percentage="searchProgress" processing class="max-w-md mx-auto" />
            <div style="font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-top: 0.5rem;">
              {{ searchProgressText || '请稍候，正在检索资源...' }}
            </div>
          </div>
        </NSpin>
      </div>

      <!-- 搜索结果 -->
      <NSpin :show="loading && results.length > 0">
        <div v-if="results.length > 0" class="result-list">
          <div v-for="item in results" :key="item.key" class="result-card">
            <div class="result-hero">
              <!-- 左侧海报 -->
              <div v-if="item.poster" class="hero-poster"
                @click="item.tmdbid && item.tmdbid !== '0' ? $router.push({ name: 'MediaDetail', query: { id: item.tmdbid, type: item.type === '电影' ? 'movie' : 'tv' } }) : null">
                <img :src="item.poster" alt="" />
                <div v-if="item.type" class="hero-poster-tag">
                  <NTag :type="getTypeColor(item.type)" size="small" round>{{ item.type }}</NTag>
                </div>
                <div v-if="item.fav === '2'" class="hero-poster-fav">
                  <IconifyIcon icon="lucide:check" class="size-3" />
                </div>
              </div>

              <!-- 右侧信息 -->
              <div class="hero-content">
                <div class="hero-title-row">
                  <h2 class="hero-title">
                    <a v-if="item.tmdbid && item.tmdbid !== '0'"
                      :href="`https://www.themoviedb.org/${item.type === '电影' ? 'movie' : 'tv'}/${item.tmdbid}`"
                      target="_blank" class="hero-title-link">{{ item.title }}</a>
                    <span v-else>{{ item.title }}</span>
                    <span v-if="item.year" class="hero-year">({{ item.year }})</span>
                  </h2>
                  <div class="hero-actions">
                    <span v-if="item.vote" class="hero-rating">
                      <IconifyIcon icon="lucide:star" class="size-5" />{{ item.vote }}
                    </span>
                    <NButton v-if="hasFilters(item)" size="small" quaternary class="filter-trigger"
                      @click="toggleFilterPanel(item.key)">
                      <IconifyIcon icon="lucide:filter" class="size-4" />
                      <span class="hidden sm:inline">筛选</span>
                      <span v-if="activeFilterCount(item) > 0" class="filter-badge">{{ activeFilterCount(item) }}</span>
                      <IconifyIcon :icon="filterExpanded[item.key] ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                        class="size-4" />
                    </NButton>
                  </div>
                </div>
                <div class="hero-overview">{{ item.overview || '暂无简介' }}</div>

                <!-- 筛选面板 -->
                <div v-if="hasFilters(item) && filterExpanded[item.key]" class="filter-panel">
                  <div class="filter-panel-inner">
                    <div v-if="item.filter.season && item.filter.season.length" class="filter-row">
                      <span class="filter-label">季</span>
                      <div class="filter-tags">
                        <span v-for="s in item.filter.season" :key="s" class="filter-chip"
                          :class="{ active: isFilterActive(item, 'season', s) }"
                          @click="toggleFilter(item, 'season', s)">{{ s }}</span>
                      </div>
                    </div>
                    <div v-if="item.filter.site.length" class="filter-row">
                      <span class="filter-label">站点</span>
                      <div class="filter-tags">
                        <span v-for="s in item.filter.site" :key="s" class="filter-chip"
                          :class="{ active: isFilterActive(item, 'site', s) }" @click="toggleFilter(item, 'site', s)">{{
                          s }}</span>
                      </div>
                    </div>
                    <div v-if="item.filter.releasegroup.length" class="filter-row">
                      <span class="filter-label">制作组</span>
                      <div class="filter-tags">
                        <span v-for="g in item.filter.releasegroup" :key="g" class="filter-chip"
                          :class="{ active: isFilterActive(item, 'releasegroup', g) }"
                          @click="toggleFilter(item, 'releasegroup', g)">{{ g }}</span>
                      </div>
                    </div>
                    <div v-if="item.filter.free.length" class="filter-row">
                      <span class="filter-label">促销</span>
                      <div class="filter-tags">
                        <span v-for="f in item.filter.free" :key="f.value" class="filter-chip"
                          :class="{ active: isFilterActive(item, 'free', f.value) }"
                          @click="toggleFilter(item, 'free', f.value)">{{ f.name }}</span>
                      </div>
                    </div>
                    <div v-if="item.filter.video && item.filter.video.length" class="filter-row">
                      <span class="filter-label">编码</span>
                      <div class="filter-tags">
                        <span v-for="v in item.filter.video" :key="v" class="filter-chip"
                          :class="{ active: isFilterActive(item, 'video', v) }"
                          @click="toggleFilter(item, 'video', v)">{{ v }}</span>
                      </div>
                    </div>
                  </div>
                  <NButton size="tiny" text @click="resetFilters(item)">
                    <IconifyIcon icon="lucide:rotate-ccw" class="size-3" /> 重置
                  </NButton>
                </div>
              </div>
            </div>

            <!-- 种子列表 -->
            <div class="torrent-section">
              <div v-for="seTuple in filteredTorrentDict(item)" :key="seTuple[0]" class="season-block">
                <div v-if="seTuple[0] !== 'MOV'" class="season-name">{{ seTuple[0] }}</div>

                <NCollapse :default-expanded-names="['0']">
                  <NCollapseItem v-for="(group, gKey, gIdx) in seTuple[1]" :key="gKey" :name="String(gIdx)">
                    <template #header>
                      <div class="group-header">
                        <span class="group-badge group-type">{{ group.group_info?.restype || '未知媒介' }}</span>
                        <span class="group-sep">/</span>
                        <span class="group-badge group-res">{{ group.group_info?.respix || '未知分辨率' }}</span>
                        <span class="group-sep">/</span>
                        <span class="group-count">共 {{ group.group_total }} 个种子</span>
                      </div>
                    </template>

                    <div class="torrent-items">
                      <div v-for="(unique, uKey) in group.group_torrents" :key="uKey">
                        <div v-for="torrent in unique.torrent_list" :key="torrent.id" class="torrent-row">
                          <div class="torrent-main">
                            <div class="torrent-header">
                              <span class="torrent-name" @click="openDownloadModal(torrent.id)">{{ torrent.torrent_name
                                }}</span>
                            </div>
                            <div v-if="torrent.description" class="torrent-desc">
                              <IconifyIcon icon="lucide:quote" class="size-3 shrink-0" />
                              <span>{{ torrent.description }}</span>
                            </div>
                            <div class="torrent-tags">
                              <span v-if="getFreeBadgeText(torrent.uploadvalue, torrent.downloadvalue)"
                                class="tag tag-free"
                                :style="getFreeBadgeStyle(torrent.uploadvalue, torrent.downloadvalue)">{{
                                  getFreeBadgeText(torrent.uploadvalue, torrent.downloadvalue) }}</span>
                              <span class="tag tag-site">{{ torrent.site }}</span>
                              <span v-if="torrent.video_encode" class="tag tag-video">{{ torrent.video_encode }}</span>
                              <span v-if="torrent.reseffect" class="tag tag-effect">{{ torrent.reseffect }}</span>
                              <span v-if="torrent.size" class="tag tag-size">{{ torrent.size }}</span>
                              <span v-if="torrent.releasegroup" class="tag tag-group">{{ torrent.releasegroup }}</span>
                              <span v-if="torrent.seeders" class="tag tag-seeders">
                                <IconifyIcon icon="lucide:arrow-up" class="size-3" />{{ torrent.seeders }}
                              </span>
                            </div>
                          </div>
                          <div class="torrent-actions">
                            <NButton size="tiny" type="primary" @click="openDownloadModal(torrent.id)">
                              <IconifyIcon icon="lucide:download" class="size-4" />
                            </NButton>
                            <NDropdown :options="getTorrentDropdownOptions(torrent)" trigger="click"
                              @select="(key: string) => handleTorrentDropdown(torrent, key)">
                              <NButton size="tiny" quaternary circle>
                                <IconifyIcon icon="lucide:more-vertical" class="size-4" />
                              </NButton>
                            </NDropdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  </NCollapseItem>
                </NCollapse>
              </div>
            </div>
          </div>
        </div>

        <NEmpty v-else-if="loading === false && keyword" description="未找到相关媒体" />
        <EmptyState v-else-if="!loading" title="开始搜索" subtitle="请输入关键词开始搜索电影或剧集" />
      </NSpin>
    </template>

    <!-- 下载模态框 -->
    <NModal v-model:show="downloadModalVisible" title="添加下载" preset="card" style="width: 420px" :bordered="false"
      size="huge">
      <NSpin :show="downloadModalLoading">
        <div class="space-y-4">
          <div>
            <div style="font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 0.25rem;">下载设置</div>
            <NSelect v-model:value="selectedDownloadSetting" :options="downloadSettings" placeholder="站点设置"
              @update:value="onDownloadSettingChange" />
          </div>
          <div>
            <div style="font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 0.25rem;">保存目录</div>
            <NSelect v-model:value="selectedDownloadDir" :options="downloadDirs" placeholder="自动" />
          </div>
        </div>
      </NSpin>
      <template #footer>
        <div class="flex justify-end gap-3">
          <NButton @click="downloadModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="downloadModalLoading" @click="confirmDownload">
            下载
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- 高级搜索模态框 -->
    <NModal v-model:show="advancedModalVisible" title="高级搜索" preset="card" style="width: 420px" :bordered="false">
      <NForm label-placement="left" label-width="60">
        <NFormItem label="名称">
          <NInput v-model:value="advancedForm.name" placeholder="电影/电视剧名称" />
        </NFormItem>
        <NFormItem label="年份">
          <NInput v-model:value="advancedForm.year" placeholder="如: 2024" />
        </NFormItem>
        <NFormItem label="类型">
          <NSelect v-model:value="advancedForm.type" :options="advancedTypeOptions" placeholder="全部" clearable />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-3">
          <NButton @click="advancedModalVisible = false">取消</NButton>
          <NButton type="primary" @click="handleAdvancedSearch">开始搜索</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
/* Result Card */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.result-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 1.25rem;
  padding: 1.5rem;
}

/* Hero */
.result-hero {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
}

.hero-poster {
  position: relative;
  width: 180px;
  flex-shrink: 0;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 12px 32px hsl(var(--foreground) / 0.12);
  cursor: pointer;
  transition: transform 0.2s;
}

.hero-poster:hover {
  transform: scale(1.02);
}

.hero-poster img {
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  display: block;
}

.hero-poster-tag {
  position: absolute;
  top: 0.625rem;
  left: 0.625rem;
}

.hero-poster-fav {
  position: absolute;
  top: 0.625rem;
  right: 0.625rem;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: hsl(var(--success));
  color: hsl(var(--success-foreground));
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hero-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero-title {
  font-size: 2rem;
  font-weight: 800;
  color: hsl(var(--card-foreground));
  line-height: 1.15;
  margin: 0;
  letter-spacing: -0.025em;
}

.hero-title-link {
  color: hsl(var(--card-foreground));
  text-decoration: none;
}

.hero-title-link:hover {
  color: hsl(var(--primary));
}

.hero-year {
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  margin-left: 0.5rem;
  font-size: 1.25rem;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.hero-rating {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: hsl(var(--warning));
  font-weight: 700;
  font-size: 1.125rem;
}

.hero-overview {
  font-size: 0.9375rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 680px;
}

/* Filter Trigger */
.filter-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 9999px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* Filter Panel */
.filter-panel {
  padding: 0.75rem;
  background: hsl(var(--muted) / 0.06);
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
}

.filter-panel-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem 1.25rem;
  margin-bottom: 0.5rem;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 9999px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}

.filter-chip:hover {
  border-color: hsl(var(--primary) / 0.5);
  color: hsl(var(--primary));
}

.filter-chip.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

/* Torrent Section */
.torrent-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.season-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.season-name {
  font-size: 1.125rem;
  font-weight: 800;
  color: hsl(var(--card-foreground));
  margin-bottom: 0.25rem;
  letter-spacing: -0.01em;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.group-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 0.5rem;
}

.group-type {
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.group-res {
  background: hsl(var(--warning) / 0.12);
  color: hsl(var(--warning));
}

.group-sep {
  color: hsl(var(--muted-foreground));
}

.group-count {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  margin-left: auto;
  font-weight: 500;
}

/* Torrent Items */
.torrent-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.torrent-row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.875rem;
  background: hsl(var(--muted) / 0.03);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.torrent-row:hover {
  background: hsl(var(--accent) / 0.15);
  border-color: hsl(var(--border));
}

.torrent-main {
  flex: 1;
  min-width: 0;
}

.torrent-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.torrent-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
  cursor: pointer;
  word-break: break-word;
}

.torrent-name:hover {
  color: hsl(var(--primary));
}

.free-badge {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: 0.375rem;
  white-space: nowrap;
  margin-top: 0.125rem;
}

.torrent-desc {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.torrent-desc span {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.torrent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  font-size: 0.6875rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  font-weight: 600;
  white-space: nowrap;
}

.tag-site {
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.tag-video {
  background: hsl(var(--warning) / 0.1);
  color: hsl(var(--warning));
}

.tag-effect {
  background: hsl(var(--info) / 0.1);
  color: hsl(var(--info));
}

.tag-size {
  background: hsl(var(--muted) / 0.3);
  color: hsl(var(--muted-foreground));
}

.tag-group {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.tag-free {
  background: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.tag-seeders {
  background: hsl(var(--success) / 0.1);
  color: hsl(var(--success));
}

.torrent-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  padding-top: 0.125rem;
}

/* Mobile */
@media (max-width: 768px) {
  .result-card {
    padding: 1rem;
  }

  .result-hero {
    gap: 1rem;
  }

  .hero-poster {
    width: 120px;
  }

  .hero-title {
    font-size: 1.5rem;
  }

  .torrent-row {
    flex-direction: column;
    gap: 0.75rem;
  }

  .torrent-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .group-count {
    margin-left: 0;
  }
}

@media (max-width: 480px) {
  .result-hero {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .hero-poster {
    width: 160px;
  }

  .hero-title-row {
    flex-direction: column;
    align-items: center;
  }
}
</style>
