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
  } catch {}
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

function getFreeBadgeBorderClass(upload: number, download: number) {
  if (download === 0) return '';
  if (download < 1) return '';
  if (upload < 1) return '';
  return '';
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
  } catch {}
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
        <div v-if="resultCount > 0" class="text-sm text-gray-500">
          共搜索到 {{ resultCount }} 条记录
        </div>
      </template>
    </PageHeader>

    <!-- 搜索框 -->
    <NCard class="mb-4" size="small">
      <NSpace align="center" wrap>
        <NInput
          v-model:value="keyword"
          placeholder="输入电影/剧集名称"
          clearable
          style="width: 300px"
          @keydown="handleKeydown"
        />
        <NSelect
          v-model:value="searchtype"
          :options="typeOptions"
          style="width: 140px"
        />
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
      <div v-if="mediaResults.length > 0" class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
        <div
          v-for="media in mediaResults"
          :key="media.id"
          class="cursor-pointer relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
          @click="handleMediaSearch(media)"
        >
          <div style="aspect-ratio: 2/3;" class="bg-gray-100 dark:bg-gray-800">
            <img
              :src="getImgUrl(media.image || media.poster)"
              class="w-full h-full object-cover"
              alt=""
              @error="(e: any) => { e.target.src = '/static/img/no-image.png'; }"
            />
          </div>
          <span
            v-if="media.media_type || media.type"
            class="absolute top-1.5 left-1.5 text-white text-[10px] px-1.5 py-0.5 rounded"
            :class="(media.media_type || media.type) === '电影' ? 'bg-lime-500' : 'bg-blue-500'"
          >
            {{ media.media_type || media.type }}
          </span>
          <span
            v-if="media.vote && media.vote !== '0.0' && media.vote !== '0'"
            class="absolute top-1.5 right-1.5 text-white text-[10px] px-1.5 py-0.5 rounded bg-purple-500"
          >
            {{ media.vote }}
          </span>
          <div class="absolute bottom-0 left-0 right-0 p-2 text-white" style="background: linear-gradient(transparent, rgba(0,0,0,0.75));">
            <div class="text-sm font-bold truncate">{{ media.title }}</div>
            <div class="flex items-center gap-2 text-xs mt-0.5">
              <span v-if="media.year">{{ media.year }}</span>
            </div>
          </div>
          <div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200" style="background: rgba(0,0,0,0.5);">
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
            <NProgress
              type="line"
              :percentage="searchProgress"
              processing
              class="max-w-md mx-auto"
            />
            <div class="text-sm text-gray-500 mt-2">
              {{ searchProgressText || '请稍候，正在检索资源...' }}
            </div>
          </div>
        </NSpin>
      </div>

      <!-- 搜索结果 -->
      <NSpin :show="loading && results.length > 0">
        <div v-if="results.length > 0" class="space-y-6">
        <div
          v-for="item in results"
          :key="item.key"
          class="bg-transparent border-0"
        >
          <div class="flex gap-4">
            <!-- 左侧海报和筛选 -->
            <div class="hidden md:block w-56 flex-shrink-0">
              <!-- 海报卡片 -->
              <div v-if="item.poster" class="rounded-lg overflow-hidden mb-3 shadow-sm relative group cursor-pointer" @click="$router.push({ name: 'MediaDetail', query: { id: item.tmdbid, type: item.type === '电影' ? 'movie' : 'tv' } })">
                <img
                  :src="item.poster"
                  class="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  style="aspect-ratio: 2/3;"
                  alt=""
                />
                <!-- 左上角类型标签 -->
                <div v-if="item.type" class="absolute top-2 left-2">
                  <NTag :type="getTypeColor(item.type)" size="small" round>{{ item.type }}</NTag>
                </div>
                <!-- 右上角收藏 -->
                <div v-if="item.fav === '2'" class="absolute top-2 right-2">
                  <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs">✓</span>
                </div>
                <!-- 底部信息覆盖层 -->
                <div class="absolute bottom-0 left-0 right-0 p-2 text-white"
                  style="background: linear-gradient(transparent, rgba(0,0,0,0.75));">
                  <div class="text-sm font-bold truncate">{{ item.title }}</div>
                  <div class="flex items-center gap-2 text-xs mt-0.5">
                    <span v-if="item.year">{{ item.year }}</span>
                    <span v-if="item.vote" class="flex items-center gap-0.5">
                      <span class="text-yellow-400">★</span>{{ item.vote }}
                    </span>
                  </div>
                </div>
                <!-- 悬浮操作按钮 -->
                <div class="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style="background: rgba(0,0,0,0.45);">
                  <NButton size="tiny" type="primary" round @click.stop="$router.push({ name: 'MediaDetail', query: { id: item.tmdbid, type: item.type === '电影' ? 'movie' : 'tv' } })">
                    详情
                  </NButton>
                  <NButton size="tiny" type="info" round @click.stop="$router.push({ name: 'MediaSearch', query: { s: item.title } })">
                    搜索
                  </NButton>
                  <NButton v-if="!item.rssid" size="tiny" type="success" round @click.stop="notification.info({content:'订阅功能开发中',duration:1500})">
                    订阅
                  </NButton>
                </div>
              </div>

              <!-- 过滤条件 -->
              <div v-if="hasFilters(item)" class="space-y-3 text-sm">
                <div v-if="item.filter.season && item.filter.season.length">
                  <div class="subheader mb-2">季</div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="s in item.filter.season"
                      :key="s"
                      class="filter-pill"
                      :class="{ 'filter-pill-active': isFilterActive(item, 'season', s) }"
                      @click="toggleFilter(item, 'season', s)"
                    >
                      {{ s }}
                    </span>
                  </div>
                </div>
                <div v-if="item.filter.site.length">
                  <div class="subheader mb-2">站点</div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="s in item.filter.site"
                      :key="s"
                      class="filter-pill"
                      :class="{ 'filter-pill-active': isFilterActive(item, 'site', s) }"
                      @click="toggleFilter(item, 'site', s)"
                    >
                      {{ s }}
                    </span>
                  </div>
                </div>
                <div v-if="item.filter.releasegroup.length">
                  <div class="subheader mb-2">制作组</div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="g in item.filter.releasegroup"
                      :key="g"
                      class="filter-pill"
                      :class="{ 'filter-pill-active': isFilterActive(item, 'releasegroup', g) }"
                      @click="toggleFilter(item, 'releasegroup', g)"
                    >
                      {{ g }}
                    </span>
                  </div>
                </div>
                <div v-if="item.filter.free.length">
                  <div class="subheader mb-2">促销</div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="f in item.filter.free"
                      :key="f.value"
                      class="filter-pill"
                      :class="{ 'filter-pill-active': isFilterActive(item, 'free', f.value) }"
                      @click="toggleFilter(item, 'free', f.value)"
                    >
                      {{ f.name }}
                    </span>
                  </div>
                </div>
                <div v-if="item.filter.video && item.filter.video.length">
                  <div class="subheader mb-2">视频编码</div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="v in item.filter.video"
                      :key="v"
                      class="filter-pill"
                      :class="{ 'filter-pill-active': isFilterActive(item, 'video', v) }"
                      @click="toggleFilter(item, 'video', v)"
                    >
                      {{ v }}
                    </span>
                  </div>
                </div>
                <div class="mt-2">
                  <NButton size="small" class="w-full" @click="resetFilters(item)">
                    重置
                  </NButton>
                </div>
              </div>
            </div>

            <!-- 右侧详情和种子列表 -->
            <div class="flex-1 min-w-0">
              <!-- 标题 -->
              <h2 class="text-2xl font-bold mb-1">
                <a
                  v-if="item.tmdbid && item.tmdbid !== '0'"
                  :href="`https://www.themoviedb.org/${item.type === '电影' ? 'movie' : 'tv'}/${item.tmdbid}`"
                  target="_blank"
                  class="hover:text-blue-500 transition-colors"
                >
                  {{ item.title }}
                </a>
                <span v-else>{{ item.title }}</span>
                <span v-if="item.year" class="text-cyan-500 font-normal">({{ item.year }})</span>
              </h2>

              <!-- 简介 -->
              <div v-if="item.overview" class="text-sm text-gray-500 mb-3 line-clamp-3">
                {{ item.overview }}
              </div>

              <!-- 种子分组列表（手风琴） -->
              <div class="mt-2 space-y-2">
                <div
                  v-for="seTuple in filteredTorrentDict(item)"
                  :key="seTuple[0]"
                >
                  <!-- 季标题（非 MOV 时显示） -->
                  <div
                    v-if="seTuple[0] !== 'MOV'"
                    class="font-bold text-base mb-2 mt-3 cursor-pointer"
                  >
                    {{ seTuple[0] }}
                  </div>

                  <NCollapse :default-expanded-names="['0']">
                    <NCollapseItem
                      v-for="(group, gKey, gIdx) in seTuple[1]"
                      :key="gKey"
                      :name="String(gIdx)"
                    >
                      <template #header>
                        <span class="text-red-500 font-medium">{{ group.group_info?.restype || '未知媒介' }}</span>
                        <span class="mx-1 text-gray-400">/</span>
                        <span class="text-orange-500 font-medium">{{ group.group_info?.respix || '未知分辨率' }}</span>
                        <span class="mx-1 text-gray-400">/</span>
                        <span>共 <strong>{{ group.group_total }}</strong> 个种子</span>
                      </template>

                      <div class="divide-y" style="border-color: hsl(var(--border))">
                        <div
                          v-for="(unique, uKey) in group.group_torrents"
                          :key="uKey"
                        >
                          <div
                            v-for="torrent in unique.torrent_list"
                            :key="torrent.id"
                            class="py-2.5 flex gap-3 items-start px-2 rounded transition-colors hover:bg-[hsl(var(--accent)/0.06)]"
                          >
                            <div class="flex-1 min-w-0">
                              <div class="flex items-start gap-2">
                                <a
                                  href="javascript:void(0)"
                                  class="text-sm font-medium hover:underline line-clamp-2 leading-snug"
                                  style="color: hsl(var(--primary))"
                                  @click="openDownloadModal(torrent.id)"
                                >
                                  {{ torrent.torrent_name }}
                                </a>
                                <span
                                  v-if="getFreeBadgeText(torrent.uploadvalue, torrent.downloadvalue)"
                                  :class="['shrink-0 inline-flex items-center text-xs px-1.5 py-px rounded font-medium border', getFreeBadgeBorderClass(torrent.uploadvalue, torrent.downloadvalue)]"
                                  :style="getFreeBadgeStyle(torrent.uploadvalue, torrent.downloadvalue)"
                                >
                                  {{ getFreeBadgeText(torrent.uploadvalue, torrent.downloadvalue) }}
                                </span>
                              </div>
                              <div v-if="torrent.description" class="mt-1.5 flex items-start gap-1.5">
                                <IconifyIcon icon="lucide:quote" class="h-3 w-3 mt-0.5 shrink-0" style="color: hsl(var(--muted-foreground)/0.5)" />
                                <span class="text-xs line-clamp-2 leading-relaxed" style="color: hsl(var(--card-foreground)/0.7)">{{ torrent.description }}</span>
                              </div>
                              <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span class="inline-flex items-center text-xs px-1.5 py-px rounded font-medium" style="background: hsl(var(--primary)/0.12); color: hsl(var(--primary))">{{ torrent.site }}</span>
                                <span v-if="torrent.video_encode" class="inline-flex items-center text-xs px-1.5 py-px rounded font-medium" style="background: hsl(var(--warning)/0.15); color: hsl(var(--warning))">{{ torrent.video_encode }}</span>
                                <span v-if="torrent.reseffect" class="inline-flex items-center text-xs px-1.5 py-px rounded font-medium" style="background: hsl(270 60% 50% / 0.15); color: hsl(270 60% 55%)">{{ torrent.reseffect }}</span>
                                <span v-if="torrent.size" class="inline-flex items-center text-xs px-1.5 py-px rounded font-medium" style="background: hsl(var(--chart-3)/0.15); color: hsl(var(--chart-3))">{{ torrent.size }}</span>
                                <span v-if="torrent.releasegroup" class="inline-flex items-center text-xs px-1.5 py-px rounded font-medium" style="background: hsl(var(--chart-1)/0.15); color: hsl(var(--chart-1))">{{ torrent.releasegroup }}</span>
                                <span v-if="torrent.seeders" class="inline-flex items-center text-xs px-1.5 py-px rounded font-medium" style="background: hsl(var(--success)/0.12); color: hsl(var(--success))">
                                  <IconifyIcon icon="lucide:arrow-up" class="h-3 w-3 mr-0.5" />
                                  {{ torrent.seeders }}
                                </span>
                              </div>
                            </div>

                            <div class="flex-shrink-0 flex items-center gap-2 pt-0.5">
                              <a
                                href="javascript:void(0)"
                                class="p-1.5 rounded hover:bg-[hsl(var(--accent)/0.1)] transition-colors"
                                title="下载"
                                style="color: hsl(var(--muted-foreground))"
                                @click="openDownloadModal(torrent.id)"
                              >
                                <IconifyIcon icon="lucide:download" class="h-4 w-4" />
                              </a>
                              <NDropdown
                                :options="getTorrentDropdownOptions(torrent)"
                                trigger="click"
                                @select="(key: string) => handleTorrentDropdown(torrent, key)"
                              >
                                <a
                                  href="javascript:void(0)"
                                  class="p-1.5 rounded hover:bg-[hsl(var(--accent)/0.1)] transition-colors"
                                  style="color: hsl(var(--muted-foreground))"
                                >
                                  <IconifyIcon icon="lucide:more-horizontal" class="h-4 w-4" />
                                </a>
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
        </div>
      </div>

      <NEmpty v-else-if="loading === false && keyword" description="未找到相关媒体" />
      <EmptyState
        v-else-if="!loading"
        title="开始搜索"
        subtitle="请输入关键词开始搜索电影或剧集"
      />
    </NSpin>
    </template>

    <!-- 下载模态框 -->
    <NModal
      v-model:show="downloadModalVisible"
      title="添加下载"
      preset="card"
      style="width: 420px"
      :bordered="false"
      size="huge"
    >
      <NSpin :show="downloadModalLoading">
        <div class="space-y-4">
          <div>
            <div class="text-sm text-gray-500 mb-1">下载设置</div>
            <NSelect
              v-model:value="selectedDownloadSetting"
              :options="downloadSettings"
              placeholder="站点设置"
              @update:value="onDownloadSettingChange"
            />
          </div>
          <div>
            <div class="text-sm text-gray-500 mb-1">保存目录</div>
            <NSelect
              v-model:value="selectedDownloadDir"
              :options="downloadDirs"
              placeholder="自动"
            />
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
    <NModal
      v-model:show="advancedModalVisible"
      title="高级搜索"
      preset="card"
      style="width: 420px"
      :bordered="false"
    >
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
.subheader {
  font-size: 0.75rem;
  color: #6c757d;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.filter-pill {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  font-size: 0.8rem;
  color: #495057;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 9999px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}
.filter-pill:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}
.filter-pill-active {
  background: #0d6efd;
  color: #fff;
  border-color: #0d6efd;
}
.filter-pill-active:hover {
  background: #0b5ed7;
  border-color: #0b5ed7;
}
.badge {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
</style>
