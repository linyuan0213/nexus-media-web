<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface Props {
  counts?: Record<string, number | string>;
}

const props = withDefaults(defineProps<Props>(), {
  counts: () => ({}),
});

const items = [
  {
    key: 'Movie',
    label: '电影',
    icon: 'lucide:film',
    color: 'hsl(210, 80%, 55%)',
  },
  {
    key: 'Series',
    label: '电视剧',
    icon: 'lucide:tv',
    color: 'hsl(155, 65%, 40%)',
  },
  {
    key: 'Episodes',
    label: '剧集',
    icon: 'lucide:play-circle',
    color: 'hsl(280, 70%, 55%)',
  },
  {
    key: 'Music',
    label: '音乐',
    icon: 'lucide:music',
    color: 'hsl(24, 95%, 55%)',
  },
  {
    key: 'User',
    label: '用户',
    icon: 'lucide:users',
    color: 'hsl(200, 90%, 55%)',
  },
];

function getCount(key: string) {
  const value = props.counts[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = Number.parseInt(value.replaceAll(',', ''), 10);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    <div
      v-for="item in items"
      :key="item.key"
      class="flex items-center gap-3 rounded-xl border p-4 transition-all hover:shadow-md"
      style="background: hsl(var(--card)); border-color: hsl(var(--border))"
    >
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style="background: hsl(var(--accent))"
      >
        <IconifyIcon
          :icon="item.icon"
          class="size-5"
          :style="{ color: item.color }"
        />
      </div>
      <div>
        <div
          class="text-xl font-bold leading-tight"
          style="color: hsl(var(--card-foreground))"
        >
          {{ getCount(item.key) }}
        </div>
        <div class="text-xs" style="color: hsl(var(--muted-foreground))">
          {{ item.label }}
        </div>
      </div>
    </div>
  </div>
</template>
