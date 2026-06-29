<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface Props {
  crews: any[];
}

defineProps<Props>();

function getKey(item: any): string {
  return item && Object.keys(item)[0];
}

function getValue(item: any): string {
  return item && Object.values(item)[0];
}
</script>

<template>
  <div
    class="rounded-2xl border p-5"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div class="mb-4 flex items-center gap-2">
      <IconifyIcon
        icon="lucide:users"
        class="size-5"
        style="color: hsl(var(--primary))"
      />
      <h2
        class="text-lg font-semibold"
        style="color: hsl(var(--card-foreground))"
      >
        演职人员
      </h2>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(item, idx) in crews"
        :key="idx"
        class="rounded-xl border p-3"
        style="border-color: hsl(var(--border))"
      >
        <div class="font-medium" style="color: hsl(var(--card-foreground))">
          {{ getKey(item) }}
        </div>
        <div class="mt-0.5 text-sm" style="color: hsl(var(--muted-foreground))">
          {{ getValue(item) }}
        </div>
      </div>
    </div>
  </div>
</template>
