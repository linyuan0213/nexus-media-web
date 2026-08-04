<script lang="ts" setup>
import type { FileItem } from '../types';

import { IconifyIcon } from '@vben/icons';

import { NCheckbox, NEmpty, NSpin, NTooltip } from 'naive-ui';

import { formatSize, getFileIcon, getFileIconColor } from '../utils';

interface Props {
  items: FileItem[];
  loading?: boolean;
  selectedPaths: Set<string>;
  selectionMode?: boolean;
  highlightPath?: string;
  emptyText?: string;
}

withDefaults(defineProps<Props>(), {
  loading: false,
  selectionMode: false,
  highlightPath: '',
  emptyText: '当前目录为空',
});

const emit = defineEmits<{
  rowClick: [item: FileItem, mods: { ctrl: boolean; shift: boolean }];
  rowContextmenu: [item: FileItem, pos: { x: number; y: number }];
  rowDblclick: [item: FileItem];
  rowLongpress: [item: FileItem];
  rowMenu: [item: FileItem, pos: { x: number; y: number }];
  toggleSelect: [item: FileItem];
}>();

let pressTimer: null | ReturnType<typeof setTimeout> = null;

function onTouchStart(item: FileItem) {
  pressTimer = setTimeout(() => {
    pressTimer = null;
    emit('rowLongpress', item);
  }, 500);
}

function onTouchEnd() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}
</script>

<template>
  <NSpin :show="loading" class="file-grid-wrapper">
    <div v-if="items.length > 0" class="file-grid">
      <div
        v-for="item in items"
        :key="item.path"
        class="file-card"
        :class="{
          'file-card-selected': selectedPaths.has(item.path),
          'file-card-highlighted': item.path === highlightPath,
          'in-selection': selectionMode,
        }"
        @click="
          emit('rowClick', item, {
            ctrl: $event.ctrlKey || $event.metaKey,
            shift: $event.shiftKey,
          })
        "
        @dblclick="emit('rowDblclick', item)"
        @contextmenu.prevent="
          emit('rowContextmenu', item, { x: $event.clientX, y: $event.clientY })
        "
        @touchstart="onTouchStart(item)"
        @touchend="onTouchEnd"
        @touchmove="onTouchEnd"
      >
        <div class="file-card-check" @click.stop>
          <NCheckbox
            :checked="selectedPaths.has(item.path)"
            @update:checked="emit('toggleSelect', item)"
          />
        </div>
        <button
          class="file-card-menu"
          aria-label="更多操作"
          @click.stop="
            emit('rowMenu', item, { x: $event.clientX, y: $event.clientY })
          "
        >
          <IconifyIcon icon="lucide:more-vertical" class="size-4" />
        </button>
        <IconifyIcon
          :icon="getFileIcon(item)"
          class="size-10 file-card-icon"
          :style="{ color: getFileIconColor(item) }"
        />
        <NTooltip trigger="hover">
          <template #trigger>
            <span class="file-card-name">{{ item.name }}</span>
          </template>
          {{ item.path }}
        </NTooltip>
        <span v-if="!item.is_dir" class="file-card-size">
          {{ formatSize(item.size) }}
        </span>
      </div>
    </div>
    <NEmpty v-else-if="!loading" :description="emptyText" class="mt-8" />
  </NSpin>
</template>

<style scoped>
.file-grid-wrapper {
  flex: 1;
  padding: 0.75rem;
  overflow-y: auto;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.file-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  align-items: center;
  padding: 1rem 0.5rem 0.625rem;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--tblr-card-border-radius);
  transition:
    background-color 0.15s,
    border-color 0.15s;
}

.file-card:hover {
  background-color: hsl(var(--accent) / 50%);
}

.file-card-selected {
  background-color: var(--tblr-primary-light);
  border-color: var(--tblr-primary);
}

.file-card-highlighted {
  background-color: hsl(var(--warning) / 15%);
}

.file-card-check {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
}

.file-card-check :deep(.n-checkbox) {
  opacity: 0;
  transition: opacity 0.15s;
}

.file-card:hover .file-card-check :deep(.n-checkbox),
.file-card-selected .file-card-check :deep(.n-checkbox),
.in-selection .file-card-check :deep(.n-checkbox) {
  opacity: 1;
}

.file-card-menu {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  opacity: 0;
  transition:
    opacity 0.15s,
    background-color 0.15s;
}

.file-card-menu:hover {
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--accent));
}

.file-card:hover .file-card-menu,
.in-selection .file-card-menu {
  opacity: 1;
}

.file-card-icon {
  flex-shrink: 0;
}

.file-card-name {
  display: -webkit-box;
  width: 100%;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 0.8rem;
  line-height: 1.3;
  color: hsl(var(--card-foreground));
  text-align: center;
  word-break: break-all;
}

.file-card-size {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 767px) {
  .file-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  .file-card-check :deep(.n-checkbox),
  .file-card-menu {
    opacity: 1;
  }
}
</style>
