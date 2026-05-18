<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  NButton,
  NModal,
  NProgress,
  NSpin,
  useNotification,
} from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import { getRecommendApi, webSearchApi } from '#/api';
import { addRssMediaApi, addRssApi } from '#/api/modules/rss';
import SubscribeConfirmModal from '#/components/subscribe/SubscribeConfirmModal.vue';
import type { SubscribeConfirmItem } from '#/components/subscribe/SubscribeConfirmModal.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';
import PageHeader from '#/components/page/PageHeader.vue';

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
}

interface CategoryConfig {
  type: string;
  subtype: string;
  title: string;
  week?: string;
}

const route = useRoute();
const router = useRouter();
const notification = useNotification();

const loadingMap = ref<Record<string, boolean>>({});
const categoryItems = ref<Record<string, RecommendItem[]>>({});
const hoveredId = ref<string | null>(null);

// 单页滚动加载状态
const singlePage = ref(1);
const singleHasMore = ref(true);
const singleLoadingMore = ref(false);
const sentinelRef = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;

// 搜索进度模态框状态
const searchModalVisible = ref(false);
const searchModalTitle = ref('');
const searchModalProgress = ref(0);
const searchModalText = ref('请稍候...');
let searchProgressTimer: ReturnType<typeof setInterval> | null = null;

// 订阅确认弹窗
const subscribeConfirmShow = ref(false);
const subscribeConfirmItem = ref<SubscribeConfirmItem | null>(null);
const subscribeConfirmPending = ref(false);

const subscribeEditShow = ref(false);
const subscribeEditItem = ref<SubscribeEditItem | null>(null);

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
  }, 1000);
}

function stopSearchProgressPoll() {
  if (searchProgressTimer) {
    clearInterval(searchProgressTimer);
    searchProgressTimer = null;
  }
}

import { getProgressApi } from '#/api/modules/system';

// 各页面分类配置（key 用 route.name，不受父菜单 path 变化影响）
const pageCategories: Record<string, CategoryConfig[]> = {
  Ranking: [
    { type: 'MOV', subtype: 'dbom', title: '正在热映' },
    { type: 'MOV', subtype: 'dbnm', title: '即将上映' },
    { type: 'TRENDING', subtype: 'tmdb', title: 'TMDB流行趋势' },
    { type: 'MOV', subtype: 'dbhm', title: '豆瓣热门电影' },
    { type: 'MOV', subtype: 'dbtop', title: '豆瓣电影TOP250' },
    { type: 'TV', subtype: 'dbht', title: '豆瓣热门剧集' },
    { type: 'TV', subtype: 'dbdh', title: '豆瓣热门动漫' },
    { type: 'TV', subtype: 'dbzy', title: '豆瓣热门综艺' },
    { type: 'TV', subtype: 'dbct', title: '华语口碑剧集榜' },
    { type: 'TV', subtype: 'dbgt', title: '全球口碑剧集榜' },
  ],
  Bangumi: [
    { type: 'TV', subtype: 'bangumi', title: '星期一', week: '1' },
    { type: 'TV', subtype: 'bangumi', title: '星期二', week: '2' },
    { type: 'TV', subtype: 'bangumi', title: '星期三', week: '3' },
    { type: 'TV', subtype: 'bangumi', title: '星期四', week: '4' },
    { type: 'TV', subtype: 'bangumi', title: '星期五', week: '5' },
    { type: 'TV', subtype: 'bangumi', title: '星期六', week: '6' },
    { type: 'TV', subtype: 'bangumi', title: '星期日', week: '7' },
  ],
};

// 单列表页面配置
const singlePageMap: Record<string, CategoryConfig> = {
  DoubanMovie: { type: 'MOV', subtype: 'dbhm', title: '豆瓣电影' },
  DoubanTv: { type: 'TV', subtype: 'dbht', title: '豆瓣电视剧' },
  TmdbMovie: { type: 'MOV', subtype: 'nm', title: 'TMDB电影' },
  TmdbTv: { type: 'TV', subtype: 'nt', title: 'TMDB电视剧' },
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

function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return src;
}

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
    const list = Array.isArray(res) ? res : (res?.data || []);
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
    const list = Array.isArray(res) ? res : (res?.data || []);
    const existing = categoryItems.value[key] || [];
    categoryItems.value[key] = [...existing, ...list];
    if (list.length === 0) singleHasMore.value = false;
  } finally {
    loadingMap.value[key] = false;
    singleLoadingMore.value = false;
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

function handleCardClick(item: RecommendItem) {
  const mediaId = item.tmdbid || item.id;
  if (!mediaId) return;
  // 使用 MOV/TV 而非 movie/tv，后端 MovieTypes 只认前者
  const typeParam = item.type || item.media_type || 'MOV';
  router.push({
    name: 'MediaDetail',
    query: {
      type: typeParam,
      id: mediaId,
    },
  });
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
        router.push(`/media/search?s=${encodeURIComponent(item.title)}&from=discovery`);
      }
    }, 500);
  } catch (err: any) {
    stopSearchProgressPoll();
    searchModalVisible.value = false;
    notification.error({ content: '搜索失败', description: err?.message || '未知错误' });
  }
}

function normalizeMediaType(type?: string): 'MOV' | 'TV' {
  if (!type) return 'MOV';
  const t = String(type).toUpperCase().trim();
  if (t === 'MOV' || t === 'MOVIE' || t === '电影') return 'MOV';
  return 'TV';
}

function handleSubscribe(item: RecommendItem, e: Event) {
  e.stopPropagation();
  subscribeConfirmItem.value = {
    id: item.id,
    tmdbid: item.tmdbid,
    title: item.title,
    year: item.year || '',
    type: normalizeMediaType(item.media_type || item.type),
    image: item.image,
    overview: item.overview,
  };
  subscribeConfirmShow.value = true;
}

async function handleConfirmSubscribe(seasons: number[], _autoMode: boolean) {
  const item = subscribeConfirmItem.value;
  if (!item) return;
  subscribeConfirmPending.value = true;
  try {
    const typeParam = item.type === 'MOV' ? 'MOV' : 'TV';
    if (typeParam === 'TV' && seasons.length > 0) {
      // 多季批量订阅
      for (const season of seasons) {
        await addRssMediaApi({
          name: item.title,
          year: item.year || '',
          type: 'TV',
          mediaid: String(item.id),
          season: String(season),
        });
      }
      notification.success({ content: '订阅成功', description: `${item.title} 已订阅 ${seasons.length} 季` });
    } else {
      const res: any = await addRssMediaApi({
        name: item.title,
        year: item.year || '',
        type: typeParam,
        mediaid: String(item.id),
      });
      const success = res?.code === 0 || res?.success || res?.rssid || res?.msg?.includes('成功') || !res;
      if (success) {
        notification.success({ content: '订阅成功', description: res?.msg || `${item.title} 已添加订阅` });
      } else {
        notification.error({ content: '订阅失败', description: res?.msg || '未知错误' });
      }
    }
  } catch (err: any) {
    notification.error({ content: '订阅失败', description: err?.message || '未知错误' });
  } finally {
    subscribeConfirmPending.value = false;
  }
}

function handleEditSubscribe() {
  const item = subscribeConfirmItem.value;
  if (!item) return;
  subscribeEditItem.value = {
    name: item.title,
    year: item.year || '',
    type: item.type === 'MOV' ? 'MOV' : 'TV',
    tmdbid: String(item.tmdbid || item.id || ''),
    image: item.image,
    season: '',
  };
  subscribeEditShow.value = true;
}

async function handleConfirmEdit(data: Record<string, any>) {
  try {
    await addRssApi(data);
    notification.success({ content: '订阅成功', description: `${data.name} 已添加订阅` });
  } catch (err: any) {
    notification.error({ content: '订阅失败', description: err?.message || '未知错误' });
  }
}

// subscribe modal usage (template end) already added in previous diff

watch(() => route.path, () => {
  categoryItems.value = {};
  singlePage.value = 1;
  singleHasMore.value = true;
  loadAll();
}, { immediate: true });

function setupInfiniteScroll() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (!singleConfig.value || !sentinelRef.value) return;
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && !loadingMap.value['single'] && !singleLoadingMore.value && singleHasMore.value) {
      singlePage.value += 1;
      loadSingle();
    }
  }, { rootMargin: '100px' });
  observer.observe(sentinelRef.value);
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
        <NButton @click="loadAll()">
          刷新
        </NButton>
      </template>
    </PageHeader>

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
            @click="router.push({ name: 'DiscoveryRecommend', query: { type: cfg.type, subtype: cfg.subtype, week: cfg.week || '', title: cfg.title } })"
          >
            更多 >
          </NButton>
        </div>

        <NSpin :show="loadingMap[`${cfg.subtype}_${cfg.week || ''}`]">
          <div
            v-if="(categoryItems[`${cfg.subtype}_${cfg.week || ''}`] || []).length > 0"
            class="flex gap-4 overflow-x-auto pb-2 px-1"
            style="scroll-snap-type: x mandatory;"
          >
            <div
              v-for="item in categoryItems[`${cfg.subtype}_${cfg.week || ''}`]"
              :key="item.id"
              class="flex-shrink-0 cursor-pointer relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
              style="width: 160px; scroll-snap-align: start;"
              @click="handleCardClick(item)"
              @mouseenter="hoveredId = item.id"
              @mouseleave="hoveredId = null"
            >
              <!-- 海报 -->
              <div style="aspect-ratio: 2/3;" class="bg-gray-100 dark:bg-gray-800">
                <img
                  :src="getImgUrl(item.image)"
                  class="w-full h-full object-cover"
                  alt=""
                  @error="(e: any) => { e.target.src = '/static/img/no-image.png'; }"
                />
              </div>

              <!-- 左上角标签 -->
              <span
                v-if="item.media_type || item.type"
                class="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded"
                :style="{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }"
              >
                {{ item.media_type || item.type }}
              </span>

              <!-- 右上角：评分 + 已入库绿勾 -->
              <div class="absolute top-1.5 right-1.5 flex items-center gap-1">
                <span
                  v-if="item.vote && item.vote !== '0.0' && item.vote !== '0'"
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  :style="{ backgroundColor: '#7c3aed', color: '#ffffff' }"
                >
                  {{ item.vote }}
                </span>
                <span
                  v-if="item.fav === '2'"
                  class="rounded-full p-0.5 flex items-center justify-center"
                  :style="{ backgroundColor: 'hsl(var(--success))', color: 'hsl(var(--primary-foreground))' }"
                >
                  <IconifyIcon icon="lucide:check" :style="{ width: '12px', height: '12px', color: 'hsl(var(--primary-foreground))' }" />
                </span>
              </div>

              <!-- 悬停遮罩 -->
              <div
                v-if="hoveredId === item.id"
                class="absolute inset-0 bg-background/80 flex flex-col justify-between p-2"
              >
                <div class="text-foreground">
                  <div v-if="item.year" class="text-xs font-semibold">{{ item.year }}</div>
                  <h4 class="text-sm font-bold mt-0.5 line-clamp-2">{{ item.title }}</h4>
                  <p v-if="item.overview" class="text-xs mt-1 line-clamp-3 opacity-90">{{ item.overview }}</p>
                </div>
                <div class="flex justify-between items-center">
                  <button
                    class="text-foreground hover:text-primary"
                    @click="(e) => handleSearch(item, e)"
                  >
                    <IconifyIcon icon="lucide:search" class="size-[18px]" />
                  </button>
                  <button
                    :class="item.fav === '1' ? 'text-destructive' : 'text-foreground hover:text-destructive/80'"
                    @click="(e) => handleSubscribe(item, e)"
                  >
                    <IconifyIcon
                      icon="lucide:heart"
                      class="size-[18px]"
                      :style="{ fill: item.fav === '1' ? 'currentColor' : 'none' }"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-muted-foreground py-4">暂无数据</div>
        </NSpin>
      </div>
    </template>

    <!-- 单列表页：豆瓣电影/电视剧/TMDB -->
    <template v-else>
      <NSpin :show="loadingMap['single']">
        <div
          v-if="(categoryItems['single'] || []).length > 0"
          class="grid gap-4"
          style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));"
        >
          <div
            v-for="item in categoryItems['single']"
            :key="item.id"
            class="cursor-pointer relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
            @click="handleCardClick(item)"
            @mouseenter="hoveredId = item.id"
            @mouseleave="hoveredId = null"
          >
            <div style="aspect-ratio: 2/3;" class="bg-muted">
              <img
                :src="getImgUrl(item.image)"
                class="w-full h-full object-cover"
                alt=""
                @error="(e: any) => { e.target.src = '/static/img/no-image.png'; }"
              />
            </div>

            <!-- 左上角标签 -->
            <span
              v-if="item.media_type || item.type"
              class="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded"
              :style="{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }"
            >
              {{ item.media_type || item.type }}
            </span>
            <!-- 右上角：评分 + 已入库绿勾 -->
            <div class="absolute top-1.5 right-1.5 flex items-center gap-1">
              <span
                v-if="item.vote && item.vote !== '0.0' && item.vote !== '0'"
                class="text-[10px] px-1.5 py-0.5 rounded"
                :style="{ backgroundColor: '#7c3aed', color: '#ffffff' }"
              >
                {{ item.vote }}
              </span>
              <span
                v-if="item.fav === '2'"
                class="rounded-full p-0.5 flex items-center justify-center"
                :style="{ backgroundColor: 'hsl(var(--success))', color: 'hsl(var(--primary-foreground))' }"
              >
                <IconifyIcon icon="lucide:check" :style="{ width: '12px', height: '12px', color: 'hsl(var(--primary-foreground))' }" />
              </span>
            </div>

            <div
              v-if="hoveredId === item.id"
              class="absolute inset-0 bg-background/80 flex flex-col justify-between p-2"
            >
              <div class="text-foreground">
                <div v-if="item.year" class="text-xs font-semibold">{{ item.year }}</div>
                <h4 class="text-sm font-bold mt-0.5 line-clamp-2">{{ item.title }}</h4>
                <p v-if="item.overview" class="text-xs mt-1 line-clamp-3 opacity-90">{{ item.overview }}</p>
              </div>
              <div class="flex justify-between items-center">
                <button
                  class="text-foreground hover:text-primary"
                  @click="(e) => handleSearch(item, e)"
                >
                  <IconifyIcon icon="lucide:search" class="size-[18px]" />
                </button>
                <button
                  :class="item.fav === '1' ? 'text-destructive' : 'text-foreground hover:text-destructive/80'"
                  @click="(e) => handleSubscribe(item, e)"
                >
                  <IconifyIcon
                    icon="lucide:heart"
                    class="size-[18px]"
                    :style="{ fill: item.fav === '1' ? 'currentColor' : 'none' }"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-muted-foreground py-12">暂无数据</div>
      </NSpin>
      <!-- 无限滚动哨兵 -->
      <div v-if="!isRankOrBangumi" ref="sentinelRef" class="h-8 w-full flex items-center justify-center mt-4">
        <NSpin v-if="singleLoadingMore" size="small" />
        <span v-else-if="!singleHasMore && (categoryItems['single'] || []).length > 0" class="text-sm text-muted-foreground">已加载全部</span>
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

    <!-- 订阅确认弹窗 -->
    <SubscribeConfirmModal
      v-model:show="subscribeConfirmShow"
      :item="subscribeConfirmItem"
      @confirm="handleConfirmSubscribe"
      @edit="handleEditSubscribe"
    />

    <!-- 编辑订阅弹窗 -->
    <SubscribeEditModal
      v-model:show="subscribeEditShow"
      :item="subscribeEditItem"
      @confirm="handleConfirmEdit"
    />
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
