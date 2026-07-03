<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

interface Props {
  name: string;
  image?: string;
  imageList?: string[];
  href?: string;
}

const props = withDefaults(defineProps<Props>(), {
  href: '#',
  image: '',
  imageList: () => [],
});

const hasCollage = computed(() => props.imageList.length >= 2);

const collageImages = computed(() => props.imageList.slice(0, 3));

const collageCols = computed(() => Math.min(props.imageList.length, 3));

function replaceLocalhost(url?: string) {
  if (!url) return '';
  if (
    url.startsWith('http://127.0.0.1') ||
    url.startsWith('https://127.0.0.1')
  ) {
    return url.replace(/127\.0\.0\.1:\d+/, window.location.host);
  }
  if (
    url.startsWith('http://localhost') ||
    url.startsWith('https://localhost')
  ) {
    return url.replace(/localhost:\d+/, window.location.host);
  }
  return url;
}

function singleImage() {
  return props.image || props.imageList[0] || '';
}
</script>

<template>
  <a
    :href="replaceLocalhost(href)"
    target="_blank"
    class="group relative block overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div class="relative aspect-[16/9] overflow-hidden">
      <div v-if="singleImage() || hasCollage" class="h-full w-full">
        <div
          v-if="hasCollage"
          class="grid h-full w-full gap-px"
          :style="`grid-template-columns: repeat(${collageCols}, 1fr)`"
          style="background: hsl(var(--border))"
        >
          <img
            v-for="(url, i) in collageImages"
            :key="i"
            :src="replaceLocalhost(url)"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            :alt="`${name}-${i + 1}`"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
        </div>
        <img
          v-else
          :src="singleImage()"
          class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          :alt="name"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
      </div>
      <div
        v-if="!singleImage() && !hasCollage"
        class="flex h-full w-full flex-col items-center justify-center gap-2"
        style="background: hsl(var(--muted))"
      >
        <IconifyIcon
          icon="lucide:library"
          class="size-10 opacity-40"
          style="color: hsl(var(--muted-foreground))"
        />
      </div>
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
      ></div>
      <div class="absolute bottom-0 left-0 right-0 p-4">
        <div class="text-base font-semibold text-white">{{ name }}</div>
      </div>
    </div>
  </a>
</template>
