<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton, NTag } from 'naive-ui';

interface Props {
  detail: Record<string, any>;
  fav: string;
  searching?: boolean;
  seasons?: any[];
}

withDefaults(defineProps<Props>(), {
  searching: false,
  seasons: () => [],
});

const emit = defineEmits<{
  search: [];
  subscribe: [];
}>();

function replaceLocalhost(url?: any) {
  if (!url) return '';
  const s = String(url);
  return s.replace(
    /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?/,
    window.location.origin,
  );
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
        backgroundImage: `url(${replaceLocalhost(detail.background || detail.backdrop)})`,
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
        <img
          v-if="detail.image || detail.poster"
          :src="replaceLocalhost(detail.image || detail.poster)"
          class="mx-auto h-64 w-44 rounded-xl object-cover shadow-xl md:mx-0 md:h-80 md:w-52"
          alt="poster"
        />
        <div
          v-else
          class="mx-auto flex h-64 w-44 items-center justify-center rounded-xl md:mx-0 md:h-80 md:w-52"
          style="background: hsl(var(--muted))"
        >
          <IconifyIcon
            icon="lucide:image"
            class="size-12 opacity-40"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
      </div>

      <!-- 信息 -->
      <div class="flex flex-1 flex-col justify-center">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <NTag v-if="fav === '2'" type="success" size="small">已入库</NTag>
          <NTag v-if="fav === '1'" type="warning" size="small">已订阅</NTag>
          <NTag
            v-if="detail.type"
            size="small"
            style="
              color: hsl(var(--accent-foreground));
              background: hsl(var(--accent));
            "
          >
            {{ detail.type === 'tv' ? '电视剧' : '电影' }}
          </NTag>
        </div>

        <h1
          class="mb-2 text-2xl font-bold sm:text-3xl md:text-4xl"
          style="color: hsl(var(--card-foreground))"
        >
          {{ detail.title }}
          <span
            v-if="detail.year"
            class="text-lg font-normal opacity-70 sm:text-xl md:text-2xl"
            >({{ detail.year }})</span
          >
        </h1>

        <div
          class="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          style="color: hsl(var(--muted-foreground))"
        >
          <span v-if="detail.runtime">{{ detail.runtime }}</span>
          <span v-if="detail.runtime && detail.genres">•</span>
          <span v-if="detail.genres">{{ detail.genres }}</span>
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
            {{ fav === '1' ? '已订阅' : '订阅' }}
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

        <div
          v-if="detail.overview"
          class="max-w-3xl text-sm leading-relaxed"
          style="color: hsl(var(--muted-foreground))"
        >
          {{ detail.overview }}
        </div>
      </div>
    </div>
  </div>
</template>
