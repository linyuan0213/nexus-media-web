<script lang="ts" setup>
import type { DiscoveryApi } from '#/api/modules/media';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSpin } from 'naive-ui';

import {
  getDiscoveryItemsApi,
  getDiscoveryProvidersApi,
} from '#/api/modules/media';
import {
  getMovieSubscriptionApi,
  getTvSubscriptionApi,
} from '#/api/modules/subscription';
import EmptyState from '#/components/empty/EmptyState.vue';
import MediaCard from '#/components/media/MediaCard.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import {
  getContentProfileDetailPath,
  getContentProfileOptions,
  getContentProfilePresentationType,
  PluginSlot,
} from '#/plugin-framework';

const route = useRoute();
const router = useRouter();

const sources = ref<DiscoveryApi.Source[]>([]);
const activeProvider = ref('');
const activeFeed = ref('');
const items = ref<DiscoveryApi.Item[]>([]);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const loadingSources = ref(true);
const loadError = ref<null | { message: string; retryable: boolean }>(null);
const selectedSeasonQuarter = ref(currentSeason().split('-q')[1]);
const selectedYear = ref(String(new Date().getFullYear()));
const selectedSeason = computed(
  () =>
    `${selectedYear.value || new Date().getFullYear()}-q${selectedSeasonQuarter.value}`,
);
const selectedWeekday = ref('');
const selectedGenre = ref('');
const genreOptions = ref<Array<{ label: string; value: string }>>([]);
const genreOptionsFeed = ref('');
const weekdayOptions = [
  { label: '全部', value: '' },
  { label: '周一', value: '1' },
  { label: '周二', value: '2' },
  { label: '周三', value: '3' },
  { label: '周四', value: '4' },
  { label: '周五', value: '5' },
  { label: '周六', value: '6' },
  { label: '周日', value: '7' },
];
const sentinelRef = ref<HTMLElement | null>(null);
let loadMoreObserver: IntersectionObserver | null = null;
let scrollCheckFrame = 0;
const PREF_KEY = 'nexus.discovery.preference';

const pageTitleMap: Record<string, string> = {
  DiscoveryAll: '排行榜',
  Ranking: '排行榜',
  Bangumi: 'Bangumi 新番',
  DoubanMovie: '豆瓣电影',
  DoubanTv: '豆瓣电视剧',
  TmdbMovie: 'TMDB 电影',
  TmdbTv: 'TMDB 电视剧',
  DiscoveryRecommend: '更多推荐',
};

const routePreset: Record<string, { feed?: string; provider?: string }> = {
  Ranking: { feed: 'movie_showing', provider: 'douban' },
  Bangumi: { feed: 'calendar', provider: 'bangumi' },
  DoubanMovie: { feed: 'movie_hot_gaia', provider: 'douban' },
  DoubanTv: { feed: 'tv_hot', provider: 'douban' },
  TmdbMovie: { feed: 'popular_movies', provider: 'tmdb' },
  TmdbTv: { feed: 'popular_tvs', provider: 'tmdb' },
};

const pageTitle = computed(() => pageTitleMap[String(route.name)] || '探索');
const activeSource = computed(() =>
  sources.value.find((item) => item.provider === activeProvider.value),
);
const orderedSources = computed(() =>
  [...sources.value].sort(
    (a, b) =>
      Number(a.visibility === 'private') - Number(b.visibility === 'private'),
  ),
);
const feeds = computed(() => activeSource.value?.feeds || []);
const feedsExpanded = ref(false);
const COLLAPSED_FEED_COUNT = 6;
const visibleFeeds = computed(() =>
  feedsExpanded.value
    ? feeds.value
    : feeds.value.slice(0, COLLAPSED_FEED_COUNT),
);
const hiddenFeedCount = computed(() =>
  Math.max(0, feeds.value.length - COLLAPSED_FEED_COUNT),
);
const activeFeedConfig = computed(() =>
  feeds.value.find((item) => item.key === activeFeed.value),
);
const supportsSeason = computed(() =>
  (activeFeedConfig.value?.facets || []).includes('season'),
);
const supportsYear = computed(() =>
  (activeFeedConfig.value?.facets || []).includes('year'),
);
const supportsWeekday = computed(() =>
  (activeFeedConfig.value?.facets || []).includes('weekday'),
);
const supportsGenre = computed(() =>
  (activeFeedConfig.value?.facets || []).includes('genre'),
);
const hasGenreOptions = computed(() =>
  genreOptions.value.some((item) => item.value !== '其他'),
);
const yearOptions = computed(() => {
  const current = new Date().getFullYear();
  const values = [{ label: '全部年份', value: '' }];
  for (let year = current + 1; year >= current - 10; year--) {
    values.push({ label: String(year), value: String(year) });
  }
  return values;
});
const yearsExpanded = ref(false);
const COLLAPSED_YEAR_COUNT = 7;
const visibleYearOptions = computed(() =>
  yearsExpanded.value
    ? yearOptions.value
    : yearOptions.value.slice(0, COLLAPSED_YEAR_COUNT),
);
const hiddenYearCount = computed(() =>
  Math.max(0, yearOptions.value.length - COLLAPSED_YEAR_COUNT),
);

function currentSeason() {
  const now = new Date();
  return `${now.getFullYear()}-q${Math.floor(now.getMonth() / 3) + 1}`;
}

function selectSeasonQuarter(value: string) {
  selectedSeasonQuarter.value = value;
  if (!selectedYear.value) {
    selectedYear.value = String(new Date().getFullYear());
  }
  loadItems(true);
}

function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T;
}

async function loadSources() {
  loadingSources.value = true;
  try {
    sources.value = unwrap<DiscoveryApi.Source[]>(
      await getDiscoveryProvidersApi(),
    );
    applyPreset();
  } finally {
    loadingSources.value = false;
  }
}

function applyPreset() {
  if (!sources.value.length) return;
  const preset = routePreset[String(route.name)] || {};
  let saved: { feed?: string; provider?: string };
  try {
    saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
  } catch {
    saved = {};
  }
  const wantedProvider = preset.provider || saved.provider;
  const wantedFeed = preset.feed || saved.feed;
  const source =
    sources.value.find((item) => item.provider === wantedProvider) ||
    sources.value[0];
  if (!source) return;
  activeProvider.value = source.provider;
  const feed =
    source.feeds.find((item) => item.key === wantedFeed) || source.feeds[0];
  activeFeed.value = feed?.key || '';
}

let loadSeq = 0;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('discovery request timeout')),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function loadItems(reset = false) {
  if (!activeProvider.value || !activeFeed.value) return;
  if (!reset && (loading.value || loadingMore.value)) return;
  if (!reset && !hasMore.value) return;

  const seq = ++loadSeq;
  const provider = activeProvider.value;
  const feed = activeFeed.value;
  if (reset) {
    page.value = 1;
    items.value = [];
    hasMore.value = true;
    loading.value = true;
    loadError.value = null;
  } else {
    loadingMore.value = true;
  }

  try {
    const result = unwrap<DiscoveryApi.Page>(
      await withTimeout(
        getDiscoveryItemsApi({
          provider,
          feed,
          page: page.value,
          filters: {
            ...(supportsSeason.value ? { season: selectedSeason.value } : {}),
            ...(supportsYear.value && selectedYear.value
              ? { year: selectedYear.value }
              : {}),
            ...(supportsWeekday.value && selectedWeekday.value
              ? { weekday: selectedWeekday.value }
              : {}),
            ...(supportsGenre.value && selectedGenre.value
              ? { genre: selectedGenre.value }
              : {}),
          },
        }),
        30000,
      ),
    );
    if (seq !== loadSeq) return;
    if (result?.error) {
      loadError.value = {
        message: result.error,
        retryable: result.retryable !== false,
      };
      hasMore.value = false;
      return;
    }
    loadError.value = null;
    if (supportsGenre.value) {
      // 题材是 feed 级目录：只在首次加载/切换 feed 时刷新，避免翻页或筛选后被当前页结果改写。
      const feedKey = `${provider}:${feed}`;
      if (genreOptionsFeed.value !== feedKey) {
        const facets: any[] = (result as any)?.facets?.genre || [];
        if (facets.length) {
          genreOptions.value = facets.map((item) => ({
            label: String(item.label || item.value),
            value: String(item.value),
          }));
          if (
            selectedGenre.value &&
            !genreOptions.value.some(
              (item) => item.value === selectedGenre.value,
            )
          ) {
            selectedGenre.value = '';
          }
          genreOptionsFeed.value = feedKey;
        }
      }
    }
    const list = result?.items || [];
    const merged = reset ? list : [...items.value, ...list];
    const seen = new Set<string>();
    items.value = merged.filter((item) => {
      // 同一内容的不同版本（如 Blu-ray/通常版）共用一个 anchor content_id，
      // 优先按锚点去重，避免探索页出现重复卡片。
      const anchor = item.anchor_ref;
      const key = anchor?.external_id
        ? `${item.content_profile || 'default'}:${anchor.provider}:${anchor.external_id}`
        : `${item.provider}:${item.ref?.external_id || item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    hasMore.value = Boolean(result?.has_more);
  } catch {
    // 超时/失败时停止无限滚动，避免底部一直显示加载中。
    if (seq === loadSeq) {
      loadError.value = { message: '加载失败，请稍后重试', retryable: true };
      hasMore.value = false;
    }
  } finally {
    if (seq === loadSeq) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function retryLoad() {
  loadError.value = null;
  if (!items.value.length) {
    page.value = 1;
    loadItems(true);
  } else {
    loadItems(false);
  }
}

function beginTabSwitch() {
  // 立即清空并让在途请求失效，避免切换后短暂显示旧榜单内容。
  loadSeq += 1;
  page.value = 1;
  items.value = [];
  hasMore.value = true;
  loading.value = true;
  selectedWeekday.value = '';
  selectedGenre.value = '';
  genreOptions.value = [];
  genreOptionsFeed.value = '';
  loadError.value = null;
}

async function selectProvider(provider: string) {
  if (provider === activeProvider.value) return;
  activeProvider.value = provider;
  activeFeed.value =
    sources.value.find((item) => item.provider === provider)?.feeds[0]?.key ||
    '';
  beginTabSwitch();
  savePreference();
  // 等 facets/activeFeedConfig 重新计算后再请求，避免切 tab 仍用旧榜单参数。
  await nextTick();
  loadItems(true);
}

async function selectFeed(feed: string) {
  if (feed === activeFeed.value) return;
  activeFeed.value = feed;
  beginTabSwitch();
  savePreference();
  await nextTick();
  loadItems(true);
}

interface SubscriptionStatus {
  fav: string;
  rssid: string;
}

const subscriptionIndex = ref(new Map<string, SubscriptionStatus>());

function addSubscriptionKey(
  map: Map<string, SubscriptionStatus>,
  key: string | undefined,
  status: SubscriptionStatus,
) {
  if (key && !map.has(key)) map.set(key, status);
}

function normalizeMediaTitle(title: string): string {
  // 只保留字母/数字/汉字，抹平空格、冒号、间隔号等来源差异。
  return (
    String(title || '')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) || []
  ).join('');
}

function addTitleKeys(
  map: Map<string, SubscriptionStatus>,
  title: string,
  year: string,
  status: SubscriptionStatus,
) {
  const normalized = normalizeMediaTitle(title);
  if (!normalized) return;
  addSubscriptionKey(map, `title:${normalized}:${year}`, status);
  // 不同来源标题可能只有空格/冒号差异，年份也可能缺失，保留纯标题兜底。
  addSubscriptionKey(map, `title:${normalized}`, status);
}

function subscriptionKeys(sub: any): string[] {
  const keys: string[] = [];
  const anchorProvider = String(
    sub.anchor_provider || sub.provider || '',
  ).trim();
  const anchorExternal = String(sub.anchor_external_id || '').trim();
  if (anchorProvider && anchorExternal) {
    keys.push(`anchor:${anchorProvider}:${anchorExternal}`);
  }
  if (anchorExternal) keys.push(`external:${anchorExternal}`);
  if (sub.tmdbid) keys.push(`tmdb:${sub.tmdbid}`);
  if (sub.keyword) {
    keys.push(`keyword:${sub.content_profile || 'default'}:${sub.keyword}`);
    keys.push(`keyword:${sub.keyword}`);
  }
  if (sub.name) keys.push(`name:${sub.name}:${sub.year || ''}`);
  return keys;
}

async function loadSubscriptionIndex() {
  try {
    const movieProfiles = [
      'default',
      ...getContentProfileOptions()
        .filter(
          (option) =>
            !['anime', 'tv'].includes(
              getContentProfilePresentationType(option.value) || 'movie',
            ),
        )
        .map((option) => option.value),
    ];
    const [movies, tvs] = await Promise.all([
      Promise.all(
        movieProfiles.map((profile) =>
          getMovieSubscriptionApi(undefined, profile).catch(() => []),
        ),
      ),
      getTvSubscriptionApi().catch(() => []),
    ]);
    const index = new Map<string, SubscriptionStatus>();
    for (const sub of [...movies.flat(), ...(tvs as any[])]) {
      if (!sub?.id) continue;
      const status = { fav: '1', rssid: String(sub.id) };
      for (const key of subscriptionKeys(sub)) {
        addSubscriptionKey(index, key, status);
      }
      addTitleKeys(index, sub.name || '', String(sub.year || ''), status);
    }
    subscriptionIndex.value = index;
  } catch {
    subscriptionIndex.value = new Map();
  }
}

function subscriptionFor(
  item: DiscoveryApi.Item,
): SubscriptionStatus | undefined {
  const index = subscriptionIndex.value;
  const anchorProvider = item.anchor_ref?.provider;
  const anchorExternal = item.anchor_ref?.external_id;
  if (anchorProvider && anchorExternal) {
    const found = index.get(`anchor:${anchorProvider}:${anchorExternal}`);
    if (found) return found;
  }
  if (anchorExternal) {
    const found = index.get(`external:${anchorExternal}`);
    if (found) return found;
  }
  if (item.provider === 'tmdb' && item.ref.external_id) {
    const found = index.get(`tmdb:${item.ref.external_id}`);
    if (found) return found;
  }
  const external = item.ref.external_id || '';
  const keywordKey = index.get(
    `keyword:${item.content_profile || 'default'}:${external}`,
  );
  if (keywordKey) return keywordKey;
  const byName = index.get(`name:${item.title}:${item.year || ''}`);
  if (byName) return byName;
  // 不同元数据源标题可能只差空格/冒号（如“龙珠超：比鲁斯” vs “龙珠超 比鲁斯”）。
  const normalized = normalizeMediaTitle(item.title);
  return (
    index.get(`title:${normalized}:${item.year || ''}`) ||
    index.get(`title:${normalized}`)
  );
}

function itemId(item: DiscoveryApi.Item) {
  return item.anchor_ref?.external_id || item.ref.external_id;
}

function itemTmdbId(item: DiscoveryApi.Item) {
  return item.provider === 'tmdb' ? item.ref.external_id : undefined;
}

function itemType(item: DiscoveryApi.Item) {
  // 自定义画像可声明自己的 presentation_type（如 av），剧集类才走季/集流程
  const profileType = getContentProfilePresentationType(item.content_profile);
  if (profileType === 'tv' || profileType === 'anime') return 'tv';
  return item.ref.media_type || 'movie';
}

function itemMetadataRef(item: DiscoveryApi.Item) {
  return `${item.ref.provider}:${item.ref.external_id}`;
}

function itemDetailLink(item: DiscoveryApi.Item) {
  const path = getContentProfileDetailPath(item.content_profile);
  if (!path) return undefined;
  const params = new URLSearchParams({
    id: item.anchor_ref?.external_id || item.ref.external_id,
    profile: item.content_profile || '',
    ref: itemMetadataRef(item),
  });
  return `${path}?${params.toString()}`;
}

function itemVote(item: DiscoveryApi.Item) {
  const values = Object.values(item.rating || {});
  return values.length ? values[0] : undefined;
}

function handleSearchFromCard(item: Record<string, any>) {
  router.push({
    path: '/media/search',
    query: {
      s:
        item.contentProfile && item.anchorExternalId
          ? item.anchorExternalId
          : item.title,
      from: item.contentProfile ? 'subscription' : 'discovery',
      tmdbid: item.tmdbId || '',
      media_type: item.mediaType || item.type || '',
      anchor_provider: item.anchorProvider || '',
      anchor_external_id: item.anchorExternalId || '',
      content_profile: item.contentProfile || '',
      poster: item.poster || '',
      vote: item.vote || '',
      year: item.year || '',
    },
  });
}

function handleCardSearch(item: DiscoveryApi.Item) {
  const customProfile =
    item.content_profile && item.content_profile !== 'default';
  handleSearchFromCard({
    anchorExternalId: item.anchor_ref?.external_id,
    anchorProvider: item.anchor_ref?.provider,
    contentProfile: item.content_profile || '',
    id: itemId(item),
    mediaType: itemType(item),
    // 自定义画像（如 AV）用番号/内容 ID 搜索，而不是日文标题
    title: customProfile
      ? item.anchor_ref?.external_id || item.title
      : item.title,
    tmdbId: itemTmdbId(item),
    poster: item.poster || '',
    vote: itemVote(item),
    year: item.year || '',
    type: itemType(item),
  });
}

function savePreference() {
  localStorage.setItem(
    PREF_KEY,
    JSON.stringify({ provider: activeProvider.value, feed: activeFeed.value }),
  );
}

function selectYear(value: string) {
  selectedYear.value = value;
  loadItems(true);
}

function selectWeekday(value: string) {
  selectedWeekday.value = value;
  loadItems(true);
}

function selectGenre(value: string) {
  selectedGenre.value = value;
  loadItems(true);
}

function loadMore() {
  if (!hasMore.value || loading.value || loadingMore.value) return;
  page.value += 1;
  loadItems(false);
}

function isNearPageBottom(target?: EventTarget | null) {
  const viewportHeight = window.innerHeight;
  const documentElement = document.documentElement;
  if (documentElement.scrollHeight - window.scrollY - viewportHeight < 600) {
    return true;
  }
  if (
    target instanceof HTMLElement &&
    target.scrollHeight > target.clientHeight + 100
  ) {
    return target.scrollHeight - target.scrollTop - target.clientHeight < 600;
  }
  return false;
}

function handleScrollForLoadMore(event: Event) {
  if (!hasMore.value || loading.value || loadingMore.value) return;
  if (scrollCheckFrame) return;
  scrollCheckFrame = requestAnimationFrame(() => {
    scrollCheckFrame = 0;
    if (isNearPageBottom(event.target)) loadMore();
  });
}

function setupLoadMoreObserver() {
  if (!('IntersectionObserver' in window)) return;
  loadMoreObserver?.disconnect();
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { rootMargin: '240px 0px' },
  );
  if (sentinelRef.value) loadMoreObserver.observe(sentinelRef.value);
}

watch(selectedYear, (value) => {
  if (!value) return;
  const index = yearOptions.value.findIndex((item) => item.value === value);
  if (index >= COLLAPSED_YEAR_COUNT) yearsExpanded.value = true;
});

watch(
  [feeds, activeFeed],
  () => {
    const index = feeds.value.findIndex(
      (item) => item.key === activeFeed.value,
    );
    feedsExpanded.value = index >= COLLAPSED_FEED_COUNT;
  },
  { immediate: true },
);

watch(
  () => route.name,
  async () => {
    applyPreset();
    await nextTick();
    loadItems(true);
  },
);

watch(
  [hasMore, loading, loadingMore],
  async () => {
    await nextTick();
    if (hasMore.value && sentinelRef.value) {
      if (!loadMoreObserver) setupLoadMoreObserver();
      else loadMoreObserver.observe(sentinelRef.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  // 榜单数据优先：订阅状态只影响卡片角标，等首屏数据渲染后再后台加载。
  await loadSources();
  await loadItems(true);
  await nextTick();
  setupLoadMoreObserver();
  window.addEventListener('scroll', handleScrollForLoadMore, true);
  void loadSubscriptionIndex();
});

onUnmounted(() => {
  loadMoreObserver?.disconnect();
  loadMoreObserver = null;
  window.removeEventListener('scroll', handleScrollForLoadMore, true);
  if (scrollCheckFrame) cancelAnimationFrame(scrollCheckFrame);
});
</script>

<template>
  <div class="p-4">
    <PageHeader :title="pageTitle" subtitle="按来源浏览榜单、季度新番与新剧">
      <template #actions>
        <NButton :loading="loading" @click="loadItems(true)">刷新</NButton>
      </template>
    </PageHeader>

    <NSpin :show="loadingSources">
      <section class="discovery-filter" aria-label="内容筛选">
        <div class="filter-row">
          <span class="filter-label">来源</span>
          <div class="filter-scroll source-list" role="tablist">
            <button
              v-for="source in orderedSources"
              :key="source.provider"
              type="button"
              class="source-tab"
              :class="{ active: activeProvider === source.provider }"
              :aria-pressed="activeProvider === source.provider"
              @click="selectProvider(source.provider)"
            >
              {{ source.name }}
            </button>
          </div>
        </div>

        <div class="filter-divider"></div>

        <div class="filter-row filter-row--wrap">
          <span class="filter-label">榜单</span>
          <div class="filter-scroll feed-list" role="tablist">
            <button
              v-for="feed in visibleFeeds"
              :key="feed.key"
              type="button"
              class="feed-tab"
              :class="{ active: activeFeed === feed.key }"
              :aria-pressed="activeFeed === feed.key"
              @click="selectFeed(feed.key)"
            >
              {{ feed.title }}
            </button>
            <button
              v-if="hiddenFeedCount > 0 || feedsExpanded"
              type="button"
              class="feed-toggle"
              @click="feedsExpanded = !feedsExpanded"
            >
              <IconifyIcon
                :icon="
                  feedsExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'
                "
                class="feed-toggle-icon"
              />
              {{ feedsExpanded ? '收起' : '更多' }}
            </button>
          </div>
        </div>

        <template v-if="supportsYear">
          <div class="filter-divider"></div>
          <div class="filter-row filter-row--facets">
            <span class="filter-label">年份</span>
            <div class="facet-group">
              <div class="facet facet--years">
                <div class="year-list">
                  <button
                    v-for="year in visibleYearOptions"
                    :key="year.value || 'all'"
                    type="button"
                    class="year-tab"
                    :class="{ active: selectedYear === year.value }"
                    :aria-pressed="selectedYear === year.value"
                    @click="selectYear(year.value)"
                  >
                    {{ year.label === '全部年份' ? '全部' : year.label }}
                  </button>
                  <button
                    v-if="hiddenYearCount > 0 || yearsExpanded"
                    type="button"
                    class="feed-toggle"
                    @click="yearsExpanded = !yearsExpanded"
                  >
                    <IconifyIcon
                      :icon="
                        yearsExpanded
                          ? 'lucide:chevron-up'
                          : 'lucide:chevron-down'
                      "
                      class="feed-toggle-icon"
                    />
                    {{ yearsExpanded ? '收起' : '更多' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-if="supportsSeason">
          <div class="filter-divider"></div>
          <div class="filter-row filter-row--facets">
            <span class="filter-label">季度</span>
            <div class="facet-group">
              <div class="year-list">
                <button
                  v-for="quarter in ['1', '2', '3', '4']"
                  :key="quarter"
                  type="button"
                  class="year-tab"
                  :class="{ active: selectedSeasonQuarter === quarter }"
                  :aria-pressed="selectedSeasonQuarter === quarter"
                  @click="selectSeasonQuarter(quarter)"
                >
                  Q{{ quarter }}
                </button>
              </div>
            </div>
          </div>
        </template>

        <div v-if="supportsWeekday" class="filter-row filter-row--wrap">
          <span class="filter-label">放送日</span>
          <div class="year-list">
            <button
              v-for="day in weekdayOptions"
              :key="day.value || 'all'"
              type="button"
              class="year-tab"
              :class="{ active: selectedWeekday === day.value }"
              :aria-pressed="selectedWeekday === day.value"
              @click="selectWeekday(day.value)"
            >
              {{ day.value ? day.label : '全部' }}
            </button>
          </div>
        </div>
        <div
          v-if="supportsGenre && hasGenreOptions"
          class="filter-row filter-row--wrap"
        >
          <span class="filter-label">题材</span>
          <div class="year-list">
            <button
              type="button"
              class="year-tab"
              :class="{ active: selectedGenre === '' }"
              :aria-pressed="selectedGenre === ''"
              @click="selectGenre('')"
            >
              全部
            </button>
            <button
              v-for="genre in genreOptions"
              :key="genre.value"
              type="button"
              class="year-tab"
              :class="{ active: selectedGenre === genre.value }"
              :aria-pressed="selectedGenre === genre.value"
              @click="selectGenre(genre.value)"
            >
              {{ genre.label }}
            </button>
          </div>
        </div>
      </section>

      <NSpin :show="loading">
        <div
          v-if="items.length > 0"
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          <MediaCard
            v-for="item in items"
            :key="`${item.provider}:${item.ref.external_id}`"
            :id="itemId(item)"
            :tmdb-id="itemTmdbId(item)"
            :title="item.title"
            :poster="item.poster"
            :type="itemType(item)"
            :media-type="itemType(item)"
            :vote="itemVote(item)"
            :year="item.year"
            :genres="item.tags?.slice(0, 4)"
            :anchor-provider="item.anchor_ref?.provider"
            :anchor-external-id="item.anchor_ref?.external_id"
            :content-profile="item.content_profile"
            :metadata-ref="itemMetadataRef(item)"
            :detail-link="itemDetailLink(item)"
            :fav="subscriptionFor(item)?.fav || '0'"
            :rssid="subscriptionFor(item)?.rssid || ''"
            @search="() => handleCardSearch(item)"
          />
        </div>
        <EmptyState
          v-else-if="!loading && loadError"
          title="加载失败"
          :subtitle="loadError.message"
        >
          <template #action>
            <NButton
              v-if="loadError.retryable"
              size="small"
              type="primary"
              @click="retryLoad"
            >
              重试
            </NButton>
          </template>
        </EmptyState>
        <EmptyState
          v-else-if="!loading"
          title="没有找到内容"
          subtitle="切换来源、榜单或筛选条件后再试"
        />
      </NSpin>

      <div
        v-if="hasMore || loadingMore"
        ref="sentinelRef"
        class="flex flex-col items-center justify-center gap-2 mt-6 min-h-12"
      >
        <template v-if="loadingMore">
          <IconifyIcon
            icon="lucide:loader-circle"
            class="size-6 animate-spin text-primary"
          />
          <span class="text-xs text-muted-foreground">加载中...</span>
        </template>
        <span v-else class="text-xs text-muted-foreground">
          已加载 {{ items.length }} 条，继续滚动加载
        </span>
      </div>
      <div
        v-else-if="loadError && items.length > 0"
        class="flex flex-col items-center justify-center gap-2 mt-6"
      >
        <span class="text-sm text-muted-foreground">{{
          loadError.message
        }}</span>
        <NButton
          v-if="loadError.retryable"
          size="small"
          type="primary"
          @click="retryLoad"
        >
          重试
        </NButton>
      </div>
      <div
        v-else-if="items.length > 0"
        class="text-center text-sm text-muted-foreground mt-6"
      >
        已加载全部
      </div>

      <PluginSlot target="discovery.panels" />
    </NSpin>
  </div>
</template>

<style scoped>
.discovery-filter {
  padding: 0 0.9rem;
  margin-bottom: 1rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
}

.filter-row {
  display: flex;
  gap: 0.9rem;
  align-items: center;
  min-height: 3rem;
}

.filter-row--wrap {
  flex-wrap: wrap;
  padding: 0.55rem 0;
}

.filter-label {
  flex: none;
  width: 2.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.filter-divider {
  height: 1px;
  margin: 0 -0.9rem;
  background: hsl(var(--border));
}

.filter-scroll {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.25rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-scroll::-webkit-scrollbar {
  display: none;
}

.source-list {
  align-items: center;
}

.source-tab {
  flex: none;
  padding: 0.45rem 0.65rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 0.4rem;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.source-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.source-tab.active {
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.feed-list {
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  overflow: visible;
}

.feed-tab {
  flex: none;
  padding: 0.3rem 0.7rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.feed-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.feed-tab.active {
  font-weight: 500;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.year-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.year-tab {
  flex: none;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 0.35rem;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.year-tab:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.year-tab.active {
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 30%);
}

.facet--years {
  flex-wrap: wrap;
}

.feed-toggle {
  display: inline-flex;
  flex: none;
  gap: 0.15rem;
  align-items: center;
  padding: 0.3rem 0.55rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 999px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.feed-toggle:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.feed-toggle-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.filter-row--facets {
  padding: 0.55rem 0;
}

.facet-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.facet {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .discovery-filter {
    padding: 0 0.75rem;
  }

  .filter-row {
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
    padding: 0.55rem 0;
  }

  .filter-label {
    width: auto;
  }

  .feed-list {
    flex: none;
    width: 100%;
  }
}
</style>
