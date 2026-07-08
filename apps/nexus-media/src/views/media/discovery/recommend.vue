<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { NModal, NProgress, NSpin } from 'naive-ui';

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
  fav?: string;
  media_type?: string;
  tmdbid?: string;
  rssid?: string;
}

const route = useRoute();
const router = useRouter();
const notification = useAppNotification();

const items = ref<RecommendItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const hasMore = ref(true);

const pageTitle = ref(String(route.query.title || '更多推荐'));
const queryType = ref(String(route.query.type || ''));
const querySubtype = ref(String(route.query.subtype || ''));
const queryWeek = ref(String(route.query.week || ''));

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

async function loadItems(page: number, append = false) {
  if (page === 1) loading.value = true;
  else loadingMore.value = true;
  try {
    const res: any = await getRecommendApi({
      type: queryType.value,
      subtype: querySubtype.value,
      page,
      ...(queryWeek.value ? { week: queryWeek.value } : {}),
    } as any);
    const list = Array.isArray(res) ? res : res?.data || [];
    if (append) {
      items.value.push(...list);
    } else {
      items.value = list;
    }
    if (list.length === 0) hasMore.value = false;
  } finally {
    loading.value = false;
    loadingMore.value = false;
    nextTick(() => checkInfiniteScroll());
  }
}

function handleSearchFromCard(item: Record<string, any>) {
  handleSearch({
    id: item.tmdbId || item.id,
    title: item.title,
    media_type: item.mediaType || item.type,
    type: item.type,
  } as any);
}

async function handleSearch(item: RecommendItem) {
  searchModalTitle.value = `正在搜索 ${item.title} ...`;
  searchModalVisible.value = true;
  startSearchProgressPoll();
  try {
    await webSearchApi({
      search_word: item.title,
      tmdbid: item.id,
      media_type: item.media_type || item.type,
    });
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

// Intersection Observer for infinite scroll
const sentinelRef = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;

function checkInfiniteScroll() {
  if (!sentinelRef.value) return;
  if (hasMore.value && !loadingMore.value && !loading.value) {
    const rect = sentinelRef.value.getBoundingClientRect();
    if (rect.top < window.innerHeight + 100) {
      currentPage.value += 1;
      loadItems(currentPage.value, true);
    }
  }
}

onMounted(() => {
  loadItems(1);
  if (sentinelRef.value) {
    observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !loading.value &&
          !loadingMore.value &&
          hasMore.value
        ) {
          currentPage.value += 1;
          loadItems(currentPage.value, true);
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(sentinelRef.value);
  }
});

onUnmounted(() => {
  stopSearchProgressPoll();
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});

watch(
  () => route.query,
  () => {
    pageTitle.value = String(route.query.title || '更多推荐');
    queryType.value = String(route.query.type || '');
    querySubtype.value = String(route.query.subtype || '');
    queryWeek.value = String(route.query.week || '');
    items.value = [];
    currentPage.value = 1;
    hasMore.value = true;
    loadItems(1);
  },
  { deep: true },
);
</script>

<template>
  <div class="p-4">
    <PageHeader :title="pageTitle" subtitle="探索更多精彩内容" />
    <NSpin :show="loading && items.length === 0">
      <div
        v-if="items.length > 0"
        class="grid gap-4 mt-4"
        style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))"
      >
        <MediaCard
          v-for="item in items"
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
          @search="handleSearchFromCard"
        />
      </div>
      <div v-else-if="!loading" class="text-center text-muted-foreground py-12">
        暂无数据
      </div>
    </NSpin>
    <div
      ref="sentinelRef"
      class="h-8 w-full flex items-center justify-center mt-4"
    >
      <NSpin v-if="loadingMore" size="small" />
      <span
        v-else-if="!hasMore && items.length > 0"
        class="text-sm text-muted-foreground"
        >已加载全部</span
      >
    </div>

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
        <div class="text-sm text-muted-foreground">
          {{ searchModalText }}
        </div>
      </div>
    </NModal>
  </div>
</template>
