<script lang="ts" setup>
import type { UploadFileInfo } from 'naive-ui';

import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NDropdown,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NTooltip,
  NUpload,
  useMessage,
} from 'naive-ui';

import {
  addTorrentApi,
  batchDeleteTasksApi,
  batchPauseTasksApi,
  batchResumeTasksApi,
  deleteTaskApi,
  getDownloadDirsApi,
  getDownloadSettingsApi,
  getDownloadTasksApi,
  pauseTaskApi,
  resumeTaskApi,
} from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import { useDownloadEventStream } from '#/composables/useDownloadEventStream';
import { useDownloadStore } from '#/store';

const downloadStore = useDownloadStore();
const message = useMessage();
const loading = ref(false);
const refreshTimer = ref<null | number>(null);
const deleteConfirmShow = ref(false);
const deleteTargetId = ref('');
const deleteWithFiles = ref(false);

const torrents = ref<any[]>([]);
const totalCount = ref(0);
const currentPage = ref(1);
const pageSize = ref(50);
const selectedDownloader = ref('');
const viewMode = ref<'grid' | 'list'>('grid');
const addModalShow = ref(false);
const addType = ref<'torrent' | 'url'>('url');
const torrentUrls = ref('');
const fileList = ref<UploadFileInfo[]>([]);
const downloadDirs = ref<string[]>([]);
const downloadSettings = ref<any[]>([]);
const selectedDir = ref('');
const selectedSetting = ref('');
const addLoading = ref(false);
const { start: startSSE, stop: stopSSE } = useDownloadEventStream(() =>
  fetchTasks(currentPage.value),
);

// 下载器颜色映射（基于 client_id）
const DOWNLOADER_STYLES: Record<
  string,
  { bg: string; dot: string; text: string }
> = {
  qbittorrent: {
    bg: 'rgba(59, 130, 246, 0.12)',
    text: 'rgb(59, 130, 246)',
    dot: 'rgb(59, 130, 246)',
  },
  transmission: {
    bg: 'rgba(245, 158, 11, 0.12)',
    text: 'rgb(245, 158, 11)',
    dot: 'rgb(245, 158, 11)',
  },
  thunder: {
    bg: 'rgba(239, 68, 68, 0.12)',
    text: 'rgb(239, 68, 68)',
    dot: 'rgb(239, 68, 68)',
  },
  aria2: {
    bg: 'rgba(16, 185, 129, 0.12)',
    text: 'rgb(16, 185, 129)',
    dot: 'rgb(16, 185, 129)',
  },
};

function getDownloaderStyle(clientId: string) {
  return (
    DOWNLOADER_STYLES[clientId] || {
      bg: 'hsl(var(--muted))',
      text: 'hsl(var(--muted-foreground))',
      dot: 'hsl(var(--muted-foreground))',
    }
  );
}

function proxyImage(url: string): string {
  if (!url) return '';
  const m = url.match(/\/t\/p\/(\w+)(\/.+)/);
  return m?.[1] && m?.[2]
    ? `/img/tmdb/${m[1]}/${m[2].slice(1)}`
    : `/img?url=${encodeURIComponent(url)}`;
}

function downloaderMetaStyle(torrent: any) {
  const s = getDownloaderStyle(torrent.client_id);
  return { backgroundColor: s.bg, color: s.text };
}

function tagBadgeStyle(tag: string) {
  const c = getTagColor(tag);
  return { backgroundColor: c + '20', color: c, borderColor: c + '40' };
}

function stateLabel(torrent: any): string {
  if (torrent.state === 'Stopped' || torrent.state === 'pausedDL')
    return '已暂停';
  if (torrent.state === 'Downloading') return '下载中';
  if (torrent.state === 'Seeding') return '做种中';
  return torrent.state || '';
}

function stateClass(torrent: any): string {
  if (torrent.state === 'Stopped' || torrent.state === 'pausedDL')
    return 'state-paused';
  if (torrent.state === 'Downloading') return 'state-downloading';
  if (torrent.state === 'Seeding') return 'state-seeding';
  return '';
}

const selectedIds = ref<Set<string>>(new Set());
const allSelected = computed(() => {
  const items = filteredTorrents.value;
  return items.length > 0 && items.every((t) => selectedIds.value.has(t.id));
});
const isIndeterminate = computed(() => {
  const items = filteredTorrents.value;
  const count = items.filter((t) => selectedIds.value.has(t.id)).length;
  return count > 0 && count < items.length;
});

function toggleSelectAll() {
  selectedIds.value = allSelected.value
    ? new Set()
    : new Set(filteredTorrents.value.map((t: any) => t.id));
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function clearSelection() {
  selectedIds.value = new Set();
}

const batchDeleteConfirmShow = ref(false);
const batchDeleteWithFiles = ref(false);
const batchLoading = ref(false);
async function handleBatchPause() {
  batchLoading.value = true;
  try {
    await batchPauseTasksApi([...selectedIds.value]);
    clearSelection();
    await fetchTasks(currentPage.value);
  } finally {
    batchLoading.value = false;
  }
}
async function handleBatchResume() {
  batchLoading.value = true;
  try {
    await batchResumeTasksApi([...selectedIds.value]);
    clearSelection();
    await fetchTasks(currentPage.value);
  } finally {
    batchLoading.value = false;
  }
}
async function handleBatchDelete() {
  batchDeleteWithFiles.value = false;
  batchDeleteConfirmShow.value = true;
}

async function handleConfirmBatchDelete() {
  batchDeleteConfirmShow.value = false;
  batchLoading.value = true;
  try {
    await batchDeleteTasksApi(
      [...selectedIds.value],
      batchDeleteWithFiles.value,
    );
    clearSelection();
    await fetchTasks(currentPage.value);
  } finally {
    batchLoading.value = false;
  }
}

const TAG_COLORS: string[] = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
  '#84cc16',
  '#f97316',
];

const tagColorMap = ref<Record<string, string>>({});
function getTagColor(tag: string): string {
  if (!tagColorMap.value[tag]) {
    const existing = Object.keys(tagColorMap.value).length;
    tagColorMap.value = {
      ...tagColorMap.value,
      [tag]: TAG_COLORS[existing % TAG_COLORS.length] ?? 'hsl(var(--primary))',
    };
  }
  return tagColorMap.value[tag] ?? TAG_COLORS[0] ?? 'hsl(var(--primary))';
}

// 按下载器筛选后的列表
const filteredTorrents = computed(() => {
  if (!selectedDownloader.value) return torrents.value;
  return torrents.value.filter(
    (t) => t.downloader_id === selectedDownloader.value,
  );
});

// 下载器分组统计
const downloaderStats = computed(() => {
  const stats: Array<{
    clientId: string;
    count: number;
    id: string;
    name: string;
  }> = [];
  const allCount =
    totalCount.value > 0 ? totalCount.value : torrents.value.length;
  if (allCount === 0) return stats;

  stats.push({ id: '', name: '全部', count: allCount, clientId: '' });

  const map = new Map<string, { clientId: string; name: string }>();
  const countMap = new Map<string, number>();
  torrents.value.forEach((t) => {
    const did = t.downloader_id || '';
    if (did) {
      if (!map.has(did)) {
        map.set(did, {
          name: t.downloader_name || did,
          clientId: t.client_id || '',
        });
      }
      countMap.set(did, (countMap.get(did) || 0) + 1);
    }
  });

  [...map.entries()].forEach(([id, info]) => {
    stats.push({
      id,
      name: info.name,
      count: countMap.get(id) || 0,
      clientId: info.clientId,
    });
  });

  return stats;
});

async function fetchTasks(page?: number) {
  loading.value = true;
  try {
    const p = page || currentPage.value;
    const res = (await getDownloadTasksApi(p, pageSize.value)) as any;
    const data = res?.data || res || {};
    const list = Array.isArray(data) ? data : data.items || [];
    torrents.value = list;
    if (data.total !== undefined) totalCount.value = data.total;
    currentPage.value = p;
    downloadStore.setTasks(
      list.map((t: any) => ({
        ...t,
        name: t.title || t.name,
        status: t.state || t.status,
      })),
    );
  } finally {
    loading.value = false;
  }
}

async function handlePause(id: string) {
  await pauseTaskApi(id);
  await fetchTasks(currentPage.value);
}

async function handleResume(id: string) {
  await resumeTaskApi(id);
  await fetchTasks(currentPage.value);
}

function confirmDelete(id: string) {
  deleteTargetId.value = id;
  deleteWithFiles.value = false;
  deleteConfirmShow.value = true;
}

async function handleConfirmDelete() {
  if (!deleteTargetId.value) return;
  await deleteTaskApi(deleteTargetId.value, deleteWithFiles.value);
  deleteConfirmShow.value = false;
  deleteTargetId.value = '';
  await fetchTasks(currentPage.value);
}

function startAutoRefresh() {
  refreshTimer.value = window.setInterval(() => {
    fetchTasks(currentPage.value);
  }, 5000);
}

function stopAutoRefresh() {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
}

async function loadDownloadDirs(sid?: string) {
  try {
    const dirsRes = await getDownloadDirsApi(sid || undefined);
    downloadDirs.value = (dirsRes as any)?.data || dirsRes || [];
  } catch (error) {
    console.error('Failed to load download dirs:', error);
  }
}

async function openAddModal() {
  addModalShow.value = true;
  addType.value = 'url';
  torrentUrls.value = '';
  fileList.value = [];
  selectedDir.value = '';
  selectedSetting.value = '';
  try {
    const [dirsRes, settingsRes] = await Promise.all([
      getDownloadDirsApi(),
      getDownloadSettingsApi(),
    ]);
    downloadDirs.value = (dirsRes as any)?.data || dirsRes || [];
    const settingsData = (settingsRes as any)?.data || settingsRes || [];
    downloadSettings.value = Array.isArray(settingsData)
      ? settingsData
      : Object.values(settingsData);
  } catch (error) {
    console.error('Failed to load add modal data:', error);
  }
}

watch(selectedSetting, async (sid) => {
  selectedDir.value = '';
  await loadDownloadDirs(sid || undefined);
});

async function handleAddDownload() {
  if (addType.value === 'url' && !torrentUrls.value.trim()) {
    message.warning('请输入种子链接');
    return;
  }
  if (addType.value === 'torrent' && fileList.value.length === 0) {
    message.warning('请上传种子文件');
    return;
  }

  addLoading.value = true;
  try {
    const urls =
      addType.value === 'url'
        ? torrentUrls.value
            .split('\n')
            .map((u) => u.trim())
            .filter(Boolean)
        : [];
    const files =
      addType.value === 'torrent'
        ? fileList.value.map((f) => f.file?.name).filter(Boolean)
        : [];

    await addTorrentApi({
      urls,
      files: files as string[],
      dl_dir: selectedDir.value || undefined,
      dl_setting: selectedSetting.value || undefined,
    });
    message.success('添加下载成功');
    addModalShow.value = false;
    await fetchTasks(1);
  } catch (error: any) {
    message.error(error?.message || '添加下载失败');
  } finally {
    addLoading.value = false;
  }
}

function getDropdownOptions(torrent: any) {
  const options: any[] = [];
  if (torrent.state === 'Stopped') {
    options.push({
      label: '开始',
      key: 'start',
      icon: () => h(IconifyIcon, { icon: 'lucide:play', class: 'size-4' }),
    });
  } else {
    options.push({
      label: '暂停',
      key: 'pause',
      icon: () => h(IconifyIcon, { icon: 'lucide:pause', class: 'size-4' }),
    });
  }
  options.push({
    label: '删除',
    key: 'delete',
    icon: () => h(IconifyIcon, { icon: 'lucide:trash-2', class: 'size-4' }),
    props: { style: 'color: hsl(var(--destructive))' },
  });
  return options;
}

function handleDropdownSelect(key: string, torrent: any) {
  switch (key) {
    case 'delete': {
      {
        confirmDelete(torrent.id);
        // No default
      }
      break;
    }
    case 'pause': {
      handlePause(torrent.id);
      break;
    }
    case 'start': {
      handleResume(torrent.id);
      break;
    }
  }
}

function stopDownloadEventStream() {
  stopSSE();
}

function startDownloadEventStream() {
  startSSE();
}

onMounted(() => {
  fetchTasks(1);
  startAutoRefresh();
  startDownloadEventStream();
});

onUnmounted(() => {
  stopAutoRefresh();
  stopDownloadEventStream();
});
</script>

<template>
  <div class="p-4">
    <div class="header-row">
      <h1 class="page-title">正在下载</h1>
      <NButton type="primary" @click="openAddModal">
        <template #icon>
          <IconifyIcon icon="lucide:plus" class="size-4" />
        </template>
        新增下载
      </NButton>
    </div>

    <div class="toolbar-row">
      <div v-if="downloaderStats.length > 1" class="type-tab-group">
        <button
          v-for="stat in downloaderStats"
          :key="stat.id"
          class="type-tab-btn"
          :class="{ 'type-tab-active': selectedDownloader === stat.id }"
          @click="selectedDownloader = stat.id"
        >
          <span
            v-if="stat.clientId"
            class="tab-dot"
            :style="{ backgroundColor: getDownloaderStyle(stat.clientId).dot }"
          ></span>
          <span>{{ stat.name }}</span>
          <span class="tab-count">{{ stat.count }}</span>
        </button>
      </div>
      <div class="flex items-center gap-2">
        <div
          v-if="selectedIds.size > 0"
          class="batch-bar flex items-center gap-2"
        >
          <span class="batch-count">已选 {{ selectedIds.size }}</span>
          <NButton
            size="small"
            @click="handleBatchResume"
            :loading="batchLoading"
          >
            <template #icon>
              <IconifyIcon icon="lucide:play" class="size-3.5" />
            </template>
            开始
          </NButton>
          <NButton
            size="small"
            @click="handleBatchPause"
            :loading="batchLoading"
          >
            <template #icon>
              <IconifyIcon icon="lucide:pause" class="size-3.5" />
            </template>
            暂停
          </NButton>
          <NButton
            size="small"
            type="error"
            @click="handleBatchDelete"
            :loading="batchLoading"
          >
            <template #icon>
              <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
            </template>
            删除
          </NButton>
        </div>
        <div class="view-actions">
          <NButton
            text
            :type="viewMode === 'grid' ? 'primary' : 'default'"
            @click="viewMode = 'grid'"
          >
            <template #icon>
              <IconifyIcon icon="lucide:layout-grid" class="size-4" />
            </template>
          </NButton>
          <NButton
            text
            :type="viewMode === 'list' ? 'primary' : 'default'"
            @click="viewMode = 'list'"
          >
            <template #icon>
              <IconifyIcon icon="lucide:list" class="size-4" />
            </template>
          </NButton>
        </div>
      </div>
    </div>

    <NSpin :show="loading && torrents.length === 0">
      <template v-if="filteredTorrents.length > 0">
        <div class="select-all-row">
          <label class="flex items-center gap-2 text-sm select-all-label">
            <input
              type="checkbox"
              :checked="allSelected"
              :indeterminate.prop="isIndeterminate"
              @change="toggleSelectAll"
            />
            全选
          </label>
        </div>
        <!-- Grid View -->
        <div v-if="viewMode === 'grid'" class="torrent-grid">
          <div
            v-for="torrent in filteredTorrents"
            :key="torrent.id"
            class="torrent-card"
            :class="{ 'torrent-card-selected': selectedIds.has(torrent.id) }"
          >
            <div class="torrent-card-inner">
              <div class="card-top-row">
                <input
                  type="checkbox"
                  :checked="selectedIds.has(torrent.id)"
                  class="torrent-checkbox"
                  @click.stop
                  @change="toggleSelect(torrent.id)"
                />
                <img
                  v-if="torrent.image"
                  :src="proxyImage(torrent.image)"
                  class="torrent-poster rounded"
                  alt=""
                />
                <div
                  v-else
                  class="torrent-poster-placeholder flex items-center justify-center rounded"
                >
                  <IconifyIcon
                    icon="lucide:film"
                    class="size-8"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <NTooltip :show-arrow="false">
                    <template #trigger>
                      <h3 class="torrent-title truncate">
                        {{ torrent.title || torrent.name }}
                      </h3>
                    </template>
                    {{ torrent.title || torrent.name }}
                  </NTooltip>
                  <div class="card-meta-row">
                    <span
                      v-if="torrent.downloader_name"
                      class="downloader-tag"
                      :style="downloaderMetaStyle(torrent)"
                    >
                      <span
                        class="downloader-dot"
                        :style="{
                          backgroundColor: getDownloaderStyle(torrent.client_id)
                            .dot,
                        }"
                      ></span>
                      {{ torrent.downloader_name }}
                    </span>
                    <span v-if="torrent.category" class="category-badge">
                      <IconifyIcon icon="lucide:folder" class="size-3" />{{
                        torrent.category
                      }}
                    </span>
                    <span
                      v-if="!torrent.noprogress"
                      class="state-badge"
                      :class="stateClass(torrent)"
                    >
                      {{ stateLabel(torrent) }}
                    </span>
                  </div>
                  <div v-if="torrent.labels?.length" class="card-tags-row">
                    <span
                      v-for="tag in torrent.labels"
                      :key="tag"
                      class="tag-badge"
                      :style="tagBadgeStyle(tag)"
                    >
                      {{ tag }}
                    </span>
                  </div>
                  <div v-if="torrent.save_path" class="save-path truncate">
                    {{ torrent.save_path }}
                  </div>
                </div>
                <div class="card-right">
                  <NDropdown
                    v-if="!torrent.nomenu"
                    :options="getDropdownOptions(torrent)"
                    @select="
                      (key) => handleDropdownSelect(key as string, torrent)
                    "
                  >
                    <NButton text>
                      <IconifyIcon icon="lucide:more-vertical" class="size-5" />
                    </NButton>
                  </NDropdown>
                </div>
              </div>
              <div class="card-bottom-row">
                <div v-if="!torrent.noprogress" class="progress-bar-wrap">
                  <div class="progress-text">{{ torrent.progress }}%</div>
                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      :style="{
                        width: `${torrent.progress}%`,
                        backgroundColor: getDownloaderStyle(torrent.client_id)
                          .dot,
                      }"
                    ></div>
                  </div>
                </div>
                <div class="torrent-speed">{{ torrent.speed }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- List View -->
        <div v-else class="torrent-list">
          <div
            v-for="torrent in filteredTorrents"
            :key="torrent.id"
            class="torrent-list-item"
            :class="{ 'torrent-list-selected': selectedIds.has(torrent.id) }"
          >
            <input
              type="checkbox"
              :checked="selectedIds.has(torrent.id)"
              class="torrent-checkbox"
              @click.stop
              @change="toggleSelect(torrent.id)"
            />
            <img
              v-if="torrent.image"
              :src="`/img?url=${torrent.image}`"
              class="torrent-list-poster rounded"
              alt=""
            />
            <div
              v-else
              class="torrent-list-poster-placeholder flex items-center justify-center rounded"
            >
              <IconifyIcon
                icon="lucide:film"
                class="size-5"
                style="color: hsl(var(--muted-foreground))"
              />
            </div>

            <div class="torrent-list-info">
              <NTooltip :show-arrow="false">
                <template #trigger>
                  <h3 class="torrent-list-title truncate">
                    {{ torrent.title || torrent.name }}
                  </h3>
                </template>
                {{ torrent.title || torrent.name }}
              </NTooltip>

              <div class="torrent-list-meta">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    v-if="torrent.downloader_name"
                    class="downloader-tag"
                    :style="downloaderMetaStyle(torrent)"
                  >
                    <span
                      class="downloader-dot"
                      :style="{
                        backgroundColor: getDownloaderStyle(torrent.client_id)
                          .dot,
                      }"
                    ></span>
                    {{ torrent.downloader_name }}
                  </span>
                  <span v-if="torrent.category" class="category-badge">
                    <IconifyIcon icon="lucide:folder" class="size-3" />{{
                      torrent.category
                    }}
                  </span>
                  <span
                    v-if="!torrent.noprogress"
                    class="state-badge"
                    :class="stateClass(torrent)"
                  >
                    {{ stateLabel(torrent) }}
                  </span>
                </div>
                <div
                  v-if="torrent.labels?.length"
                  class="flex items-center gap-1 flex-wrap mt-0.5"
                >
                  <span
                    v-for="tag in torrent.labels"
                    :key="tag"
                    class="tag-badge"
                    :style="tagBadgeStyle(tag)"
                    >{{ tag }}</span
                  >
                </div>
                <span v-if="torrent.save_path" class="save-path truncate">{{
                  torrent.save_path
                }}</span>
              </div>
            </div>

            <div class="torrent-list-progress">
              <div class="flex items-center gap-2">
                <div class="progress-text">{{ torrent.progress }}%</div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    :style="{
                      width: `${torrent.progress}%`,
                      backgroundColor: getDownloaderStyle(torrent.client_id)
                        .dot,
                    }"
                  ></div>
                </div>
              </div>
              <div class="torrent-list-speed">{{ torrent.speed }}</div>
            </div>

            <div class="torrent-list-actions">
              <NDropdown
                v-if="!torrent.nomenu"
                :options="getDropdownOptions(torrent)"
                @select="(key) => handleDropdownSelect(key as string, torrent)"
              >
                <NButton text>
                  <IconifyIcon icon="lucide:more-vertical" class="size-5" />
                </NButton>
              </NDropdown>
            </div>
          </div>
        </div>

        <div v-if="totalCount > pageSize" class="pagination-row">
          <NButton
            text
            :disabled="currentPage <= 1"
            @click="
              currentPage--;
              fetchTasks(currentPage);
            "
          >
            <template #icon>
              <IconifyIcon icon="lucide:chevron-left" class="size-4" />
            </template>
          </NButton>
          <span class="pagination-text">
            {{ currentPage }} / {{ Math.ceil(totalCount / pageSize) }}
            <span class="pagination-total">（共 {{ totalCount }} 个）</span>
          </span>
          <NButton
            text
            :disabled="currentPage >= Math.ceil(totalCount / pageSize)"
            @click="
              currentPage++;
              fetchTasks(currentPage);
            "
          >
            <template #icon>
              <IconifyIcon icon="lucide:chevron-right" class="size-4" />
            </template>
          </NButton>
        </div>
      </template>

      <template v-else>
        <EmptyState
          v-if="!loading"
          title="没有下载任务"
          :subtitle="
            selectedDownloader
              ? '当前筛选的下载器中没有正在下载的任务'
              : '所有下载器中均没有正在下载的任务'
          "
        >
          <template #icon>
            <IconifyIcon
              icon="lucide:download-cloud"
              class="size-16"
              style="color: hsl(var(--muted-foreground))"
            />
          </template>
        </EmptyState>
      </template>
    </NSpin>

    <!-- 删除确认 -->
    <NModal
      v-model:show="deleteConfirmShow"
      title="确认删除"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="handleConfirmDelete"
    >
      <div>确定要删除这个下载任务吗？</div>
      <div class="mt-2">
        <label class="flex items-center gap-2 text-sm">
          <input v-model="deleteWithFiles" type="checkbox" />
          同时删除文件
        </label>
      </div>
    </NModal>

    <!-- 批量删除确认 -->
    <NModal
      v-model:show="batchDeleteConfirmShow"
      title="确认批量删除"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="handleConfirmBatchDelete"
    >
      <div>
        确定要删除已选的 {{ selectedIds.size }} 个下载任务吗？此操作不可撤销。
      </div>
      <div class="mt-2">
        <label class="flex items-center gap-2 text-sm">
          <input v-model="batchDeleteWithFiles" type="checkbox" />
          同时删除文件
        </label>
      </div>
    </NModal>

    <!-- 新增下载弹窗 -->
    <NModal
      v-model:show="addModalShow"
      title="新增下载"
      preset="card"
      :style="{ width: '560px', maxWidth: '92vw' }"
    >
      <NTabs v-model:value="addType as any" type="segment">
        <NTabPane name="url" tab="种子链接">
          <NForm label-placement="top">
            <NFormItem label="种子链接" required>
              <NInput
                v-model:value="torrentUrls"
                type="textarea"
                :rows="4"
                placeholder="支持多个链接，每行一个"
              />
            </NFormItem>
          </NForm>
        </NTabPane>
        <NTabPane name="torrent" tab="种子文件">
          <NForm label-placement="top">
            <NFormItem label="种子文件" required>
              <NUpload v-model:file-list="fileList" :max="5" accept=".torrent">
                <NButton>
                  <template #icon>
                    <IconifyIcon icon="lucide:upload" class="size-4" />
                  </template>
                  选择文件
                </NButton>
              </NUpload>
            </NFormItem>
          </NForm>
        </NTabPane>
      </NTabs>

      <NForm label-placement="top" class="mt-4">
        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="下载目录">
            <NSelect
              v-model:value="selectedDir"
              :options="[
                { label: '默认目录', value: '' },
                ...downloadDirs.map((d) => ({ label: d, value: d })),
              ]"
              placeholder="选择下载目录"
              clearable
            />
          </NFormItem>
          <NFormItem label="下载设置">
            <NSelect
              v-model:value="selectedSetting"
              :options="
                downloadSettings.map((s) => ({
                  label: s.name,
                  value: String(s.id),
                }))
              "
              placeholder="留空使用默认设置"
              clearable
            />
          </NFormItem>
        </div>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="addModalShow = false">取消</NButton>
          <NButton
            type="primary"
            :loading="addLoading"
            @click="handleAddDownload"
          >
            开始下载
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.page-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--foreground));
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.view-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.type-tab-group {
  display: inline-flex;
  gap: 0.125rem;
  padding: 0.25rem;
  background-color: hsl(var(--muted) / 40%);
  border-radius: 0.625rem;
}

.type-tab-btn {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  padding: 0.375rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background-color: transparent;
  border: none;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.type-tab-btn:hover {
  color: hsl(var(--foreground));
}

.type-tab-active {
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--card));
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
}

.tab-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted));
  border-radius: 9999px;
}

.type-tab-active .tab-count {
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted-foreground) / 15%);
}

/* ===== Grid View ===== */
.torrent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 0.75rem;
}

.torrent-card {
  min-width: 0;
  overflow: hidden;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  transition: box-shadow 0.2s;
}

.torrent-card:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.torrent-card-inner {
  padding: 0.875rem 1rem;
}

.card-top-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.card-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
  margin-top: 0.375rem;
}

.card-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  margin-top: 0.375rem;
}

.card-right {
  flex-shrink: 0;
  margin-left: auto;
}

.card-bottom-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-top: 0.5rem;
  margin-top: 0.625rem;
  border-top: 1px solid hsl(var(--border) / 50%);
}

.progress-bar-wrap {
  display: flex;
  flex: 1;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.torrent-poster {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  object-fit: cover;
  background-color: hsl(var(--muted));
}

.torrent-poster-placeholder {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  background-color: hsl(var(--muted));
}

.torrent-title {
  margin-bottom: 0.25rem;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

/* ===== List View ===== */
.torrent-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.torrent-list-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  transition: box-shadow 0.2s;
}

.torrent-list-item:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.torrent-list-poster {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  object-fit: cover;
  background-color: hsl(var(--muted));
}

.torrent-list-poster-placeholder {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  background-color: hsl(var(--muted));
}

.torrent-list-info {
  flex: 1;
  min-width: 0;
}

.torrent-list-title {
  margin-bottom: 0.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

.torrent-list-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.torrent-list-progress {
  flex-shrink: 0;
  width: 180px;
}

.torrent-list-speed {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  text-align: right;
}

.torrent-list-actions {
  flex-shrink: 0;
}

/* ===== Common ===== */
.torrent-speed {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.downloader-tag {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.375rem;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
}

.downloader-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.save-path {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.progress-text {
  flex-shrink: 0;
  width: 2.5rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  text-align: right;
}

.progress-track {
  flex: 1;
  height: 0.5rem;
  overflow: hidden;
  background-color: hsl(var(--muted));
  border-radius: 9999px;
}

.progress-fill {
  min-width: 4px;
  height: 100%;
  border-radius: 9999px;
  transition: width 0.5s ease;
}

/* ===== Batch actions ===== */
.batch-bar {
  padding: 0.25rem 0.5rem;
  background-color: hsl(var(--muted) / 40%);
  border-radius: 0.5rem;
}

.batch-count {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.select-all-row {
  padding: 0.25rem 0 0.5rem;
}

.select-all-label {
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.torrent-checkbox {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  accent-color: hsl(var(--primary));
  cursor: pointer;
}

.torrent-card-selected {
  border-color: hsl(var(--primary) / 40%);
  box-shadow: 0 0 0 1px hsl(var(--primary) / 20%);
}

.torrent-list-selected {
  border-color: hsl(var(--primary) / 40%);
  box-shadow: 0 0 0 1px hsl(var(--primary) / 20%);
}

/* ===== Tag & Category Badges ===== */
.tag-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.4rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  border: 1px solid;
  border-radius: 0.25rem;
}

.category-badge {
  display: inline-flex;
  gap: 0.2rem;
  align-items: center;
  padding: 0.1rem 0.4rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.3;
  color: hsl(var(--primary-foreground));
  white-space: nowrap;
  background-color: hsl(var(--primary) / 20%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 0.25rem;
}

/* ===== State Badge ===== */
.state-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.4rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  border-radius: 0.25rem;
}

.state-downloading {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 12%);
  border: 1px solid hsl(var(--success) / 30%);
}

.state-paused {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 12%);
  border: 1px solid hsl(var(--warning) / 30%);
}

.state-seeding {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 12%);
  border: 1px solid hsl(var(--primary) / 30%);
}

/* ===== Pagination ===== */
.pagination-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0;
}

.pagination-text {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.pagination-total {
  font-size: 0.8125rem;
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  .header-row {
    margin-bottom: 0.5rem;
  }

  .toolbar-row {
    justify-content: space-between;
    width: 100%;
    margin-bottom: 0.75rem;
  }

  .torrent-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .torrent-card-inner {
    padding: 0.625rem 0.75rem;
  }

  .torrent-poster,
  .torrent-poster-placeholder {
    width: 48px;
    height: 48px;
  }

  .torrent-title {
    margin-bottom: 0.125rem;
    font-size: 0.8125rem;
  }

  .downloader-tag {
    padding: 0.1rem 0.375rem;
    font-size: 0.6875rem;
  }

  .save-path {
    font-size: 0.6875rem;
  }

  .torrent-speed {
    margin-top: 0.125rem;
    font-size: 0.75rem;
  }

  .progress-text {
    width: 2rem;
    font-size: 0.75rem;
  }

  .torrent-list-item {
    gap: 0.5rem;
    padding: 0.625rem;
  }

  .torrent-list-poster,
  .torrent-list-poster-placeholder {
    width: 36px;
    height: 36px;
  }

  .torrent-list-progress {
    width: 80px;
  }

  .torrent-list-title {
    font-size: 0.875rem;
  }

  .torrent-list-speed {
    display: none;
  }

  .type-tab-group {
    max-width: 100%;
    padding: 0.2rem;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .type-tab-group::-webkit-scrollbar {
    display: none;
  }

  .type-tab-btn {
    padding: 0.3rem 0.75rem;
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .card-bottom-row {
    padding-top: 0.375rem;
    margin-top: 0.5rem;
  }

  .card-top-row {
    gap: 0.5rem;
  }
}
</style>
