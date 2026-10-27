<script lang="ts" setup>
import type { SubscribeConfirmItem } from '#/components/subscribe/SubscribeConfirmModal.vue';
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { NButton, NSpin, useMessage } from 'naive-ui';

import {
  getMediaDetailApi,
  getMediaDetailByRefApi,
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

const detailProvider = computed(() => String(route.query.provider || ''));
const detailExternalId = computed(() =>
  String(route.query.ref || route.query.external_id || ''),
);
const detailProfile = computed(() => String(route.query.profile || ''));
const isExternalDetail = computed(
  () => !!detailProvider.value && detailProvider.value !== 'tmdb',
);
const mediaId = computed(() =>
  String(
    isExternalDetail.value ? detailExternalId.value : route.query.id || '',
  ),
);
const subscribeMediaId = computed(() =>
  String(detail.value.mediaid || mediaId.value),
);
const mediaType = computed(() => {
  const t = String(route.query.type || 'movie');
  if (t.toLowerCase() === 'movie') return 'movie';
  if (t.toLowerCase() === 'tv') return 'tv';
  return t;
});
const isTv = computed(() => mediaType.value !== 'movie');
// TMDB 没有动漫类型：动漫/电视剧都走 tv 接口
const tmdbType = computed(() => (mediaType.value === 'movie' ? 'movie' : 'tv'));

async function loadDetail() {
  if (!mediaId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const res: any = isExternalDetail.value
      ? await getMediaDetailByRefApi(
          detailProvider.value,
          detailExternalId.value,
          mediaType.value,
          detailProfile.value,
          String(route.query.id || ''),
        )
      : await getMediaDetailApi(mediaId.value, tmdbType.value);
    if (res && typeof res === 'object' && res.title) {
      detail.value = res;
      fav.value = String(res.fav || '0');
      seasons.value = Array.isArray(res.seasons) ? res.seasons : [];
      subSeasons.value = Array.isArray(res.sub_seasons)
        ? res.sub_seasons.map(Number)
        : [];
      if (
        isExternalDetail.value &&
        Array.isArray(detail.value.similar) &&
        detail.value.similar.length > 0
      ) {
        similar.value = detail.value.similar;
      }
      if (detail.value.tmdbid) {
        if (!isExternalDetail.value || similar.value.length === 0)
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
  if (
    isExternalDetail.value &&
    Array.isArray(detail.value.similar) &&
    detail.value.similar.length > 0
  ) {
    similar.value = detail.value.similar;
    return;
  }
  const tid = detail.value.tmdbid;
  if (!tid) return;
  try {
    const res: any = await getSimilarApi({
      type: tmdbType.value,
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
      type: tmdbType.value,
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
      media_type: tmdbType.value,
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
      id: subscribeMediaId.value,
      tmdbid: subscribeMediaId.value,
      title: detail.value.title,
      year: detail.value.year || '',
      type: 'tv',
      image: detail.value.image || detail.value.poster,
      overview: detail.value.overview,
      content_profile: (detail.value as any).content_profile,
      metadata_ref: (detail.value as any).metadata_ref,
      provider: (detail.value as any).provider,
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
        content_profile: (detail.value as any).content_profile,
      });
      fav.value = '0';
      message.success('已删除订阅');
    } else {
      await addSubscriptionMediaApi({
        name: detail.value.title,
        year: detail.value.year || '',
        type: mediaType.value,
        mediaid: subscribeMediaId.value,
        content_profile: (detail.value as any).content_profile,
        metadata_ref: (detail.value as any).metadata_ref,
        provider: (detail.value as any).provider,
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
        mediaid: subscribeMediaId.value,
        season: String(season),
        content_profile: (detail.value as any).content_profile,
        metadata_ref: (detail.value as any).metadata_ref,
        provider: (detail.value as any).provider,
      });
    }
    for (const season of remove) {
      await removeSubscriptionApi({
        name: detail.value.title,
        year: detail.value.year || '',
        type: 'tv',
        tmdbid: subscribeMediaId.value,
        season: String(season),
        content_profile: (detail.value as any).content_profile,
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
    tmdbid: String(it.tmdbid || it.id || ''),
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
    await (isCustom ? addSubscriptionMediaApi(data) : addSubscriptionApi(data));
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

watch(
  [
    () => route.query.id,
    () => route.query.type,
    () => route.query.provider,
    () => route.query.ref,
  ],
  () => {
    loadDetail();
    loadSimilar();
    loadRecommends();
  },
);
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
