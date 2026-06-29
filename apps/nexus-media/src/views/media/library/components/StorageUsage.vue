<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface Props {
  freeSpace?: string;
  totalSpace?: string;
  usedSpace?: string;
  usedPercent?: number;
}

withDefaults(defineProps<Props>(), {
  freeSpace: '-',
  totalSpace: '-',
  usedSpace: '-',
  usedPercent: 0,
});

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}
</script>

<template>
  <div
    class="rounded-2xl border p-5"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:hard-drive"
          class="size-5"
          style="color: hsl(var(--primary))"
        />
        <span class="font-semibold" style="color: hsl(var(--card-foreground))"
          >媒体库存储</span
        >
      </div>
      <span
        class="text-sm font-bold"
        :style="{
          color:
            usedPercent > 90
              ? 'hsl(var(--destructive))'
              : usedPercent > 75
                ? 'hsl(var(--warning))'
                : 'hsl(var(--success))',
        }"
      >
        {{ usedPercent }}%
      </span>
    </div>

    <div
      class="mb-5 h-3 w-full overflow-hidden rounded-full"
      style="background: hsl(var(--muted))"
    >
      <div
        class="h-full rounded-full transition-all"
        :style="{
          width: `${clamp(usedPercent)}%`,
          background:
            usedPercent > 90
              ? 'hsl(var(--destructive))'
              : usedPercent > 75
                ? 'hsl(var(--warning))'
                : 'hsl(var(--primary))',
        }"
      ></div>
    </div>

    <div class="grid grid-cols-3 gap-3">
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
      <div
        class="rounded-lg p-2 text-center"
        style="background: hsl(var(--accent))"
      >
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
