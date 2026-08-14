<script lang="ts" setup>
import type { SubscribeConfirmItem } from '#/components/subscribe/SubscribeConfirmModal.vue';
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NProgress,
  NSelect,
  NSpin,
  NTag,
} from 'naive-ui';

import { getSearchResultApi, searchMediaApi, webSearchApi } from '#/api';
import {
  downloadSearchResultApi,
  getDownloadDirsApi,
  getDownloadSettingsApi,
} from '#/api/modules/download';
import {
  addSubscriptionApi,
  addSubscriptionMediaApi,
  deleteSubscriptionApi,
  getDefaultSubscriptionSettingApi,
  removeSubscriptionApi,
} from '#/api/modules/subscription';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscribeConfirmModal from '#/components/subscribe/SubscribeConfirmModal.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';
import { useDownloadEventStream } from '#/composables/useDownloadEventStream';
import { useSearchProgress } from '#/composables/useSearchProgress';
import { useAppNotification } from '#/utils/notify';
import { useResourceHelpers } from '#/views/site/resources/composables/useResourceHelpers';

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
  seeds_season?: number;
  seeds_episode?: number;
  seeds_end_episode?: number;
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
  episode: string[];
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
  type_key?: string;
  year: string;
  vote: string;
  poster: string;
  overview: string;
  fav: string;
  rssid: null | string;
  seeds_season?: null | number;
  seeds_episode?: null | number;
  seeds_end_episode?: null | number;
  filter: {
    episode?: string[];
    free: Array<{ name: string; value: string }>;
    releasegroup: string[];
    season?: string[];
    site: string[];
    video?: string[];
  };
  // 后端排序后变成 [[SE_key, SE_dict], ...]
  torrent_dict: Array<[string, Record<string, GroupItem>]>;
}

interface SearchResultWithFilter extends SearchResult {
  activeFilters: FilterState;
}

const route = useRoute();
const router = useRouter();
const notification = useAppNotification();
const { start: startSSE, stop: stopSSE } = useDownloadEventStream();

const subscribeConfirmShow = ref(false);
const subscribeConfirmItem = ref<null | SubscribeConfirmItem>(null);
const subscribeEditShow = ref(false);
const subscribeEditItem = ref<null | SubscribeEditItem>(null);
const unsubscribingMedia = ref<MediaItem | null>(null);
const subscribeConfirmPending = ref(false);

function normalizeMediaType(type?: string): 'movie' | 'tv' {
  if (!type) return 'tv';
  const t = type.toLowerCase();
  if (t === 'movie' || t === '电影') return 'movie';
  if (t === 'tv' || t === '剧集' || t === '电视剧') return 'tv';
  return 'tv';
}

function updateCardSubscribeState(title: string, fav: string, rssid?: string) {
  for (const item of results.value) {
    if (item.title === title) {
      item.fav = fav;
      if (rssid !== undefined) item.rssid = String(rssid);
    }
  }
}

async function handleSubscribe(item: SearchResult, e: Event) {
  e.stopPropagation();
  const mtype = normalizeMediaType(item.type_key || item.type);
  // 电影已订阅 → 取消订阅；电视剧已订阅 → 仍打开季选择框以追加其他季
  if (item.fav === '1' && item.rssid && mtype === 'movie') {
    try {
      await deleteSubscriptionApi(Number(item.rssid));
      updateCardSubscribeState(item.title, '');
      notification.success('已取消订阅', { description: item.title });
    } catch (error: any) {
      notification.error('取消订阅失败', { description: error?.message || '' });
    }
    return;
  }
  subscribeConfirmItem.value = {
    id: String(item.tmdbid || item.key),
    tmdbid: item.tmdbid,
    title: item.title,
    year: item.year || '',
    type: mtype,
    image: item.poster,
    overview: item.overview,
  };
  subscribeConfirmShow.value = true;
}

async function handleConfirmSubscribe(payload: {
  add: number[];
  autoMode: boolean;
  remove: number[];
  selected: number[];
}) {
  const it = subscribeConfirmItem.value;
  if (!it) return;
  const { add, remove, selected } = payload;
  subscribeConfirmPending.value = true;
  try {
    const typeParam = it.type === 'movie' ? 'movie' : 'tv';
    if (typeParam === 'tv') {
      let lastRssid = '';
      for (const season of add) {
        const r: any = await addSubscriptionMediaApi({
          name: it.title,
          year: it.year || '',
          type: 'tv',
          mediaid: String(it.id),
          season: String(season),
        });
        lastRssid = r?.rssid ? String(r.rssid) : lastRssid;
      }
      for (const season of remove) {
        await removeSubscriptionApi({
          name: it.title,
          year: it.year || '',
          type: 'tv',
          tmdbid: String(it.tmdbid || it.id),
          season: String(season),
        });
      }
      const fav = selected.length > 0 ? '1' : '';
      const parts: string[] = [];
      if (add.length > 0) parts.push(`订阅 ${add.length} 季`);
      if (remove.length > 0) parts.push(`退订 ${remove.length} 季`);
      notification.success('操作成功', {
        description: `${it.title} 已${parts.join('、')}`,
      });
      updateCardSubscribeState(it.title, fav, lastRssid || undefined);
      updateMediaSubscribeState(it.id, fav, lastRssid || undefined);
    } else {
      const res: any = await addSubscriptionMediaApi({
        name: it.title,
        year: it.year || '',
        type: typeParam,
        mediaid: String(it.id),
      });
      const success = res?.code === 0 || res?.success || res?.rssid || !res;
      if (success) {
        notification.success('订阅成功', {
          description: res?.msg || `${it.title} 已添加订阅`,
        });
        updateCardSubscribeState(
          it.title,
          '1',
          res?.rssid ? String(res.rssid) : undefined,
        );
        updateMediaSubscribeState(
          it.id,
          '1',
          res?.rssid ? String(res.rssid) : undefined,
        );
      } else {
        notification.error('订阅失败', { description: res?.msg || '未知错误' });
      }
    }
  } catch (error: any) {
    notification.error('操作失败', { description: error?.message || '' });
  } finally {
    subscribeConfirmPending.value = false;
    subscribeConfirmShow.value = false;
  }
}

async function handleEditSubscribe() {
  const it = subscribeConfirmItem.value;
  if (!it) return;
  const mtype = it.type === 'movie' ? 'movie' : 'tv';
  let defaults: any = {};
  try {
    const res: any = await getDefaultSubscriptionSettingApi(mtype);
    defaults = res?.data || res || {};
  } catch {
    // ignore
  }
  subscribeEditItem.value = {
    name: it.title,
    year: it.year || '',
    type: mtype,
    tmdbid: String(it.tmdbid || it.id || ''),
    image: it.image,
    season: '',
    fuzzy_match: false,
    over_edition: !!(
      defaults.over_edition && String(defaults.over_edition) === '1'
    ),
    filter_restype: defaults.restype || defaults.filter_restype || '',
    filter_pix: defaults.pix || defaults.filter_pix || '',
    filter_team: defaults.team || defaults.filter_team || '',
    filter_rule: defaults.rule == null ? '' : String(defaults.rule),
    filter_include: defaults.include || defaults.filter_include || '',
    filter_exclude: defaults.exclude || defaults.filter_exclude || '',
    filter_free:
      defaults.free != null && String(defaults.free) === '1'
        ? true
        : (defaults.filter_free ?? false),
    download_setting:
      defaults.download_setting == null
        ? ''
        : String(defaults.download_setting),
    rss_sites: Array.isArray(defaults.rss_sites) ? defaults.rss_sites : [],
    search_sites: Array.isArray(defaults.search_sites)
      ? defaults.search_sites
      : [],
  } as SubscribeEditItem;
  subscribeConfirmShow.value = false;
  subscribeEditShow.value = true;
}

async function handleConfirmEdit(data: Record<string, any>) {
  try {
    const res: any = await addSubscriptionApi(data);
    const it = subscribeConfirmItem.value;
    if (it) {
      updateCardSubscribeState(
        it.title,
        '1',
        res?.rssid ? String(res.rssid) : undefined,
      );
      updateMediaSubscribeState(
        it.id,
        '1',
        res?.rssid ? String(res.rssid) : undefined,
      );
    }
    notification.success('订阅成功', {
      description: `${data.name} 已添加订阅`,
    });
  } catch (error: any) {
    notification.error('订阅失败', { description: error?.message || '' });
  } finally {
    subscribeEditShow.value = false;
  }
}

function updateMediaSubscribeState(
  mediaId: string,
  fav: string,
  rssid?: string,
) {
  for (const m of mediaResults.value) {
    if (String(m.tmdb_id || m.id) === mediaId) {
      m.fav = fav;
      if (rssid !== undefined) m.rssid = String(rssid);
    }
  }
}

function handleMediaSubscribe(media: MediaItem) {
  subscribeConfirmItem.value = {
    id: String(media.tmdb_id || media.id),
    tmdbid: String(media.tmdb_id || media.id),
    title: media.title,
    year: media.year || '',
    type: normalizeMediaType(media.media_type || media.type),
    image: media.image || media.poster,
    overview: media.overview,
  };
  subscribeConfirmShow.value = true;
}

async function handleMediaUnsubscribe(media: MediaItem) {
  if (!media.rssid) return;
  unsubscribingMedia.value = media;
}

/** 已订阅按钮：电影 → 取消订阅；电视剧 → 打开季选择框追加其他季 */
function handleMediaSubscribedClick(media: MediaItem) {
  if (normalizeMediaType(media.media_type || media.type) === 'movie') {
    handleMediaUnsubscribe(media);
  } else {
    handleMediaSubscribe(media);
  }
}

async function confirmUnsubscribe() {
  const media = unsubscribingMedia.value;
  if (!media?.rssid) return;
  try {
    await deleteSubscriptionApi(Number(media.rssid));
    updateMediaSubscribeState(String(media.tmdb_id || media.id), '');
    updateCardSubscribeState(media.title, '');
    notification.success('已取消订阅', { description: media.title });
  } catch (error: any) {
    notification.error('取消订阅失败', { description: error?.message || '' });
  } finally {
    unsubscribingMedia.value = null;
  }
}

/** 图片 URL 处理：后端已统一转换代理路径，直接使用 */
function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return src;
}

const loading = ref(false);
const keyword = ref('');
const searchtype = ref<'' | 'douban' | 'tmdb'>('tmdb');

// 持久化当前搜索关键词，用于从其他页面切回（无 query 参数）时恢复标题显示
const SEARCH_KEYWORD_KEY = 'nexus:search:keyword';
function setSearchKeyword(k: string) {
  keyword.value = k;
  try {
    if (k) sessionStorage.setItem(SEARCH_KEYWORD_KEY, k);
  } catch {}
}

// 显示模式：empty | media(普通搜索媒体结果) | torrent(种子结果)
const displayMode = ref<'empty' | 'media' | 'torrent'>('empty');

// 普通搜索的媒体词条结果
interface MediaItem {
  id: number | string;
  title: string;
  year?: string;
  type?: string;
  media_type?: string;
  vote?: number | string;
  image?: string;
  poster?: string;
  overview?: string;
  tmdb_id?: number | string;
  fav?: string;
  rssid?: string;
}
const mediaResults = ref<MediaItem[]>([]);

// 种子搜索结果
const results = ref<SearchResultWithFilter[]>([]);
const resultCount = ref(0);
const { getLabelClass } = useResourceHelpers();
const {
  pct: searchProgressPct,
  text: searchProgressText,
  sites: searchSiteStatuses,
  start: startSearchProgress,
  stop: stopSearchProgress,
} = useSearchProgress();
const searchSessionId = ref('');
const SEARCH_SESSION_KEY = 'nexus:search:session';

function activeFilterCount(item: SearchResultWithFilter): number {
  return Object.values(item.activeFilters).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
}

const filterDropOpen = ref<Record<string, boolean>>({});
const seasonCollapsed = ref<Record<string, boolean>>({});

function toggleFilterDrop(key: string) {
  const wasOpen = filterDropOpen.value[key];
  filterDropOpen.value = {};
  if (!wasOpen) filterDropOpen.value[key] = true;
}

function toggleSeasonCollapse(key: string) {
  seasonCollapsed.value = {
    ...seasonCollapsed.value,
    [key]: !seasonCollapsed.value[key],
  };
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
  { label: '电影', value: 'movie' },
  { label: '电视剧', value: 'tv' },
];

// 下载模态框
const downloadModalVisible = ref(false);
const downloadModalLoading = ref(false);
const downloadTorrentId = ref('');
const downloadSettings = ref<Array<{ label: string; value: string }>>([]);
const downloadDirs = ref<Array<{ label: string; value: string }>>([
  { label: '自动', value: '' },
]);
const selectedDownloadSetting = ref('');
const selectedDownloadDir = ref('');

/** 从 sessionStorage 恢复进行中的搜索（页面切回时自动重连 SSE） */
function resumeOngoingSearch(): boolean {
  const sid = sessionStorage.getItem(SEARCH_SESSION_KEY);
  if (!sid) return false;

  // 路由有显式搜索参数 → 优先级高于 sessionStorage，不恢复旧会话
  const s = route.query.s as string;
  if (s) return false;

  const kw = sessionStorage.getItem(SEARCH_KEYWORD_KEY);
  if (kw) keyword.value = kw;

  searchSessionId.value = sid;
  displayMode.value = 'torrent';
  loading.value = true;
  startSearchProgress(sid, () => {
    sessionStorage.removeItem(SEARCH_SESSION_KEY);
    loadSearchResults();
  });
  return true;
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
    mediaResults.value = Array.isArray(res) ? res : res?.data || [];
  } catch (error: any) {
    notification.error('搜索失败', {
      description: error?.message || '未知错误',
    });
  } finally {
    loading.value = false;
  }
}

/** 点击媒体卡片 → 进入媒体详情 */
function handleMediaCardClick(media: MediaItem) {
  const id = media.tmdb_id || media.id;
  if (!id) return;
  const t = normalizeMediaType(media.media_type || media.type);
  router.push({
    name: 'MediaDetail',
    query: { id: String(id), type: t },
  });
}

/** 点击「搜索资源」→ 触发种子搜索 */
async function handleMediaSearch(media: MediaItem) {
  displayMode.value = 'torrent';
  loading.value = true;
  setSearchKeyword(media.title);
  try {
    const resp: any = await webSearchApi({
      search_word: media.title,
      tmdbid: String(media.tmdb_id || media.id || ''),
      media_type: media.type || media.media_type || '',
    });
    searchSessionId.value = resp?.session_id || '';
    if (searchSessionId.value)
      sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
    startSearchProgress(resp?.session_id || '', () => {
      sessionStorage.removeItem(SEARCH_SESSION_KEY);
      loadSearchResults();
    });
  } catch (error: any) {
    loading.value = false;
    sessionStorage.removeItem(SEARCH_SESSION_KEY);
    notification.error('搜索失败', {
      description: error?.message || '未知错误',
    });
  }
}

async function handleAdvancedSearch() {
  if (!advancedForm.value.name.trim()) return;
  advancedModalVisible.value = false;
  displayMode.value = 'torrent';
  setSearchKeyword(advancedForm.value.name);
  loading.value = true;
  try {
    const resp: any = await webSearchApi({
      search_word: advancedForm.value.name,
      tmdbid: '',
      media_type: advancedForm.value.type,
    });
    searchSessionId.value = resp?.session_id || '';
    if (searchSessionId.value)
      sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
    startSearchProgress(resp?.session_id || '', () => {
      sessionStorage.removeItem(SEARCH_SESSION_KEY);
      loadSearchResults();
    });
  } catch (error: any) {
    loading.value = false;
    sessionStorage.removeItem(SEARCH_SESSION_KEY);
    notification.error('搜索失败', {
      description: error?.message || '未知错误',
    });
  }
}

async function loadSearchResults() {
  loading.value = true;
  results.value = [];
  try {
    const res: any = await getSearchResultApi(
      searchSessionId.value || undefined,
    );
    const searchData = res?.result || {};
    if (typeof searchData === 'object') {
      results.value = Object.entries(searchData).map(
        ([, item]: [string, any]) => {
          // 从 torrent_dict 键中提取集数，范围展开为单集（如 "S01 E02-E03" → E02, E03）
          const episodeSet = new Set<string>();
          const dict = item.torrent_dict || [];
          for (const [seKey] of dict) {
            const m = seKey.match(/E(\d+)(?:-E?(\d+))?$/i);
            if (!m) continue;
            const start = Number.parseInt(m[1], 10);
            const end = m[2] ? Number.parseInt(m[2], 10) : start;
            for (let e = start; e <= end; e++) {
              episodeSet.add(`E${String(e).padStart(2, '0')}`);
            }
          }
          const filter = item.filter || {
            site: [],
            releasegroup: [],
            free: [],
          };
          return {
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
            seeds_season: item.seeds_season,
            seeds_episode: item.seeds_episode,
            seeds_end_episode: item.seeds_end_episode,
            filter: { ...filter, episode: [...episodeSet].toSorted() },
            torrent_dict: dict,
            activeFilters: {
              season: [],
              episode: [],
              site: [],
              releasegroup: [],
              free: [],
              video: [],
            },
          };
        },
      );
      resultCount.value = res?.total || results.value.length;
      if (results.value.length > 0) {
        displayMode.value = 'torrent';
      }
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

// 防止 onMounted 与 watch 对同一次路由跳转重复触发搜索
let lastHandledQueryKey = '';

onMounted(() => {
  startSSE();
  // 有进行中的搜索（页面切回）→ 恢复 SSE 连接和进度
  if (resumeOngoingSearch()) return;

  lastHandledQueryKey = `${route.query.s}|${route.query.from}|${route.query.session_id}|${route.query.tmdbid}`;

  const s = route.query.s as string;
  const from = route.query.from as string;
  const sid = route.query.session_id as string;
  if (sid) searchSessionId.value = sid;

  if (s) {
    setSearchKeyword(s);
    // 探索/详情/订阅已带 session_id → 只连 SSE 等结果，不重复搜索
    if (
      sid &&
      (from === 'discovery' || from === 'detail' || from === 'subscription')
    ) {
      displayMode.value = 'torrent';
      loading.value = true;
      if (sid) sessionStorage.setItem(SEARCH_SESSION_KEY, sid);
      startSearchProgress(sid, () => {
        sessionStorage.removeItem(SEARCH_SESSION_KEY);
        loadSearchResults();
      });
    } else if (
      from === 'discovery' ||
      from === 'detail' ||
      from === 'subscription'
    ) {
      const tmdbId = (route.query.tmdbid as string) || '';
      const mediaType = (route.query.media_type as string) || '';
      displayMode.value = 'torrent';
      loading.value = true;
      webSearchApi({ search_word: s, tmdbid: tmdbId, media_type: mediaType })
        .then((resp: any) => {
          searchSessionId.value = resp?.session_id || '';
          if (searchSessionId.value)
            sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
          startSearchProgress(resp?.session_id || '', () => {
            sessionStorage.removeItem(SEARCH_SESSION_KEY);
            loadSearchResults();
          });
        })
        .catch(() => {
          loading.value = false;
          sessionStorage.removeItem(SEARCH_SESSION_KEY);
        });
    } else if (from === 'global-search' || !from) {
      handleSearch();
    } else {
      displayMode.value = 'torrent';
      results.value = [];
      loading.value = true;
      webSearchApi({ search_word: s })
        .then((resp: any) => {
          searchSessionId.value = resp?.session_id || '';
          if (searchSessionId.value)
            sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
          startSearchProgress(resp?.session_id || '', () => {
            sessionStorage.removeItem(SEARCH_SESSION_KEY);
            loadSearchResults();
          });
        })
        .catch((error: any) => {
          loading.value = false;
          sessionStorage.removeItem(SEARCH_SESSION_KEY);
          notification.error('搜索失败', {
            description: error?.message || '未知错误',
          });
        });
    }
  } else {
    loadSearchResults();
  }
});
// 探索/详情页跳转时组件复用，onMounted 不重跑 → watch 补救
watch(
  () => route.query,
  (q) => {
    const queryKey = `${q.s}|${q.from}|${q.session_id}|${q.tmdbid}`;
    if (queryKey === lastHandledQueryKey) return;
    lastHandledQueryKey = queryKey;
    const s = q.s as string;
    const from = q.from as string;
    const tmdbId = (q.tmdbid as string) || '';
    const mediaType = (q.media_type as string) || '';
    if (!s) return;
    setSearchKeyword(s);
    if (from === 'discovery' || from === 'detail' || from === 'subscription') {
      displayMode.value = 'torrent';
      loading.value = true;
      webSearchApi({ search_word: s, tmdbid: tmdbId, media_type: mediaType })
        .then((resp: any) => {
          searchSessionId.value = resp?.session_id || '';
          if (searchSessionId.value)
            sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
          startSearchProgress(resp?.session_id || '', () => {
            sessionStorage.removeItem(SEARCH_SESSION_KEY);
            loadSearchResults();
          });
        })
        .catch(() => {
          loading.value = false;
          sessionStorage.removeItem(SEARCH_SESSION_KEY);
        });
    }
  },
);
onUnmounted(() => {
  // 只断开 SSE 连接，保留 sessionStorage 用于页面切回时恢复
  stopSearchProgress();
  stopSSE();
});

function getTypeColor(type: string) {
  if (type === 'movie') return 'success';
  if (type === 'anime') return 'warning';
  return 'info';
}

function getMediaTypeLabel(type?: string) {
  const map: Record<string, string> = {
    movie: '电影',
    tv: '电视剧',
    anime: '动漫',
  };
  return (type && map[type]) || '未知';
}

function hasFilters(item: SearchResultWithFilter) {
  const f = item.filter;
  return (
    (f.season && f.season.length > 0) ||
    (f.episode && f.episode.length > 0) ||
    f.site.length > 0 ||
    f.releasegroup.length > 0 ||
    f.free.length > 0 ||
    (f.video && f.video.length > 0)
  );
}

function getFreeBadgeText(upload: number, download: number) {
  if (download === 0) return 'FREE';
  if (download < 1) return `${Math.round(download * 100)}%DL`;
  if (upload < 1) return `${Math.round(upload * 100)}%UL`;
  return '';
}

function handleTorrentDropdown(torrent: TorrentItem, key: string) {
  if (key === 'enclosure') {
    window.open(torrent.enclosure, '_blank');
  } else if (key === 'pageurl') {
    window.open(torrent.pageurl, '_blank');
  }
}

// ---- 过滤逻辑 ----
function toggleFilter(
  item: SearchResultWithFilter,
  category: keyof FilterState,
  value: string,
) {
  const idx = results.value.findIndex((r) => r.key === item.key);
  if (idx === -1) return;
  const target = results.value[idx]!;
  const arr = [...target.activeFilters[category]];
  const aIdx = arr.indexOf(value);
  if (aIdx === -1) {
    arr.push(value);
  } else {
    arr.splice(aIdx, 1);
  }
  results.value[idx] = {
    ...target,
    activeFilters: { ...target.activeFilters, [category]: arr },
  };
}

function resetFilters(item: SearchResultWithFilter) {
  const idx = results.value.findIndex((r) => r.key === item.key);
  if (idx === -1) return;
  const target = results.value[idx]!;
  results.value[idx] = {
    ...target,
    activeFilters: {
      season: [],
      episode: [],
      site: [],
      releasegroup: [],
      free: [],
      video: [],
    },
  };
}

function isFilterActive(
  item: SearchResultWithFilter,
  category: keyof FilterState,
  value: string,
) {
  return item.activeFilters[category].includes(value);
}

function torrentMatchesFreeFilter(torrent: TorrentItem, filterValue: string) {
  const parts = filterValue.split(' ');
  if (parts.length !== 2) return false;
  const expectedUp = Number.parseFloat(parts[0]!);
  const expectedDown = Number.parseFloat(parts[1]!);
  return (
    Math.abs(torrent.uploadvalue - expectedUp) < 0.001 &&
    Math.abs(torrent.downloadvalue - expectedDown) < 0.001
  );
}

/** 检查 torrent_dict 的键是否包含指定集数（支持范围如 E02-E03） */
function episodeKeyMatches(seKey: string, episode: string): boolean {
  const m = seKey.match(/E(\d+)(?:-E?(\d+))?$/i);
  if (!m) return false;
  const target = Number.parseInt(episode.replace(/^E/i, ''), 10);
  const start = Number.parseInt(m[1] || '', 10);
  const end = m[2] ? Number.parseInt(m[2], 10) : start;
  return target >= start && target <= end;
}

function filteredTorrentDict(
  item: SearchResultWithFilter,
): Array<[string, Record<string, GroupItem>]> {
  const af = item.activeFilters;
  const hasActive =
    af.season.length ||
    af.episode.length ||
    af.site.length ||
    af.releasegroup.length ||
    af.free.length ||
    af.video.length;
  if (!hasActive) return item.torrent_dict;

  return item.torrent_dict
    .filter(([seKey]) => {
      if (af.season.length > 0 && !af.season.some((s) => seKey.includes(s)))
        return false;
      if (
        af.episode.length > 0 &&
        !af.episode.some((ep) => episodeKeyMatches(seKey, ep))
      )
        return false;
      return true;
    })
    .map(([seKey, seDict]): [string, Record<string, GroupItem>] => {
      const filteredGroups: Record<string, GroupItem> = {};
      for (const [gKey, group] of Object.entries(seDict)) {
        let groupTotal = 0;
        const filteredTorrents: Record<string, UniqueGroup> = {};
        for (const [uKey, unique] of Object.entries(group.group_torrents)) {
          const list = unique.torrent_list.filter((t) => {
            if (af.site.length > 0 && !af.site.includes(t.site)) return false;
            if (
              af.releasegroup.length > 0 &&
              !af.releasegroup.includes(t.releasegroup || '未知')
            )
              return false;
            if (
              af.free.length > 0 &&
              !af.free.some((fv) => torrentMatchesFreeFilter(t, fv))
            )
              return false;
            if (af.video.length > 0 && !af.video.includes(t.video_encode || ''))
              return false;
            return true;
          });
          if (list.length > 0) {
            groupTotal += list.length;
            filteredTorrents[uKey] = { ...unique, torrent_list: list };
          }
        }
        if (Object.keys(filteredTorrents).length > 0) {
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

/** 将分组内所有 unique 的种子扁平化为一个列表 */
function flattenGroupTorrents(group: GroupItem): TorrentItem[] {
  const list: TorrentItem[] = [];
  for (const unique of Object.values(group.group_torrents)) {
    list.push(...unique.torrent_list);
  }
  return list;
}

function getSeasonTorrents(seDict: Record<string, GroupItem>): TorrentItem[] {
  const list: TorrentItem[] = [];
  for (const group of Object.values(seDict)) {
    list.push(...flattenGroupTorrents(group));
  }
  return list.toSorted((a, b) => (b.seeders || 0) - (a.seeders || 0));
}

function totalTorrentCount(item: SearchResultWithFilter): number {
  let total = 0;
  for (const [, seDict] of item.torrent_dict) {
    total += getSeasonTorrents(seDict).length;
  }
  return total;
}

function formatSeasonLabel(key: string): string {
  if (key === 'movie' || !key) return '';
  return key;
}

function getMediaStatSites(item: SearchResultWithFilter): number {
  const sites = new Set<string>();
  for (const [, seDict] of item.torrent_dict) {
    for (const t of getSeasonTorrents(seDict)) {
      sites.add(t.site);
    }
  }
  return sites.size;
}

function getMediaStatSeasonCount(item: SearchResultWithFilter): number {
  const seasons = new Set<string>();
  for (const [seKey] of item.torrent_dict) {
    if (seKey === 'movie') continue;
    const m = seKey.match(/S(\d+)/i);
    if (m) seasons.add(m[1]!);
  }
  return seasons.size;
}

function getMediaStatFree(item: SearchResultWithFilter): number {
  let count = 0;
  for (const [, seDict] of item.torrent_dict) {
    for (const t of getSeasonTorrents(seDict)) {
      if (t.downloadvalue === 0) count++;
    }
  }
  return count;
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
      downloadSettings.value = Object.entries(settingsRes).map(
        ([sid, s]: [string, any]) => ({
          label: s.name || sid,
          value: String(s.id || sid),
        }),
      );
    }
    // 默认选中第一项并加载对应目录
    if (downloadSettings.value.length > 0) {
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
    if (dirsRes && Array.isArray(dirsRes) && dirsRes.length > 0) {
      downloadDirs.value = [
        { label: '自动', value: '' },
        ...dirsRes.map((d: string) => ({ label: d, value: d })),
      ];
    }
  } catch {}
}

async function onDownloadSettingChange(val: null | string) {
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
    notification.success('下载任务已提交');
    downloadModalVisible.value = false;
  } catch (error: any) {
    notification.error('下载失败', {
      description: error?.message || '未知错误',
    });
  } finally {
    downloadModalLoading.value = false;
  }
}
</script>

<template>
  <div class="p-4">
    <PageHeader title="资源搜索">
      <template #actions>
        <div
          v-if="resultCount > 0"
          style="font-size: 0.875rem; color: hsl(var(--muted-foreground))"
        >
          共搜索到 {{ resultCount }} 条记录
        </div>
      </template>
    </PageHeader>

    <!-- 搜索框 -->
    <NCard class="mb-4" size="small" :bordered="false">
      <div class="flex items-center gap-3 flex-wrap">
        <NInput
          v-model:value="keyword"
          placeholder="输入电影/剧集名称"
          clearable
          class="search-input"
          @keydown="handleKeydown"
        >
          <template #prefix>
            <IconifyIcon
              icon="lucide:search"
              class="size-4"
              style="color: hsl(var(--muted-foreground))"
            />
          </template>
        </NInput>
        <NSelect
          v-model:value="searchtype"
          :options="typeOptions"
          class="search-select"
        />
        <NButton
          type="primary"
          :loading="loading && displayMode === 'media'"
          class="search-btn"
          @click="handleSearch"
        >
          <template #icon>
            <IconifyIcon icon="lucide:search" class="size-4" />
          </template>
          搜索
        </NButton>
        <NButton
          quaternary
          class="advanced-btn"
          @click="advancedModalVisible = true"
        >
          <template #icon>
            <IconifyIcon icon="lucide:sliders-horizontal" class="size-4" />
          </template>
          高级搜索
        </NButton>
      </div>
    </NCard>

    <!-- 普通搜索：媒体词条结果 -->
    <NSpin v-if="displayMode === 'media'" :show="loading">
      <div>
        <div
          v-if="mediaResults.length > 0"
          class="grid gap-4"
          style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))"
        >
          <div
            v-for="media in mediaResults"
            :key="media.id"
            class="cursor-pointer relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
            @click="handleMediaCardClick(media)"
          >
            <div style="aspect-ratio: 2/3; background: hsl(var(--muted))">
              <img
                :src="getImgUrl(media.image || media.poster)"
                class="w-full h-full object-cover"
                alt=""
                @error="
                  (e: any) => {
                    e.target.src = '/static/img/no-image.png';
                  }
                "
              />
            </div>
            <span
              v-if="media.media_type || media.type"
              class="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded"
              :style="{
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
              }"
            >
              {{ getMediaTypeLabel(media.media_type || media.type) }}
            </span>
            <span
              v-if="media.vote && media.vote !== '0.0' && media.vote !== '0'"
              style="
                position: absolute;
                top: 0.375rem;
                right: 0.375rem;
                padding: 0.125rem 0.375rem;
                font-size: 10px;
                color: #fff;
                background: var(--tblr-purple);
                border-radius: 0.25rem;
              "
            >
              {{ media.vote }}
            </span>
            <div
              class="absolute bottom-0 left-0 right-0 p-2 text-white"
              style="background: linear-gradient(transparent, rgb(0 0 0 / 75%))"
            >
              <div class="text-sm font-bold truncate">{{ media.title }}</div>
              <div class="flex items-center gap-2 text-xs mt-0.5">
                <span v-if="media.year">{{ media.year }}</span>
              </div>
            </div>
            <div
              class="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity duration-200"
              style="background: rgb(0 0 0 / 50%)"
            >
              <NButton
                size="small"
                type="primary"
                round
                @click.stop="handleMediaSearch(media)"
              >
                搜索资源
              </NButton>
              <NButton
                v-if="media.fav !== '1'"
                size="small"
                round
                style="color: #fff; border-color: #fff"
                ghost
                @click.stop="handleMediaSubscribe(media)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:heart" />
                </template>
                订阅
              </NButton>
              <NButton
                v-else
                size="small"
                type="error"
                ghost
                round
                @click.stop="handleMediaSubscribedClick(media)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:heart" style="fill: currentcolor" />
                </template>
                已订阅
              </NButton>
            </div>
          </div>
        </div>
      </div>
      <NEmpty
        v-if="!loading && mediaResults.length === 0 && keyword"
        description="未找到相关媒体"
      />
    </NSpin>

    <!-- 初始加载中 -->
    <div
      v-if="loading && displayMode === 'empty'"
      class="flex items-center justify-center py-24"
    >
      <NSpin :show="true"><span></span></NSpin>
    </div>

    <!-- 种子搜索：进度 + 结果 -->
    <template v-else-if="displayMode === 'torrent'">
      <!-- 有旧结果时：顶部内联进度条，保留旧结果列表 -->
      <div v-if="loading && results.length > 0" class="torrent-progress-inline">
        <IconifyIcon
          icon="lucide:loader-circle"
          class="size-4 animate-spin progress-icon"
        />
        <span class="progress-text">
          正在搜索「{{ keyword }}」<template v-if="searchProgressText">
            · {{ searchProgressText }}</template
          >
        </span>
        <NProgress
          type="line"
          :percentage="searchProgressPct"
          processing
          :show-indicator="false"
          class="progress-bar"
        />
        <span class="progress-pct">{{ searchProgressPct }}%</span>
      </div>

      <!-- 无结果时：居中进度提示 -->
      <div v-else-if="loading" class="flex items-center justify-center py-24">
        <NSpin show>
          <div class="text-center">
            <div class="text-lg mb-2">正在搜索「{{ keyword }}」</div>
            <NProgress
              type="line"
              :percentage="searchProgressPct"
              processing
              class="w-96 max-w-xl"
            />
            <div
              style="
                margin-top: 0.5rem;
                font-size: 0.875rem;
                color: hsl(var(--muted-foreground));
              "
            >
              {{ searchProgressText || '请稍候，正在检索资源...' }}
            </div>
          </div>
        </NSpin>
      </div>

      <!-- 站点搜索状态（含失败原因），搜索中/结束后均展示 -->
      <div v-if="searchSiteStatuses.length > 0" class="search-site-status">
        <span
          v-for="st in searchSiteStatuses"
          :key="st.name"
          class="search-site-chip"
          :class="`search-site-chip--${st.status}`"
          :title="st.error ? `${st.name}：${st.error}` : st.name"
        >
          <span class="search-site-chip-dot"></span>
          <span class="search-site-chip-name">{{ st.name }}</span>
          <span v-if="st.status === 'ok'" class="search-site-chip-num">{{
            st.count
          }}</span>
          <span v-else-if="st.status === 'timeout'" class="search-site-chip-msg"
            >超时</span
          >
          <span v-else class="search-site-chip-msg">{{
            st.error || '失败'
          }}</span>
        </span>
      </div>

      <!-- 搜索结果 -->
      <div>
        <div v-if="results.length > 0" class="result-list">
          <div v-for="item in results" :key="item.key" class="result-card">
            <!-- 左栏：海报 + 信息 -->
            <div class="result-left">
              <div
                v-if="item.poster"
                class="result-poster"
                @click="
                  item.tmdbid && item.tmdbid !== '0'
                    ? $router.push({
                        name: 'MediaDetail',
                        query: {
                          id: item.tmdbid,
                          type:
                            item.type_key ||
                            (item.type === 'movie' ? 'movie' : 'tv'),
                        },
                      })
                    : null
                "
              >
                <img :src="item.poster" alt="" />
                <div v-if="item.type_key" class="result-poster-tag">
                  <NTag :type="getTypeColor(item.type_key)" size="small" round>
                    {{ getMediaTypeLabel(item.type_key) }}
                  </NTag>
                </div>
                <div v-if="item.fav === '2'" class="result-poster-fav">
                  <IconifyIcon icon="lucide:check" class="size-3" />
                </div>
              </div>
              <div class="result-info">
                <h2 class="result-title">
                  <a
                    v-if="item.tmdbid && item.tmdbid !== '0'"
                    :href="`https://www.themoviedb.org/${item.type === 'movie' ? 'movie' : 'tv'}/${item.tmdbid}`"
                    target="_blank"
                    class="result-title-link"
                    >{{ item.title }}</a
                  >
                  <span v-else>{{ item.title }}</span>
                  <span v-if="item.year" class="result-year"
                    >({{ item.year }})</span
                  >
                </h2>
                <div class="result-meta">
                  <span v-if="item.vote" class="result-rating">
                    <IconifyIcon icon="lucide:star" class="size-4" />{{
                      item.vote
                    }}
                  </span>
                  <template v-if="item.type_key || item.filter?.season?.length">
                    <span v-if="getMediaStatSeasonCount(item) > 0"
                      >{{ getMediaStatSeasonCount(item) }} 季</span
                    >
                  </template>
                </div>
                <div class="result-meta">
                  <span
                    v-if="item.tmdbid && item.tmdbid !== '0'"
                    class="result-sub-badge"
                    :class="{ subbed: item.fav === '1' }"
                    @click="(e) => handleSubscribe(item, e)"
                  >
                    <IconifyIcon
                      icon="lucide:heart"
                      class="size-3"
                      :style="{
                        fill: item.fav === '1' ? 'currentColor' : 'none',
                      }"
                    />
                    {{ item.fav === '1' ? '已订阅' : '订阅' }}
                  </span>
                </div>
                <p class="result-overview">{{ item.overview || '暂无简介' }}</p>
                <div class="result-stats">
                  <div class="result-stat">
                    <div class="stat-num">{{ totalTorrentCount(item) }}</div>
                    <div class="stat-lbl">种子</div>
                  </div>
                  <div class="result-stat">
                    <div class="stat-num">{{ getMediaStatSites(item) }}</div>
                    <div class="stat-lbl">站点</div>
                  </div>
                  <div class="result-stat">
                    <div class="stat-num">{{ getMediaStatFree(item) }}</div>
                    <div class="stat-lbl">免费</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右栏：筛选 + 资源表 -->
            <div class="result-right">
              <div v-if="hasFilters(item)" class="result-filter-bar">
                <div
                  v-if="item.filter.season && item.filter.season.length > 0"
                  class="filter-fd"
                  :class="{ open: filterDropOpen[`${item.key}-season`] }"
                >
                  <button
                    class="filter-fd-btn"
                    :class="{
                      has:
                        activeFilterCount(item) > 0 &&
                        item.activeFilters.season.length > 0,
                    }"
                    @click.stop="toggleFilterDrop(`${item.key}-season`)"
                  >
                    <span class="ffd-label">季</span>
                    <span class="ffd-val">{{
                      item.activeFilters.season.length > 0
                        ? item.activeFilters.season.join(', ')
                        : '全部'
                    }}</span>
                    <span class="ffd-arr">▼</span>
                    <div class="ffd-drop">
                      <button
                        v-for="s in item.filter.season"
                        :key="s"
                        :class="{ sel: isFilterActive(item, 'season', s) }"
                        @click="toggleFilter(item, 'season', s)"
                      >
                        {{ s }}
                      </button>
                    </div>
                  </button>
                </div>
                <div
                  v-if="item.filter.episode && item.filter.episode.length > 0"
                  class="filter-fd"
                  :class="{ open: filterDropOpen[`${item.key}-episode`] }"
                >
                  <button
                    class="filter-fd-btn"
                    :class="{ has: item.activeFilters.episode.length > 0 }"
                    @click.stop="toggleFilterDrop(`${item.key}-episode`)"
                  >
                    <span class="ffd-label">集</span>
                    <span class="ffd-val">{{
                      item.activeFilters.episode.length > 0
                        ? item.activeFilters.episode.join(', ')
                        : '全部'
                    }}</span>
                    <span class="ffd-arr">▼</span>
                    <div class="ffd-drop">
                      <button
                        v-for="e in item.filter.episode"
                        :key="e"
                        :class="{ sel: isFilterActive(item, 'episode', e) }"
                        @click="toggleFilter(item, 'episode', e)"
                      >
                        {{ e }}
                      </button>
                    </div>
                  </button>
                </div>
                <div
                  v-if="item.filter.site.length > 0"
                  class="filter-fd"
                  :class="{ open: filterDropOpen[`${item.key}-site`] }"
                >
                  <button
                    class="filter-fd-btn"
                    :class="{ has: item.activeFilters.site.length > 0 }"
                    @click.stop="toggleFilterDrop(`${item.key}-site`)"
                  >
                    <span class="ffd-label">站点</span>
                    <span class="ffd-val">{{
                      item.activeFilters.site.length > 0
                        ? item.activeFilters.site.join(', ')
                        : '全部'
                    }}</span>
                    <span class="ffd-arr">▼</span>
                    <div class="ffd-drop">
                      <button
                        v-for="s in item.filter.site"
                        :key="s"
                        :class="{ sel: isFilterActive(item, 'site', s) }"
                        @click="toggleFilter(item, 'site', s)"
                      >
                        {{ s }}
                      </button>
                    </div>
                  </button>
                </div>
                <div
                  v-if="item.filter.releasegroup.length > 0"
                  class="filter-fd"
                  :class="{ open: filterDropOpen[`${item.key}-releasegroup`] }"
                >
                  <button
                    class="filter-fd-btn"
                    :class="{ has: item.activeFilters.releasegroup.length > 0 }"
                    @click.stop="toggleFilterDrop(`${item.key}-releasegroup`)"
                  >
                    <span class="ffd-label">压制组</span>
                    <span class="ffd-val">{{
                      item.activeFilters.releasegroup.length > 0
                        ? item.activeFilters.releasegroup.join(', ')
                        : '全部'
                    }}</span>
                    <span class="ffd-arr">▼</span>
                    <div class="ffd-drop">
                      <button
                        v-for="g in item.filter.releasegroup"
                        :key="g"
                        :class="{
                          sel: isFilterActive(item, 'releasegroup', g),
                        }"
                        @click="toggleFilter(item, 'releasegroup', g)"
                      >
                        {{ g }}
                      </button>
                    </div>
                  </button>
                </div>
                <div
                  v-if="item.filter.video && item.filter.video.length > 0"
                  class="filter-fd"
                  :class="{ open: filterDropOpen[`${item.key}-video`] }"
                >
                  <button
                    class="filter-fd-btn"
                    :class="{ has: item.activeFilters.video.length > 0 }"
                    @click.stop="toggleFilterDrop(`${item.key}-video`)"
                  >
                    <span class="ffd-label">编码</span>
                    <span class="ffd-val">{{
                      item.activeFilters.video.length > 0
                        ? item.activeFilters.video.join(', ')
                        : '全部'
                    }}</span>
                    <span class="ffd-arr">▼</span>
                    <div class="ffd-drop">
                      <button
                        v-for="v in item.filter.video"
                        :key="v"
                        :class="{ sel: isFilterActive(item, 'video', v) }"
                        @click="toggleFilter(item, 'video', v)"
                      >
                        {{ v }}
                      </button>
                    </div>
                  </button>
                </div>
                <button
                  v-for="f in item.filter.free"
                  :key="f.value"
                  class="filter-toggle"
                  :class="{ on: isFilterActive(item, 'free', f.value) }"
                  @click="toggleFilter(item, 'free', f.value)"
                >
                  {{ f.name }}
                </button>
                <button
                  v-if="activeFilterCount(item) > 0"
                  class="filter-reset"
                  @click="resetFilters(item)"
                >
                  重置
                </button>
              </div>

              <div class="result-tables">
                <div
                  v-for="seTuple in filteredTorrentDict(item)"
                  :key="seTuple[0]"
                  class="season-table-block"
                >
                  <div
                    v-if="seTuple[0] !== 'movie'"
                    class="season-table-header"
                    @click="toggleSeasonCollapse(`${item.key}-${seTuple[0]}`)"
                  >
                    <IconifyIcon
                      :icon="
                        seasonCollapsed[`${item.key}-${seTuple[0]}`]
                          ? 'lucide:chevron-right'
                          : 'lucide:chevron-down'
                      "
                      class="size-4"
                    />
                    {{ formatSeasonLabel(seTuple[0]) }}
                    <span class="season-table-count"
                      >{{ getSeasonTorrents(seTuple[1]).length }} 条</span
                    >
                  </div>
                  <template
                    v-if="!seasonCollapsed[`${item.key}-${seTuple[0]}`]"
                  >
                    <table class="torrent-table">
                      <thead>
                        <tr>
                          <th class="th-site">站点</th>
                          <th>标题</th>
                          <th class="th-num">做种</th>
                          <th class="th-num">大小</th>
                          <th class="th-num">促销</th>
                          <th class="th-act"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="torrent in getSeasonTorrents(seTuple[1])"
                          :key="torrent.id"
                          class="torrent-tr"
                        >
                          <td>
                            <span class="td-site">
                              {{ torrent.site }}
                            </span>
                          </td>
                          <td class="td-title">
                            <div
                              class="td-title-name"
                              @click="openDownloadModal(torrent.id)"
                            >
                              {{ torrent.torrent_name }}
                            </div>
                            <div class="td-title-sub">
                              <span v-if="torrent.respix" class="tag tag-res">{{
                                torrent.respix
                              }}</span>
                              <span
                                v-if="torrent.video_encode"
                                class="tag tag-video"
                                >{{ torrent.video_encode }}</span
                              >
                              <span
                                v-if="torrent.restype"
                                class="tag tag-type"
                                >{{ torrent.restype }}</span
                              >
                              <span
                                v-if="torrent.reseffect"
                                class="tag tag-effect"
                                >{{ torrent.reseffect }}</span
                              >
                              <span
                                v-if="
                                  torrent.releasegroup &&
                                  torrent.releasegroup !== '未知'
                                "
                                class="tag tag-group"
                                >{{ torrent.releasegroup }}</span
                              >
                            </div>
                            <div
                              v-if="torrent.labels?.length"
                              class="td-labels"
                            >
                              <span
                                v-for="label in torrent.labels.filter((l) =>
                                  l.trim(),
                                )"
                                :key="label"
                                class="resource-tag"
                                :class="getLabelClass(label)"
                                >{{ label }}</span
                              >
                            </div>
                            <div v-if="torrent.description" class="td-desc">
                              {{ torrent.description }}
                            </div>
                          </td>
                          <td class="td-seed">{{ torrent.seeders || 0 }}</td>
                          <td class="td-size">{{ torrent.size }}</td>
                          <td>
                            <span
                              v-if="
                                getFreeBadgeText(
                                  torrent.uploadvalue,
                                  torrent.downloadvalue,
                                )
                              "
                              class="td-free"
                              :class="{
                                'td-free-promo':
                                  torrent.downloadvalue > 0 &&
                                  torrent.downloadvalue < 1,
                              }"
                              >{{
                                getFreeBadgeText(
                                  torrent.uploadvalue,
                                  torrent.downloadvalue,
                                )
                              }}</span
                            >
                          </td>
                          <td>
                            <div class="td-actions">
                              <button
                                class="tbl-btn dl"
                                @click="openDownloadModal(torrent.id)"
                              >
                                下载
                              </button>
                              <button
                                class="tbl-btn gh"
                                @click="
                                  handleTorrentDropdown(torrent, 'pageurl')
                                "
                              >
                                详情
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <NEmpty
          v-else-if="loading === false && keyword"
          description="未找到相关媒体"
        />
        <EmptyState
          v-else-if="!loading"
          title="开始搜索"
          subtitle="请输入关键词开始搜索电影或剧集"
        />
      </div>
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
            <div
              style="
                margin-bottom: 0.25rem;
                font-size: 0.875rem;
                color: hsl(var(--muted-foreground));
              "
            >
              下载设置
            </div>
            <NSelect
              v-model:value="selectedDownloadSetting"
              :options="downloadSettings"
              placeholder="站点设置"
              @update:value="onDownloadSettingChange"
            />
          </div>
          <div>
            <div
              style="
                margin-bottom: 0.25rem;
                font-size: 0.875rem;
                color: hsl(var(--muted-foreground));
              "
            >
              保存目录
            </div>
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
          <NButton
            type="primary"
            :loading="downloadModalLoading"
            @click="confirmDownload"
          >
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
          <NInput
            v-model:value="advancedForm.name"
            placeholder="电影/电视剧名称"
          />
        </NFormItem>
        <NFormItem label="年份">
          <NInput v-model:value="advancedForm.year" placeholder="如: 2024" />
        </NFormItem>
        <NFormItem label="类型">
          <NSelect
            v-model:value="advancedForm.type"
            :options="advancedTypeOptions"
            placeholder="全部"
            clearable
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-3">
          <NButton @click="advancedModalVisible = false">取消</NButton>
          <NButton type="primary" @click="handleAdvancedSearch">
            开始搜索
          </NButton>
        </div>
      </template>
    </NModal>
    <NModal
      :show="unsubscribingMedia !== null"
      preset="dialog"
      type="warning"
      title="取消订阅"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmUnsubscribe"
      @negative-click="unsubscribingMedia = null"
      @update:show="unsubscribingMedia = null"
    >
      确认取消订阅「{{ unsubscribingMedia?.title }}」？
    </NModal>
    <SubscribeConfirmModal
      v-model:show="subscribeConfirmShow"
      :item="subscribeConfirmItem"
      @confirm="handleConfirmSubscribe"
      @edit="handleEditSubscribe"
    />
    <SubscribeEditModal
      v-model:show="subscribeEditShow"
      :item="subscribeEditItem"
      @confirm="handleConfirmEdit"
    />
  </div>
</template>

<style scoped>
/* 站点搜索状态芯片 */
.search-site-status {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.search-site-chip {
  display: inline-flex;
  gap: 0.3125rem;
  align-items: center;
  padding: 0.1875rem 0.5rem;
  font-size: 0.7188rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--muted));
  border-radius: 0.375rem;
}

.search-site-chip-dot {
  flex-shrink: 0;
  width: 0.375rem;
  height: 0.375rem;
  background: hsl(var(--muted-foreground) / 40%);
  border-radius: 50%;
}

.search-site-chip--ok .search-site-chip-dot {
  background: hsl(var(--success));
}

.search-site-chip--timeout {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 12%);
}

.search-site-chip--timeout .search-site-chip-dot {
  background: hsl(var(--warning));
}

.search-site-chip--error {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
}

.search-site-chip--error .search-site-chip-dot {
  background: hsl(var(--destructive));
}

.search-site-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-site-chip-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--card-foreground));
}

.search-site-chip-msg {
  opacity: 0.85;
}

@media (max-width: 640px) {
  .search-site-chip {
    max-width: 10rem;
  }

  .search-site-chip-name {
    max-width: 5.5rem;
  }
}

/* 顶部内联搜索进度条 */
.torrent-progress-inline {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}

.torrent-progress-inline .progress-icon {
  flex-shrink: 0;
  color: var(--tblr-primary);
}

.torrent-progress-inline .progress-text {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.torrent-progress-inline .progress-bar {
  flex: 3;
  min-width: 6rem;
}

.torrent-progress-inline .progress-pct {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .torrent-progress-inline {
    flex-wrap: wrap;
  }

  .torrent-progress-inline .progress-text {
    flex-basis: calc(100% - 1.75rem);
  }
}

/* Result Card - split layout */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.result-card {
  display: flex;
  gap: 0;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

/* ---- Left Panel ---- */
.result-left {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 280px;
  padding: 1.25rem 1rem;
  background: hsl(var(--accent) / 50%);
  border-right: 1px solid hsl(var(--border));
}

.result-poster {
  position: relative;
  width: 150px;
  aspect-ratio: 2/3;
  margin: 0 auto 0.75rem;
  overflow: hidden;
  cursor: pointer;
  border-radius: var(--radius);
  box-shadow: 0 12px 24px -8px hsl(0deg 0% 0% / 30%);
  transition: transform 0.2s;
}

.result-poster:hover {
  transform: scale(1.02);
}

.result-poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-poster-tag {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 10;
}

.result-poster-fav {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  color: hsl(var(--success-foreground));
  background: hsl(var(--success));
  border-radius: 50%;
}

.result-info {
  text-align: center;
}

.result-title {
  margin: 0 0 0.1875rem;
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.25;
  color: hsl(var(--card-foreground));
  letter-spacing: -0.01em;
}

.result-title-link {
  color: hsl(var(--card-foreground));
  text-decoration: none;
}

.result-title-link:hover {
  color: hsl(var(--primary));
}

.result-year {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.result-rating {
  display: inline-flex;
  gap: 0.125rem;
  align-items: center;
  font-weight: 700;
  color: var(--tblr-purple);
}

.result-sub-badge {
  display: inline-flex;
  gap: 0.1875rem;
  align-items: center;
  padding: 0.0938rem 0.4375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--success));
  cursor: pointer;
  background: hsl(var(--success) / 12%);
  border: 1px solid transparent;
  border-radius: 0.25rem;
  transition: border-color 0.15s;
}

.result-sub-badge:hover {
  border-color: hsl(var(--success) / 30%);
}

.result-sub-badge.subbed {
  background: hsl(var(--success) / 14%);
}

.result-overview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 4;
  font-size: 0.75rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground) / 75%);
  text-align: left;
  -webkit-box-orient: vertical;
}

.result-stats {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  padding: 0.5rem;
  margin-top: 0.625rem;
  background: hsl(var(--muted));
  border-radius: var(--radius);
}

.result-stat {
  flex: 1;
  text-align: center;
}

.stat-num {
  font-size: 0.9375rem;
  font-weight: 800;
  color: hsl(var(--primary));
}

.stat-lbl {
  margin-top: 0.0625rem;
  font-size: 0.5938rem;
  color: hsl(var(--muted-foreground));
}

/* ---- Right Panel ---- */
.result-right {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 1rem 1.25rem;
  background: hsl(var(--card));
}

/* Filter Bar */
.result-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3125rem;
  align-items: center;
  padding: 0.5rem 0.625rem;
  margin-bottom: 0.75rem;
  background: hsl(var(--accent) / 50%);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.filter-fd {
  position: relative;
}

.filter-fd-btn {
  display: inline-flex;
  gap: 0.1875rem;
  align-items: center;
  padding: 0.2813rem 0.4375rem;
  font-family: inherit;
  font-size: 0.7188rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  transition: border-color 0.12s;
}

.filter-fd-btn:hover {
  border-color: hsl(var(--muted-foreground) / 40%);
}

.filter-fd-btn.has {
  border-color: hsl(var(--primary) / 50%);
}

.ffd-label {
  font-size: 0.6563rem;
  color: hsl(var(--muted-foreground));
}

.ffd-val {
  margin: 0 0.125rem;
  font-weight: 600;
}

.ffd-arr {
  font-size: 0.4375rem;
  color: hsl(var(--muted-foreground));
}

.ffd-drop {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  display: none;
  min-width: 120px;
  padding: 0.3125rem;
  margin-top: 0.1875rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 4px 12px hsl(0deg 0% 0% / 40%);
}

.filter-fd.open .ffd-drop {
  display: block;
}

.ffd-drop button {
  display: block;
  width: 100%;
  padding: 0.1875rem 0.4375rem;
  margin-bottom: 0.0625rem;
  font-family: inherit;
  font-size: 0.7188rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 3px;
}

.ffd-drop button:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.ffd-drop button.sel {
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.filter-toggle {
  padding: 0.2813rem 0.5rem;
  font-family: inherit;
  font-size: 0.7188rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  transition: all 0.12s;
}

.filter-toggle.on {
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 14%);
  border-color: hsl(var(--primary));
}

.filter-reset {
  margin-left: auto;
  font-family: inherit;
  font-size: 0.7188rem;
  color: hsl(var(--muted-foreground) / 50%);
  cursor: pointer;
  background: none;
  border: none;
}

.filter-reset:hover {
  color: hsl(var(--destructive));
}

/* Torrent Tables */
.result-tables {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.season-table-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0.25rem;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: hsl(var(--primary));
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid hsl(var(--border) / 40%);
}

.season-table-header:hover {
  color: hsl(var(--primary) / 80%);
}

.season-table-count {
  margin-left: auto;
  font-size: 0.7188rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.torrent-table {
  width: 100%;
  min-width: 500px;
  overflow: hidden;
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.torrent-table thead th {
  padding: 0.4375rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  cursor: pointer;
  background: hsl(var(--muted) / 80%);
  border-bottom: 2px solid hsl(var(--border));
}

.torrent-table thead th:hover {
  color: hsl(var(--foreground));
}

.th-site {
  width: 84px;
}

.th-num {
  width: 56px;
}

.th-act {
  width: 94px;
}

.torrent-tr td {
  padding: 0.5rem;
  font-size: 0.8125rem;
  vertical-align: middle;
  white-space: nowrap;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border) / 25%);
  transition: background 0.12s;
}

.torrent-tr:hover td {
  background: hsl(var(--accent) / 70%);
}

.td-site {
  font-weight: 600;
}

.td-title {
  width: 100%;
  max-width: 0;
}

.td-title-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  line-height: 1.35;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
  cursor: pointer;
}

.td-title-name:hover {
  color: hsl(var(--primary));
}

.td-title-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.1875rem;
}

.tag {
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 3px;
}

.tag-video {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 12%);
}

.tag-res {
  color: hsl(var(--tag-dolby));
  background: hsl(var(--tag-dolby) / 14%);
}

.tag-type {
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
}

.tag-effect {
  color: hsl(var(--tag-hdr));
  background: hsl(var(--tag-hdr) / 14%);
}

.tag-group {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
}

.td-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.1875rem;
  margin-top: 0.1875rem;
}

.td-desc {
  margin-top: 0.1875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground) / 65%);
  white-space: nowrap;
}

.td-seed {
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--success));
}

.td-size {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground) / 75%);
}

.td-free {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.4375rem;
  font-size: 0.5625rem;
  font-weight: 800;
  line-height: 1.4;
  color: hsl(var(--success));
  letter-spacing: 0.04em;
  background: hsl(var(--success) / 15%);
  border-radius: 3px;
}

.td-free-promo {
  color: hsl(280deg 50% 55%);
  background: hsl(280deg 50% 55% / 15%);
}

.td-actions {
  display: flex;
  gap: 0.1875rem;
  opacity: 0;
  transition: opacity 0.12s;
}

.torrent-tr:hover .td-actions {
  opacity: 1;
}

.tbl-btn {
  padding: 0.1563rem 0.375rem;
  font-family: inherit;
  font-size: 0.6563rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  transition: all 0.12s;
}

.tbl-btn.dl {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 6%);
  border-color: hsl(var(--primary) / 25%);
}

.tbl-btn.dl:hover {
  background: hsl(var(--primary) / 16%);
}

.tbl-btn.gh {
  color: hsl(var(--muted-foreground));
}

.tbl-btn.gh:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

/* Mobile */
@media (max-width: 768px) {
  .result-card {
    flex-direction: column;
  }

  .result-left {
    flex-direction: row;
    gap: 0.875rem;
    align-items: flex-start;
    width: 100%;
    padding: 1rem;
  }

  .result-poster {
    flex-shrink: 0;
    width: 112px;
    margin: 0;
    box-shadow: 0 4px 12px -4px hsl(0deg 0% 0% / 25%);
  }

  .result-info {
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .result-title {
    font-size: 1rem;
  }

  .result-overview {
    -webkit-line-clamp: 2;
  }

  .result-meta {
    justify-content: flex-start;
  }

  .result-stats {
    display: none;
  }
}

/* 搜索区域 */
.search-input {
  width: 300px;
}

.search-select {
  width: 140px;
}

.search-btn {
  gap: 0.25rem;
}

.advanced-btn {
  gap: 0.25rem;
  color: hsl(var(--muted-foreground));
}

.advanced-btn:hover {
  color: hsl(var(--primary));
}

@media (max-width: 640px) {
  .search-input,
  .search-select {
    width: 100%;
  }
}

/* 站点资源标签风格 */
.torrent-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.375rem;
}

.resource-tag {
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  border-radius: 0.25rem;
}

.resource-tag-default {
  color: hsl(var(--tag-default));
  background-color: hsl(var(--tag-default) / 18%);
}

.resource-tag-primary {
  color: hsl(var(--tag-primary));
  background-color: hsl(var(--tag-primary) / 20%);
}

.resource-tag-danger {
  color: hsl(var(--tag-danger));
  background-color: hsl(var(--tag-danger) / 20%);
}

.resource-tag-lang {
  color: hsl(var(--tag-lang));
  background-color: hsl(var(--tag-lang) / 18%);
}

.resource-tag-dolby {
  color: hsl(var(--tag-dolby));
  background-color: hsl(var(--tag-dolby) / 20%);
}

.resource-tag-hdr {
  color: hsl(var(--tag-hdr));
  background-color: hsl(var(--tag-hdr) / 20%);
}

.resource-tag-quality {
  color: hsl(var(--tag-quality));
  background-color: hsl(var(--tag-quality) / 18%);
}

.resource-tag-audio {
  color: hsl(var(--tag-audio));
  background-color: hsl(var(--tag-audio) / 20%);
}

.resource-tag-source {
  color: hsl(var(--tag-source));
  background-color: hsl(var(--tag-source) / 18%);
}

.resource-tag-edition {
  color: hsl(var(--tag-edition));
  background-color: hsl(var(--tag-edition) / 20%);
}
</style>
