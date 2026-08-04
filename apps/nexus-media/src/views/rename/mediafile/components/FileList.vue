<script lang="ts" setup>
import type { FileItem, SortKey, SortOrder } from '../types';

import { IconifyIcon } from '@vben/icons';

import { NCheckbox, NEmpty, NSpin, NTooltip } from 'naive-ui';

import {
  formatSize,
  formatTime,
  getFileIcon,
  getFileIconColor,
} from '../utils';

interface Props {
  items: FileItem[];
  loading?: boolean;
  selectedPaths: Set<string>;
  selectionMode?: boolean;
  sortKey?: SortKey;
  sortOrder?: SortOrder;
  highlightPath?: string;
  emptyText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectionMode: false,
  sortKey: 'name',
  sortOrder: 'asc',
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
  toggleSelectAll: [];
  toggleSort: [key: SortKey];
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

function sortIcon(key: SortKey) {
  if (props.sortKey !== key) return '';
  return props.sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down';
}
</script>

<template>
  <NSpin :show="loading" class="file-list-wrapper">
    <div v-if="items.length > 0" class="file-list">
      <div class="file-list-header">
        <div class="file-col-check" @click.stop>
          <NCheckbox
            :checked="items.every((i) => selectedPaths.has(i.path))"
            @update:checked="emit('toggleSelectAll')"
          />
        </div>
        <div class="file-col-name sortable" @click="emit('toggleSort', 'name')">
          名称
          <IconifyIcon
            v-if="sortIcon('name')"
            :icon="sortIcon('name')"
            class="size-3 sort-icon"
          />
        </div>
        <div class="file-col-size sortable" @click="emit('toggleSort', 'size')">
          大小
          <IconifyIcon
            v-if="sortIcon('size')"
            :icon="sortIcon('size')"
            class="size-3 sort-icon"
          />
        </div>
        <div
          class="file-col-mtime sortable"
          @click="emit('toggleSort', 'mtime')"
        >
          修改时间
          <IconifyIcon
            v-if="sortIcon('mtime')"
            :icon="sortIcon('mtime')"
            class="size-3 sort-icon"
          />
        </div>
        <div class="file-col-actions"></div>
      </div>

      <div
        v-for="item in items"
        :key="item.path"
        class="file-list-row"
        :class="{
          'file-row-selected': selectedPaths.has(item.path),
          'file-row-highlighted': item.path === highlightPath,
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
        <div class="file-col-check" @click.stop>
          <NCheckbox
            :checked="selectedPaths.has(item.path)"
            @update:checked="emit('toggleSelect', item)"
          />
        </div>
        <div class="file-col-name">
          <IconifyIcon
            :icon="getFileIcon(item)"
            class="size-5 file-row-icon"
            :style="{ color: getFileIconColor(item) }"
          />
          <NTooltip trigger="hover">
            <template #trigger>
              <span class="file-row-name truncate">{{ item.name }}</span>
            </template>
            {{ item.path }}
          </NTooltip>
        </div>
        <div class="file-col-size">
          <span v-if="!item.is_dir">{{ formatSize(item.size) }}</span>
          <span v-else class="file-row-type">文件夹</span>
        </div>
        <div class="file-col-mtime">{{ formatTime(item.mtime) }}</div>
        <div class="file-col-actions" @click.stop>
          <button
            class="row-menu-btn"
            aria-label="更多操作"
            @click="
              emit('rowMenu', item, {
                x: $event.clientX,
                y: $event.clientY,
              })
            "
          >
            <IconifyIcon icon="lucide:more-vertical" class="size-4" />
          </button>
        </div>
      </div>
    </div>
    <NEmpty v-else-if="!loading" :description="emptyText" class="mt-8" />
  </NSpin>
</template>

<style scoped>
.file-list-wrapper {
  flex: 1;
  overflow-y: auto;
}

.file-list {
  display: flex;
  flex-direction: column;
}

.file-list-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: hsl(var(--muted) / 30%);
  border-bottom: 1px solid hsl(var(--border));
}

.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.sortable:hover {
  color: hsl(var(--card-foreground));
}

.sort-icon {
  display: inline-block;
  margin-left: 0.25rem;
  vertical-align: middle;
}

.file-list-row {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  transition: background-color 0.15s;
}

.file-list-row:hover {
  background-color: hsl(var(--accent) / 50%);
}

.file-row-selected {
  background-color: var(--tblr-primary-light);
  box-shadow: inset 2px 0 0 var(--tblr-primary);
}

.file-row-selected:hover {
  background-color: var(--tblr-primary-light);
}

.file-row-highlighted {
  background-color: hsl(var(--warning) / 15%);
}

.file-col-check {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  width: 2rem;
}

.file-col-check :deep(.n-checkbox) {
  opacity: 0;
  transition: opacity 0.15s;
}

.file-list-header .file-col-check :deep(.n-checkbox),
.file-list-row:hover .file-col-check :deep(.n-checkbox),
.file-row-selected .file-col-check :deep(.n-checkbox),
.in-selection .file-col-check :deep(.n-checkbox) {
  opacity: 1;
}

.file-col-name {
  display: flex;
  flex: 1;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.file-row-icon {
  flex-shrink: 0;
}

.file-row-name {
  font-size: 0.875rem;
  color: hsl(var(--card-foreground));
}

.file-col-size {
  flex-shrink: 0;
  width: 100px;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  text-align: right;
}

.file-row-type {
  color: hsl(var(--muted-foreground));
}

.file-col-mtime {
  flex-shrink: 0;
  width: 150px;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  text-align: right;
}

.file-col-actions {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  width: 2.5rem;
}

.row-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
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

.row-menu-btn:hover {
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--accent));
}

.file-list-row:hover .row-menu-btn,
.in-selection .row-menu-btn {
  opacity: 1;
}

@media (max-width: 767px) {
  .file-col-check :deep(.n-checkbox) {
    opacity: 1;
  }

  .row-menu-btn {
    width: 2.5rem;
    height: 2.5rem;
    opacity: 1;
  }

  .file-list-row {
    min-height: 3rem;
  }

  .file-col-size,
  .file-col-mtime {
    display: none;
  }
}
</style>
