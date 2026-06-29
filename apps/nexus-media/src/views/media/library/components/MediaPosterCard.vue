<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface Props {
  title: string;
  image?: string;
  type?: string;
  typeLabel?: string;
  percent?: number;
  href?: string;
}

withDefaults(defineProps<Props>(), {
  href: '#',
  image: '',
  percent: undefined,
  type: '',
  typeLabel: '',
});

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
</script>

<template>
  <a
    :href="replaceLocalhost(href)"
    target="_blank"
    class="group relative block w-[140px] shrink-0 overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:w-[160px] lg:w-[180px]"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div class="relative aspect-[2/3] overflow-hidden">
      <img
        v-if="image"
        :src="image"
        class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        :alt="title"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <div
        v-if="!image"
        class="flex h-full w-full flex-col items-center justify-center gap-2"
        style="background: hsl(var(--muted))"
      >
        <IconifyIcon
          icon="lucide:image"
          class="size-8 opacity-40"
          style="color: hsl(var(--muted-foreground))"
        />
      </div>

      <!-- 类型标签 -->
      <div
        v-if="typeLabel"
        class="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style="
          color: hsl(var(--primary-foreground));
          background: hsl(var(--primary));
        "
      >
        {{ typeLabel }}
      </div>

      <!-- 进度条 -->
      <div
        v-if="percent !== undefined"
        class="absolute bottom-0 left-0 right-0 h-1"
        style="background: hsl(var(--muted) / 60%)"
      >
        <div
          class="h-full transition-all"
          :style="{
            width: `${percent}%`,
            background: 'hsl(var(--primary))',
          }"
        ></div>
      </div>
    </div>

    <div class="p-2.5">
      <div
        class="truncate text-sm font-medium"
        style="color: hsl(var(--card-foreground))"
      >
        {{ title }}
      </div>
    </div>
  </a>
</template>
