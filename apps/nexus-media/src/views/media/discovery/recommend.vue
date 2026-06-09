<script lang="ts" setup>
import type { SubscribeConfirmItem } from '#/components/subscribe/SubscribeConfirmModal.vue';
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { NSpin, useNotification } from 'naive-ui';

import { getRecommendApi, webSearchApi } from '#/api';
import {
  addSubscriptionApi,
  addSubscriptionMediaApi,
} from '#/api/modules/subscription';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscribeConfirmModal from '#/components/subscribe/SubscribeConfirmModal.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';

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

const route = useRoute();
const router = useRouter();
const notification = useNotification();

const items = ref<RecommendItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const hasMore = ref(true);
const hoveredId = ref<null | string>(null);

// 订阅确认弹窗
const subscribeConfirmShow = ref(false);
const subscribeConfirmItem = ref<null | SubscribeConfirmItem>(null);
const subscribeConfirmPending = ref(false);

const subscribeEditShow = ref(false);
const subscribeEditItem = ref<null | SubscribeEditItem>(null);

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
  }
}

function handleCardClick(item: RecommendItem) {
  const mediaId = item.tmdbid || item.id;
  if (!mediaId) return;
  const typeParam = item.type || item.media_type || 'movie';
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
  try {
    await webSearchApi({
      search_word: item.title,
      tmdbid: item.id,
      media_type: item.media_type || item.type,
    });
    router.push(
      `/media/search?s=${encodeURIComponent(item.title)}&from=discovery`,
    );
  } catch (error: any) {
    notification.error({
      content: '搜索失败',
      description: error?.message || '未知错误',
    });
  }
}

function normalizeMediaType(type?: string): 'movie' | 'tv' {
  if (!type) return 'movie';
  const t = String(type).toLowerCase().trim();
  if (t === 'movie') return 'movie';
  return 'tv';
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
    const typeParam = item.type === 'movie' ? 'movie' : 'tv';
    if (typeParam === 'tv' && seasons.length > 0) {
      for (const season of seasons) {
        await addSubscriptionMediaApi({
          name: item.title,
          year: item.year || '',
          type: 'tv',
          mediaid: String(item.id),
          season: String(season),
        });
      }
      notification.success({
        content: '订阅成功',
        description: `${item.title} 已订阅 ${seasons.length} 季`,
      });
    } else {
      const res: any = await addSubscriptionMediaApi({
        name: item.title,
        year: item.year || '',
        type: typeParam,
        mediaid: String(item.id),
      });
      const success =
        res?.code === 0 ||
        res?.success ||
        res?.rssid ||
        res?.msg?.includes('成功') ||
        !res;
      if (success) {
        notification.success({
          content: '订阅成功',
          description: res?.msg || `${item.title} 已添加订阅`,
        });
      } else {
        notification.error({
          content: '订阅失败',
          description: res?.msg || '未知错误',
        });
      }
    }
  } catch (error: any) {
    notification.error({
      content: '订阅失败',
      description: error?.message || '未知错误',
    });
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
    type: item.type === 'movie' ? 'movie' : 'tv',
    tmdbid: String(item.tmdbid || item.id || ''),
    image: item.image,
    season: '',
  };
  subscribeEditShow.value = true;
}

async function handleConfirmEdit(data: Record<string, any>) {
  try {
    await addSubscriptionApi(data);
    notification.success({
      content: '订阅成功',
      description: `${data.name} 已添加订阅`,
    });
  } catch (error: any) {
    notification.error({
      content: '订阅失败',
      description: error?.message || '未知错误',
    });
  }
}

function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return src;
}

// Intersection Observer for infinite scroll
const sentinelRef = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;

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
        <div
          v-for="item in items"
          :key="item.id"
          class="cursor-pointer relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
          @click="handleCardClick(item)"
          @mouseenter="hoveredId = item.id"
          @mouseleave="hoveredId = null"
        >
          <div style="aspect-ratio: 2/3" class="bg-muted">
            <img
              :src="getImgUrl(item.image)"
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
            v-if="item.media_type || item.type"
            class="absolute top-1.5 left-1.5 text-white text-[10px] px-1.5 py-0.5 rounded"
            :class="
              (item.media_type || item.type) === 'movie'
                ? 'bg-primary'
                : 'bg-accent'
            "
          >
            {{ item.media_type || item.type }}
          </span>
          <!-- 右上角：评分 + 已入库绿勾 -->
          <div class="absolute top-1.5 right-1.5 flex items-center gap-1">
            <span
              v-if="item.vote && item.vote !== '0.0' && item.vote !== '0'"
              class="text-white text-[10px] px-1.5 py-0.5 rounded bg-secondary"
            >
              {{ item.vote }}
            </span>
            <span
              v-if="item.fav === '2'"
              class="bg-success rounded-full p-0.5 flex items-center justify-center"
            >
              <IconifyIcon
                icon="lucide:check"
                class="text-white"
                style="width: 12px; height: 12px"
              />
            </span>
          </div>
          <div
            v-if="hoveredId === item.id"
            class="absolute inset-0 bg-background/80 flex flex-col justify-between p-2"
          >
            <div class="text-foreground">
              <div v-if="item.year" class="text-xs font-semibold">
                {{ item.year }}
              </div>
              <h4 class="text-sm font-bold mt-0.5 line-clamp-2">
                {{ item.title }}
              </h4>
              <p
                v-if="item.overview"
                class="text-xs mt-1 line-clamp-3 opacity-90"
              >
                {{ item.overview }}
              </p>
            </div>
            <div class="flex justify-between items-center">
              <button
                class="text-foreground hover:text-primary"
                @click="(e) => handleSearch(item, e)"
              >
                <IconifyIcon icon="lucide:search" class="size-[18px]" />
              </button>
              <button
                :class="
                  item.fav === '1'
                    ? 'text-destructive'
                    : 'text-foreground hover:text-destructive/80'
                "
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
