<script lang="ts" setup>
import type { SubscribeConfirmItem } from '#/components/subscribe/SubscribeConfirmModal.vue';
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

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
  addSubscriptionApi,
  addSubscriptionMediaApi,
  getDefaultSubscriptionSettingApi,
  removeSubscriptionApi,
} from '#/api/modules/subscription';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscribeConfirmModal from '#/components/subscribe/SubscribeConfirmModal.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';

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
const subSeasons = ref<number[]>([]);
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
const isTv = computed(() => mediaType.value !== 'movie');

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
      subSeasons.value = Array.isArray(res.sub_seasons)
        ? res.sub_seasons.map(Number)
        : [];
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

  let sessionId = '';
  try {
    const resp: any = await webSearchApi({
      search_word: detail.value.title,
      tmdbid: mediaId.value,
      media_type: mediaType.value,
    });
    sessionId = resp?.session_id || '';
  } catch {}

  router.push({
    name: 'MediaSearch',
    query: {
      s: detail.value.title || '',
      from: 'detail',
      ...(sessionId ? { session_id: sessionId } : {}),
    },
  });

  searching.value = false;
}

const subscribeConfirmShow = ref(false);
const subscribeConfirmItem = ref<null | SubscribeConfirmItem>(null);
const subscribeEditShow = ref(false);
const subscribeEditItem = ref<null | SubscribeEditItem>(null);

async function handleSubscribe() {
  // 电视剧：始终打开季选择框（未订阅=订阅，已订阅=追加其他季）
  if (isTv.value) {
    subscribeConfirmItem.value = {
      id: mediaId.value,
      tmdbid: mediaId.value,
      title: detail.value.title,
      year: detail.value.year || '',
      type: 'tv',
      image: detail.value.image || detail.value.poster,
      overview: detail.value.overview,
    };
    subscribeConfirmShow.value = true;
    return;
  }
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

async function handleConfirmSubscribe(payload: {
  add: number[];
  autoMode: boolean;
  remove: number[];
  selected: number[];
}) {
  const { add, remove, selected } = payload;
  if (add.length === 0 && remove.length === 0) return;
  try {
    for (const season of add) {
      await addSubscriptionMediaApi({
        name: detail.value.title,
        year: detail.value.year || '',
        type: 'tv',
        mediaid: mediaId.value,
        season: String(season),
      });
    }
    for (const season of remove) {
      await removeSubscriptionApi({
        name: detail.value.title,
        year: detail.value.year || '',
        type: 'tv',
        tmdbid: mediaId.value,
        season: String(season),
      });
    }
    fav.value = selected.length > 0 ? '1' : '0';
    subSeasons.value = [...selected].toSorted((a, b) => a - b);
    const parts: string[] = [];
    if (add.length > 0) parts.push(`订阅 ${add.length} 季`);
    if (remove.length > 0) parts.push(`退订 ${remove.length} 季`);
    message.success(`已${parts.join('、')}`);
  } catch {
    message.error('操作失败');
  } finally {
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
    await addSubscriptionApi(data);
    fav.value = '1';
    if (data.season) {
      const s = Number(data.season);
      if (!subSeasons.value.includes(s)) {
        subSeasons.value = [...subSeasons.value, s].toSorted((a, b) => a - b);
      }
    }
    message.success('已添加订阅');
  } catch {
    message.error('订阅失败');
  } finally {
    subscribeEditShow.value = false;
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
          :sub-seasons="subSeasons"
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
        <NButton size="small" @click="router.push({ name: 'Home' })">
          返回首页
        </NButton>
      </div>
    </NSpin>

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
