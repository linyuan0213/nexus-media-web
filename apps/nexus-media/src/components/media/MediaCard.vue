<script setup lang="ts">
import type { SubscribeConfirmItem } from '#/components/subscribe/SubscribeConfirmModal.vue';
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { NButton, NModal } from 'naive-ui';

import {
  addSubscriptionApi,
  addSubscriptionMediaApi,
  deleteSubscriptionApi,
  getDefaultSubscriptionSettingApi,
  removeSubscriptionApi,
} from '#/api/modules/subscription';
import SubscribeConfirmModal from '#/components/subscribe/SubscribeConfirmModal.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';
import {
  getContentProfileImageUrl,
  getContentProfileLabel,
  getContentProfilePosterPosition,
} from '#/plugin-framework';
import { getImgUrl } from '#/utils/image';
import { useAppNotification } from '#/utils/notify';

interface Props {
  id: number | string;
  tmdbId?: number | string;
  title: string;
  year?: string;
  poster?: string;
  type?: string;
  mediaType?: string;
  vote?: number | string;
  overview?: string;
  fav?: string;
  rssid?: string;
  genres?: string[];
  countries?: string[];
  languages?: string[];
  anchorProvider?: string;
  anchorExternalId?: string;
  contentProfile?: string;
  metadataRef?: string;
  detailLink?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'search', item: Props): void;
}>();

const router = useRouter();
const notification = useAppNotification();

const hovered = ref(false);
const subscribeShow = ref(false);
const subscribeItem = ref<null | SubscribeConfirmItem>(null);
const subscribeEditShow = ref(false);
const subscribeEditItem = ref<null | SubscribeEditItem>(null);
const unsubscribing = ref(false);
const _fav = ref(props.fav || '0');
const _rssid = ref(props.rssid || '');

// 探索页订阅状态是异步加载的，props 更新后必须同步到卡片内部状态。
watch(
  () => props.fav,
  (value) => {
    _fav.value = value || '0';
  },
);
watch(
  () => props.rssid,
  (value) => {
    _rssid.value = value || '';
  },
);

const typeLabel = computed(() => {
  // 自定义画像优先使用插件标签；插件前端未就绪时也不回落成“电影”
  if (props.contentProfile && props.contentProfile !== 'default') {
    return (
      getContentProfileLabel(props.contentProfile) ||
      props.contentProfile.toUpperCase()
    );
  }
  const t = props.mediaType || props.type || '';
  if (t === 'movie' || t === '电影') return '电影';
  if (t === 'anime' || t === '动漫') return '动漫';
  if (t === 'tv' || t === '剧集' || t === '电视剧') return '剧集';
  return '';
});

const posterUrl = computed(() =>
  getImgUrl(getContentProfileImageUrl(props.contentProfile, props.poster)),
);
const posterEl = ref<HTMLImageElement | null>(null);
const posterSrc = ref('');
let posterObserver: IntersectionObserver | null = null;

function revealPoster() {
  posterSrc.value = posterUrl.value;
}

onMounted(() => {
  // 卡片先渲染榜单数据，封面等接近可视区后再请求，避免首屏被图片下载占满。
  const el = posterEl.value;
  if (!el || typeof IntersectionObserver === 'undefined') {
    revealPoster();
    return;
  }
  posterObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        posterObserver?.disconnect();
        posterObserver = null;
        revealPoster();
      }
    },
    { rootMargin: '240px 0px' },
  );
  posterObserver.observe(el);
});

watch(posterUrl, (url) => {
  if (posterSrc.value || !posterObserver) posterSrc.value = url;
});

onUnmounted(() => {
  posterObserver?.disconnect();
  posterObserver = null;
});

const posterPosition = computed(
  () => getContentProfilePosterPosition(props.contentProfile) || '50% 50%',
);
const subscribed = computed(() => _fav.value === '1');
const inLibrary = computed(() => _fav.value === '2');
const isTvType = computed(() => {
  const t = (props.mediaType || props.type || '').toLowerCase();
  return t !== 'movie';
});

const mediaId = computed(() => String(props.tmdbId || props.id));
const subscribeMediaId = computed(() => {
  const provider = props.anchorProvider;
  const externalId = props.anchorExternalId || String(props.id);
  if (!provider) return String(props.tmdbId || props.id);
  if (provider === 'douban') return `DB:${externalId}`;
  if (provider === 'bangumi') return `BG:${externalId}`;
  if (provider === 'content_id') {
    // 内容编号是身份锚点；订阅来源仍取实际 provider。
    const sourceProvider = String(props.metadataRef || '').split(':')[0];
    return `${sourceProvider || 'content_id'}:${externalId}`;
  }
  return `${provider}:${externalId}`;
});

const metaTags = computed(() => {
  const tags = [
    ...(props.genres || []),
    ...(props.countries || []),
    ...(props.languages || []),
  ];
  return tags.filter(Boolean).slice(0, 4);
});

function goDetail() {
  if (props.detailLink) {
    router.push(props.detailLink);
    return;
  }
  const t = props.mediaType || props.type || 'movie';
  const typeParam =
    t === '电影' ? 'movie' : t === '剧集' ? 'tv' : t.toLowerCase();
  if (
    props.anchorProvider &&
    props.anchorProvider !== 'tmdb' &&
    props.anchorProvider !== 'content_id' &&
    props.anchorExternalId
  ) {
    router.push({
      name: 'MediaDetail',
      query: {
        provider: props.anchorProvider,
        ref: props.anchorExternalId,
        type: typeParam,
      },
    });
    return;
  }
  router.push({
    name: 'MediaDetail',
    query: { id: mediaId.value, type: typeParam },
  });
}

function handleSearch(e: Event) {
  e.stopPropagation();
  emit('search', props);
}

function handleSubscribe(e: Event) {
  e.stopPropagation();
  // 电影已订阅 → 取消订阅；电视剧已订阅 → 仍打开季选择框以追加其他季
  if (subscribed.value && !isTvType.value && _rssid.value) {
    unsubscribing.value = true;
    return;
  }
  subscribeItem.value = {
    id: mediaId.value,
    mediaid: subscribeMediaId.value,
    anchor_provider: props.anchorProvider,
    anchor_external_id: props.anchorExternalId,
    tmdbid: mediaId.value,
    title: props.title,
    year: props.year || '',
    type: isTvType.value ? 'tv' : 'movie',
    image: posterUrl.value,
    overview: props.overview,
    content_profile: props.contentProfile,
    metadata_ref: props.metadataRef,
    provider: props.anchorProvider,
  };
  subscribeShow.value = true;
}

async function confirmUnsubscribe() {
  if (!_rssid.value) return;
  try {
    await deleteSubscriptionApi(Number(_rssid.value));
    _fav.value = '0';
    _rssid.value = '';
    notification.success('已取消订阅', { description: props.title });
  } catch (error: any) {
    notification.error('取消订阅失败', { description: error?.message || '' });
  } finally {
    unsubscribing.value = false;
  }
}

async function handleConfirmSubscribe(payload: {
  add: number[];
  autoMode: boolean;
  policy?: string;
  remove: number[];
  selected: number[];
}) {
  const it = subscribeItem.value;
  if (!it) return;
  const { add, remove, selected } = payload;
  try {
    const typeParam = it.type === 'movie' ? 'movie' : 'tv';
    if (typeParam === 'tv') {
      for (const season of add) {
        await addSubscriptionMediaApi({
          name: it.title,
          year: it.year || '',
          type: 'tv',
          mediaid: it.mediaid || String(it.id),
          season: String(season),
          metadata_policy:
            payload.policy === 'auto' ? undefined : payload.policy,
          metadata_ref: it.metadata_ref,
          provider: it.provider,
          content_profile: it.content_profile,
          image: it.image || props.poster || posterUrl.value,
        });
      }
      for (const season of remove) {
        await removeSubscriptionApi({
          name: it.title,
          year: it.year || '',
          type: 'tv',
          tmdbid: String(it.tmdbid || it.id),
          season: String(season),
          content_profile: it.content_profile,
        });
      }
      _fav.value = selected.length > 0 ? '1' : '0';
      if (selected.length === 0) _rssid.value = '';
      const parts: string[] = [];
      if (add.length > 0) parts.push(`订阅 ${add.length} 季`);
      if (remove.length > 0) parts.push(`退订 ${remove.length} 季`);
      notification.success('操作成功', {
        description: `${it.title} 已${parts.join('、')}`,
      });
    } else {
      const res: any = await addSubscriptionMediaApi({
        name: it.title,
        year: it.year || '',
        type: typeParam,
        mediaid: it.mediaid || String(it.id),
        metadata_ref: it.metadata_ref,
        provider: it.provider,
        content_profile: it.content_profile,
        metadata_policy: payload.policy === 'auto' ? undefined : payload.policy,
        image: it.image || props.poster || posterUrl.value,
      });
      _fav.value = '1';
      if (res?.rssid) _rssid.value = String(res.rssid);
      notification.success('订阅成功', {
        description: `${it.title} 已添加订阅`,
      });
    }
  } catch (error: any) {
    notification.error('操作失败', { description: error?.message || '' });
  } finally {
    subscribeShow.value = false;
  }
}

async function handleEditSubscribe() {
  const it = subscribeItem.value;
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
  subscribeShow.value = false;
  subscribeEditShow.value = true;
}

async function handleConfirmEdit(data: Record<string, any>) {
  try {
    const isCustom =
      !!data.content_profile && data.content_profile !== 'default';
    const res: any = isCustom
      ? await addSubscriptionMediaApi(data)
      : await addSubscriptionApi(data);
    _fav.value = '1';
    if (res?.rssid) _rssid.value = String(res.rssid);
    notification.success('订阅成功', {
      description: `${data.name} 已添加订阅`,
    });
  } catch (error: any) {
    notification.error('订阅失败', { description: error?.message || '' });
  } finally {
    subscribeEditShow.value = false;
  }
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = '/static/img/no-image.png';
}
</script>

<template>
  <div
    class="media-card relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
    @click="goDetail"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <div class="aspect-[2/3]" style="background: hsl(var(--muted))">
      <img
        ref="posterEl"
        :src="posterSrc || undefined"
        class="w-full h-full object-cover"
        :style="{ objectPosition: posterPosition }"
        alt=""
        loading="lazy"
        decoding="async"
        @error="onImgError"
      />
    </div>

    <span
      v-if="typeLabel"
      class="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded"
      :style="{
        backgroundColor: 'hsl(var(--primary))',
        color: 'hsl(var(--primary-foreground))',
      }"
    >
      {{ typeLabel }}
    </span>

    <div class="absolute top-1.5 right-1.5 flex items-center gap-1">
      <span
        v-if="vote && vote !== '0.0' && vote !== '0'"
        class="text-[10px] px-1.5 py-0.5 rounded text-white"
        style="background: #7c3aed"
      >
        {{ vote }}
      </span>
      <span
        v-if="subscribed || inLibrary"
        class="flex items-center gap-1 rounded-full px-1.5 py-0.5 shadow-sm"
        :style="{
          backgroundColor: 'hsl(var(--card) / 0.85)',
          color: 'hsl(var(--card-foreground))',
          backdropFilter: 'blur(4px)',
        }"
      >
        <span
          v-if="subscribed"
          class="flex items-center"
          title="已订阅"
          aria-label="已订阅"
        >
          <IconifyIcon
            icon="lucide:heart"
            :style="{
              width: '12px',
              height: '12px',
              color: 'hsl(var(--destructive))',
              fill: 'currentcolor',
            }"
          />
        </span>
        <span
          v-if="inLibrary"
          class="flex items-center"
          title="已入库"
          aria-label="已入库"
        >
          <IconifyIcon
            icon="lucide:check"
            :style="{
              width: '12px',
              height: '12px',
              color: 'hsl(var(--success))',
            }"
          />
        </span>
      </span>
    </div>

    <div
      class="absolute bottom-0 left-0 right-0 p-2 text-white"
      style="
        text-shadow: 0 1px 3px rgb(0 0 0 / 80%);
        background: linear-gradient(
          transparent 0%,
          rgb(0 0 0 / 35%) 40%,
          rgb(0 0 0 / 75%) 100%
        );
      "
    >
      <div
        class="text-sm font-bold line-clamp-2 text-center"
        style="min-height: 2.5em"
      >
        {{ title }}{{ year ? `（${year}）` : '' }}
      </div>
      <div
        v-if="metaTags.length > 0"
        class="mt-1 text-center"
        style="min-height: 2em"
      >
        <span
          class="text-[10px] leading-tight line-clamp-2"
          style="color: rgb(255 255 255 / 80%)"
        >
          {{ metaTags.join(' · ') }}
        </span>
      </div>
    </div>

    <div
      v-if="hovered"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2"
      style="background: rgb(0 0 0 / 50%)"
    >
      <NButton size="small" type="primary" round @click.stop="handleSearch">
        搜索资源
      </NButton>
      <NButton
        v-if="!subscribed"
        size="small"
        ghost
        round
        style="color: #fff; border-color: #fff"
        @click.stop="handleSubscribe"
      >
        <template #icon><IconifyIcon icon="lucide:heart" /></template>
        订阅
      </NButton>
      <NButton
        v-else
        size="small"
        type="error"
        ghost
        round
        @click.stop="handleSubscribe"
      >
        <template #icon>
          <IconifyIcon icon="lucide:heart" style="fill: currentcolor" />
        </template>
        已订阅
      </NButton>
    </div>

    <SubscribeConfirmModal
      v-model:show="subscribeShow"
      :item="subscribeItem"
      @confirm="handleConfirmSubscribe"
      @edit="handleEditSubscribe"
    />
    <SubscribeEditModal
      v-model:show="subscribeEditShow"
      :item="subscribeEditItem"
      @confirm="handleConfirmEdit"
    />
    <NModal
      :show="unsubscribing"
      preset="dialog"
      type="warning"
      title="取消订阅"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmUnsubscribe"
      @negative-click="unsubscribing = false"
      @update:show="unsubscribing = false"
    >
      确认取消订阅「{{ title }}」？
    </NModal>
  </div>
</template>
