<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface Props {
  facts: any[];
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
        icon="lucide:info"
        class="size-5"
        style="color: hsl(var(--primary))"
      />
      <h2
        class="text-lg font-semibold"
        style="color: hsl(var(--card-foreground))"
      >
        详细信息
      </h2>
    </div>

    <div class="space-y-2">
      <div
        v-for="(item, idx) in facts"
        :key="idx"
        class="flex justify-between border-b py-2 last:border-0"
        style="border-color: hsl(var(--border))"
      >
        <span class="font-medium" style="color: hsl(var(--card-foreground))">{{
          getKey(item)
        }}</span>
        <span
          class="max-w-[60%] text-right text-sm"
          style="color: hsl(var(--muted-foreground))"
          >{{ getValue(item) }}</span
        >
      </div>
    </div>
  </div>
</template>
