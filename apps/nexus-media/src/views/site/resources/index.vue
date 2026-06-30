<script lang="ts" setup>
import type { ResourceItem, SiteItem } from './types';

import { onMounted, onUnmounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NInput, NPagination, NSpin } from 'naive-ui';

import {
  addTorrentApi,
  getDownloadDirsApi,
  getDownloadSettingsApi,
  getIndexersApi,
  resolveDownloadUrlApi,
} from '#/api/modules/download';
import { getSiteFaviconsApi, getSiteResourcesApi } from '#/api/modules/site';
import EmptyState from '#/components/empty/EmptyState.vue';
import { useDownloadEventStream } from '#/composables/useDownloadEventStream';
import { useAppNotification } from '#/utils/notify';

import DownloadModal from './components/DownloadModal.vue';
import ResourceCard from './components/ResourceCard.vue';
import ResourceList from './components/ResourceList.vue';
import SiteSelector from './components/SiteSelector.vue';

const notification = useAppNotification();
const loading = ref(false);
const sites = ref<SiteItem[]>([]);
const resources = ref<ResourceItem[]>([]);
const selectedSite = ref<null | SiteItem>(null);
const keyword = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const favicons = ref<Record<string, string>>({});
const faviconLoadFailed = ref<Record<string, boolean>>({});
const viewMode = ref<'grid' | 'list'>('grid');
const { start: startSSE, stop: stopSSE } = useDownloadEventStream();

const downloadModalVisible = ref(false);
const downloadModalLoading = ref(false);
const downloadResource = ref<null | ResourceItem>(null);
const downloadSettings = ref<Array<{ label: string; value: string }>>([]);
const downloadDirs = ref<Array<{ label: string; value: string }>>([
  { label: '自动', value: '' },
]);
const selectedDownloadSetting = ref('');
const selectedDownloadDir = ref('');

async function fetchSites() {
  loading.value = true;
  try {
    const [indexersRes, faviconRes]: [any, any] = await Promise.all([
      getIndexersApi(),
      getSiteFaviconsApi().catch(() => ({}) as any),
    ]);
    const list = Array.isArray(indexersRes)
      ? indexersRes
      : indexersRes?.data || [];
    sites.value = list.map((s: any) => ({ id: s.id, name: s.name }));
    favicons.value = faviconRes?.data || faviconRes || {};
  } catch {
    // 全局请求拦截器已展示错误提示
  } finally {
    loading.value = false;
  }
}

function handleFaviconError(name: string) {
  faviconLoadFailed.value[name] = true;
}

function selectSite(site: SiteItem) {
  selectedSite.value = site;
  keyword.value = '';
  currentPage.value = 1;
  total.value = 0;
  fetchData();
}

function backToSites() {
  selectedSite.value = null;
  resources.value = [];
  total.value = 0;
}

async function fetchData(page = 1) {
  if (!selectedSite.value) return;
  loading.value = true;
  try {
    const res: any = await getSiteResourcesApi({
      id: selectedSite.value.id,
      page: page - 1,
      keyword: keyword.value || undefined,
    });
    let data: any[] = [];
    if (Array.isArray(res)) {
      data = res;
    } else if (Array.isArray(res?.data)) {
      data = res.data;
    } else if (Array.isArray(res?.data?.list)) {
      data = res.data.list;
    } else if (res?.data) {
      data = [res.data];
    }
    resources.value = data;
    currentPage.value = page;
    total.value =
      data.length > 0
        ? Math.max(total.value, page * pageSize.value + 1)
        : (page - 1) * pageSize.value;
  } catch {
    // 全局请求拦截器已展示错误提示
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  total.value = 0;
  fetchData(1);
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchData(page);
}

function handleOpenUrl(url?: string) {
  if (url) {
    window.open(url, '_blank');
  }
}

async function openDownloadModal(item: ResourceItem) {
  if (!item.enclosure && !item.page_url) {
    notification.warning('该资源暂无下载链接，请前往详情页查看');
    return;
  }
  downloadResource.value = item;
  downloadModalVisible.value = true;
  downloadModalLoading.value = true;
  downloadSettings.value = [];
  downloadDirs.value = [{ label: '自动', value: '' }];
  selectedDownloadSetting.value = '';
  selectedDownloadDir.value = '';
  try {
    const settingsRes: any = await getDownloadSettingsApi();
    if (Array.isArray(settingsRes)) {
      downloadSettings.value = settingsRes.map((s: any) => ({
        label: s.name || String(s.id),
        value: String(s.id),
      }));
    } else if (typeof settingsRes === 'object' && !Array.isArray(settingsRes)) {
      downloadSettings.value = Object.entries(settingsRes).map(
        ([sid, s]: [string, any]) => ({
          label: (s as any).name || sid,
          value: String((s as any).id || sid),
        }),
      );
    }
    if (downloadSettings.value.length > 0) {
      const first = downloadSettings.value[0]!.value;
      selectedDownloadSetting.value = first;
      await loadDownloadDirs(first);
    }
  } catch {
    // 全局请求拦截器已展示错误提示
  } finally {
    downloadModalLoading.value = false;
  }
}

async function loadDownloadDirs(val: string) {
  downloadDirs.value = [{ label: '自动', value: '' }];
  if (!val) return;
  try {
    const dirsRes: any = await getDownloadDirsApi(val);
    if (Array.isArray(dirsRes) && dirsRes.length > 0) {
      downloadDirs.value = [
        { label: '自动', value: '' },
        ...dirsRes.map((d: string) => ({ label: d, value: d })),
      ];
    }
  } catch {}
}

async function onDownloadSettingChange(val: null | string) {
  selectedDownloadSetting.value = val || '';
  selectedDownloadDir.value = '';
  await loadDownloadDirs(val || '');
}

async function confirmDownload() {
  if (!downloadResource.value) return;
  downloadModalLoading.value = true;
  try {
    let enclosure = downloadResource.value.enclosure || '';
    if (!enclosure && downloadResource.value.page_url) {
      const res: any = await resolveDownloadUrlApi({
        page_url: downloadResource.value.page_url,
        enclosure: downloadResource.value.enclosure,
      });
      enclosure = res?.data?.url || res?.url || '';
    }
    if (!enclosure) {
      notification.error('无法获取下载链接');
      return;
    }
    await addTorrentApi({
      urls: [enclosure],
      dl_dir: selectedDownloadDir.value || undefined,
      dl_setting: selectedDownloadSetting.value || undefined,
      page_url: downloadResource.value.page_url || undefined,
      upload_volume_factor:
        downloadResource.value.uploadvolumefactor ?? undefined,
      download_volume_factor:
        downloadResource.value.downloadvolumefactor ?? undefined,
      title: downloadResource.value.title || undefined,
      description: downloadResource.value.description || undefined,
      site: downloadResource.value.indexer || undefined,
      size: downloadResource.value.size ?? undefined,
    });
    notification.success('下载任务已提交');
    downloadModalVisible.value = false;
  } catch {
    // 全局请求拦截器已展示错误提示
  } finally {
    downloadModalLoading.value = false;
  }
}

onMounted(() => {
  fetchSites();
  startSSE();
});

onUnmounted(() => {
  stopSSE();
});
</script>

<template>
  <div class="p-4">
    <!-- 站点选择 -->
    <SiteSelector
      v-if="!selectedSite"
      :sites="sites"
      :loading="loading"
      :favicons="favicons"
      :favicon-load-failed="faviconLoadFailed"
      @favicon-error="handleFaviconError"
      @refresh="fetchSites"
      @select="selectSite"
    />

    <!-- 资源列表 -->
    <template v-else>
      <div class="header-row" :style="{ borderColor: 'hsl(var(--border))' }">
        <div class="header-title-group">
          <NButton
            size="small"
            quaternary
            class="back-button"
            @click="backToSites"
          >
            <template #icon>
              <IconifyIcon icon="lucide:arrow-left" class="h-4 w-4" />
            </template>
          </NButton>
          <h1 class="page-title" :style="{ color: 'hsl(var(--foreground))' }">
            {{ selectedSite.name }}
          </h1>
          <span
            class="page-subtitle"
            :style="{ color: 'hsl(var(--muted-foreground))' }"
            >资源列表</span
          >
        </div>

        <div class="toolbar-actions">
          <NButton size="small" @click="() => fetchData()">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            <span class="hidden sm:inline">刷新</span>
          </NButton>

          <!-- 视图切换 -->
          <div
            class="view-toggle"
            :style="{
              background: 'hsl(var(--accent))',
              borderColor: 'hsl(var(--border))',
            }"
          >
            <button
              type="button"
              class="view-toggle-btn"
              :class="{ active: viewMode === 'grid' }"
              :style="
                viewMode === 'grid'
                  ? {
                      background: 'hsl(var(--background))',
                      color: 'hsl(var(--foreground))',
                    }
                  : {
                      color: 'hsl(var(--muted-foreground))',
                    }
              "
              aria-label="网格视图"
              @click="viewMode = 'grid'"
            >
              <IconifyIcon icon="lucide:layout-grid" class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="view-toggle-btn"
              :class="{ active: viewMode === 'list' }"
              :style="
                viewMode === 'list'
                  ? {
                      background: 'hsl(var(--background))',
                      color: 'hsl(var(--foreground))',
                    }
                  : {
                      color: 'hsl(var(--muted-foreground))',
                    }
              "
              aria-label="列表视图"
              @click="viewMode = 'list'"
            >
              <IconifyIcon icon="lucide:list" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- 搜索栏 -->
      <div
        class="search-bar"
        :style="{
          background: 'hsl(var(--card))',
          borderColor: 'hsl(var(--border))',
        }"
      >
        <div class="search-row">
          <NInput
            v-model:value="keyword"
            placeholder="搜索资源名称"
            clearable
            class="search-input"
            size="small"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <IconifyIcon
                icon="lucide:search"
                class="h-4 w-4"
                :style="{ color: 'hsl(var(--muted-foreground))' }"
              />
            </template>
          </NInput>
          <NButton type="primary" size="small" @click="handleSearch">
            <template #icon>
              <IconifyIcon icon="lucide:search" class="h-4 w-4" />
            </template>
            <span class="hidden sm:inline">搜索</span>
          </NButton>
        </div>
      </div>

      <!-- 统计条 -->
      <div v-if="resources.length > 0" class="stats-bar">
        <span
          class="stats-text"
          :style="{ color: 'hsl(var(--muted-foreground))' }"
        >
          共
          <strong :style="{ color: 'hsl(var(--card-foreground))' }">{{
            total
          }}</strong>
          条资源
        </span>
      </div>

      <NSpin :show="loading">
        <template v-if="resources.length > 0">
          <!-- Grid View -->
          <div v-if="viewMode === 'grid'" class="resource-grid">
            <ResourceCard
              v-for="(item, index) in resources"
              :key="`${item.indexer}-${item.title}-${index}`"
              :item="item"
              :favicons="favicons"
              @download="openDownloadModal"
              @open-url="handleOpenUrl"
            />
          </div>

          <!-- List View -->
          <div v-else class="resource-list">
            <ResourceList
              v-for="(item, index) in resources"
              :key="`${item.indexer}-${item.title}-${index}`"
              :item="item"
              :favicons="favicons"
              @download="openDownloadModal"
              @open-url="handleOpenUrl"
            />
          </div>
        </template>

        <EmptyState
          v-else-if="!loading"
          title="暂无资源"
          subtitle="该站点暂无资源或连接失败"
        >
          <template #icon>
            <IconifyIcon
              icon="lucide:database"
              class="h-12 w-12"
              :style="{ color: 'hsl(var(--muted-foreground))' }"
            />
          </template>
        </EmptyState>

        <div
          v-if="total > pageSize"
          class="pagination-bar"
          :style="{ borderColor: 'hsl(var(--border))' }"
        >
          <NPagination
            v-model:page="currentPage"
            :page-size="pageSize"
            :item-count="total"
            :page-sizes="[20, 50, 100]"
            show-size-picker
            @update:page="handlePageChange"
          />
        </div>
      </NSpin>
    </template>

    <DownloadModal
      v-model:visible="downloadModalVisible"
      v-model:model-setting="selectedDownloadSetting"
      v-model:model-dir="selectedDownloadDir"
      :loading="downloadModalLoading"
      :resource="downloadResource"
      :settings="downloadSettings"
      :dirs="downloadDirs"
      @setting-change="onDownloadSettingChange"
      @confirm="confirmDownload"
    />
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  margin-bottom: 0.875rem;
  border-bottom: 1px solid;
}

.header-title-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.back-button {
  flex-shrink: 0;
}

.page-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
}

.page-subtitle {
  font-size: 0.875rem;
  font-weight: 500;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.view-toggle {
  display: inline-flex;
  gap: 0.125rem;
  padding: 0.25rem;
  border: 1px solid;
  border-radius: var(--radius);
}

.view-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  cursor: pointer;
  border: none;
  border-radius: calc(var(--radius) - 0.125rem);
  transition: all 0.2s ease;
}

.view-toggle-btn:hover:not(.active) {
  background: hsl(var(--muted) / 40%);
}

.search-bar {
  padding: 0.625rem;
  margin-bottom: 0.75rem;
  border: 1px solid;
  border-radius: 0.5rem;
}

.search-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.stats-bar {
  padding: 0 0.125rem;
  margin-bottom: 0.625rem;
}

.stats-text {
  font-size: 0.8125rem;
}

.stats-text strong {
  font-weight: 600;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.625rem;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.pagination-bar {
  display: flex;
  justify-content: center;
  padding-top: 0.875rem;
  margin-top: 1rem;
  border-top: 1px solid;
}

@media (max-width: 640px) {
  .header-row {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
    margin-bottom: 0.625rem;
  }

  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions > *:not(.view-toggle) {
    flex: 1 1 auto;
  }

  .view-toggle {
    margin-left: auto;
  }

  .search-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .resource-grid {
    grid-template-columns: 1fr;
  }
}
</style>
