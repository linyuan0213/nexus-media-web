<script lang="ts" setup>
import type { SubscribeConfirmItem } from '#/components/subscribe/SubscribeConfirmModal.vue';
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
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

import {
  getMetadataProvidersApi,
  getSearchResultApi,
  searchMetadataApi,
  webSearchApi,
} from '#/api';
import {
  downloadSearchResultApi,
  getDownloadDirsApi,
  getDownloadSettingsApi,
} from '#/api/modules/download';
import { getVisibleSitesApi } from '#/api/modules/site';
import {
  addSubscriptionApi,
  addSubscriptionMediaApi,
  deleteSubscriptionApi,
  getDefaultSubscriptionSettingApi,
  removeSubscriptionApi,
} from '#/api/modules/subscription';
import EmptyState from '#/components/empty/EmptyState.vue';
import MediaPoster from '#/components/media/MediaPoster.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscribeConfirmModal from '#/components/subscribe/SubscribeConfirmModal.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';
import { useDownloadEventStream } from '#/composables/useDownloadEventStream';
import { useSearchProgress } from '#/composables/useSearchProgress';
import {
  getContentProfileDefaultSearchSource,
  getContentProfileDetailPath,
  getContentProfileForSource,
  getContentProfileLabel,
  getContentProfileOverviewFallback,
  getContentProfileSearchSources,
  getContentProfileSourceOptions,
} from '#/plugin-framework';
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
  resolution: string[];
}

interface SearchResult {
  title: string;
  key: string;
  tmdbid: string;
  type: string;
  type_key?: string;
  year: string;
  vote: string;
  content_profile?: string;
  metadata_ref?: string;
  provider?: string;
  anchor_provider?: string;
  anchor_external_id?: string;
  identity_id?: string;
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
    resolution?: string[];
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

function normalizeMediaType(type?: string): 'anime' | 'movie' | 'tv' {
  if (!type) return 'tv';
  const t = type.toLowerCase();
  if (t === 'movie' || t === '电影') return 'movie';
  if (t === 'anime' || t === '动漫') return 'anime';
  if (t === 'tv' || t === '剧集' || t === '电视剧') return 'tv';
  return 'tv';
}

function mediaIdentityKey(item: any): string {
  if (item?.identity_id) return `id:${item.identity_id}`;
  const provider = String(item?.anchor_provider || item?.provider || '').trim();
  const external = String(item?.anchor_external_id || '').trim();
  if (provider && external) return `${provider}:${external}`;
  if (item?.metadata_ref) return String(item.metadata_ref);
  if (item?.tmdb_id) return `tmdb:${item.tmdb_id}`;
  return `local:${item?.id || item?.key || item?.title || ''}`;
}

function itemLinks(item: any): Array<{ label: string; url: string }> {
  if (Array.isArray(item?.links) && item.links.length > 0) return item.links;
  const links: Array<{ label: string; url: string }> = [];
  if (item?.douban_id) {
    links.push({
      label: '豆瓣',
      url: `https://movie.douban.com/subject/${item.douban_id}`,
    });
  }
  if (item?.tmdbid && String(item.tmdbid) !== '0') {
    links.push({
      label: 'TMDB',
      url: `https://www.themoviedb.org/${item.type === 'movie' ? 'movie' : 'tv'}/${item.tmdbid}`,
    });
  }
  if (item?.anchor_provider === 'bangumi' && item?.anchor_external_id) {
    links.push({
      label: 'Bangumi',
      url: `https://bgm.tv/subject/${item.anchor_external_id}`,
    });
  }
  return links;
}

function itemLink(item: any): string {
  if (item?.link) return item.link;
  if (item?.anchor_provider === 'douban' && item?.douban_id) {
    return `https://movie.douban.com/subject/${item.douban_id}`;
  }
  return itemLinks(item)[0]?.url || '';
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
  const resultProvider = String(
    (item as any).anchor_provider || (item as any).provider || '',
  ).trim();
  const resultExternal = String(
    (item as any).anchor_external_id || item.key || '',
  ).trim();
  subscribeConfirmItem.value = {
    id: resultExternal,
    tmdbid: resultProvider === 'tmdb' ? String(item.tmdbid || '') : '',
    mediaid:
      (item as any).metadata_ref ||
      (resultProvider ? `${resultProvider}:${resultExternal}` : resultExternal),
    title: item.title,
    year: item.year || '',
    type: mtype,
    image: item.poster,
    overview: item.overview,
    content_profile: effectiveContentProfile(item),
    metadata_ref: (item as any).metadata_ref,
    provider: (item as any).provider,
    anchor_provider: (item as any).anchor_provider,
    anchor_external_id: (item as any).anchor_external_id,
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
          mediaid: it.mediaid || String(it.id),
          season: String(season),
          content_profile: it.content_profile,
          metadata_ref: it.metadata_ref,
          provider: it.provider,
        });
        lastRssid = r?.rssid ? String(r.rssid) : lastRssid;
      }
      for (const season of remove) {
        await removeSubscriptionApi({
          name: it.title,
          year: it.year || '',
          type: 'tv',
          tmdbid: it.tmdbid || undefined,
          anchor_provider: it.anchor_provider,
          anchor_external_id: it.anchor_external_id,
          metadata_ref: it.metadata_ref,
          season: String(season),
          content_profile: it.content_profile,
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
        mediaid: it.mediaid || String(it.id),
        content_profile: it.content_profile,
        metadata_ref: it.metadata_ref,
        provider: it.provider,
        anchor_provider: it.anchor_provider,
        anchor_external_id: it.anchor_external_id,
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
    const res: any = await getDefaultSubscriptionSettingApi(
      mtype,
      it.content_profile,
    );
    defaults = res?.data || res || {};
  } catch {
    // ignore
  }
  subscribeEditItem.value = {
    name: it.title,
    year: it.year || '',
    type: mtype,
    tmdbid: it.tmdbid || '',
    image: it.image,
    content_profile: it.content_profile,
    metadata_ref: it.metadata_ref,
    mediaid: it.mediaid,
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
    const isCustom =
      !!data.content_profile && data.content_profile !== 'default';
    const res: any = isCustom
      ? await addSubscriptionMediaApi(data)
      : await addSubscriptionApi(data);
    const it = subscribeConfirmItem.value;
    if (it) {
      updateCardSubscribeState(
        it.title,
        '1',
        res?.rssid ? String(res.rssid) : undefined,
      );
      updateMediaSubscribeState(
        mediaIdentityKey(it),
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
    if (mediaIdentityKey(m) === mediaId) {
      m.fav = fav;
      if (rssid !== undefined) m.rssid = String(rssid);
    }
  }
}

function handleMediaSubscribe(media: MediaItem) {
  const provider = String((media as any).anchor_provider || '').trim();
  const external = String(
    (media as any).anchor_external_id || media.id || '',
  ).trim();
  subscribeConfirmItem.value = {
    id: external,
    tmdbid: provider === 'tmdb' ? String(media.tmdb_id || external) : '',
    mediaid:
      (media as any).metadata_ref ||
      (provider ? `${provider}:${external}` : external),
    title: media.title,
    year: media.year || '',
    type: normalizeMediaType(media.media_type || media.type),
    image: media.image || media.poster,
    overview: media.overview,
    content_profile: (media as any).content_profile,
    metadata_ref: (media as any).metadata_ref,
    anchor_provider: (media as any).anchor_provider,
    anchor_external_id: (media as any).anchor_external_id,
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
    updateMediaSubscribeState(mediaIdentityKey(media), '');
    updateCardSubscribeState(media.title, '');
    notification.success('已取消订阅', { description: media.title });
  } catch (error: any) {
    notification.error('取消订阅失败', { description: error?.message || '' });
  } finally {
    unsubscribingMedia.value = null;
  }
}

const loading = ref(false);
const keyword = ref('');
const searchtype = ref<string>('');
const contentProfileKey = computed(() =>
  String(route.query.content_profile || ''),
);
const profileSources = computed(() =>
  getContentProfileSearchSources(contentProfileKey.value),
);
const initialMetadataSource = String(route.query.metadata_source || '').trim();
const metadataSource = ref(
  initialMetadataSource && initialMetadataSource !== 'content_id'
    ? initialMetadataSource
    : getContentProfileDefaultSearchSource(contentProfileKey.value),
);

function applyIncomingSource(source: string) {
  const normalized = source.trim();
  if (normalized && normalized !== 'content_id') {
    metadataSource.value = normalized;
    searchtype.value = normalized;
    return;
  }
  // content_id 只是内部锚点，不能作为来源选项显示。
  metadataSource.value = getContentProfileDefaultSearchSource(
    contentProfileKey.value,
  );
  searchtype.value = '';
}

watch(profileSources, (sources) => {
  if (!sources.length) return;
  if (!sources.some((item) => item.value === metadataSource.value)) {
    metadataSource.value = sources[0]!.value;
  }
});

function setSearchKeyword(k: string) {
  keyword.value = k;
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
  content_profile?: string;
  metadata_ref?: string;
  provider?: string;
  anchor_provider?: string;
  anchor_external_id?: string;
  search_query?: string;
  studio?: string;
  vote?: number | string;
  image?: string;
  poster?: string;
  overview?: string;
  tmdb_id?: number | string;
  douban_id?: string;
  link?: string;
  links?: Array<{ label: string; url: string }>;
  sources?: string[];
  score?: number;
  fav?: string;
  rssid?: string;
}
const mediaResults = ref<MediaItem[]>([]);

// 搜索页快照：切走再切回时恢复关键词/结果/进度，避免重复发起搜索
interface SearchSnapshot {
  keyword: string;
  sessionId: string;
  displayMode: 'empty' | 'media' | 'torrent';
  searchtype: string;
  metadataSource: string;
  status: 'completed' | 'idle' | 'running';
  from: string;
  mediaResults: MediaItem[];
  torrentRequest?: null | TorrentSearchPayload;
  updatedAt: number;
}

const SEARCH_SNAPSHOT_KEY = 'nexus:search:snapshot';
const SEARCH_SNAPSHOT_TTL = 30 * 60 * 1000;

// 最近一次种子搜索参数，供站点筛选变化时按同一目标重跑
type TorrentSearchPayload = Parameters<typeof webSearchApi>[0];
const lastTorrentRequest = ref<null | TorrentSearchPayload>(null);

function requestTorrentSearch(payload: TorrentSearchPayload) {
  lastTorrentRequest.value = payload;
  saveSearchSnapshot({ torrentRequest: payload });
  return webSearchApi(payload);
}

function readSearchSnapshot(): null | SearchSnapshot {
  try {
    const raw = sessionStorage.getItem(SEARCH_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as SearchSnapshot;
    if (!snapshot || typeof snapshot !== 'object') return null;
    if (Date.now() - Number(snapshot.updatedAt || 0) > SEARCH_SNAPSHOT_TTL) {
      sessionStorage.removeItem(SEARCH_SNAPSHOT_KEY);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function saveSearchSnapshot(patch: Partial<SearchSnapshot> = {}) {
  try {
    const previous = readSearchSnapshot();
    const snapshot: SearchSnapshot = {
      ...previous,
      keyword: keyword.value,
      sessionId: searchSessionId.value,
      displayMode: displayMode.value,
      searchtype: searchtype.value,
      metadataSource: metadataSource.value,
      status: previous?.status || 'idle',
      from: String(route.query.from || previous?.from || ''),
      mediaResults: previous?.mediaResults || [],
      torrentRequest: previous?.torrentRequest || null,
      ...patch,
      updatedAt: Date.now(),
    };
    if (snapshot.mediaResults.length > 40) {
      snapshot.mediaResults = snapshot.mediaResults.slice(0, 40);
    }
    sessionStorage.setItem(SEARCH_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {}
}

function clearSearchSnapshot() {
  try {
    sessionStorage.removeItem(SEARCH_SNAPSHOT_KEY);
  } catch {}
}

/** 恢复上次搜索；运行中的任务只续接进度，不重新发起搜索 */
function restoreSearchSnapshot(snapshot: SearchSnapshot) {
  resultPollToken += 1;
  stopSearchProgress();
  keyword.value = snapshot.keyword || '';
  searchtype.value = snapshot.searchtype || '';
  metadataSource.value = snapshot.metadataSource || '';
  displayMode.value = snapshot.displayMode || 'empty';
  searchSessionId.value = snapshot.sessionId || '';
  lastTorrentRequest.value = snapshot.torrentRequest || null;
  if (snapshot.displayMode === 'media') {
    mediaResults.value = Array.isArray(snapshot.mediaResults)
      ? snapshot.mediaResults
      : [];
    loading.value = false;
    return;
  }
  if (!snapshot.sessionId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  if (snapshot.status === 'running') {
    startSearchProgress(snapshot.sessionId, () => {
      saveSearchSnapshot({ status: 'completed' });
      void loadResultsWhenReady();
    });
  }
  void loadResultsWhenReady();
}

/** 统一的进度跟踪：开始时写快照，结束后标记完成 */
function trackSearchProgress(sessionId: string, onCompleted: () => void) {
  saveSearchSnapshot({
    sessionId,
    status: 'running',
    displayMode: displayMode.value,
    keyword: keyword.value,
  });
  startSearchProgress(sessionId, () => {
    saveSearchSnapshot({
      status: 'completed',
      mediaResults: mediaResults.value,
    });
    onCompleted();
  });
}

// 种子搜索结果
const results = ref<SearchResultWithFilter[]>([]);
const resultCount = ref(0);
const { getLabelClass } = useResourceHelpers();
const {
  pct: searchProgressPct,
  text: searchProgressText,
  start: startSearchProgress,
  stop: stopSearchProgress,
} = useSearchProgress();
const searchSessionId = ref('');
let resultPollToken = 0;
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
// 可选索引器（站点）：空 = 全部当前用户可见站点
const siteOptions = ref<{ label: string; value: string }[]>([]);
const siteDisplayNames = ref<Record<string, string>>({});
const SITE_FILTER_KEY = 'media_search_sites';
const ALL_SITES_VALUE = '__all__';
const SYNCED_DEFAULTS_KEY = 'nexus:search:synced_defaults';

function readSavedSites(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SITE_FILTER_KEY) || '[]');
    const list = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
    return list.includes(ALL_SITES_VALUE) ? [ALL_SITES_VALUE] : list;
  } catch {
    return [];
  }
}

function readSyncedDefaults(): string[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SYNCED_DEFAULTS_KEY) || '[]',
    );
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeSyncedDefaults(sites: string[]) {
  try {
    localStorage.setItem(SYNCED_DEFAULTS_KEY, JSON.stringify(sites));
  } catch {}
}

// 同步初始化，避免可见站点异步返回后覆盖用户刚做的选择
const selectedSites = ref<string[]>(readSavedSites());

function buildSiteFilter(defaultFirst = false): Record<string, any> {
  // 显式选择「全部已授权站点」：传空数组，后端归一为全站
  if (selectedSites.value.includes(ALL_SITES_VALUE)) return { site: [] };
  const selected = selectedSites.value.filter(
    (item) => item !== ALL_SITES_VALUE,
  );
  if (selected.length === 0) {
    return defaultFirst ? { site_default_first: true } : {};
  }
  // 探索/订阅来源：默认站点优先，页面选择作为 fallback；
  // 手动搜索：页面选择直接生效。
  return defaultFirst
    ? { site_default_first: true, site_fallback: selected }
    : { site: selected };
}

/**
 * 探索/订阅跳转：用订阅默认站点更新“搜索站点”。
 * - 内置类型（TV/电影/动漫）：默认站点直接替换搜索站点；
 * - 插件画像：默认站点 + 已手动选择的站点合并，避免丢掉插件专属站点；
 * - 默认未配置时保留当前选择。
 */
async function syncSitesFromSubscriptionDefault(
  mediaType?: string,
  profile?: string,
) {
  if (selectedSites.value.includes(ALL_SITES_VALUE)) return;
  try {
    const mtype = (mediaType || (profile ? 'movie' : 'tv')).trim();
    const res: any = await getDefaultSubscriptionSettingApi(
      mtype,
      profile || undefined,
    );
    const setting = res?.data || res || {};
    const sites = Array.isArray(setting.search_sites)
      ? setting.search_sites.filter(
          (item: any) => typeof item === 'string' && item,
        )
      : [];
    if (sites.length === 0) return;
    const isPluginProfile = Boolean(profile) && profile !== 'default';
    let next = [...sites];
    if (isPluginProfile) {
      const previous = readSyncedDefaults();
      const explicit = selectedSites.value.filter(
        (item) => item !== ALL_SITES_VALUE && !previous.includes(item),
      );
      for (const item of explicit) {
        if (!next.includes(item)) next.push(item);
      }
    }
    suppressSiteAutoRerun = true;
    selectedSites.value = next;
    writeSyncedDefaults(sites);
    await nextTick();
    suppressSiteAutoRerun = false;
  } catch {
    // 默认设置读取失败时保留页面当前选择
  }
}

async function loadVisibleSites() {
  try {
    const res: any = await getVisibleSitesApi();
    const list = Array.isArray(res) ? res : res?.data || [];
    siteOptions.value = list
      .filter((i: any) => (i.permissions || []).includes('search'))
      .map((i: any) => ({
        label: i.display_name || i.name,
        value: i.name,
      }));
    siteDisplayNames.value = Object.fromEntries(
      list.map((i: any) => [i.name, i.display_name || i.name]),
    );
  } catch {
    siteOptions.value = [];
  }
}

// 站点筛选变化：持久化，并在种子结果页自动按新站点重跑搜索
let siteRerunTimer: null | ReturnType<typeof setTimeout> = null;

async function rerunTorrentSearchWithFilters() {
  const payload = lastTorrentRequest.value;
  if (!payload || displayMode.value !== 'torrent') return;
  resultPollToken += 1;
  stopSearchProgress();
  loading.value = true;
  try {
    const baseFilters =
      typeof payload.filters === 'object' && payload.filters
        ? payload.filters
        : {};
    const defaultFirst = Boolean(
      (baseFilters as Record<string, any>).site_default_first,
    );
    const resp: any = await requestTorrentSearch({
      ...payload,
      filters: { ...baseFilters, ...buildSiteFilter(defaultFirst) },
    });
    searchSessionId.value = resp?.session_id || '';
    if (searchSessionId.value)
      sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
    trackSearchProgress(searchSessionId.value, () => {
      sessionStorage.removeItem(SEARCH_SESSION_KEY);
      void loadResultsWhenReady();
    });
  } catch (error: any) {
    loading.value = false;
    notification.error('筛选站点失败', {
      description: error?.message || '未知错误',
    });
  }
}

let suppressSiteAutoRerun = false;

watch(selectedSites, (val, old) => {
  if (val.includes(ALL_SITES_VALUE) && val.length > 1) {
    const addedAll = !old.includes(ALL_SITES_VALUE);
    selectedSites.value = addedAll
      ? [ALL_SITES_VALUE]
      : val.filter((item) => item !== ALL_SITES_VALUE);
    return;
  }
  localStorage.setItem(SITE_FILTER_KEY, JSON.stringify(val));
  if (suppressSiteAutoRerun) return;
  if (displayMode.value !== 'torrent' || !lastTorrentRequest.value) return;
  if (siteRerunTimer) clearTimeout(siteRerunTimer);
  siteRerunTimer = setTimeout(() => {
    siteRerunTimer = null;
    void rerunTorrentSearchWithFilters();
  }, 800);
});

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

/** 清空搜索页状态；从菜单进入时不恢复上次搜索 */
function resetSearchLanding() {
  resultPollToken += 1;
  stopSearchProgress();
  searchSessionId.value = '';
  keyword.value = '';
  mediaResults.value = [];
  results.value = [];
  resultCount.value = 0;
  displayMode.value = 'empty';
  loading.value = false;
  lastTorrentRequest.value = null;
  clearSearchSnapshot();
  try {
    sessionStorage.removeItem(SEARCH_SESSION_KEY);
  } catch {}
}

const metadataProviders = ref<
  Array<{ label: string; profile: string; value: string }>
>([]);
const siteSelectOptions = computed(() => [
  { label: '全部已授权站点', value: ALL_SITES_VALUE },
  ...siteOptions.value,
]);
const baseTypeOptions = computed(() => [
  { label: '全部来源', profile: '', value: '' },
  ...metadataProviders.value,
]);
const pluginSourceOptions = computed(() => getContentProfileSourceOptions());

function normalizeProviderOptionKey(value: string): string {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  if (['content-id', 'content_id', '番号识别'].includes(key))
    return 'content_id';
  return key;
}

const typeOptions = computed(() => {
  // 同一 provider 可能同时来自后端列表和插件画像，且存在大小写/content_id 别名；
  // 统一归一化后合并，避免下拉里出现多个 TMDB、番号识别。
  const merged = new Map<
    string,
    { label: string; profile: string; value: string }
  >();
  for (const item of [...baseTypeOptions.value, ...pluginSourceOptions.value]) {
    const key = normalizeProviderOptionKey(item.value);
    if (!key || key === 'content_id') continue;
    // provider 与画像同名的是聚合入口，不是实际元数据来源，不放进来源下拉。
    if (item.profile && normalizeProviderOptionKey(item.profile) === key)
      continue;
    const previous = merged.get(key);
    if (!previous || (!previous.profile && item.profile)) {
      merged.set(key, {
        ...item,
        value: previous?.value ?? item.value,
      });
    }
  }
  return [...merged.values()];
});
const sourceProfileMap = computed(() =>
  Object.fromEntries(
    typeOptions.value
      .filter((item) => item.profile)
      .map((item) => [item.value, item.profile]),
  ),
);

async function loadMetadataProviders() {
  try {
    const res: any = await getMetadataProvidersApi();
    const list = Array.isArray(res) ? res : res?.data || [];
    metadataProviders.value = list
      .filter(
        (item: any) =>
          Array.isArray(item?.capabilities) &&
          item.capabilities.includes('search'),
      )
      .map((item: any) => ({
        label: String(item.name || item.provider),
        // 插件 provider 也必须在选择后使用自己的 content_profile，
        // 不能因为 visibility=private 被丢弃而回退到 TMDB 搜索。
        profile: String(item.content_profiles?.[0] || ''),
        value: String(item.provider),
      }));
  } catch {
    metadataProviders.value = [];
  }
}

function metadataContentId(item: any): string {
  const extra = item?.extra || {};
  return String(
    Object.entries(extra).find(([key]) => key.endsWith('.content_id'))?.[1] ||
      '',
  );
}

function filterMetadataHits(list: any[], query: string): any[] {
  const keywordUp = query.trim().toUpperCase();
  if (!keywordUp) return list;
  const exact = list.filter(
    (item) =>
      metadataContentId(item).toUpperCase() === keywordUp ||
      String(item.title || '').toUpperCase() === keywordUp,
  );
  return exact.length > 0 ? exact : list;
}

function mapMetadataResults(list: any[]): MediaItem[] {
  const routePoster = String(route.query.poster || '');
  const routeVote = String(route.query.vote || '');
  const routeYear = String(route.query.year || '');
  return list.map((item) => {
    const extra = item.extra || {};
    // 新框架的 content_profile 也用于内建分类（如 anime），只有插件注册的画像才走专属路由。
    const rawProfile = String(item.content_profile || '');
    // 保留后端返回的画像；详情路由是否已注册只影响点击跳转，不能把标签降级成电影。
    const contentProfile =
      rawProfile && rawProfile !== 'default' ? rawProfile : 'default';
    const profile = contentProfile;
    const contentId = metadataContentId(item);
    const searchQuery = String(
      extra.search_query || contentId || item.title || '',
    );
    const anchorProvider = String(
      extra.anchor_provider || item.ref?.provider || 'content_id',
    );
    const anchorExternalId = String(
      extra.anchor_external_id || item.ref?.external_id || contentId || '',
    );
    const studio = String(extra.studio || extra[`${profile}.studio`] || '');
    const isKeywordHit =
      String(item.title || '').toUpperCase() ===
        keyword.value.trim().toUpperCase() ||
      String(contentId || '').toUpperCase() ===
        keyword.value.trim().toUpperCase();
    return {
      content_profile: contentProfile,
      id: String(anchorExternalId || contentId || item.title || ''),
      image: item.poster || (isKeywordHit ? routePoster : ''),
      media_type: item.media_type || 'movie',
      metadata_ref: item.ref
        ? `${item.ref.provider}:${item.ref.external_id}`
        : '',
      overview: item.overview || '',
      poster: item.poster || (isKeywordHit ? routePoster : ''),
      provider: item.ref?.provider || '',
      anchor_provider: anchorProvider,
      anchor_external_id: anchorExternalId,
      search_query: searchQuery,
      studio,
      title: item.title || String(contentId || ''),
      tmdb_id: anchorProvider === 'tmdb' ? anchorExternalId : '',
      type: item.media_type || 'movie',
      vote: item.extra?.rating || (isKeywordHit ? routeVote : ''),
      year: item.year || (isKeywordHit ? routeYear : ''),
      sources: [
        metadataProviderLabel(
          String(item.ref?.provider || item.provider || ''),
        ),
      ].filter(Boolean),
      score: Number(item.score || 0),
    };
  });
}

/** 普通搜索：搜索媒体词条 */
function handleSourceTypeChange(value: string) {
  searchtype.value = value;
  if (keyword.value.trim()) handleSearch();
}

/** 解析当前来源对应的内容画像；不能用 provider 名回退成媒体搜索。 */
function resolveSearchTarget() {
  const profilePinned = Boolean(
    contentProfileKey.value && profileSources.value.length > 0,
  );
  const activeProvider = String(
    (profilePinned ? metadataSource.value : searchtype.value) || '',
  );
  const selectedOption = typeOptions.value.find(
    (item) => item.value === activeProvider,
  );
  const sourceProfile =
    (profilePinned ? contentProfileKey.value : '') ||
    selectedOption?.profile ||
    sourceProfileMap.value[activeProvider] ||
    '';
  return { activeProvider, sourceProfile };
}

async function handleSearch() {
  if (!keyword.value.trim()) return;
  // 取消上一个搜索的结果轮询，避免旧资源结果覆盖当前影视搜索。
  resultPollToken += 1;
  stopSearchProgress();
  displayMode.value = 'media';
  mediaResults.value = [];
  loading.value = true;
  saveSearchSnapshot({
    keyword: keyword.value,
    mediaResults: [],
    metadataSource: metadataSource.value,
    searchtype: searchtype.value,
    sessionId: '',
    status: 'running',
  });
  try {
    const { activeProvider, sourceProfile } = resolveSearchTarget();
    // 全部来源也走统一的多元数据框架，由后端聚合所有已注册 provider。
    const res: any = await searchMetadataApi({
      content_profile: sourceProfile || undefined,
      limit: 24,
      ...(activeProvider ? { provider: activeProvider } : {}),
      query: keyword.value,
    });
    const list = Array.isArray(res) ? res : res?.data || [];
    const mapped = mapMetadataResults(filterMetadataHits(list, keyword.value));
    mediaResults.value = activeProvider ? mapped : mergeMetadataResults(mapped);
    saveSearchSnapshot({
      status: 'completed',
      mediaResults: mediaResults.value,
    });
  } catch (error: any) {
    saveSearchSnapshot({ status: 'idle', mediaResults: [] });
    notification.error('搜索失败', {
      description: error?.message || '未知错误',
    });
  } finally {
    loading.value = false;
  }
}

/** 点击媒体卡片 → 进入媒体详情 */
function effectiveContentProfile(item: any): string {
  const profile = String(item?.content_profile || '').trim();
  if (profile && profile !== 'default') return profile;
  const source = String(
    item?.provider ||
      item?.anchor_provider ||
      String(item?.metadata_ref || '').split(':')[0] ||
      '',
  );
  return getContentProfileForSource(source);
}

function handleMediaCardClick(media: MediaItem) {
  const anchorProvider = String(
    (media as any).anchor_provider || media.provider || '',
  );
  const anchorExternal = String(
    (media as any).anchor_external_id ||
      (media as any).douban_id ||
      String(media.metadata_ref || '').split(':')[1] ||
      '',
  );
  // 插件内容画像必须先走插件注册的详情路由，不能被通用 provider 分支截走。
  const profile = effectiveContentProfile(media);
  if (profile) {
    const detailPath = getContentProfileDetailPath(profile);
    if (!detailPath) return;
    const params = new URLSearchParams({
      id: String(media.id),
      profile,
      ...(anchorProvider ? { provider: anchorProvider } : {}),
      ...(anchorExternal ? { ref: anchorExternal } : {}),
      ...(media.metadata_ref ? { metadata_ref: media.metadata_ref } : {}),
    });
    router.push(`${detailPath}?${params.toString()}`);
    return;
  }
  // 所有普通 provider（含 TMDB）统一走 provider+ref 详情，不再把 TMDB 当默认。
  if (anchorProvider && anchorExternal) {
    router.push({
      name: 'MediaDetail',
      query: {
        provider: anchorProvider,
        ref: anchorExternal,
        type: normalizeMediaType(media.media_type || media.type),
      },
    });
    return;
  }
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
  resultPollToken += 1;
  stopSearchProgress();
  if (media.content_profile && media.content_profile !== 'default') {
    const code = String(media.search_query || media.id || media.title || '');
    const query: Record<string, string> = {
      s: code,
      from: 'subscription',
      media_type: 'movie',
      content_profile: media.content_profile,
      metadata_source: media.provider || metadataSource.value,
      anchor_provider: media.anchor_provider || media.provider || 'content_id',
      anchor_external_id: media.anchor_external_id || code,
    };
    if (media.poster) query.poster = media.poster;
    if (media.vote) query.vote = String(media.vote);
    if (media.year) query.year = String(media.year);
    // 已经在搜索页时，router.push 相同 query 不会触发 watch；
    // 这里直接发起资源搜索，保证按钮一定有反馈。
    displayMode.value = 'torrent';
    mediaResults.value = [];
    results.value = [];
    loading.value = true;
    requestTorrentSearch({
      filters: {
        ...buildSiteFilter(),
        content_profile: media.content_profile,
        ...(query.metadata_source
          ? { metadata_source: query.metadata_source }
          : {}),
      },
      search_word: code,
      media_type: 'movie',
      anchor_provider: query.anchor_provider,
      anchor_external_id: query.anchor_external_id,
    })
      .then((resp: any) => {
        searchSessionId.value = resp?.session_id || '';
        if (searchSessionId.value)
          sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
        trackSearchProgress(searchSessionId.value, () => {
          sessionStorage.removeItem(SEARCH_SESSION_KEY);
          void loadResultsWhenReady();
        });
      })
      .catch(() => {
        loading.value = false;
        sessionStorage.removeItem(SEARCH_SESSION_KEY);
      });
    return;
  }
  displayMode.value = 'torrent';
  loading.value = true;
  setSearchKeyword(media.title);
  try {
    const raw: any = media as any;
    const metadataRef = String(raw.metadata_ref || '').trim();
    let anchorProvider = String(
      raw.anchor_provider || raw.provider || '',
    ).trim();
    let anchorExternalId = String(raw.anchor_external_id || '').trim();
    if (!anchorProvider && metadataRef.includes(':')) {
      const [provider, ...rest] = metadataRef.split(':');
      anchorProvider = String(provider || '');
      anchorExternalId = anchorExternalId || rest.join(':');
    }
    // 没有显式 provider 时不猜测 TMDB；让后端按标题/类型识别。
    const resp: any = await requestTorrentSearch({
      filters: buildSiteFilter(),
      search_word: media.title,
      metadata_ref: metadataRef || undefined,
      anchor_provider: anchorProvider || undefined,
      anchor_external_id: anchorExternalId || undefined,
      content_profile: raw.content_profile,
      media_type: media.type || media.media_type || '',
    });
    searchSessionId.value = resp?.session_id || '';
    if (searchSessionId.value)
      sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
    trackSearchProgress(resp?.session_id || '', () => {
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

function openResultDetail(item: SearchResult) {
  if (item.content_profile && item.content_profile !== 'default') {
    const detailPath = getContentProfileDetailPath(item.content_profile);
    if (!detailPath) return;
    const contentProvider = String(
      item.anchor_provider || item.provider || '',
    ).trim();
    const contentExternal = String(item.anchor_external_id || '').trim();
    const params = new URLSearchParams({
      id: item.title,
      profile: item.content_profile,
      ...(contentProvider ? { provider: contentProvider } : {}),
      ...(contentExternal ? { ref: contentExternal } : {}),
      ...(item.metadata_ref ? { metadata_ref: item.metadata_ref } : {}),
    });
    router.push(`${detailPath}?${params.toString()}`);
    return;
  }
  const provider = String(item.anchor_provider || item.provider || '').trim();
  const external = String(item.anchor_external_id || '').trim();
  if (provider && external) {
    router.push({
      name: 'MediaDetail',
      query: {
        provider,
        ref: external,
        type: item.type_key || (item.type === 'movie' ? 'movie' : 'tv'),
        ...(item.content_profile ? { profile: item.content_profile } : {}),
      },
    });
    return;
  }
  if (item.tmdbid && item.tmdbid !== '0') {
    router.push({
      name: 'MediaDetail',
      query: {
        id: item.tmdbid,
        type: item.type_key || (item.type === 'movie' ? 'movie' : 'tv'),
      },
    });
  }
}

function handleMediaCardSubscribe(media: MediaItem) {
  if (media.content_profile && media.content_profile !== 'default') {
    handleResultSubscribe(media as unknown as SearchResult);
    return;
  }
  handleMediaSubscribe(media);
}

async function handleResultSubscribe(item: SearchResult) {
  if (!item.content_profile || item.content_profile === 'default') {
    return;
  }
  const code = String(
    (item as any).anchor_external_id || (item as any).id || item.title || '',
  ).trim();
  const preferredProvider =
    item.provider ||
    getContentProfileDefaultSearchSource(item.content_profile) ||
    metadataSource.value ||
    '';
  let metadataRef = item.metadata_ref;
  let metadataTitle = item.title;
  try {
    if (!metadataRef || metadataRef.startsWith('tmdb:')) {
      const res: any = await searchMetadataApi({
        content_profile: item.content_profile,
        limit: 1,
        provider: preferredProvider || undefined,
        query: code,
      });
      const list = Array.isArray(res) ? res : res?.data || [];
      const hit = list.find(
        (entry: any) => entry?.ref?.external_id || entry?.external_id,
      );
      if (hit) {
        const provider = hit.ref?.provider || hit.provider || preferredProvider;
        const externalId = String(
          hit.ref?.external_id || hit.external_id || '',
        );
        metadataRef = `${provider}:${externalId}`;
        metadataTitle = hit.title || metadataTitle;
      }
    }
    subscribeConfirmItem.value = {
      id: code,
      mediaid: `content_id:${code}`,
      title: metadataTitle,
      year: item.year || '',
      type: 'movie',
      image: item.poster,
      overview: item.overview,
      content_profile: item.content_profile,
      metadata_ref: metadataRef,
      provider: preferredProvider,
      anchor_provider: 'content_id',
      anchor_external_id: code,
    };
    subscribeConfirmShow.value = true;
  } catch (error: any) {
    notification.error('订阅失败', {
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
    const resp: any = await requestTorrentSearch({
      filters: buildSiteFilter(),
      search_word: advancedForm.value.name,
      tmdbid: '',
      media_type: advancedForm.value.type,
    });
    searchSessionId.value = resp?.session_id || '';
    if (searchSessionId.value)
      sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
    trackSearchProgress(resp?.session_id || '', () => {
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

function activeSearchProfile(item?: any): string {
  return String(
    item?.content_profile ||
      route.query.content_profile ||
      contentProfileKey.value ||
      sourceProfileMap.value[searchtype.value] ||
      '',
  ).trim();
}

function withRoutePoster(item: any) {
  const profile = activeSearchProfile(item);
  const raw = String(route.query.poster || '').trim();
  if (!raw) return { ...item, content_profile: profile };
  const poster = raw.startsWith('/img')
    ? raw
    : `/img?url=${encodeURIComponent(raw)}`;
  const vote = String(route.query.vote || '').trim();
  const year = String(route.query.year || '').trim();
  const itemVote = String(item.vote || '').trim();
  const hasVote = itemVote && itemVote !== '0' && itemVote !== '0.0';
  const base = {
    ...item,
    backdrop: item.backdrop || poster,
    image: item.image || poster,
    poster: item.poster || poster,
    vote: hasVote ? item.vote : vote,
    year: item.year || year,
    content_profile: profile,
    metadata_ref: String(route.query.metadata_ref || ''),
    provider: String(route.query.metadata_source || ''),
  };
  if (!profile) return base;
  // 自定义画像按单片展示，避免出现 S01 季分组
  return {
    ...base,
    filter: { ...base.filter, season: [], episode: [] },
    torrent_dict: (base.torrent_dict || []).map(
      ([, dict]: [string, any]) => ['movie', dict] as [string, any],
    ),
    type: 'movie',
    type_key: 'movie',
  };
}

const overviewTitleCache = new Map<string, string>();

/** 插件来源结果没有 POSTER 时，用当前画像 provider 补一张元数据海报 */
async function enrichResultPoster(items: any[]) {
  if (items.length === 0 || items.some((item) => item.poster)) return;
  const profile = activeSearchProfile(items[0]);
  if (!profile || profile === 'default') return;
  const provider = String(
    route.query.metadata_source || metadataSource.value || '',
  ).trim();
  try {
    const res: any = await searchMetadataApi({
      content_profile: profile,
      limit: 1,
      provider: provider || undefined,
      query: keyword.value,
    });
    const hit = (Array.isArray(res) ? res : res?.data || [])[0];
    const poster = String(hit?.poster || '').trim();
    if (!poster) return;
    for (const item of items) {
      item.poster = item.poster || poster;
      item.image = item.image || poster;
      item.backdrop = item.backdrop || poster;
    }
  } catch {
    // 海报补充失败不影响资源列表
  }
}

async function fillResultOverviews(items: any[]) {
  const groups = new Map<
    string,
    { code: string; items: any[]; profile: string }
  >();
  for (const item of items) {
    if (String(item.overview || '').trim()) continue;
    const profile = String(
      item.content_profile || contentProfileKey.value || '',
    );
    if (getContentProfileOverviewFallback(profile) !== 'title') continue;
    const code = String(item.title || '').trim();
    if (!code) continue;
    const key = `${profile}:${code}`;
    const group = groups.get(key) || { code, items: [], profile };
    group.items.push(item);
    groups.set(key, group);
  }
  await Promise.all(
    [...groups.entries()].map(async ([key, group]) => {
      let title = overviewTitleCache.get(key) || '';
      if (!title) {
        try {
          const res: any = await searchMetadataApi({
            content_profile: group.profile,
            limit: 10,
            provider:
              group.items[0]?.provider ||
              getContentProfileDefaultSearchSource(group.profile) ||
              undefined,
            query: group.code,
          });
          const hits = Array.isArray(res) ? res : res?.data || [];
          const code = group.code.toUpperCase();
          const hit =
            hits.find((entry: any) =>
              String(entry?.title || '')
                .trim()
                .toUpperCase()
                .startsWith(code),
            ) ||
            hits.find((entry: any) =>
              String(entry?.title || '')
                .toUpperCase()
                .includes(code),
            );
          title = String(hit?.title || '').trim();
          if (title) overviewTitleCache.set(key, title);
        } catch {
          title = '';
        }
      }
      if (title) {
        for (const item of group.items) item.overview = title;
      }
    }),
  );
}

function resultOverview(item: any): string {
  return String(item.overview || '').trim() || '暂无简介';
}

async function loadSearchResults(keepLoading = false, token?: number) {
  if (token !== undefined && token !== resultPollToken) return;
  loading.value = true;
  results.value = [];
  try {
    const res: any = await getSearchResultApi(
      searchSessionId.value || undefined,
    );
    if (token !== undefined && token !== resultPollToken) return;
    const searchData = res?.result || {};
    if (typeof searchData === 'object') {
      results.value = Object.entries(searchData)
        .map(([, item]: [string, any]) => {
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
            content_profile: item.content_profile,
            metadata_ref: item.metadata_ref,
            provider: item.provider,
            anchor_provider: item.anchor_provider,
            anchor_external_id: item.anchor_external_id,
            identity_id: item.identity_id,
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
              resolution: [],
            },
          };
        })
        .map(withRoutePoster);
      await enrichResultPoster(results.value);
      void fillResultOverviews(results.value);
      // 卡片搜索是按条目搜索：只保留卡片对应年份，避免 studio 搜索带出其他年份
      const targetYear = String(route.query.year || '').trim();
      if (route.query.from === 'subscription' && targetYear) {
        results.value = results.value.filter(
          (item: any) => !item.year || String(item.year) === targetYear,
        );
      }
      resultCount.value =
        results.value.length !== Object.keys(searchData).length
          ? results.value.length
          : res?.total || results.value.length;
      if (results.value.length > 0) {
        displayMode.value = 'torrent';
      }
    }
  } finally {
    if (!keepLoading) loading.value = false;
  }
}

async function loadResultsWhenReady() {
  // 搜索尚未写库时保持加载态，不能每轮轮询都闪一次“未找到”。
  const token = ++resultPollToken;
  loading.value = true;
  try {
    for (let i = 0; i < 20; i += 1) {
      if (token !== resultPollToken) return;
      await loadSearchResults(true, token);
      if (token !== resultPollToken) return;
      if (results.value.length > 0 || !keyword.value) return;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } finally {
    if (token === resultPollToken) loading.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleSearch();
  }
}

// 防止 onMounted 与 watch 对同一次路由跳转重复触发搜索
let lastHandledQueryKey = '';

function routeQueryKey(q: Record<string, any>): string {
  return [
    q.s,
    q.from,
    q.session_id,
    q.tmdbid,
    q.content_profile,
    q.metadata_source,
    q.anchor_provider,
    q.anchor_external_id,
    q.metadata_ref,
  ].join('|');
}

onMounted(() => {
  void loadMetadataProviders();
  loadVisibleSites();
  startSSE();
  const snapshot = readSearchSnapshot();
  const initialS = String(route.query.s || '');
  lastHandledQueryKey = routeQueryKey(route.query);
  // 切页回来：优先恢复上次搜索（结果/进度），不重新发起
  if (!initialS) {
    if (snapshot?.keyword) {
      restoreSearchSnapshot(snapshot);
      return;
    }
    resetSearchLanding();
    return;
  }

  const s = initialS;
  const from = route.query.from as string;
  const sid = route.query.session_id as string;
  if (
    snapshot &&
    snapshot.keyword === s &&
    (!sid || snapshot.sessionId === sid) &&
    (snapshot.sessionId || (snapshot.mediaResults?.length ?? 0) > 0)
  ) {
    restoreSearchSnapshot(snapshot);
    return;
  }

  resultPollToken += 1;
  stopSearchProgress();

  applyIncomingSource(String(route.query.metadata_source || ''));
  if (sid) searchSessionId.value = sid;

  if (s) {
    setSearchKeyword(s);
    // 探索/详情/订阅已带 session_id → 只连 SSE 等结果，不重复搜索
    if (
      sid &&
      (from === 'discovery' || from === 'detail' || from === 'subscription')
    ) {
      const queryProfile = String(route.query.content_profile || '');
      const defaultFirst = from === 'discovery' || from === 'subscription';
      lastTorrentRequest.value = {
        search_word: s,
        tmdbid: String(route.query.tmdbid || '') || undefined,
        media_type: String(route.query.media_type || '') || undefined,
        anchor_provider: String(route.query.anchor_provider || '') || undefined,
        anchor_external_id:
          String(route.query.anchor_external_id || '') || undefined,
        metadata_ref: String(route.query.metadata_ref || '') || undefined,
        filters: {
          ...buildSiteFilter(defaultFirst),
          ...(queryProfile ? { content_profile: queryProfile } : {}),
        },
      };
      saveSearchSnapshot({ torrentRequest: lastTorrentRequest.value });
      displayMode.value = 'torrent';
      loading.value = true;
      if (sid) sessionStorage.setItem(SEARCH_SESSION_KEY, sid);
      trackSearchProgress(sid, () => {
        sessionStorage.removeItem(SEARCH_SESSION_KEY);
        void loadResultsWhenReady();
      });
    } else if (
      from === 'discovery' ||
      from === 'detail' ||
      from === 'subscription'
    ) {
      const tmdbId = (route.query.tmdbid as string) || '';
      const mediaType = (route.query.media_type as string) || '';
      const defaultFirst = from === 'discovery' || from === 'subscription';
      const startSearch = async () => {
        if (defaultFirst) {
          await syncSitesFromSubscriptionDefault(
            mediaType,
            contentProfileKey.value,
          );
        }
        return requestTorrentSearch({
          filters: {
            ...buildSiteFilter(defaultFirst),
            ...(contentProfileKey.value
              ? { content_profile: contentProfileKey.value }
              : {}),
            ...(String(route.query.metadata_source || '')
              ? { metadata_source: String(route.query.metadata_source) }
              : {}),
          },
          search_word: s,
          tmdbid: tmdbId,
          media_type: mediaType,
          anchor_provider:
            String(route.query.anchor_provider || '') || undefined,
          anchor_external_id:
            String(route.query.anchor_external_id || '') || undefined,
          metadata_ref: String(route.query.metadata_ref || '') || undefined,
        });
      };
      displayMode.value = 'torrent';
      loading.value = true;
      void startSearch()
        .then((resp: any) => {
          searchSessionId.value = resp?.session_id || '';
          if (searchSessionId.value)
            sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
          trackSearchProgress(resp?.session_id || '', () => {
            sessionStorage.removeItem(SEARCH_SESSION_KEY);
            void loadResultsWhenReady();
          });
        })
        .catch(() => {
          loading.value = false;
          sessionStorage.removeItem(SEARCH_SESSION_KEY);
        });
    } else if (from === 'profile-search') {
      displayMode.value = 'media';
      handleSearch();
    } else if (from === 'global-search' || !from) {
      handleSearch();
    } else {
      displayMode.value = 'torrent';
      results.value = [];
      loading.value = true;
      requestTorrentSearch({ filters: buildSiteFilter(), search_word: s })
        .then((resp: any) => {
          searchSessionId.value = resp?.session_id || '';
          if (searchSessionId.value)
            sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
          trackSearchProgress(resp?.session_id || '', () => {
            sessionStorage.removeItem(SEARCH_SESSION_KEY);
            void loadResultsWhenReady();
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
  }
});
// 探索/详情页跳转时组件复用，onMounted 不重跑 → watch 补救
watch(
  () => route.query,
  (q) => {
    const queryKey = routeQueryKey(q);
    if (queryKey === lastHandledQueryKey) return;
    lastHandledQueryKey = queryKey;
    resultPollToken += 1;
    stopSearchProgress();
    const incomingSource = String(q.metadata_source || '').trim();
    if (incomingSource) {
      applyIncomingSource(incomingSource);
    } else if (q.content_profile) {
      metadataSource.value = getContentProfileDefaultSearchSource(
        String(q.content_profile),
      );
    }
    const s = q.s as string;
    const from = q.from as string;
    const sid = String(q.session_id || '');
    const tmdbId = (q.tmdbid as string) || '';
    const mediaType = (q.media_type as string) || '';
    const snapshot = readSearchSnapshot();
    if (!s) {
      if (snapshot?.keyword) {
        restoreSearchSnapshot(snapshot);
        return;
      }
      resetSearchLanding();
      return;
    }
    if (
      snapshot &&
      snapshot.keyword === s &&
      (!sid || snapshot.sessionId === sid) &&
      (snapshot.sessionId || (snapshot.mediaResults?.length ?? 0) > 0)
    ) {
      restoreSearchSnapshot(snapshot);
      return;
    }
    setSearchKeyword(s);
    if (from === 'discovery' || from === 'detail' || from === 'subscription') {
      displayMode.value = 'torrent';
      loading.value = true;
      const profile = String(q.content_profile || '').trim();
      const defaultFirst = from === 'discovery' || from === 'subscription';
      const startSearch = async () => {
        if (defaultFirst) {
          await syncSitesFromSubscriptionDefault(mediaType, profile);
        }
        return requestTorrentSearch({
          filters: {
            ...buildSiteFilter(defaultFirst),
            ...(profile ? { content_profile: profile } : {}),
            ...(String(q.metadata_source || '')
              ? { metadata_source: String(q.metadata_source) }
              : {}),
          },
          search_word: s,
          tmdbid: tmdbId,
          media_type: mediaType,
          anchor_provider: String(q.anchor_provider || '') || undefined,
          anchor_external_id: String(q.anchor_external_id || '') || undefined,
          metadata_ref: String(q.metadata_ref || '') || undefined,
        });
      };
      void startSearch()
        .then((resp: any) => {
          searchSessionId.value = resp?.session_id || '';
          if (searchSessionId.value)
            sessionStorage.setItem(SEARCH_SESSION_KEY, searchSessionId.value);
          trackSearchProgress(resp?.session_id || '', () => {
            sessionStorage.removeItem(SEARCH_SESSION_KEY);
            void loadResultsWhenReady();
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
  if (siteRerunTimer) {
    clearTimeout(siteRerunTimer);
    siteRerunTimer = null;
  }
  // 只断开 SSE 连接，保留快照用于页面切回时恢复（结果 + 运行中进度）
  if (displayMode.value === 'media') {
    saveSearchSnapshot({ mediaResults: mediaResults.value });
  } else {
    saveSearchSnapshot();
  }
  stopSearchProgress();
  stopSSE();
});

function getTypeColor(type: string) {
  if (type === 'movie') return 'success';
  if (type === 'anime') return 'warning';
  return 'info';
}

function getMediaTypeLabel(type?: string, profile?: string) {
  if (profile && profile !== 'default') {
    return getContentProfileLabel(profile) || profile.toUpperCase();
  }
  const map: Record<string, string> = {
    movie: '电影',
    tv: '电视剧',
    anime: '动漫',
  };
  return (type && map[type]) || '未知';
}

const METADATA_PROVIDER_LABELS: Record<string, string> = {
  bangumi: 'Bangumi',
  douban: '豆瓣',
  tmdb: 'TMDB',
};

function metadataProviderLabel(provider?: string) {
  const key = String(provider || '').trim();
  if (!key) return '';
  return METADATA_PROVIDER_LABELS[key] || key.toUpperCase();
}

function mediaSourceLabel(media: MediaItem) {
  if (media.sources && media.sources.length > 0) {
    return media.sources.join(' / ');
  }
  return mediaProviderSource(media);
}

function mediaProviderSource(media: MediaItem) {
  return metadataProviderLabel(media.provider || media.anchor_provider);
}

function mediaTypeFamily(type?: string) {
  if (type === 'movie') return 'movie';
  if (type === 'anime' || type === 'tv') return 'series';
  return 'unknown';
}

function mediaTypeRank(type?: string) {
  if (type === 'anime') return 0;
  if (type === 'tv') return 1;
  if (type === 'movie') return 2;
  return 3;
}

/** 全部来源下同一作品可能命中多个 provider：按标题+年份+类型族合并，优先动漫。 */
function mergeMetadataResults(items: MediaItem[]): MediaItem[] {
  const order: string[] = [];
  const buckets = new Map<string, MediaItem[]>();
  for (const item of items) {
    const titleKey = String(item.title || '')
      .trim()
      .toLowerCase();
    const family = mediaTypeFamily(item.media_type || item.type);
    const key = titleKey ? `${titleKey}|${family}` : `__${order.length}`;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
      order.push(key);
    }
    const itemYear = String(item.year || '');
    // 同标题同类型族合并；年份都已知且不同才视为不同作品
    const target = list.find((entry) => {
      const entryYear = String(entry.year || '');
      return !entryYear || !itemYear || entryYear === itemYear;
    });
    if (!target) {
      list.push({ ...item, sources: [...(item.sources || [])] });
      continue;
    }
    const index = list.indexOf(target);
    const currentRank = mediaTypeRank(target.media_type || target.type);
    const itemRank = mediaTypeRank(item.media_type || item.type);
    let keep = target;
    let other = item;
    if (
      itemRank < currentRank ||
      (itemRank === currentRank && (item.score || 0) > (target.score || 0))
    ) {
      keep = item;
      other = target;
    }
    list[index] = {
      ...keep,
      image: keep.image || other.image,
      overview: keep.overview || other.overview,
      poster: keep.poster || other.poster,
      sources: Array.from(
        new Set([
          ...(target.sources || []),
          ...(item.sources || []),
          mediaProviderSource(item),
          mediaProviderSource(target),
        ]),
      ).filter(Boolean),
      year: String(keep.year || other.year || ''),
    };
  }
  return order.flatMap((key) => buckets.get(key) || []);
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
      resolution: [],
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
    af.video.length ||
    af.resolution.length;
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
            if (
              af.resolution.length > 0 &&
              !af.resolution.includes(t.respix || '')
            )
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

function formatSeasonLabel(key: string, mediaType?: string): string {
  if (key && key !== 'movie') return key;
  if (['anime', 'tv'].includes(String(mediaType || '').toLowerCase())) {
    return '全部集数';
  }
  return '';
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
          v-if="contentProfileKey && profileSources.length > 0"
          v-model:value="metadataSource"
          :options="profileSources"
          class="search-select"
        />
        <NSelect
          v-else
          v-model:value="searchtype"
          :options="typeOptions"
          class="search-select"
          @update:value="handleSourceTypeChange"
        />
        <NSelect
          v-model:value="selectedSites"
          :options="siteSelectOptions"
          :placeholder="siteOptions.length > 0 ? '默认搜索站点' : '无可用站点'"
          :disabled="siteOptions.length === 0"
          multiple
          clearable
          filterable
          :max-tag-count="1"
          class="search-select site-select"
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
              <MediaPoster
                :src="media.image || media.poster"
                :content-profile="effectiveContentProfile(media)"
                class="w-full h-full"
                alt=""
              />
            </div>
            <span
              v-if="media.media_type || media.type || media.content_profile"
              class="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded"
              :style="{
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
              }"
            >
              {{
                getMediaTypeLabel(
                  media.media_type || media.type,
                  effectiveContentProfile(media),
                )
              }}
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
                <span
                  v-if="mediaSourceLabel(media)"
                  class="truncate rounded bg-white/20 px-1 py-0.5 text-[10px] leading-none"
                >
                  {{ mediaSourceLabel(media) }}
                </span>
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
                v-if="
                  media.content_profile &&
                  media.content_profile !== 'default' &&
                  media.fav !== '1'
                "
                size="small"
                round
                style="color: #fff; border-color: #fff"
                ghost
                @click.stop="handleMediaCardSubscribe(media)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:heart" />
                </template>
                订阅
              </NButton>
              <NButton
                v-else-if="
                  media.content_profile &&
                  media.content_profile !== 'default' &&
                  media.fav === '1'
                "
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
              <NButton
                v-else-if="media.fav !== '1'"
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

      <!-- 搜索结果 -->
      <div>
        <div v-if="results.length > 0" class="result-list">
          <div v-for="item in results" :key="item.key" class="result-card">
            <!-- 左栏：海报 + 信息 -->
            <div class="result-left">
              <div
                v-if="item.poster"
                class="result-poster"
                @click="openResultDetail(item)"
              >
                <MediaPoster
                  :src="item.poster"
                  :content-profile="item.content_profile"
                  class="result-poster-img"
                  alt=""
                />
                <div
                  v-if="item.type_key || item.content_profile"
                  class="result-poster-tag"
                >
                  <NTag
                    :type="getTypeColor(item.type_key || '')"
                    size="small"
                    round
                  >
                    {{ getMediaTypeLabel(item.type_key, item.content_profile) }}
                  </NTag>
                </div>
                <div v-if="item.fav === '2'" class="result-poster-fav">
                  <IconifyIcon icon="lucide:check" class="size-3" />
                </div>
              </div>
              <div class="result-info">
                <h2 class="result-title">
                  <a
                    v-if="itemLink(item)"
                    :href="itemLink(item)"
                    target="_blank"
                    class="result-title-link"
                    >{{ item.title }}</a
                  >
                  <span v-else>{{ item.title || keyword }}</span>
                  <span v-if="item.year" class="result-year"
                    >({{ item.year }})</span
                  >
                </h2>
                <div
                  v-if="itemLinks(item).length > 1"
                  class="result-sources"
                  style="display: flex; gap: 0.5rem; margin-top: 0.15rem"
                >
                  <a
                    v-for="source in itemLinks(item)"
                    :key="source.url"
                    :href="source.url"
                    target="_blank"
                    rel="noopener"
                    style="
                      font-size: 0.72rem;
                      color: hsl(var(--primary));
                      text-decoration: underline;
                    "
                    >{{ source.label }}</a
                  >
                </div>
                <div class="result-meta">
                  <span v-if="item.vote" class="result-rating">
                    <IconifyIcon icon="lucide:star" class="size-4" />{{
                      item.vote
                    }}
                  </span>
                  <template
                    v-if="
                      !item.content_profile &&
                      (item.type_key || item.filter?.season?.length)
                    "
                  >
                    <span v-if="getMediaStatSeasonCount(item) > 0"
                      >{{ getMediaStatSeasonCount(item) }} 季</span
                    >
                  </template>
                </div>
                <div class="result-meta">
                  <span
                    v-if="
                      (item.tmdbid && item.tmdbid !== '0') ||
                      (item.content_profile &&
                        item.content_profile !== 'default')
                    "
                    class="result-sub-badge"
                    :class="{ subbed: item.fav === '1' }"
                    @click="
                      (e) =>
                        item.content_profile &&
                        item.content_profile !== 'default'
                          ? handleResultSubscribe(item)
                          : handleSubscribe(item, e)
                    "
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
                <p class="result-overview">{{ resultOverview(item) }}</p>
                <div class="result-stats">
                  <div class="result-stat">
                    <div class="stat-num">{{ totalTorrentCount(item) }}</div>
                    <div class="stat-lbl">种子</div>
                  </div>
                  <div class="result-stat">
                    <div class="stat-num">{{ getMediaStatSites(item) }}</div>
                    <div class="stat-lbl">有结果站点</div>
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
                <div
                  v-if="
                    item.filter.resolution && item.filter.resolution.length > 0
                  "
                  class="filter-fd"
                  :class="{ open: filterDropOpen[`${item.key}-resolution`] }"
                >
                  <button
                    class="filter-fd-btn"
                    :class="{ has: item.activeFilters.resolution.length > 0 }"
                    @click.stop="toggleFilterDrop(`${item.key}-resolution`)"
                  >
                    <span class="ffd-label">分辨率</span>
                    <span class="ffd-val">{{
                      item.activeFilters.resolution.length > 0
                        ? item.activeFilters.resolution.join(', ')
                        : '全部'
                    }}</span>
                    <span class="ffd-arr">▼</span>
                    <div class="ffd-drop">
                      <button
                        v-for="r in item.filter.resolution"
                        :key="r"
                        :class="{ sel: isFilterActive(item, 'resolution', r) }"
                        @click="toggleFilter(item, 'resolution', r)"
                      >
                        {{ r }}
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
                  <tbody
                    v-for="seTuple in filteredTorrentDict(item)"
                    :key="seTuple[0]"
                    class="season-table-block"
                  >
                    <tr
                      v-if="
                        ['anime', 'tv'].includes(
                          String(item.type || '').toLowerCase(),
                        ) || seTuple[0] !== 'movie'
                      "
                      class="season-row"
                      @click="toggleSeasonCollapse(`${item.key}-${seTuple[0]}`)"
                    >
                      <td colspan="6">
                        <div class="season-table-header">
                          <IconifyIcon
                            :icon="
                              seasonCollapsed[`${item.key}-${seTuple[0]}`]
                                ? 'lucide:chevron-right'
                                : 'lucide:chevron-down'
                            "
                            class="size-4"
                          />
                          {{ formatSeasonLabel(seTuple[0], item.type) }}
                          <span class="season-table-count">
                            {{ getSeasonTorrents(seTuple[1]).length }} 条
                          </span>
                        </div>
                      </td>
                    </tr>
                    <template
                      v-if="!seasonCollapsed[`${item.key}-${seTuple[0]}`]"
                    >
                      <tr
                        v-for="torrent in getSeasonTorrents(seTuple[1])"
                        :key="torrent.id"
                        class="torrent-tr"
                      >
                        <td>
                          <span class="td-site">
                            {{ siteDisplayNames[torrent.site] || torrent.site }}
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
                            >
                              {{ torrent.video_encode }}
                            </span>
                            <span v-if="torrent.restype" class="tag tag-type">
                              {{ torrent.restype }}
                            </span>
                            <span
                              v-if="torrent.reseffect"
                              class="tag tag-effect"
                            >
                              {{ torrent.reseffect }}
                            </span>
                            <span
                              v-if="
                                torrent.releasegroup &&
                                torrent.releasegroup !== '未知'
                              "
                              class="tag tag-group"
                            >
                              {{ torrent.releasegroup }}
                            </span>
                          </div>
                          <div v-if="torrent.labels?.length" class="td-labels">
                            <span
                              v-for="label in torrent.labels.filter((l) =>
                                l.trim(),
                              )"
                              :key="label"
                              class="resource-tag"
                              :class="getLabelClass(label)"
                            >
                              {{ label }}
                            </span>
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
                          >
                            {{
                              getFreeBadgeText(
                                torrent.uploadvalue,
                                torrent.downloadvalue,
                              )
                            }}
                          </span>
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
                              @click="handleTorrentDropdown(torrent, 'pageurl')"
                            >
                              详情
                            </button>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
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
  width: 220px;
  padding: 1rem 0.875rem;
  background: hsl(var(--accent) / 35%);
  border-right: 1px solid hsl(var(--border));
}

.result-poster {
  position: relative;
  width: 112px;
  aspect-ratio: 2/3;
  margin: 0 auto 0.5rem;
  overflow: hidden;
  cursor: pointer;
  border-radius: var(--radius);
  box-shadow: none;
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
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
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
  padding: 0.875rem 1rem;
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
  gap: 0.5rem;
}

.season-table-block {
  width: 100%;
}

.season-row td {
  padding: 0;
  background: hsl(var(--accent) / 35%);
  border-bottom: 1px solid hsl(var(--border) / 40%);
}

.season-row .season-table-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.season-table-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0.625rem;
  margin-bottom: 0;
  font-size: 0.75rem;
  font-weight: 600;
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
  border: 0;
  border-radius: var(--radius);
}

.torrent-table thead th {
  padding: 0.5rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-align: left;
  letter-spacing: 0;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border-bottom: 1px solid hsl(var(--border));
}

.torrent-table thead th:hover {
  color: hsl(var(--foreground));
}

.th-site {
  width: 96px;
}

.th-num {
  width: 56px;
}

.th-act {
  width: 104px;
}

.torrent-tr td {
  padding: 0.625rem 0.5rem;
  font-size: 0.75rem;
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
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-weight: 500;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
  white-space: normal;
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

/* 触屏没有 hover：下载/详情按钮保持可见，否则移动端看不到 */
@media (hover: none) {
  .td-actions {
    opacity: 1;
  }
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

.site-select {
  width: 200px;
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
  .search-select,
  .site-select {
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

/* Mobile：结果表转卡片布局，避免横向切列 */
@media (max-width: 900px) {
  .season-table-block {
    overflow: visible;
  }

  .torrent-table,
  .torrent-table tbody {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  .torrent-table thead {
    display: none;
  }

  .torrent-tr {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem 0.75rem;
    padding: 0.625rem 0.75rem;
    margin-bottom: 0.625rem;
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border) / 60%);
    border-radius: var(--radius);
  }

  .torrent-tr:hover td {
    background: transparent;
  }

  .torrent-tr td {
    display: inline-block;
    padding: 0;
    white-space: normal;
    background: transparent;
    border: none;
  }

  .torrent-tr td.td-site {
    width: 100%;
    font-weight: 600;
  }

  .torrent-tr td.td-title {
    width: 100%;
    max-width: none;
  }

  .torrent-tr td.td-seed,
  .torrent-tr td.td-size,
  .torrent-tr td.td-free {
    margin-right: 0.75rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }

  .torrent-tr td.td-seed::before {
    content: '做种 ';
  }

  .torrent-tr td.td-size::before {
    content: '大小 ';
  }

  .torrent-tr td.td-free::before {
    content: '促销 ';
  }

  .torrent-tr td.td-free {
    color: hsl(var(--success));
  }

  .torrent-tr > td:last-child {
    width: 100%;
  }

  .torrent-tr .td-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    width: 100%;
    margin-top: 0.125rem;
    opacity: 1;
  }

  .torrent-tr .td-actions .tbl-btn.gh {
    order: -1;
  }
}
</style>
