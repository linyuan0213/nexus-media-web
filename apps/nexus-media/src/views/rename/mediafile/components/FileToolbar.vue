<script lang="ts" setup>
import type { SearchScope, ViewMode } from '../types';

import { nextTick, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NButtonGroup,
  NDropdown,
  NInput,
  NSelect,
  NTooltip,
} from 'naive-ui';

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface Props {
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  breadcrumbs: BreadcrumbItem[];
  rootName: string;
  rootPath: string;
  currentPath: string;
  viewMode: ViewMode;
  searchKeyword: string;
  searchScope: SearchScope;
  isMobile?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isMobile: false,
});

const emit = defineEmits<{
  back: [];
  forward: [];
  mkdir: [];
  navigate: [path: string];
  openNav: [];
  refresh: [];
  searchEnter: [];
  up: [];
  'update:searchKeyword': [value: string];
  'update:searchScope': [value: SearchScope];
  'update:viewMode': [value: ViewMode];
  upload: [];
}>();

const scopeOptions = [
  { label: '当前目录', value: 'dir' },
  { label: '全盘索引', value: 'global' },
];

const moreOptions = [
  { label: '新建目录', key: 'mkdir' },
  { label: '上传文件', key: 'upload' },
  { label: '刷新', key: 'refresh' },
];

const editingPath = ref(false);
const pathInput = ref('');
const pathInputRef = ref<InstanceType<typeof NInput>>();

function startEditPath() {
  pathInput.value = props.currentPath || '/';
  editingPath.value = true;
  nextTick(() => pathInputRef.value?.focus());
}

function submitPath() {
  const p = pathInput.value.trim();
  editingPath.value = false;
  if (p && p !== props.currentPath) {
    emit('navigate', p === '/' ? '' : p);
  }
}

function handlePathKeyup(e: KeyboardEvent) {
  if (e.key === 'Enter') submitPath();
  else if (e.key === 'Escape') editingPath.value = false;
}

function handleMore(key: string) {
  switch (key) {
    case 'mkdir': {
      emit('mkdir');
      break;
    }
    case 'refresh': {
      {
        emit('refresh');
        // No default
      }
      break;
    }
    case 'upload': {
      emit('upload');
      break;
    }
  }
}
</script>

<template>
  <div class="file-toolbar">
    <div class="toolbar-row">
      <NButton
        v-if="isMobile"
        size="small"
        quaternary
        aria-label="打开导航"
        @click="emit('openNav')"
      >
        <template #icon>
          <IconifyIcon icon="lucide:menu" class="size-5" />
        </template>
      </NButton>

      <NButtonGroup size="small">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              quaternary
              :disabled="!canGoBack"
              aria-label="后退"
              @click="emit('back')"
            >
              <template #icon>
                <IconifyIcon icon="lucide:arrow-left" class="size-4" />
              </template>
            </NButton>
          </template>
          后退
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              quaternary
              :disabled="!canGoForward"
              aria-label="前进"
              @click="emit('forward')"
            >
              <template #icon>
                <IconifyIcon icon="lucide:arrow-right" class="size-4" />
              </template>
            </NButton>
          </template>
          前进
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              quaternary
              :disabled="!canGoUp"
              aria-label="上级目录"
              @click="emit('up')"
            >
              <template #icon>
                <IconifyIcon icon="lucide:arrow-up" class="size-4" />
              </template>
            </NButton>
          </template>
          上级目录
        </NTooltip>
      </NButtonGroup>

      <div class="address-bar" @click="startEditPath">
        <NInput
          v-if="editingPath"
          ref="pathInputRef"
          v-model:value="pathInput"
          size="small"
          @keyup="handlePathKeyup"
          @blur="editingPath = false"
        />
        <div v-else class="breadcrumb-path">
          <span
            v-if="rootName"
            class="breadcrumb-item"
            @click.stop="emit('navigate', rootPath)"
          >
            {{ rootName }}
          </span>
          <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
            <span class="breadcrumb-separator">/</span>
            <span
              class="breadcrumb-item"
              :class="{
                'breadcrumb-active': index === breadcrumbs.length - 1,
              }"
              @click.stop="emit('navigate', crumb.path)"
            >
              {{ crumb.name }}
            </span>
          </template>
          <span
            v-if="!rootName && breadcrumbs.length === 0"
            class="breadcrumb-hint"
          >
            点击输入路径
          </span>
        </div>
      </div>

      <div class="toolbar-search">
        <NSelect
          :value="searchScope"
          :options="scopeOptions"
          size="small"
          class="search-scope"
          @update:value="(v: SearchScope) => emit('update:searchScope', v)"
        />
        <NInput
          :value="searchKeyword"
          size="small"
          clearable
          :placeholder="
            searchScope === 'dir' ? '过滤当前目录...' : '搜索全盘文件...'
          "
          @update:value="(v: string) => emit('update:searchKeyword', v)"
          @keyup.enter="emit('searchEnter')"
          @clear="emit('update:searchKeyword', '')"
        >
          <template #prefix>
            <IconifyIcon
              icon="lucide:search"
              class="size-4"
              style="color: hsl(var(--muted-foreground))"
            />
          </template>
        </NInput>
      </div>

      <NButtonGroup size="small">
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              quaternary
              :type="viewMode === 'list' ? 'primary' : 'default'"
              aria-label="列表视图"
              @click="emit('update:viewMode', 'list')"
            >
              <template #icon>
                <IconifyIcon icon="lucide:list" class="size-4" />
              </template>
            </NButton>
          </template>
          列表视图
        </NTooltip>
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              quaternary
              :type="viewMode === 'grid' ? 'primary' : 'default'"
              aria-label="网格视图"
              @click="emit('update:viewMode', 'grid')"
            >
              <template #icon>
                <IconifyIcon icon="lucide:layout-grid" class="size-4" />
              </template>
            </NButton>
          </template>
          网格视图
        </NTooltip>
      </NButtonGroup>

      <NTooltip trigger="hover">
        <template #trigger>
          <NButton
            size="small"
            quaternary
            aria-label="刷新"
            @click="emit('refresh')"
          >
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
            </template>
          </NButton>
        </template>
        刷新
      </NTooltip>

      <NDropdown :options="moreOptions" @select="handleMore">
        <NButton size="small" quaternary aria-label="更多操作">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
        </NButton>
      </NDropdown>
    </div>
  </div>
</template>

<style scoped>
.file-toolbar {
  display: flex;
  flex-direction: column;
  padding: 0.375rem 0.75rem;
  background-color: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.toolbar-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.address-bar {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0.5rem;
  cursor: text;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  transition: border-color 0.15s;
}

.address-bar:hover {
  border-color: hsl(var(--primary) / 50%);
}

.breadcrumb-path {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  overflow-x: auto;
  white-space: nowrap;
}

.breadcrumb-item {
  flex-shrink: 0;
  padding: 0.125rem 0.375rem;
  font-size: 0.85rem;
  color: hsl(var(--primary));
  cursor: pointer;
  border-radius: 0.25rem;
  transition: background-color 0.15s;
}

.breadcrumb-item:hover {
  background-color: hsl(var(--accent));
}

.breadcrumb-item.breadcrumb-active {
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.breadcrumb-separator {
  flex-shrink: 0;
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
  user-select: none;
}

.breadcrumb-hint {
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
}

.toolbar-search {
  display: flex;
  flex-shrink: 0;
  gap: 0.25rem;
  align-items: center;
}

.search-scope {
  width: 110px;
}

.toolbar-search :deep(.n-input) {
  width: 200px;
}

@media (max-width: 767px) {
  .toolbar-row {
    flex-wrap: wrap;
  }

  .address-bar {
    flex-basis: 100%;
    order: 2;
  }

  .toolbar-search {
    flex-basis: 100%;
    order: 3;
  }

  .search-scope {
    flex-shrink: 0;
    width: 110px;
  }

  .toolbar-search :deep(.n-input) {
    flex: 1;
    width: auto;
    min-width: 0;
  }
}
</style>
