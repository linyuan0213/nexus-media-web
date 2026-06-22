<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSpin, NTag, useMessage } from 'naive-ui';

import {
  getMediaDetailApi,
  getRecommendationsApi,
  getSimilarApi,
  webSearchApi,
} from '#/api/modules/media';
import {
  addSubscriptionMediaApi,
  removeSubscriptionApi,
} from '#/api/modules/subscription';
import PageHeader from '#/components/page/PageHeader.vue';

const route = useRoute();
const router = useRouter();
const message = useMessage();

const loading = ref(true);
const detail = ref<Record<string, any>>({});
const seasons = ref<any[]>([]);
const similar = ref<any[]>([]);
const recommends = ref<any[]>([]);
const fav = ref<string>('0');

const mediaId = computed(() => String(route.query.id || ''));
const mediaType = computed(() => {
  const t = String(route.query.type || 'movie');
  // 统一兼容 movie/tv -> MOV/TV
  if (t.toLowerCase() === 'movie') return 'movie';
  if (t.toLowerCase() === 'tv') return 'tv';
  return t;
});

function replaceLocalhost(url?: any) {
  if (!url) return '';
  const s = String(url);
  return s.replace(
    /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?/,
    window.location.origin,
  );
}

async function loadDetail() {
  if (!mediaId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const res: any = await getMediaDetailApi(mediaId.value, mediaType.value);
    if (res && typeof res === 'object' && res.title) {
      detail.value = res;
      // 后端 fav 语义："2"=已入库, "1"=已订阅, ""=无
      fav.value = String(res.fav || '0');
      seasons.value = Array.isArray(res.seasons) ? res.seasons : [];
      // 详情加载成功后再加载相似/推荐（豆瓣数据可能通过标题匹配到TMDB）
      if (detail.value.tmdbid) {
        loadSimilar();
        loadRecommends();
      }
    } else {
      message.error('无法查询到TMDB媒体信息');
      router.back();
    }
  } catch (error: any) {
    message.error(error?.message || '加载详情失败');
  } finally {
    loading.value = false;
  }
}

async function loadSimilar() {
  const tid = detail.value.tmdbid;
  if (!tid) return;
  try {
    const res: any = await getSimilarApi({
      type: mediaType.value,
      tmdbid: String(tid),
      page: 1,
    });
    similar.value = Array.isArray(res) ? res : res?.Items || [];
  } catch (error: any) {
    console.error('[similar] error:', error);
  }
}

async function loadRecommends() {
  const tid = detail.value.tmdbid;
  if (!tid) return;
  try {
    const res: any = await getRecommendationsApi({
      type: mediaType.value,
      tmdbid: String(tid),
      page: 1,
    });
    recommends.value = Array.isArray(res) ? res : res?.Items || [];
  } catch (error: any) {
    console.error('[recommends] error:', error);
  }
}

const searching = ref(false);

async function handleSearch() {
  if (searching.value) return;
  searching.value = true;

  // 先跳转到搜索页，再后台触发搜索（避免同步阻塞导致页面卡住）
  router.push({
    name: 'MediaSearch',
    query: {
      s: encodeURIComponent(detail.value.title || ''),
      from: 'detail',
    },
  });

  // 后台触发搜索，不阻塞页面跳转
  try {
    await webSearchApi({
      search_word: detail.value.title,
      tmdbid: mediaId.value,
      media_type: mediaType.value,
    });
  } catch {
    // 搜索触发失败不影响页面跳转，搜索页会轮询进度
  } finally {
    searching.value = false;
  }
}

async function handleSubscribe() {
  try {
    if (fav.value === '1') {
      await removeSubscriptionApi({
        name: detail.value.title,
        year: detail.value.year || '',
        type: mediaType.value,
        rssid: detail.value.rssid,
        tmdbid: mediaId.value,
      });
      fav.value = '0';
      message.success('已删除订阅');
    } else {
      await addSubscriptionMediaApi({
        name: detail.value.title,
        year: detail.value.year || '',
        type: mediaType.value,
        mediaid: mediaId.value,
      });
      fav.value = '1';
      message.success('已添加订阅');
    }
  } catch {
    message.error('操作失败');
  }
}

function goDetail(item: any) {
  if (!item) return;
  const targetId = item.tmdbid || item.id;
  if (!targetId) return;
  router.push({
    name: 'MediaDetail',
    query: {
      type: item.type || 'movie',
      id: targetId,
    },
  });
}

onMounted(() => {
  loadDetail();
  // similar/recommends 现在由 loadDetail 成功后再调用
});

watch([() => route.query.id, () => route.query.type], () => {
  loadDetail();
  loadSimilar();
  loadRecommends();
});
</script>

<template>
  <div>
    <div class="px-4">
      <PageHeader title="媒体详情" />
    </div>

    <NSpin :show="loading">
      <div class="p-4">
        <!-- 有数据时显示 -->
        <template v-if="detail.title">
          <!-- 顶部信息区 -->
          <div class="relative mb-6 overflow-hidden rounded-lg">
            <!-- 背景图 -->
            <div
              v-if="detail.background || detail.backdrop"
              class="absolute inset-0 bg-cover bg-center"
              :style="{
                backgroundImage: `url(${replaceLocalhost(detail.background || detail.backdrop)})`,
              }"
            >
              <div class="absolute inset-0 bg-black/60"></div>
            </div>
            <div v-else class="absolute inset-0 bg-gray-800"></div>

            <div class="relative flex flex-col gap-4 p-4 md:flex-row md:p-6">
              <!-- 海报 -->
              <img
                v-if="detail.image || detail.poster"
                :src="replaceLocalhost(detail.image || detail.poster)"
                class="mx-auto h-56 w-36 rounded-lg object-cover shadow-lg sm:h-72 sm:w-48 md:mx-0"
                alt="poster"
              />
              <div
                v-else
                class="mx-auto h-56 w-36 rounded-lg bg-gray-700 sm:h-72 sm:w-48 md:mx-0"
              ></div>

              <!-- 信息 -->
              <div class="flex flex-1 flex-col justify-end text-white">
                <div class="mb-2">
                  <NTag v-if="fav === '2'" type="success" size="small">
                    已入库
                  </NTag>
                </div>
                <h1 class="mb-1 text-xl font-bold sm:text-2xl md:text-3xl">
                  {{ detail.title }}
                  <span
                    v-if="detail.year"
                    class="text-base font-normal opacity-80 sm:text-xl"
                    >({{ detail.year }})</span
                  >
                </h1>
                <div
                  class="mb-4 flex flex-wrap gap-x-2 gap-y-1 text-xs opacity-80 sm:text-sm"
                >
                  <span v-if="detail.runtime">{{ detail.runtime }}</span>
                  <span
                    v-if="detail.genres"
                    class="before:content-['|'] before:mr-2 before:text-white/30"
                    >{{ detail.genres }}</span
                  >
                  <span
                    v-if="seasons.length > 0"
                    class="before:content-['|'] before:mr-2 before:text-white/30"
                    >共 {{ seasons.length }} 季</span
                  >
                  <span
                    v-if="detail.link"
                    class="before:content-['|'] before:mr-2 before:text-white/30"
                  >
                    TMDB:
                    <a
                      :href="detail.link"
                      target="_blank"
                      class="text-primary-foreground hover:underline"
                      >{{ detail.tmdbid }}</a
                    >
                  </span>
                  <span
                    v-if="detail.douban_link"
                    class="before:content-['|'] before:mr-2 before:text-white/30"
                  >
                    豆瓣:
                    <a
                      :href="detail.douban_link"
                      target="_blank"
                      class="text-primary-foreground hover:underline"
                      >{{ detail.douban_id }}</a
                    >
                  </span>
                </div>

                <div class="flex flex-wrap gap-2">
                  <NButton
                    type="primary"
                    size="small"
                    :loading="searching"
                    @click="handleSearch"
                  >
                    <IconifyIcon icon="lucide:search" class="mr-1 size-4" />
                    搜索资源
                  </NButton>
                  <NButton
                    size="small"
                    :type="fav === '1' ? 'error' : 'default'"
                    :class="fav !== '1' ? 'subscribe-btn-unsub' : ''"
                    @click="handleSubscribe"
                  >
                    <IconifyIcon
                      :icon="fav === '1' ? 'lucide:heart' : 'lucide:heart-off'"
                      class="mr-1 size-4"
                    />
                    {{ fav === '1' ? '已订阅' : '订阅' }}
                  </NButton>
                  <NButton
                    v-if="detail.item_url"
                    type="success"
                    size="small"
                    tag="a"
                    :href="detail.item_url"
                    target="_blank"
                  >
                    <IconifyIcon icon="lucide:play" class="mr-1 size-4" />
                    在线观看
                  </NButton>
                </div>
              </div>
            </div>
          </div>

          <!-- 简介与详情 -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <!-- 左侧：简介、演员、季集 -->
            <div class="lg:col-span-3 space-y-6">
              <div class="rounded-lg bg-card p-4 shadow-sm">
                <h2 class="mb-2 text-lg font-bold">简介</h2>
                <p class="text-sm leading-relaxed text-muted-foreground">
                  {{ detail.overview || '暂无简介' }}
                </p>
              </div>

              <!-- 演职人员 -->
              <div
                v-if="detail.crews && detail.crews.length > 0"
                class="rounded-lg bg-card p-4 shadow-sm"
              >
                <h2 class="mb-3 text-lg font-bold">演职人员</h2>
                <div
                  class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                >
                  <div v-for="(item, idx) in detail.crews" :key="idx">
                    <h3 class="font-bold">
                      {{ item && Object.keys(item)[0] }}
                    </h3>
                    <p class="text-sm text-muted-foreground">
                      {{ item && Object.values(item)[0] }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- 季集 -->
              <div
                v-if="seasons.length > 0"
                class="rounded-lg bg-card p-4 shadow-sm"
              >
                <h2 class="mb-3 text-lg font-bold">季集</h2>
                <div class="space-y-2">
                  <div
                    v-for="season in seasons"
                    :key="season.season_number"
                    class="flex items-center justify-between rounded border p-3 dark:border-border"
                  >
                    <div>
                      <div class="font-bold">
                        {{ season.name || `第 ${season.season_number} 季` }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{
                          season.episode_count
                            ? `共 ${season.episode_count} 集`
                            : ''
                        }}
                        {{ season.air_date ? ` | ${season.air_date}` : '' }}
                      </div>
                    </div>
                    <NButton size="tiny" @click="handleSearch">搜索</NButton>
                  </div>
                </div>
              </div>

              <!-- 类似影片 -->
              <div
                v-if="similar.length > 0"
                class="rounded-lg bg-card p-4 shadow-sm"
              >
                <h2 class="mb-3 text-lg font-bold">类似</h2>
                <div
                  class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                >
                  <div
                    v-for="item in similar"
                    :key="item.id || item.tmdbid"
                    class="cursor-pointer overflow-hidden rounded-lg shadow-sm transition hover:shadow-md"
                    @click="goDetail(item)"
                  >
                    <img
                      :src="replaceLocalhost(item.image || item.poster)"
                      class="h-40 w-full object-cover"
                      alt=""
                    />
                    <div class="p-2">
                      <div class="truncate text-sm font-medium">
                        {{ item.title }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ item.year }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 推荐影片 -->
              <div
                v-if="recommends.length > 0"
                class="rounded-lg bg-card p-4 shadow-sm"
              >
                <h2 class="mb-3 text-lg font-bold">推荐</h2>
                <div
                  class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                >
                  <div
                    v-for="item in recommends"
                    :key="item.id || item.tmdbid"
                    class="cursor-pointer overflow-hidden rounded-lg shadow-sm transition hover:shadow-md"
                    @click="goDetail(item)"
                  >
                    <img
                      :src="replaceLocalhost(item.image || item.poster)"
                      class="h-40 w-full object-cover"
                      alt=""
                    />
                    <div class="p-2">
                      <div class="truncate text-sm font-medium">
                        {{ item.title }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ item.year }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧：Facts -->
            <div class="lg:col-span-1">
              <div
                v-if="detail.fact && detail.fact.length > 0"
                class="rounded-lg bg-card p-4 shadow-sm"
              >
                <div
                  v-for="(item, idx) in detail.fact"
                  :key="idx"
                  class="flex justify-between border-b py-2 last:border-0 dark:border-border"
                >
                  <span class="font-medium">{{
                    item && Object.keys(item)[0]
                  }}</span>
                  <span class="text-right text-sm text-muted-foreground">{{
                    item && Object.values(item)[0]
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 无数据 -->
        <div
          v-else-if="!loading"
          class="flex flex-col items-center gap-4 py-12 text-center text-muted-foreground"
        >
          <span>未找到媒体信息</span>
          <NButton size="small" @click="router.push({ name: 'Dashboard' })">
            返回首页
          </NButton>
        </div>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: middle;
}

.subscribe-btn-unsub {
  color: #1f2937 !important;
  background-color: rgb(255 255 255 / 90%) !important;
  border-color: transparent !important;
}

.subscribe-btn-unsub:hover {
  background-color: rgb(255 255 255 / 100%) !important;
}
</style>
