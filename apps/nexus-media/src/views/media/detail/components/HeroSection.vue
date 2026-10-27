<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NTag } from 'naive-ui';

import { getImgUrl } from '#/utils/image';

interface Props {
  detail: Record<string, any>;
  fav: string;
  searching?: boolean;
  seasons?: any[];
  subSeasons?: number[];
  showSubscribe?: boolean;
  typeLabel?: string;
  posterPosition?: string;
}

const props = withDefaults(defineProps<Props>(), {
  searching: false,
  seasons: () => [],
  subSeasons: () => [],
  showSubscribe: true,
  typeLabel: '',
  posterPosition: '',
});

const emit = defineEmits<{
  search: [];
  subscribe: [];
}>();

const isTv = computed(() => props.detail.type !== 'movie');

const posterSrc = computed(() =>
  imageUrl(props.detail.image || props.detail.poster),
);
const posterStatus = ref<'error' | 'loaded' | 'loading'>('loading');

watch(
  posterSrc,
  (src) => {
    posterStatus.value = src ? 'loading' : 'error';
  },
  { immediate: true },
);

const contentCode = computed(() =>
  String(
    props.detail.id ||
      props.detail.mediaid ||
      props.detail.anchor_external_id ||
      '',
  ).trim(),
);

const displayTitle = computed(() => {
  const title = String(props.detail.title || '').trim();
  const code = contentCode.value;
  if (code && title.toLowerCase().startsWith(code.toLowerCase())) {
    return title
      .slice(code.length)
      .replace(/^[\s:：\-–—]+/, '')
      .trim();
  }
  return title;
});

const tmdbUrl = computed(() => {
  const tid = props.detail.tmdbid;
  if (!tid) return '';
  const base = isTv.value ? 'tv' : 'movie';
  return `https://www.themoviedb.org/${base}/${tid}`;
});

const genresText = computed(() =>
  Array.isArray(props.detail.genres)
    ? props.detail.genres.join(' / ')
    : props.detail.genres || '',
);

const sourceLinks = computed<Array<{ label: string; url: string }>>(() => {
  if (Array.isArray(props.detail.links) && props.detail.links.length > 0) {
    return props.detail.links;
  }
  if (!tmdbUrl.value) return [];
  return [{ label: 'TMDB', url: tmdbUrl.value }];
});

const detailUrl = computed(() => props.detail.link || tmdbUrl.value);

const subscribedLabel = computed(() => {
  if (props.fav !== '1') return '';
  if (props.subSeasons.length > 0) {
    const text = props.subSeasons.map((n) => `第${n}季`).join('、');
    return `已订阅 ${text}`;
  }
  return '已订阅';
});

function replaceLocalhost(url?: any) {
  if (!url) return '';
  const s = String(url);
  return s.replace(
    /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?/,
    window.location.origin,
  );
}

function imageUrl(url?: any) {
  if (!url) return '';
  const s = String(url);
  if (s.startsWith('/img?')) return getImgUrl(s);
  if (s.startsWith('/img/')) return s;
  if (/^https?:\/\//.test(s)) return getImgUrl(s);
  return replaceLocalhost(s);
}
</script>

<template>
  <div
    class="relative mb-8 overflow-hidden rounded-2xl border"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <!-- 背景图 -->
    <div
      v-if="detail.background || detail.backdrop"
      class="absolute inset-0 bg-cover bg-center opacity-20"
      :style="{
        backgroundImage: `url(${imageUrl(detail.background || detail.backdrop)})`,
      }"
    ></div>
    <div
      class="absolute inset-0"
      style="
        background: linear-gradient(
          to right,
          hsl(var(--card) / 95%) 0%,
          hsl(var(--card) / 80%) 50%,
          hsl(var(--card) / 40%) 100%
        );
      "
    ></div>

    <div class="relative flex flex-col gap-6 p-6 md:flex-row">
      <!-- 海报 -->
      <div class="shrink-0">
        <div
          class="relative mx-auto h-64 w-44 overflow-hidden rounded-xl shadow-xl md:mx-0 md:h-80 md:w-52"
          style="background: hsl(var(--muted))"
        >
          <img
            v-if="posterSrc && posterStatus !== 'error'"
            :src="posterSrc"
            :alt="detail.title || 'poster'"
            class="h-full w-full object-cover transition-opacity duration-300"
            :style="{
              opacity: posterStatus === 'loaded' ? 1 : 0,
              objectPosition: posterPosition || '50% 50%',
            }"
            decoding="async"
            fetchpriority="high"
            @load="posterStatus = 'loaded'"
            @error="posterStatus = 'error'"
          />
          <div
            v-if="posterStatus === 'loading'"
            class="absolute inset-0 animate-pulse"
            style="background: hsl(var(--muted))"
            aria-hidden="true"
          ></div>
          <div
            v-if="!posterSrc || posterStatus === 'error'"
            class="absolute inset-0 flex items-center justify-center"
          >
            <IconifyIcon
              icon="lucide:image"
              class="size-12 opacity-40"
              style="color: hsl(var(--muted-foreground))"
            />
          </div>
        </div>
      </div>

      <!-- 信息 -->
      <div class="flex flex-1 flex-col justify-center">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <NTag v-if="fav === '2'" type="success" size="small">已入库</NTag>
          <NTag v-if="fav === '1'" type="warning" size="small">
            {{ subscribedLabel }}
          </NTag>
          <NTag
            v-if="detail.type"
            size="small"
            style="
              color: hsl(var(--accent-foreground));
              background: hsl(var(--accent));
            "
          >
            {{
              typeLabel ||
              (detail.type === 'movie'
                ? '电影'
                : detail.type === 'anime'
                  ? '动漫'
                  : '电视剧')
            }}
          </NTag>
          <NTag
            v-if="contentCode"
            size="small"
            :bordered="false"
            class="font-mono font-medium tracking-wide"
            style="
              color: hsl(var(--tag-primary));
              background: hsl(var(--tag-primary) / 12%);
            "
          >
            {{ contentCode }}
          </NTag>
        </div>

        <h1
          class="mb-3 line-clamp-3 max-w-4xl text-lg font-medium leading-relaxed break-words sm:text-xl"
          style="color: hsl(var(--card-foreground))"
          :title="displayTitle"
        >
          <a
            v-if="detailUrl"
            :href="detailUrl"
            target="_blank"
            rel="noopener"
            class="transition-colors hover:underline hover:decoration-1 hover:underline-offset-4"
            style="color: inherit"
          >
            {{ displayTitle }}
          </a>
          <template v-else>{{ displayTitle }}</template>
          <span
            v-if="detail.year"
            class="ml-1 text-sm font-normal sm:text-base"
            style="color: hsl(var(--muted-foreground))"
            >({{ detail.year }})</span
          >
        </h1>

        <div
          class="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          style="color: hsl(var(--muted-foreground))"
        >
          <span v-if="detail.runtime">{{ detail.runtime }}</span>
          <span v-if="detail.runtime && detail.genres">•</span>
          <span v-if="genresText">{{ genresText }}</span>
          <span v-if="seasons.length > 0">• 共 {{ seasons.length }} 季</span>
        </div>

        <div class="mb-6 flex flex-wrap gap-3">
          <NButton
            type="primary"
            size="medium"
            :loading="searching"
            @click="emit('search')"
          >
            <template #icon>
              <IconifyIcon icon="lucide:search" class="size-4" />
            </template>
            搜索资源
          </NButton>

          <NButton
            v-if="showSubscribe"
            size="medium"
            :type="fav === '1' ? 'error' : 'default'"
            @click="emit('subscribe')"
          >
            <template #icon>
              <IconifyIcon
                :icon="fav === '1' ? 'lucide:heart' : 'lucide:heart-off'"
                class="size-4"
              />
            </template>
            {{
              fav === '1' && isTv ? '管理订阅' : fav === '1' ? '已订阅' : '订阅'
            }}
          </NButton>

          <NButton
            v-for="source in sourceLinks"
            :key="source.url"
            size="medium"
            tag="a"
            :href="source.url"
            target="_blank"
          >
            {{ source.label }}详情
          </NButton>

          <NButton
            v-if="detail.item_url"
            size="medium"
            tag="a"
            :href="detail.item_url"
            target="_blank"
          >
            <template #icon>
              <IconifyIcon icon="lucide:play" class="size-4" />
            </template>
            在线观看
          </NButton>
        </div>
      </div>
    </div>
  </div>
</template>
