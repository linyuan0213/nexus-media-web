<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { NButton, NModal, NPopover, NProgress, NSpin } from 'naive-ui';

import { getRecommendApi, webSearchApi } from '#/api';
import { getProgressApi } from '#/api/modules/system';
import MediaCard from '#/components/media/MediaCard.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useAppNotification } from '#/utils/notify';

interface RecommendItem {
  id: string;
  title: string;
  image?: string;
  type?: string;
  year?: string;
  vote?: string;
  overview?: string;
  weekday?: string;
  fav?: string;
  date?: string;
  site?: string;
  media_type?: string;
  tmdbid?: string;
  doubanid?: string;
  rssid?: string;
  genres?: string[];
  countries?: string[];
  languages?: string[];
}

interface CategoryConfig {
  type: string;
  subtype: string;
  title: string;
  week?: string;
  params?: Record<string, any>;
}

const route = useRoute();
const router = useRouter();
const notification = useAppNotification();

const loadingMap = ref<Record<string, boolean>>({});
const categoryItems = ref<Record<string, RecommendItem[]>>({});
const singlePage = ref(1);
const singleHasMore = ref(true);
const singleLoadingMore = ref(false);
const sentinelRef = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;
const selectedGenre = ref('');
const selectedCountry = ref('');
const selectedLanguage = ref('');
const selectedYear = ref('');

const priorityCountries = [
  '中国大陆',
  '中国香港',
  '中国台湾',
  '中国澳门',
  '美国',
  '日本',
  '韩国',
  '英国',
  '法国',
  '德国',
  '加拿大',
  '澳大利亚',
  '印度',
  '泰国',
  '俄罗斯',
];

const priorityLanguages = [
  '中文',
  '英语',
  '日语',
  '韩语',
  '法语',
  '德语',
  '西班牙语',
  '意大利语',
  '俄语',
  '葡萄牙语',
  '阿拉伯语',
  '泰语',
  '印地语',
];

function sortByPriority(items: string[], priority: string[]) {
  const order = new Map(priority.map((v, i) => [v, i]));
  return items.toSorted((a, b) => {
    if (a === '其他') return 1;
    if (b === '其他') return -1;
    const pa = order.get(a);
    const pb = order.get(b);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return a.localeCompare(b, 'zh-CN');
  });
}

const allGenres = computed(() => {
  const genres = new Set<string>();
  Object.values(categoryItems.value).forEach((items) => {
    items.forEach((item: any) => {
      (item.genres || []).forEach((g: string) => genres.add(g));
    });
  });
  return [...genres].toSorted((a, b) => {
    if (a === '其他') return 1;
    if (b === '其他') return -1;
    return a.localeCompare(b, 'zh-CN');
  });
});

const allCountries = computed(() => {
  const countries = new Set<string>();
  Object.values(categoryItems.value).forEach((items) => {
    items.forEach((item: any) => {
      (item.countries || []).forEach((c: string) => countries.add(c));
    });
  });
  return sortByPriority([...countries], priorityCountries);
});

const allLanguages = computed(() => {
  const languages = new Set<string>();
  Object.values(categoryItems.value).forEach((items) => {
    items.forEach((item: any) => {
      (item.languages || []).forEach((l: string) => languages.add(l));
    });
  });
  return sortByPriority([...languages], priorityLanguages);
});

const allYears = computed(() => {
  const years = new Set<string>();
  Object.values(categoryItems.value).forEach((items) => {
    items.forEach((item: any) => {
      if (item.year) years.add(String(item.year));
    });
  });
  return [...years].toSorted((a, b) => Number(b) - Number(a));
});

function filterItems(items: RecommendItem[]) {
  if (
    !selectedGenre.value &&
    !selectedCountry.value &&
    !selectedLanguage.value &&
    !selectedYear.value
  )
    return items;
  return items.filter((item: any) => {
    const genres = item.genres || [];
    const countries = item.countries || [];
    const languages = item.languages || [];
    const year = item.year ? String(item.year) : '';
    if (selectedGenre.value && !genres.includes(selectedGenre.value))
      return false;
    if (selectedCountry.value && !countries.includes(selectedCountry.value))
      return false;
    if (selectedLanguage.value && !languages.includes(selectedLanguage.value))
      return false;
    if (selectedYear.value && year !== selectedYear.value) return false;
    return true;
  });
}

const activeFilterCount = computed(
  () =>
    Number(!!selectedCountry.value) +
    Number(!!selectedLanguage.value) +
    Number(!!selectedYear.value),
);

// 搜索进度模态框状态
const searchModalVisible = ref(false);
const searchModalTitle = ref('');
const searchModalProgress = ref(0);
const searchModalText = ref('请稍候...');
let searchProgressTimer: null | ReturnType<typeof setInterval> = null;

function startSearchProgressPoll() {
  stopSearchProgressPoll();
  searchModalProgress.value = 0;
  searchModalText.value = '正在检索资源...';
  searchProgressTimer = setInterval(async () => {
    try {
      const res: any = await getProgressApi('search');
      // requestClient 拦截器已自动解包 data，res 直接是 { value, text }
      if (res) {
        searchModalProgress.value = Math.min(res.value || 0, 100);
        searchModalText.value = res.text || '请稍候...';
        if (searchModalProgress.value >= 100) {
          stopSearchProgressPoll();
          searchModalVisible.value = false;
        }
      }
    } catch {}
  }, 3000);
}

function stopSearchProgressPoll() {
  if (searchProgressTimer) {
    clearInterval(searchProgressTimer);
    searchProgressTimer = null;
  }
}

// 各页面分类配置（key 用 route.name，不受父菜单 path 变化影响）
const pageCategories: Record<string, CategoryConfig[]> = {
  Ranking: [
    { type: 'movie', subtype: 'dbom', title: '正在热映' },
    { type: 'movie', subtype: 'dbnm', title: '即将上映' },
    { type: 'TRENDING', subtype: 'tmdb', title: 'TMDB流行趋势' },
    { type: 'movie', subtype: 'dbhm', title: '豆瓣热门电影' },
    { type: 'movie', subtype: 'dbtop', title: '豆瓣电影TOP250' },
    { type: 'tv', subtype: 'dbht', title: '豆瓣热门剧集' },
    { type: 'tv', subtype: 'dbdh', title: '豆瓣热门动漫' },
    { type: 'tv', subtype: 'dbzy', title: '豆瓣热门综艺' },
    { type: 'tv', subtype: 'dbct', title: '华语口碑剧集榜' },
    { type: 'tv', subtype: 'dbgt', title: '全球口碑剧集榜' },
  ],
  Bangumi: [
    { type: 'tv', subtype: 'bangumi', title: '星期一', week: '1' },
    { type: 'tv', subtype: 'bangumi', title: '星期二', week: '2' },
    { type: 'tv', subtype: 'bangumi', title: '星期三', week: '3' },
    { type: 'tv', subtype: 'bangumi', title: '星期四', week: '4' },
    { type: 'tv', subtype: 'bangumi', title: '星期五', week: '5' },
    { type: 'tv', subtype: 'bangumi', title: '星期六', week: '6' },
    { type: 'tv', subtype: 'bangumi', title: '星期日', week: '7' },
  ],
};

// 单列表页面配置
const singlePageMap: Record<string, CategoryConfig> = {
  DoubanMovie: { type: 'movie', subtype: 'dbhm', title: '豆瓣电影' },
  DoubanTv: { type: 'tv', subtype: 'dbht', title: '豆瓣电视剧' },
  TmdbMovie: { type: 'movie', subtype: 'nm', title: 'TMDB电影' },
  TmdbTv: { type: 'tv', subtype: 'nt', title: 'TMDB电视剧' },
};

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    Ranking: '排行榜',
    DoubanMovie: '豆瓣电影',
    DoubanTv: '豆瓣电视剧',
    TmdbMovie: 'TMDB电影',
    TmdbTv: 'TMDB电视剧',
    Bangumi: 'Bangumi',
  };
  return map[route.name as string] || '推荐';
});

const isRankOrBangumi = computed(() => {
  return route.name === 'Ranking' || route.name === 'Bangumi';
});

const categories = computed<CategoryConfig[]>(() => {
  return pageCategories[route.name as string] || [];
});

const singleConfig = computed<CategoryConfig | null>(() => {
  return singlePageMap[route.name as string] || null;
});

async function loadCategory(cfg: CategoryConfig) {
  const key = `${cfg.subtype}_${cfg.week || ''}`;
  if (loadingMap.value[key]) return;
  loadingMap.value[key] = true;
  try {
    const res: any = await getRecommendApi({
      type: cfg.type,
      subtype: cfg.subtype,
      page: 1,
      ...(cfg.week ? { week: cfg.week } : {}),
    } as any);
    const list = Array.isArray(res) ? res : res?.data || [];
    categoryItems.value[key] = list;
  } finally {
    loadingMap.value[key] = false;
  }
}

async function loadSingle(reset = false) {
  const cfg = singleConfig.value;
  if (!cfg) return;
  const key = 'single';
  if (loadingMap.value[key] || singleLoadingMore.value) return;
  if (reset) {
    singlePage.value = 1;
    singleHasMore.value = true;
    categoryItems.value[key] = [];
  }
  if (!singleHasMore.value) return;

  if (singlePage.value === 1) loadingMap.value[key] = true;
  else singleLoadingMore.value = true;

  try {
    const res: any = await getRecommendApi({
      type: cfg.type,
      subtype: cfg.subtype,
      page: singlePage.value,
    });
    const list = Array.isArray(res) ? res : res?.data || [];
    const existing = categoryItems.value[key] || [];
    categoryItems.value[key] = [...existing, ...list];
    if (list.length === 0) singleHasMore.value = false;
  } finally {
    loadingMap.value[key] = false;
    singleLoadingMore.value = false;
    nextTick(() => checkInfiniteScroll());
  }
}

async function loadAll() {
  if (isRankOrBangumi.value) {
    for (const cfg of categories.value) {
      await loadCategory(cfg);
    }
  } else {
    await loadSingle();
  }
}

function handleSearchFromCard(item: Record<string, any>) {
  handleSearch(
    {
      id: item.tmdbId || item.id,
      title: item.title,
      media_type: item.mediaType || item.type,
      type: item.type,
    } as any,
    new MouseEvent('click'),
  );
}

async function handleSearch(item: RecommendItem, e: Event) {
  e.stopPropagation();
  searchModalTitle.value = `正在搜索 ${item.title} ...`;
  searchModalVisible.value = true;
  startSearchProgressPoll();
  try {
    await webSearchApi({
      search_word: item.title,
      tmdbid: item.id,
      media_type: item.media_type || item.type,
    });
    // 搜索触发成功，持续轮询进度，进度条满后自动关闭并跳转
    const checkAndNavigate = setInterval(() => {
      if (!searchModalVisible.value) {
        clearInterval(checkAndNavigate);
        router.push(
          `/media/search?s=${encodeURIComponent(item.title)}&from=discovery`,
        );
      }
    }, 500);
  } catch (error: any) {
    stopSearchProgressPoll();
    searchModalVisible.value = false;
    notification.error('搜索失败', {
      description: error?.message || '未知错误',
    });
  }
}

watch(
  () => route.path,
  () => {
    categoryItems.value = {};
    singlePage.value = 1;
    singleHasMore.value = true;
    loadAll();
  },
  { immediate: true },
);

function setupInfiniteScroll() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (!singleConfig.value || !sentinelRef.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (
        entries[0]?.isIntersecting &&
        !loadingMap.value.single &&
        !singleLoadingMore.value &&
        singleHasMore.value
      ) {
        singlePage.value += 1;
        loadSingle();
      }
    },
    { rootMargin: '100px' },
  );
  observer.observe(sentinelRef.value);
}

function checkInfiniteScroll() {
  if (!singleConfig.value || !sentinelRef.value) return;
  if (
    singleHasMore.value &&
    !singleLoadingMore.value &&
    !loadingMap.value.single
  ) {
    const rect = sentinelRef.value.getBoundingClientRect();
    if (rect.top < window.innerHeight + 100) {
      singlePage.value += 1;
      loadSingle();
    }
  }
}

onMounted(() => {
  loadAll();
  setupInfiniteScroll();
});
</script>

<template>
  <div class="p-4">
    <PageHeader :title="pageTitle" subtitle="探索热门电影和剧集">
      <template #actions>
        <NButton @click="loadAll()"> 刷新 </NButton>
      </template>
    </PageHeader>

    <div class="flex items-start gap-2 mb-4 genre-tabs-wrapper">
      <div
        class="flex items-center gap-6 overflow-x-auto pb-2 genre-tabs"
        style="scroll-snap-type: x mandatory"
      >
        <button
          v-for="g in ['', ...allGenres]"
          :key="g || 'all'"
          class="genre-tab relative whitespace-nowrap text-sm transition-colors"
          :class="{ active: selectedGenre === g }"
          style="flex-shrink: 0; padding: 6px 0; scroll-snap-align: start"
          @click="selectedGenre = g"
        >
          {{ g || '全部' }}
        </button>
      </div>
      <NPopover
        placement="bottom-start"
        trigger="click"
        :show-arrow="false"
        style="padding: 0"
      >
        <template #trigger>
          <button
            class="genre-tab relative whitespace-nowrap text-sm transition-colors flex items-center gap-1"
            style="padding: 6px 0"
          >
            <IconifyIcon
              icon="lucide:filter"
              style="width: 14px; height: 14px"
            />
            筛选
            <span
              v-if="activeFilterCount > 0"
              class="text-xs px-1.5 py-0 rounded-full"
              :style="{
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
              }"
            >
              {{ activeFilterCount }}
            </span>
          </button>
        </template>
        <div
          class="p-3"
          style="width: 300px; max-height: 50vh; overflow-y: auto"
        >
          <div class="mb-4">
            <div class="text-sm font-medium mb-2">地区</div>
            <div
              class="grid gap-2"
              style="grid-template-columns: repeat(2, 1fr)"
            >
              <div
                class="flex items-center justify-center px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm text-center"
                :style="
                  selectedCountry === ''
                    ? {
                        backgroundColor: 'hsl(var(--accent))',
                        color: 'hsl(var(--accent-foreground))',
                      }
                    : {}
                "
                @click="selectedCountry = ''"
              >
                <span>全部</span>
              </div>
              <div
                v-for="c in allCountries"
                :key="c"
                class="flex items-center justify-center px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm text-center"
                :style="
                  selectedCountry === c
                    ? {
                        backgroundColor: 'hsl(var(--accent))',
                        color: 'hsl(var(--accent-foreground))',
                      }
                    : {}
                "
                @click="selectedCountry = c"
              >
                <span>{{ c }}</span>
              </div>
            </div>
          </div>
          <div class="mb-4">
            <div class="text-sm font-medium mb-2">年份</div>
            <div
              class="grid gap-2"
              style="grid-template-columns: repeat(3, 1fr)"
            >
              <div
                class="flex items-center justify-center px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm text-center"
                :style="
                  selectedYear === ''
                    ? {
                        backgroundColor: 'hsl(var(--accent))',
                        color: 'hsl(var(--accent-foreground))',
                      }
                    : {}
                "
                @click="selectedYear = ''"
              >
                <span>全部</span>
              </div>
              <div
                v-for="y in allYears"
                :key="y"
                class="flex items-center justify-center px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm text-center"
                :style="
                  selectedYear === y
                    ? {
                        backgroundColor: 'hsl(var(--accent))',
                        color: 'hsl(var(--accent-foreground))',
                      }
                    : {}
                "
                @click="selectedYear = y"
              >
                <span>{{ y }}</span>
              </div>
            </div>
          </div>
          <div>
            <div class="text-sm font-medium mb-2">语言</div>
            <div
              class="grid gap-2"
              style="grid-template-columns: repeat(2, 1fr)"
            >
              <div
                class="flex items-center justify-center px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm text-center"
                :style="
                  selectedLanguage === ''
                    ? {
                        backgroundColor: 'hsl(var(--accent))',
                        color: 'hsl(var(--accent-foreground))',
                      }
                    : {}
                "
                @click="selectedLanguage = ''"
              >
                <span>全部</span>
              </div>
              <div
                v-for="l in allLanguages"
                :key="l"
                class="flex items-center justify-center px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm text-center"
                :style="
                  selectedLanguage === l
                    ? {
                        backgroundColor: 'hsl(var(--accent))',
                        color: 'hsl(var(--accent-foreground))',
                      }
                    : {}
                "
                @click="selectedLanguage = l"
              >
                <span>{{ l }}</span>
              </div>
            </div>
          </div>
        </div>
      </NPopover>
    </div>

    <!-- 排行榜 / Bangumi：按分类横向滚动 -->
    <template v-if="isRankOrBangumi">
      <div
        v-for="cfg in categories"
        :key="`${cfg.subtype}_${cfg.week || ''}`"
        class="mb-6"
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-bold">{{ cfg.title }}</h3>
          <NButton
            text
            size="small"
            @click="
              router.push({
                name: 'DiscoveryRecommend',
                query: {
                  type: cfg.type,
                  subtype: cfg.subtype,
                  week: cfg.week || '',
                  title: cfg.title,
                },
              })
            "
          >
            更多 >
          </NButton>
        </div>

        <NSpin :show="loadingMap[`${cfg.subtype}_${cfg.week || ''}`]">
          <div
            v-if="
              filterItems(
                categoryItems[`${cfg.subtype}_${cfg.week || ''}`] || [],
              ).length > 0
            "
            class="flex gap-4 overflow-x-auto pb-2 px-1"
            style="scroll-snap-type: x mandatory"
          >
            <MediaCard
              v-for="item in filterItems(
                categoryItems[`${cfg.subtype}_${cfg.week || ''}`] || [],
              )"
              :key="item.id"
              :id="item.id"
              :tmdb-id="item.tmdbid"
              :title="item.title"
              :poster="item.image"
              :type="item.type"
              :media-type="item.media_type"
              :vote="item.vote"
              :year="item.year"
              :overview="item.overview"
              :fav="item.fav"
              :rssid="item.rssid"
              :genres="item.genres"
              :countries="item.countries"
              :languages="item.languages"
              class="flex-shrink-0"
              style="width: 160px; scroll-snap-align: start"
              @search="handleSearchFromCard"
            />
          </div>
          <div v-else class="text-sm text-muted-foreground py-4">暂无数据</div>
        </NSpin>
      </div>
    </template>

    <!-- 单列表页：豆瓣电影/电视剧/TMDB -->
    <template v-else>
      <NSpin :show="loadingMap.single">
        <div
          v-if="filterItems(categoryItems.single || []).length > 0"
          class="grid gap-4"
          style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))"
        >
          <MediaCard
            v-for="item in filterItems(categoryItems.single || [])"
            :key="item.id"
            :id="item.id"
            :tmdb-id="item.tmdbid"
            :title="item.title"
            :poster="item.image"
            :type="item.type"
            :media-type="item.media_type"
            :vote="item.vote"
            :year="item.year"
            :overview="item.overview"
            :fav="item.fav"
            :rssid="item.rssid"
            :genres="item.genres"
            :countries="item.countries"
            :languages="item.languages"
            @search="handleSearchFromCard"
          />
        </div>
        <div v-else class="text-center text-muted-foreground py-12">
          暂无数据
        </div>
      </NSpin>
      <!-- 无限滚动哨兵 -->
      <div
        v-if="!isRankOrBangumi"
        ref="sentinelRef"
        class="h-8 w-full flex items-center justify-center mt-4"
      >
        <NSpin v-if="singleLoadingMore" size="small" />
        <span
          v-else-if="!singleHasMore && (categoryItems.single || []).length > 0"
          class="text-sm text-muted-foreground"
          >已加载全部</span
        >
      </div>
    </template>

    <!-- 搜索进度模态框 -->
    <NModal
      v-model:show="searchModalVisible"
      preset="card"
      :title="searchModalTitle"
      style="width: 420px"
      :mask-closable="false"
      :closable="false"
    >
      <div class="text-center py-2">
        <NProgress
          type="line"
          :percentage="searchModalProgress"
          processing
          class="mb-2"
        />
        <div class="text-sm text-gray-500">
          {{ searchModalText }}
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.genre-tab {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
}

.genre-tab.active {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.genre-tab.active::after {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 20px;
  height: 3px;
  content: '';
  background-color: hsl(var(--primary));
  border-radius: 2px;
  transform: translateX(-50%);
}

.genre-tabs::-webkit-scrollbar {
  display: none;
}

.line-clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.line-clamp-3 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
</style>
