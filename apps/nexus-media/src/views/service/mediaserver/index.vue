<script lang="ts" setup>
import type {
  MediaServerInstance,
  MediaServerSchema,
} from './components/types';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NModal, NSpin, useMessage } from 'naive-ui';

import {
  deleteMediaServerApi,
  getMediaServersConfigApi,
  setDefaultMediaServerApi,
} from '#/api/modules/system';
import PageHeader from '#/components/page/PageHeader.vue';

import MediaServerCard from './components/MediaServerCard.vue';
import MediaServerEditModal from './components/MediaServerEditModal.vue';

const message = useMessage();
const loading = ref(false);
const schemas = ref<Record<string, MediaServerSchema>>({});
const instances = ref<MediaServerInstance[]>([]);
const editVisible = ref(false);
const currentInstance = ref<MediaServerInstance | null>(null);
const deleteVisible = ref(false);
const deleteTarget = ref<MediaServerInstance | null>(null);
const deleting = ref(false);

const sortedInstances = computed(() =>
  [...instances.value].sort(
    (a, b) => b.is_default - a.is_default || a.name.localeCompare(b.name),
  ),
);

async function fetchData() {
  loading.value = true;
  try {
    const response: any = await getMediaServersConfigApi();
    const data = response.data ?? response;
    schemas.value = data.mediaserver_conf || {};
    instances.value = Object.entries(data.servers || {}).map(
      ([key, value]: [string, any]) => ({
        id: value.id,
        name: value.name || key,
        type: value.type || key,
        enabled: value.enabled,
        is_default: value.is_default,
        config: value.config || {},
      }),
    );
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '获取媒体服务器配置失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  currentInstance.value = null;
  editVisible.value = true;
}

function openEdit(instance: MediaServerInstance) {
  currentInstance.value = instance;
  editVisible.value = true;
}

async function setDefault(instance: MediaServerInstance) {
  if (!instance.id || instance.is_default) return;
  await setDefaultMediaServerApi(instance.id);
  message.success(`${instance.name} 已设为默认媒体服务器`);
  await fetchData();
}

function confirmDelete(instance: MediaServerInstance) {
  deleteTarget.value = instance;
  deleteVisible.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value?.id) return;
  deleting.value = true;
  try {
    await deleteMediaServerApi(deleteTarget.value.id);
    message.success('媒体服务器实例已删除');
    deleteVisible.value = false;
    deleteTarget.value = null;
    await fetchData();
  } catch (error: any) {
    message.error(
      error?.response?.data?.detail || error?.message || '删除失败',
    );
  } finally {
    deleting.value = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="mediaserver-page">
    <PageHeader
      title="媒体服务器设置"
      subtitle="管理媒体服务器配置及媒体库同步目标"
    >
      <template #actions>
        <NButton type="primary" @click="openCreate">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增媒体服务器
        </NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="sortedInstances.length" class="instance-grid">
        <MediaServerCard
          v-for="instance in sortedInstances"
          :key="instance.id"
          :instance="instance"
          @edit="openEdit(instance)"
          @set-default="setDefault(instance)"
          @delete="confirmDelete(instance)"
        />
      </div>
      <div v-else-if="!loading" class="empty-state">
        <div class="empty-icon">
          <IconifyIcon icon="lucide:server-off" class="size-8" />
        </div>
        <p>暂无媒体服务器配置</p>
        <NButton type="primary" @click="openCreate">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增媒体服务器
        </NButton>
      </div>
    </NSpin>

    <MediaServerEditModal
      v-model:show="editVisible"
      :instance="currentInstance"
      :schemas="schemas"
      @saved="fetchData"
    />

    <NModal
      v-model:show="deleteVisible"
      preset="dialog"
      type="warning"
      title="删除媒体服务器"
      positive-text="删除"
      negative-text="取消"
      :loading="deleting"
      @positive-click="handleDelete"
    >
      确定删除“{{ deleteTarget?.name }}”吗？此操作不会影响其他实例。
    </NModal>
  </div>
</template>

<style scoped>
.mediaserver-page {
  padding: 20px;
  background: hsl(var(--background));
}

.instance-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 50%;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
}

@media (min-width: 640px) {
  .instance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .instance-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
