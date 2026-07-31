<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { NSpin } from 'naive-ui';

import { getRecommendApi } from '#/api';
import MediaCard from '#/components/media/MediaCard.vue';
import PageHeader from '#/components/page/PageHeader.vue';

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
  genres?: string[];
  countries?: string[];
  languages?: string[];
}

const route = useRoute();
const router = useRouter();

const items = ref<RecommendItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const hasMore = ref(true);

const pageTitle = ref(String(route.query.title || '更多推荐'));
const queryType = ref(String(route.query.type || ''));
const querySubtype = ref(String(route.query.subtype || ''));
const queryWeek = ref(String(route.query.week || ''));

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
  router.push(
    `/media/search?s=${encodeURIComponent(item.title)}&from=discovery&tmdbid=${encodeURIComponent(item.id || '')}`,
  );
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
          :genres="item.genres"
          :countries="item.countries"
          :languages="item.languages"
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
  </div>
</template>
