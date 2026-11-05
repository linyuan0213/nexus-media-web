<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton } from 'naive-ui';

interface Props {
  inLibrary?: boolean;
  subscribed?: boolean;
}

withDefaults(defineProps<Props>(), {
  inLibrary: false,
  subscribed: false,
});

const emit = defineEmits<{
  search: [];
  subscribe: [];
}>();
</script>

<template>
  <div class="media-card-actions" role="group" aria-label="媒体操作">
    <NButton
      circle
      size="small"
      type="primary"
      title="搜索资源"
      aria-label="搜索资源"
      @click.stop="emit('search')"
    >
      <template #icon>
        <IconifyIcon icon="lucide:search" class="size-4" />
      </template>
    </NButton>
    <NButton
      v-if="!inLibrary"
      circle
      size="small"
      :type="subscribed ? 'error' : 'default'"
      :title="subscribed ? '已订阅' : '订阅'"
      :aria-label="subscribed ? '已订阅' : '订阅'"
      @click.stop="emit('subscribe')"
    >
      <template #icon>
        <IconifyIcon
          icon="lucide:heart"
          class="size-4"
          :style="subscribed ? 'fill: currentcolor' : ''"
        />
      </template>
    </NButton>
  </div>
</template>

<style scoped>
.media-card-actions {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  transform: translateY(-50%);
}

.media-card-actions :deep(.n-button) {
  box-shadow: 0 1px 4px hsl(var(--background) / 35%);
}
</style>
