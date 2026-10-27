<script lang="ts" setup>
import type { MediaApi } from '#/api/modules/media';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NAlert, NButton, NEmpty, NSelect, NSpin, useMessage } from 'naive-ui';

import { getLibraryHomeApi, refreshMediaLibraryApi } from '#/api/modules/media';
import PageHeader from '#/components/page/PageHeader.vue';

import LibraryRouteModal from './components/LibraryRouteModal.vue';
import LibraryServerSection from './components/LibraryServerSection.vue';
import StorageUsage from './components/StorageUsage.vue';
import SyncLibrariesModal from './components/SyncLibrariesModal.vue';

const message = useMessage();
const loading = ref(false);
const refreshing = ref(false);
const servers = ref<MediaApi.MediaServerOption[]>([]);
const sections = ref<MediaApi.LibrarySection[]>([]);
const librarySpaces = ref<Record<string, any>>({});
const selectedServer = ref<'all' | number>('all');
const scanningId = ref<null | number>(null);
const syncVisible = ref(false);
const routeVisible = ref(false);
const syncServerId = ref<null | number>(null);
let requestSequence = 0;

const serverOptions = computed(() => [
  { label: `全部服务器（${servers.value.length}）`, value: 'all' as const },
  ...servers.value.map((server) => ({
    label: `${server.name}（${server.type}）`,
    value: server.id,
  })),
]);
const visibleSections = computed(() =>
  selectedServer.value === 'all'
    ? sections.value
    : sections.value.filter(
        (section) => section.server_id === selectedServer.value,
      ),
);
const onlineCount = computed(
  () => sections.value.filter((section) => section.server_success).length,
);

async function fetchData(showRefresh = false) {
  const sequence = ++requestSequence;
  if (showRefresh) refreshing.value = true;
  else loading.value = true;
  try {
    const serverId =
      selectedServer.value === 'all' ? undefined : selectedServer.value;
    const data = await getLibraryHomeApi(serverId);
    if (sequence !== requestSequence) return;
    servers.value = data.servers || [];
    sections.value = data.sections || [];
    librarySpaces.value = data.library_spaces || {};
  } catch (error: any) {
    if (sequence === requestSequence)
      message.error(error?.response?.data?.detail || '媒体库加载失败');
  } finally {
    if (sequence === requestSequence) {
      loading.value = false;
      refreshing.value = false;
    }
  }
}

function selectServer(value: 'all' | number) {
  selectedServer.value = value;
  void fetchData();
}

async function scanLibrary(section: MediaApi.LibrarySection) {
  scanningId.value = section.server_id;
  try {
    await refreshMediaLibraryApi(section.server_id);
    message.success(`${section.server_name} 的媒体库扫描已提交`);
  } catch (error: any) {
    message.error(error?.response?.data?.detail || '媒体库扫描提交失败');
  } finally {
    scanningId.value = null;
  }
}

function openSync(section?: MediaApi.LibrarySection) {
  syncServerId.value =
    section?.server_id ||
    (selectedServer.value === 'all' ? null : selectedServer.value);
  syncVisible.value = true;
}

onMounted(fetchData);
</script>

<template>
  <div class="library-page">
    <PageHeader
      title="我的媒体库"
      :subtitle="`${onlineCount} / ${sections.length} 个实例连接正常`"
    >
      <template #actions>
        <div class="page-actions">
          <NSelect
            :value="selectedServer"
            :options="serverOptions"
            class="server-select"
            @update:value="selectServer"
          />
          <NButton secondary @click="routeVisible = true">
            <template #icon><IconifyIcon icon="lucide:route" /></template>
            目录路由
          </NButton>
          <NButton secondary @click="openSync()">
            <template #icon><IconifyIcon icon="lucide:folder-sync" /></template>
            同步媒体库
          </NButton>
          <NButton
            type="primary"
            :loading="refreshing"
            @click="fetchData(true)"
          >
            <template #icon><IconifyIcon icon="lucide:refresh-cw" /></template>
            刷新数据
          </NButton>
        </div>
      </template>
    </PageHeader>

    <NAlert
      v-if="servers.length === 0 && !loading"
      type="info"
      :bordered="false"
    >
      尚未配置启用的媒体服务器，请先前往“服务设置 → 媒体服务器”添加实例。
    </NAlert>

    <NSpin :show="loading">
      <div v-if="visibleSections.length" class="server-sections">
        <LibraryServerSection
          v-for="section in visibleSections"
          :key="section.server_id"
          :section="section"
          :scanning="scanningId === section.server_id"
          @scan="scanLibrary(section)"
          @sync="openSync(section)"
        />
      </div>
      <NEmpty
        v-else-if="!loading && servers.length > 0"
        description="当前实例暂无媒体库数据"
        class="py-16"
      />
    </NSpin>

    <StorageUsage
      v-if="Object.keys(librarySpaces).length"
      class="storage-card"
      :free-space="librarySpaces.FreeSpace"
      :used-space="librarySpaces.UsedSpace"
      :total-space="librarySpaces.TotalSpace"
      :used-percent="librarySpaces.UsedPercent"
    />

    <SyncLibrariesModal
      v-model:show="syncVisible"
      :servers="servers"
      :sections="sections"
      :initial-server-id="syncServerId"
    />
    <LibraryRouteModal v-model:show="routeVisible" :servers="servers" />
  </div>
</template>

<style scoped>
.library-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
}

.page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.server-select {
  width: 240px;
}

.server-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.storage-card {
  max-width: 100%;
}

@media (max-width: 900px) {
  .page-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .library-page {
    padding: 12px;
  }

  .page-actions,
  .server-select {
    width: 100%;
  }

  .page-actions :deep(.n-button) {
    flex: 1;
  }
}
</style>
