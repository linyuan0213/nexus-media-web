<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton } from 'naive-ui';

interface Props {
  seasons: any[];
}

defineProps<Props>();

const emit = defineEmits<{
  search: [];
}>();
</script>

<template>
  <div
    class="rounded-2xl border p-5"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div class="mb-4 flex items-center gap-2">
      <IconifyIcon
        icon="lucide:list-video"
        class="size-5"
        style="color: hsl(var(--primary))"
      />
      <h2
        class="text-lg font-semibold"
        style="color: hsl(var(--card-foreground))"
      >
        季集
      </h2>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="season in seasons"
        :key="season.season_number"
        class="flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-accent/30"
        style="border-color: hsl(var(--border))"
      >
        <div>
          <div class="font-medium" style="color: hsl(var(--card-foreground))">
            {{ season.name || `第 ${season.season_number} 季` }}
          </div>
          <div
            class="mt-0.5 text-xs"
            style="color: hsl(var(--muted-foreground))"
          >
            {{ season.episode_count ? `共 ${season.episode_count} 集` : '' }}
            {{ season.air_date ? ` | ${season.air_date}` : '' }}
          </div>
        </div>
        <NButton size="tiny" @click="emit('search')">搜索</NButton>
      </div>
    </div>
  </div>
</template>
