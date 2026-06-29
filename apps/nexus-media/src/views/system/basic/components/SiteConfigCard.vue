<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NSpace } from 'naive-ui';

interface Props {
  local?: string;
  remote?: string;
  needsUpdate?: boolean;
  reloading?: boolean;
  updating?: boolean;
}

withDefaults(defineProps<Props>(), {
  local: '',
  needsUpdate: false,
  reloading: false,
  remote: '',
  updating: false,
});

const emit = defineEmits<{
  reload: [];
  update: [];
}>();
</script>

<template>
  <NCard
    size="small"
    class="mb-6 overflow-hidden"
    style="
      background: hsl(var(--card));
      border-color: hsl(var(--border));
      border-left-color: hsl(var(--primary));
      border-left-width: 4px;
    "
  >
    <template #header>
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:globe"
          class="size-4"
          style="color: hsl(var(--primary))"
        />
        <span class="font-semibold" style="color: hsl(var(--card-foreground))"
          >站点配置</span
        >
      </div>
    </template>
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="text-sm" style="color: hsl(var(--muted-foreground))">
        <span v-if="local">当前版本: {{ local }}</span>
        <span v-if="remote && remote !== 'unknown'"
          >，远程版本: {{ remote }}</span
        >
        <span
          v-if="needsUpdate"
          class="ml-1 font-medium"
          style="color: hsl(var(--warning))"
          >（有新版本）</span
        >
      </div>
      <NSpace>
        <NButton size="small" :loading="reloading" @click="emit('reload')">
          <template #icon>
            <IconifyIcon icon="lucide:activity" class="size-4" />
          </template>
          重载配置
        </NButton>
        <NButton
          size="small"
          :loading="updating"
          :type="needsUpdate ? 'primary' : 'default'"
          @click="emit('update')"
        >
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          {{ needsUpdate ? '更新站点配置' : '检查更新' }}
        </NButton>
      </NSpace>
    </div>
  </NCard>
</template>
