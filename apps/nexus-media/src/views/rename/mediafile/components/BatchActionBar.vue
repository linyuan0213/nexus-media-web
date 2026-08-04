<script lang="ts" setup>
import type { FileActionKey } from '../types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NDropdown } from 'naive-ui';

interface Props {
  count: number;
  allFiles?: boolean;
  mobile?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  allFiles: true,
  mobile: false,
});

const emit = defineEmits<{
  action: [key: FileActionKey];
  clear: [];
}>();

const moreOptions = computed(() => {
  const opts = [
    { label: '识别', key: 'identify' },
    { label: '移动', key: 'move' },
    { label: '复制', key: 'copy' },
  ];
  if (props.allFiles) {
    opts.push({ label: '下载', key: 'download' });
  }
  return opts;
});
</script>

<template>
  <div class="batch-bar" :class="{ 'batch-bar-mobile': mobile }">
    <div class="batch-info">
      <NButton text size="small" aria-label="取消选择" @click="emit('clear')">
        <template #icon>
          <IconifyIcon icon="lucide:x" class="size-4" />
        </template>
      </NButton>
      <span class="batch-count">已选 {{ count }} 项</span>
    </div>
    <div class="batch-actions">
      <NButton size="small" @click="emit('action', 'transfer')">
        <template #icon>
          <IconifyIcon icon="lucide:arrow-right-left" class="size-4" />
        </template>
        转移
      </NButton>
      <NButton size="small" @click="emit('action', 'scrap')">
        <template #icon>
          <IconifyIcon icon="lucide:sparkles" class="size-4" />
        </template>
        刮削
      </NButton>
      <NButton v-if="allFiles" size="small" @click="emit('action', 'subtitle')">
        <template #icon>
          <IconifyIcon icon="lucide:subtitles" class="size-4" />
        </template>
        字幕
      </NButton>
      <NDropdown
        :options="moreOptions"
        @select="(key: FileActionKey) => emit('action', key)"
      >
        <NButton size="small">
          <template #icon>
            <IconifyIcon icon="lucide:more-horizontal" class="size-4" />
          </template>
          更多
        </NButton>
      </NDropdown>
      <NButton
        size="small"
        type="error"
        secondary
        @click="emit('action', 'delete')"
      >
        <template #icon>
          <IconifyIcon icon="lucide:trash-2" class="size-4" />
        </template>
        删除
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background-color: hsl(var(--card));
  border-bottom: 1px solid var(--tblr-primary);
  box-shadow: var(--tblr-box-shadow);
}

.batch-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.batch-count {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--tblr-primary);
}

.batch-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.batch-bar-mobile {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  flex-direction: column;
  gap: 0.5rem;
  align-items: stretch;
  padding: 0.625rem 1rem calc(0.625rem + env(safe-area-inset-bottom));
  border-top: 1px solid var(--tblr-primary);
  border-bottom: none;
}

.batch-bar-mobile .batch-actions {
  justify-content: space-between;
}

.batch-bar-mobile .batch-actions :deep(.n-button) {
  flex: 1;
}
</style>
