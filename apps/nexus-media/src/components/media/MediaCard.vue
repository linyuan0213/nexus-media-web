<script setup lang="ts">
import type { SubscribeConfirmItem } from '#/components/subscribe/SubscribeConfirmModal.vue';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { NButton, NModal } from 'naive-ui';

import {
  addSubscriptionMediaApi,
  deleteSubscriptionApi,
} from '#/api/modules/subscription';
import SubscribeConfirmModal from '#/components/subscribe/SubscribeConfirmModal.vue';
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
const unsubscribing = ref(false);
const _fav = ref(props.fav || '0');
const _rssid = ref(props.rssid || '');

const typeLabel = computed(() => {
  const t = props.mediaType || props.type || '';
  if (t === 'movie' || t === '电影') return '电影';
  if (t === 'tv' || t === '剧集' || t === '电视剧') return '剧集';
  return '';
});

const subscribed = computed(() => _fav.value === '1');
const inLibrary = computed(() => _fav.value === '2');

const mediaId = computed(() => String(props.tmdbId || props.id));

function goDetail() {
  const t = props.mediaType || props.type || 'movie';
  const typeParam =
    t === '电影' ? 'movie' : t === '剧集' ? 'tv' : t.toLowerCase();
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
  if (subscribed.value && _rssid.value) {
    unsubscribing.value = true;
    return;
  }
  subscribeItem.value = {
    id: mediaId.value,
    tmdbid: mediaId.value,
    title: props.title,
    year: props.year || '',
    type: (props.mediaType || props.type || 'movie').toLowerCase(),
    image: props.poster,
    overview: props.overview,
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

async function handleConfirmSubscribe(seasons: number[]) {
  const it = subscribeItem.value;
  if (!it) return;
  try {
    const typeParam = it.type === 'movie' ? 'movie' : 'tv';
    if (typeParam === 'tv' && seasons.length > 0) {
      for (const season of seasons) {
        await addSubscriptionMediaApi({
          name: it.title,
          year: it.year || '',
          type: 'tv',
          mediaid: String(it.id),
          season: String(season),
        });
      }
      _fav.value = '1';
      notification.success('订阅成功', {
        description: `${it.title} 已订阅 ${seasons.length} 季`,
      });
    } else {
      const res: any = await addSubscriptionMediaApi({
        name: it.title,
        year: it.year || '',
        type: typeParam,
        mediaid: String(it.id),
      });
      _fav.value = '1';
      if (res?.rssid) _rssid.value = String(res.rssid);
      notification.success('订阅成功', {
        description: `${it.title} 已添加订阅`,
      });
    }
  } catch (error: any) {
    notification.error('订阅失败', { description: error?.message || '' });
  } finally {
    subscribeShow.value = false;
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
        :src="poster || '/static/img/no-image.png'"
        class="w-full h-full object-cover"
        alt=""
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
        v-if="inLibrary"
        class="rounded-full p-0.5 flex items-center justify-center"
        :style="{
          backgroundColor: 'hsl(var(--success))',
          color: 'hsl(var(--primary-foreground))',
        }"
      >
        <IconifyIcon
          icon="lucide:check"
          :style="{ width: '12px', height: '12px' }"
        />
      </span>
    </div>

    <div
      class="absolute bottom-0 left-0 right-0 p-2 text-white"
      style="background: linear-gradient(transparent, rgb(0 0 0 / 75%))"
    >
      <div class="text-sm font-bold truncate">{{ title }}</div>
      <div v-if="year" class="text-xs mt-0.5">{{ year }}</div>
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
