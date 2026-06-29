<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface ActivityItem {
  type?: string;
  event?: string;
  date?: string;
  time?: string;
  [key: string]: any;
}

interface Props {
  items: ActivityItem[];
}

defineProps<Props>();

function parseItem(item: ActivityItem): { date: string; text: string } {
  if (item.event) {
    return { text: item.event, date: item.date || item.time || '' };
  }
  if (item.message) {
    return { text: item.message, date: item.date || item.time || '' };
  }
  if (typeof item === 'string') {
    return { text: item, date: '' };
  }
  return { text: JSON.stringify(item), date: item.date || item.time || '' };
}

function typeIcon(type?: string) {
  const map: Record<string, string> = {
    download: 'lucide:download',
    LG: 'lucide:log-in',
    login: 'lucide:log-in',
    playback: 'lucide:play',
    play: 'lucide:play',
    stop: 'lucide:square',
    transfer: 'lucide:folder-sync',
    sync: 'lucide:refresh-cw',
    rss: 'lucide:rss',
    subscribe: 'lucide:heart',
  };
  return map[(type || '').toLowerCase()] || 'lucide:activity';
}
</script>

<template>
  <div
    class="rounded-2xl border"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div
      class="flex items-center gap-2 border-b px-5 py-4"
      style="border-color: hsl(var(--border))"
    >
      <IconifyIcon
        icon="lucide:activity"
        class="size-5"
        style="color: hsl(var(--primary))"
      />
      <span class="font-semibold" style="color: hsl(var(--card-foreground))"
        >最近动态</span
      >
    </div>

    <div class="max-h-[360px] overflow-y-auto p-2">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-accent/30"
      >
        <div
          class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style="background: hsl(var(--accent))"
        >
          <IconifyIcon
            :icon="typeIcon(item.type)"
            class="size-4"
            style="color: hsl(var(--primary))"
          />
        </div>
        <div class="min-w-0 flex-1">
          <div
            class="break-words text-sm leading-relaxed"
            style="color: hsl(var(--card-foreground))"
          >
            {{ parseItem(item).text }}
          </div>
          <div
            v-if="parseItem(item).date"
            class="mt-1 text-xs"
            style="color: hsl(var(--muted-foreground))"
          >
            {{ parseItem(item).date }}
          </div>
        </div>
      </div>

      <div
        v-if="items.length === 0"
        class="flex flex-col items-center justify-center py-12"
      >
        <IconifyIcon
          icon="lucide:bell"
          class="mb-3 size-10 opacity-40"
          style="color: hsl(var(--muted-foreground))"
        />
        <div class="text-sm" style="color: hsl(var(--muted-foreground))">
          暂无最近动态
        </div>
      </div>
    </div>
  </div>
</template>
