<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { NButton, NSpin, useMessage } from 'naive-ui';

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

import CastList from './components/CastList.vue';
import FactPanel from './components/FactPanel.vue';
import HeroSection from './components/HeroSection.vue';
import MediaGrid from './components/MediaGrid.vue';
import SeasonList from './components/SeasonList.vue';

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
  if (t.toLowerCase() === 'movie') return 'movie';
  if (t.toLowerCase() === 'tv') return 'tv';
  return t;
});

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
      fav.value = String(res.fav || '0');
      seasons.value = Array.isArray(res.seasons) ? res.seasons : [];
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

  webSearchApi({
    search_word: detail.value.title,
    tmdbid: mediaId.value,
    media_type: mediaType.value,
  }).catch(() => {});

  router.push({
    name: 'MediaSearch',
    query: {
      s: detail.value.title || '',
      from: 'detail',
    },
  });

  searching.value = false;
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
});

watch([() => route.query.id, () => route.query.type], () => {
  loadDetail();
  loadSimilar();
  loadRecommends();
});
</script>

<template>
  <div class="p-4 lg:p-6">
    <PageHeader title="媒体详情" />

    <NSpin :show="loading">
      <div v-if="detail.title" class="mt-6">
        <HeroSection
          :detail="detail"
          :fav="fav"
          :searching="searching"
          :seasons="seasons"
          @search="handleSearch"
          @subscribe="handleSubscribe"
        />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div class="space-y-6 lg:col-span-3">
            <CastList
              v-if="detail.crews && detail.crews.length > 0"
              :crews="detail.crews"
            />

            <SeasonList
              v-if="seasons.length > 0"
              :seasons="seasons"
              @search="handleSearch"
            />

            <MediaGrid
              v-if="similar.length > 0"
              title="类似影片"
              icon="lucide:film"
              :items="similar"
              @click="goDetail"
            />

            <MediaGrid
              v-if="recommends.length > 0"
              title="推荐影片"
              icon="lucide:thumbs-up"
              :items="recommends"
              @click="goDetail"
            />
          </div>

          <div class="lg:col-span-1">
            <FactPanel
              v-if="detail.fact && detail.fact.length > 0"
              :facts="detail.fact"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="!loading"
        class="flex flex-col items-center gap-4 py-16 text-center"
        style="color: hsl(var(--muted-foreground))"
      >
        <span>未找到媒体信息</span>
        <NButton size="small" @click="router.push({ name: 'Dashboard' })">
          返回首页
        </NButton>
      </div>
    </NSpin>
  </div>
</template>
