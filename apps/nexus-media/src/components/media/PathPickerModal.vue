<script lang="ts" setup>
import type { StorageApi } from '#/api/modules/storage';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NEmpty, NModal, NSelect, NSpace, NSpin } from 'naive-ui';

import { getDirListApi } from '#/api/modules/media';
import { getStorageBackendsApi } from '#/api/modules/storage';

const props = defineProps<{
  initialBackendId?: string;
  initialPath?: string;
  show: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'confirm', path: string, backendId: string): void;
}>();

const loading = ref(false);
const currentPath = ref('');
const currentBackendId = ref('local');
const dirList = ref<Array<{ is_dir: boolean; name: string; path: string }>>([]);
const backends = ref<StorageApi.StorageBackend[]>([]);

const backendOptions = computed(() => [
  { label: '本地', value: 'local' },
  ...backends.value.map((b) => ({
    label: `${b.name} (${b.type})`,
    value: String(b.id),
  })),
]);

const breadcrumbs = computed(() => {
  if (!currentPath.value || currentPath.value === '/') return [];
  const parts = currentPath.value
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean);
  const items: Array<{ name: string; path: string }> = [];
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : `/${part}`;
    items.push({ name: part, path: acc });
  }
  return items;
});

async function fetchBackends() {
  try {
    const res = await getStorageBackendsApi();
    backends.value = res.items || [];
  } catch {
    // ignore
  }
}

async function fetchDirList(path?: string) {
  loading.value = true;
  try {
    const res = await getDirListApi(
      path,
      'HIDE_FILES_FILTER',
      currentBackendId.value,
    );
    if (Array.isArray(res)) {
      dirList.value = res
        .filter((a: any) => a.is_dir)
        .toSorted((a: any, b: any) => a.name.localeCompare(b.name));
      currentPath.value = path || '';
    }
  } catch {
    dirList.value = [];
  } finally {
    loading.value = false;
  }
}

function navigateTo(path: string) {
  fetchDirList(path || undefined);
}

function goUp() {
  const norm = currentPath.value.replaceAll('\\', '/');
  const parts = norm.split('/').filter(Boolean);
  parts.pop();
  const parent = parts.length > 0 ? `/${parts.join('/')}` : '/';
  navigateTo(parent === '/' ? '' : parent);
}

function switchBackend(backendId: string) {
  currentBackendId.value = backendId;
  currentPath.value = '';
  fetchDirList();
}

function handleConfirm() {
  emit('confirm', currentPath.value, currentBackendId.value);
  emit('update:show', false);
}

function handleClose() {
  emit('update:show', false);
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      currentPath.value = props.initialPath || '';
      currentBackendId.value = props.initialBackendId || 'local';
      fetchBackends();
      fetchDirList(currentPath.value || undefined);
    }
  },
);
</script>

<template>
  <NModal
    :show="show"
    :title="title || '选择目录'"
    preset="card"
    style="width: 600px; max-width: 90vw"
    :trap-focus="false"
    @update:show="handleClose"
  >
    <div class="path-picker">
      <!-- 顶部工具栏 -->
      <div class="picker-toolbar">
        <NSelect
          v-model:value="currentBackendId"
          :options="backendOptions"
          size="small"
          style="width: 160px"
          @update:value="switchBackend"
        />
        <NButton size="small" :disabled="!currentPath" @click="goUp">
          <template #icon>
            <IconifyIcon icon="lucide:arrow-up" class="size-4" />
          </template>
          上级
        </NButton>
      </div>

      <!-- 面包屑 -->
      <div class="picker-breadcrumb">
        <span class="breadcrumb-root" @click="navigateTo('')">根目录</span>
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
          <span class="breadcrumb-separator">/</span>
          <span
            class="breadcrumb-item"
            :class="{ 'breadcrumb-active': index === breadcrumbs.length - 1 }"
            @click="navigateTo(crumb.path)"
          >
            {{ crumb.name }}
          </span>
        </template>
      </div>

      <!-- 当前路径显示 -->
      <div class="picker-current-path">
        <IconifyIcon
          icon="lucide:folder"
          class="size-4"
          style="color: hsl(var(--warning))"
        />
        <span class="path-text">{{ currentPath || '根目录' }}</span>
      </div>

      <!-- 目录列表 -->
      <NSpin :show="loading" class="picker-list-wrapper">
        <div v-if="dirList.length > 0" class="picker-list">
          <div
            v-for="item in dirList"
            :key="item.path"
            class="picker-item"
            @click="navigateTo(item.path)"
          >
            <IconifyIcon
              icon="lucide:folder"
              class="size-5"
              style="color: hsl(var(--warning))"
            />
            <span class="picker-item-name">{{ item.name }}</span>
            <IconifyIcon
              icon="lucide:chevron-right"
              class="size-4 picker-item-arrow"
            />
          </div>
        </div>
        <NEmpty v-else description="暂无目录" size="small" class="py-4" />
      </NSpin>

      <!-- 底部按钮 -->
      <div class="picker-footer">
        <NSpace justify="end">
          <NButton size="small" @click="handleClose">取消</NButton>
          <NButton type="primary" size="small" @click="handleConfirm">
            <template #icon>
              <IconifyIcon icon="lucide:check" class="size-4" />
            </template>
            确定
          </NButton>
        </NSpace>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.path-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.picker-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: center;
  min-height: 24px;
  padding: 4px 0;
  font-size: 13px;
}

.breadcrumb-root,
.breadcrumb-item {
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: color 0.2s;
}

.breadcrumb-root:hover,
.breadcrumb-item:hover {
  color: hsl(var(--primary));
}

.breadcrumb-active {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.breadcrumb-separator {
  padding: 0 2px;
  color: hsl(var(--muted-foreground));
}

.picker-current-path {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
  background: hsl(var(--accent));
  border-radius: 6px;
}

.path-text {
  color: hsl(var(--foreground));
  word-break: break-all;
}

.picker-list-wrapper {
  min-height: 200px;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.picker-list {
  display: flex;
  flex-direction: column;
}

.picker-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  transition: background 0.15s;
}

.picker-item:last-child {
  border-bottom: none;
}

.picker-item:hover {
  background: hsl(var(--accent));
}

.picker-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.picker-item-arrow {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.picker-footer {
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border));
}
</style>
