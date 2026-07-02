<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

interface Props {
  freeSpace?: string;
  totalSpace?: string;
  usedSpace?: string;
  usedPercent?: number;
}

const props = withDefaults(defineProps<Props>(), {
  freeSpace: '-',
  totalSpace: '-',
  usedSpace: '-',
  usedPercent: 0,
});

const pct = computed(() =>
  Math.min(100, Math.max(0, Number(props.usedPercent) || 0)),
);

const statusColor = computed(() =>
  pct.value > 90
    ? 'hsl(var(--destructive))'
    : pct.value > 75
      ? 'hsl(var(--warning))'
      : 'hsl(var(--primary))',
);
</script>

<template>
  <div
    class="flex h-full flex-col rounded-2xl border p-5"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div class="mb-5 flex items-center gap-2">
      <IconifyIcon
        icon="lucide:hard-drive"
        class="size-5"
        :style="{ color: statusColor }"
      />
      <span class="font-semibold" style="color: hsl(var(--card-foreground))">
        媒体库存储
      </span>
    </div>

    <div class="mb-4 flex items-baseline gap-2">
      <span class="text-2xl font-bold" :style="{ color: statusColor }">
        {{ pct }}%
      </span>
      <span class="text-sm" style="color: hsl(var(--muted-foreground))">
        已使用
      </span>
    </div>

    <div
      class="mb-5 h-2.5 w-full overflow-hidden rounded-full"
      style="background: hsl(var(--muted))"
    >
      <div
        class="h-full rounded-full transition-all duration-700"
        :style="{ width: `${pct}%`, background: statusColor }"
      ></div>
    </div>

    <div class="mt-auto grid grid-cols-3 gap-2">
      <div class="rounded-lg p-2 text-center">
        <div
          class="text-sm font-bold"
          style="color: hsl(var(--card-foreground))"
        >
          {{ totalSpace }}
        </div>
        <div class="mt-0.5 text-xs" style="color: hsl(var(--muted-foreground))">
          总容量
        </div>
      </div>
      <div class="rounded-lg p-2 text-center">
        <div
          class="text-sm font-bold"
          style="color: hsl(var(--card-foreground))"
        >
          {{ usedSpace }}
        </div>
        <div class="mt-0.5 text-xs" style="color: hsl(var(--muted-foreground))">
          已使用
        </div>
      </div>
      <div class="rounded-lg p-2 text-center">
        <div
          class="text-sm font-bold"
          style="color: hsl(var(--card-foreground))"
        >
          {{ freeSpace }}
        </div>
        <div class="mt-0.5 text-xs" style="color: hsl(var(--muted-foreground))">
          可用空间
        </div>
      </div>
    </div>
  </div>
</template>
