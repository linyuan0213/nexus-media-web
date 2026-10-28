<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import MediaPoster from '#/components/media/MediaPoster.vue';

interface Props {
  title: string;
  items: any[];
  icon: string;
}

defineProps<Props>();

const emit = defineEmits<{
  click: [item: any];
}>();
</script>

<template>
  <div
    class="rounded-2xl border p-5"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div class="mb-4 flex items-center gap-2">
      <IconifyIcon
        :icon="icon"
        class="size-5"
        style="color: hsl(var(--primary))"
      />
      <h2
        class="text-lg font-semibold"
        style="color: hsl(var(--card-foreground))"
      >
        {{ title }}
      </h2>
    </div>

    <div
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <div
        v-for="item in items"
        :key="item.id || item.tmdbid"
        class="group cursor-pointer overflow-hidden rounded-xl border transition-all hover:-translate-y-1 hover:shadow-lg"
        style="background: hsl(var(--card)); border-color: hsl(var(--border))"
        @click="emit('click', item)"
      >
        <div class="relative aspect-[2/3] overflow-hidden">
          <MediaPoster
            :src="item.image || item.poster"
            :content-profile="item.content_profile"
            class="h-full w-full transition-transform duration-500 group-hover:scale-105"
            alt=""
          />
          <div
            v-if="!item.image && !item.poster"
            class="flex h-full w-full items-center justify-center"
            style="background: hsl(var(--muted))"
          >
            <IconifyIcon
              icon="lucide:image"
              class="size-8 opacity-40"
              style="color: hsl(var(--muted-foreground))"
            />
          </div>
        </div>
        <div class="p-2.5">
          <div
            class="truncate text-sm font-medium"
            style="color: hsl(var(--card-foreground))"
          >
            {{ item.title }}
          </div>
          <div class="text-xs" style="color: hsl(var(--muted-foreground))">
            {{ item.year }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
