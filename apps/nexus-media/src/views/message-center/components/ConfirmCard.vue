<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton } from 'naive-ui';

defineProps<{
  arguments: Record<string, any>;
  busy?: boolean;
  message: string;
  tool: string;
}>();

const emit = defineEmits<{
  approve: [];
  reject: [];
}>();
</script>

<template>
  <div
    class="mx-auto my-2 flex max-w-[92%] items-center gap-3 rounded-xl border px-4 py-3"
    :style="{
      background: 'hsl(var(--warning) / 0.08)',
      borderColor: 'hsl(var(--warning) / 0.4)',
    }"
  >
    <IconifyIcon
      icon="lucide:shield-alert"
      class="size-5 shrink-0"
      :style="{ color: 'hsl(var(--warning))' }"
    />
    <div class="min-w-0 flex-1">
      <div
        class="text-sm font-medium"
        :style="{ color: 'hsl(var(--foreground))' }"
      >
        危险操作需要确认
      </div>
      <div
        class="mt-0.5 text-xs"
        :style="{ color: 'hsl(var(--muted-foreground))' }"
      >
        {{ message }}（{{ tool }}）
      </div>
    </div>
    <div class="flex shrink-0 gap-2">
      <NButton
        size="small"
        type="warning"
        :loading="busy"
        @click="emit('approve')"
      >
        确认执行
      </NButton>
      <NButton size="small" quaternary @click="emit('reject')">取消</NButton>
    </div>
  </div>
</template>
