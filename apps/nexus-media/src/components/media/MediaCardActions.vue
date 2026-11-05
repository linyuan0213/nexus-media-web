<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

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
    <button
      type="button"
      class="media-card-action"
      aria-label="搜索资源"
      @click.stop="emit('search')"
    >
      <IconifyIcon icon="lucide:search" class="size-3" />
      <span>搜索</span>
    </button>
    <span class="media-card-action-divider" aria-hidden="true"></span>
    <button
      v-if="inLibrary"
      type="button"
      class="media-card-action media-card-action--muted"
      disabled
      aria-label="已入库"
    >
      <IconifyIcon icon="lucide:check" class="size-3" />
      <span>已入库</span>
    </button>
    <button
      v-else
      type="button"
      class="media-card-action"
      :class="{ 'media-card-action--active': subscribed }"
      :aria-label="subscribed ? '已订阅' : '订阅'"
      @click.stop="emit('subscribe')"
    >
      <IconifyIcon
        icon="lucide:heart"
        class="size-3"
        :style="subscribed ? 'fill: currentcolor' : ''"
      />
      <span>{{ subscribed ? '已订阅' : '订阅' }}</span>
    </button>
  </div>
</template>

<style scoped>
.media-card-actions {
  display: flex;
  gap: 0.125rem;
  align-items: center;
  justify-content: center;
  margin-top: 0.375rem;
  color: rgb(255 255 255 / 92%);
}

.media-card-action {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  min-height: 1.75rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  line-height: 1;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 9999px;
  transition: background-color 0.15s ease;
}

.media-card-action:hover,
.media-card-action:focus-visible {
  outline: none;
  background: rgb(255 255 255 / 16%);
}

.media-card-action:focus-visible {
  box-shadow: 0 0 0 1px rgb(255 255 255 / 70%);
}

.media-card-action:disabled {
  cursor: default;
}

.media-card-action--active {
  color: hsl(var(--destructive));
}

.media-card-action--muted {
  color: rgb(255 255 255 / 65%);
}

.media-card-action-divider {
  width: 1px;
  height: 0.75rem;
  background: rgb(255 255 255 / 28%);
}
</style>
