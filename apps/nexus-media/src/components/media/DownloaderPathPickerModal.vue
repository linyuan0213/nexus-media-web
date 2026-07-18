<script lang="ts" setup>
import { ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NEmpty, NInput, NModal, NSpace, NSpin } from 'naive-ui';

import { browseDownloaderDirsApi } from '#/api/modules/download';

const props = defineProps<{
  downloaderConfig: Record<string, any>;
  downloaderType: string;
  initialPath?: string;
  show: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'confirm', path: string): void;
}>();

const loading = ref(false);
const currentPath = ref('');
const dirList = ref<string[]>([]);

async function fetchDirList() {
  loading.value = true;
  try {
    const res = await browseDownloaderDirsApi(
      props.downloaderType,
      JSON.stringify(props.downloaderConfig || {}),
    );
    dirList.value = res?.items || [];
  } catch {
    dirList.value = [];
  } finally {
    loading.value = false;
  }
}

function selectDir(path: string) {
  currentPath.value = path;
}

function handleConfirm() {
  const path = currentPath.value.trim();
  if (!path) return;
  emit('confirm', path);
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
      fetchDirList();
    }
  },
);
</script>

<template>
  <NModal
    :show="show"
    :title="title || '选择下载器目录'"
    preset="card"
    style="width: 600px; max-width: 90vw"
    :trap-focus="false"
    @update:show="handleClose"
  >
    <div class="dl-path-picker">
      <!-- 手动输入 + 刷新 -->
      <div class="picker-toolbar">
        <NInput
          v-model:value="currentPath"
          size="small"
          placeholder="下载保存目录（可手动输入或从下方选择）"
          clearable
        >
          <template #prefix>
            <IconifyIcon
              icon="lucide:folder-input"
              class="size-4"
              style="color: hsl(var(--muted-foreground))"
            />
          </template>
        </NInput>
        <NButton size="small" :loading="loading" @click="fetchDirList">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          刷新
        </NButton>
      </div>

      <div class="picker-hint">
        目录列表来自下载器 API（默认保存路径、分类路径及已有种子路径）
      </div>

      <!-- 目录列表 -->
      <NSpin :show="loading" class="picker-list-wrapper">
        <div v-if="dirList.length > 0" class="picker-list">
          <div
            v-for="item in dirList"
            :key="item"
            class="picker-item"
            :class="{ 'picker-item-active': item === currentPath }"
            @click="selectDir(item)"
            @dblclick="
              selectDir(item);
              handleConfirm();
            "
          >
            <IconifyIcon
              icon="lucide:folder"
              class="size-5 flex-shrink-0"
              style="color: hsl(var(--warning))"
            />
            <span class="picker-item-name" :title="item">{{ item }}</span>
            <IconifyIcon
              v-if="item === currentPath"
              icon="lucide:check"
              class="size-4 flex-shrink-0"
              style="color: hsl(var(--primary))"
            />
          </div>
        </div>
        <NEmpty
          v-else-if="!loading"
          description="未获取到目录，请检查下载器连接或手动输入"
          size="small"
          class="py-4"
        />
      </NSpin>

      <!-- 底部按钮 -->
      <div class="picker-footer">
        <NSpace justify="end">
          <NButton size="small" @click="handleClose">取消</NButton>
          <NButton
            type="primary"
            size="small"
            :disabled="!currentPath.trim()"
            @click="handleConfirm"
          >
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
.dl-path-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.picker-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.picker-hint {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
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

.picker-item-active {
  background: hsl(var(--primary) / 10%);
}

.picker-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  font-size: 14px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.picker-footer {
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border));
}
</style>
