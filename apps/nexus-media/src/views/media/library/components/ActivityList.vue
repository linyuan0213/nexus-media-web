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

function dotColor(type?: string): string {
  const map: Record<string, string> = {
    download: 'hsl(var(--primary))',
    transfer: 'hsl(var(--success))',
    play: 'hsl(var(--warning))',
    playback: 'hsl(var(--warning))',
    subscribe: 'hsl(346, 74%, 67%)',
    rss: 'hsl(26, 85%, 65%)',
  };
  return map[(type || '').toLowerCase()] || 'hsl(var(--border))';
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
      <span class="font-semibold" style="color: hsl(var(--card-foreground))">
        最近动态
      </span>
    </div>

    <div class="max-h-[360px] overflow-y-auto px-5 py-4">
      <div class="timeline">
        <div v-for="(item, index) in items" :key="index" class="timeline-item">
          <div
            class="timeline-dot"
            :style="{ background: dotColor(item.type) }"
          ></div>
          <div class="timeline-content">
            <div
              class="break-words text-sm leading-relaxed"
              style="color: hsl(var(--card-foreground))"
            >
              {{ parseItem(item).text }}
            </div>
            <div
              v-if="parseItem(item).date"
              class="mt-0.5 text-xs"
              style="color: hsl(var(--muted-foreground))"
            >
              {{ parseItem(item).date }}
            </div>
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

<style scoped>
.timeline {
  position: relative;
  padding-left: 8px;
}

.timeline::before {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 4px;
  width: 1px;
  content: '';
  background: hsl(var(--border));
}

.timeline-item {
  position: relative;
  display: flex;
  gap: 0.75rem;
  padding-bottom: 1rem;
  padding-left: 20px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  top: 6px;
  left: -12px;
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border: 2px solid hsl(var(--card));
  border-radius: 50%;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}
</style>
