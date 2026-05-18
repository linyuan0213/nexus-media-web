<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface Props {
  title: string;
  value: string | number;
  icon: string;
  iconColor?: string;
  iconBg?: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
}

withDefaults(defineProps<Props>(), {
  iconColor: 'hsl(var(--primary))',
  iconBg: 'hsl(var(--primary) / 10%)',
  trend: undefined,
  trendType: 'neutral',
});
</script>

<template>
  <div
    class="flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:shadow-md"
    style="border-color: hsl(var(--border)); background: hsl(var(--card))"
  >
    <div
      class="flex h-10 w-10 items-center justify-center rounded-xl"
      :style="{ background: iconBg }"
    >
      <IconifyIcon
        :icon="icon"
        class="size-5"
        :style="{ color: iconColor }"
      />
    </div>
    <div class="flex flex-col gap-0.5">
      <span class="text-xs font-medium" style="color: hsl(var(--muted-foreground))">
        {{ title }}
      </span>
      <span class="text-lg font-bold leading-tight" style="color: hsl(var(--card-foreground))">
        {{ value }}
      </span>
      <span
        v-if="trend"
        class="flex items-center justify-center gap-1 text-xs"
        :style="{
          color:
            trendType === 'up'
              ? 'hsl(var(--success))'
              : trendType === 'down'
                ? 'hsl(var(--destructive))'
                : 'hsl(var(--muted-foreground))',
        }"
      >
        <IconifyIcon
          :icon="trendType === 'up' ? 'lucide:trending-up' : trendType === 'down' ? 'lucide:trending-down' : 'lucide:minus'"
          class="size-3"
        />
        {{ trend }}
      </span>
    </div>
  </div>
</template>
