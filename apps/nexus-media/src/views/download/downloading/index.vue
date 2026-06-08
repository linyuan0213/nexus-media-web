<script lang="ts" setup>
import { h, onMounted, onUnmounted, ref, watch, computed } from 'vue';

import {
  NButton,
  NDropdown,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSpin,
  NUpload,
  NTabPane,
  NTabs,
  NSelect,
  NTooltip,
  useMessage,
  type UploadFileInfo,
} from 'naive-ui';

import { IconifyIcon } from '@vben/icons';

import {
  addTorrentApi,
  deleteTaskApi,
  getDownloadDirsApi,
  getDownloadSettingsApi,
  getDownloadTasksApi,
  pauseTaskApi,
  resumeTaskApi,
} from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import { useDownloadStore } from '#/store';

const downloadStore = useDownloadStore();
const message = useMessage();
const loading = ref(false);
const refreshTimer = ref<number | null>(null);
const deleteConfirmShow = ref(false);
const deleteTargetId = ref('');
const deleteWithFiles = ref(false);

const torrents = ref<any[]>([]);
const selectedDownloader = ref('');
const viewMode = ref<'grid' | 'list'>('grid');
const addModalShow = ref(false);
const addType = ref<'url' | 'torrent'>('url');
const torrentUrls = ref('');
const fileList = ref<UploadFileInfo[]>([]);
const downloadDirs = ref<string[]>([]);
const downloadSettings = ref<any[]>([]);
const selectedDir = ref('');
const selectedSetting = ref('');
const addLoading = ref(false);

// 下载器颜色映射（基于 client_id）
const DOWNLOADER_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
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
  return DOWNLOADER_STYLES[clientId] || {
    bg: 'hsl(var(--muted))',
    text: 'hsl(var(--muted-foreground))',
    dot: 'hsl(var(--muted-foreground))',
  };
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
  const stats: Array<{ id: string; name: string; count: number; clientId: string }> = [];
  const allCount = torrents.value.length;
  if (allCount === 0) return stats;

  stats.push({ id: '', name: '全部', count: allCount, clientId: '' });

  const map = new Map<string, { name: string; clientId: string }>();
  const countMap = new Map<string, number>();
  torrents.value.forEach((t) => {
    const did = t.downloader_id || '';
    if (did) {
      if (!map.has(did)) {
        map.set(did, { name: t.downloader_name || did, clientId: t.client_id || '' });
      }
      countMap.set(did, (countMap.get(did) || 0) + 1);
    }
  });

  Array.from(map.entries()).forEach(([id, info]) => {
    stats.push({ id, name: info.name, count: countMap.get(id) || 0, clientId: info.clientId });
  });

  return stats;
});

async function fetchTasks() {
  loading.value = true;
  try {
    const res = (await getDownloadTasksApi()) as any;
    const list = Array.isArray(res) ? res : res?.data || [];
    torrents.value = list;
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
  await fetchTasks();
}

async function handleResume(id: string) {
  await resumeTaskApi(id);
  await fetchTasks();
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
  await fetchTasks();
}

function startAutoRefresh() {
  refreshTimer.value = window.setInterval(() => {
    fetchTasks();
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
  } catch (e) {
    console.error('Failed to load download dirs:', e);
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
  } catch (e) {
    console.error('Failed to load add modal data:', e);
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
    await fetchTasks();
  } catch (e: any) {
    message.error(e?.message || '添加下载失败');
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
      icon: () =>
        h(IconifyIcon, { icon: 'lucide:play', class: 'size-4' }),
    });
  } else {
    options.push({
      label: '暂停',
      key: 'pause',
      icon: () =>
        h(IconifyIcon, { icon: 'lucide:pause', class: 'size-4' }),
    });
  }
  options.push({
    label: '删除',
    key: 'delete',
    icon: () =>
      h(IconifyIcon, { icon: 'lucide:trash-2', class: 'size-4' }),
    props: { style: 'color: hsl(var(--destructive))' },
  });
  return options;
}

function handleDropdownSelect(key: string, torrent: any) {
  if (key === 'start') handleResume(torrent.id);
  else if (key === 'pause') handlePause(torrent.id);
  else if (key === 'delete') confirmDelete(torrent.id);
}

onMounted(() => {
  fetchTasks();
  startAutoRefresh();
});

onUnmounted(stopAutoRefresh);
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
          />
          <span>{{ stat.name }}</span>
          <span class="tab-count">{{ stat.count }}</span>
        </button>
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

    <NSpin :show="loading && torrents.length === 0">
      <template v-if="filteredTorrents.length > 0">
        <!-- Grid View -->
        <div
          v-if="viewMode === 'grid'"
          class="torrent-grid"
        >
        <div
          v-for="torrent in filteredTorrents"
          :key="torrent.id"
          class="torrent-card"
        >
          <div class="torrent-card-inner">
            <div class="flex items-center gap-3">
              <img
                v-if="torrent.image"
                :src="`/img?url=${torrent.image}`"
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
                <div class="flex items-center gap-2 mt-1">
                  <span
                    v-if="torrent.downloader_name"
                    class="downloader-tag"
                    :style="{
                      backgroundColor: getDownloaderStyle(torrent.client_id).bg,
                      color: getDownloaderStyle(torrent.client_id).text,
                    }"
                  >
                    <span
                      class="downloader-dot"
                      :style="{ backgroundColor: getDownloaderStyle(torrent.client_id).dot }"
                    />
                    {{ torrent.downloader_name }}
                  </span>
                  <span v-if="torrent.save_path" class="save-path truncate">
                    {{ torrent.save_path }}
                  </span>
                </div>
                <div class="torrent-speed">
                  {{ torrent.speed }}
                </div>
                <div v-if="!torrent.noprogress" class="mt-2">
                  <div class="flex items-center gap-2">
                    <div class="progress-text">{{ torrent.progress }}%</div>
                    <div class="progress-track">
                      <div
                        class="progress-fill"
                        :style="{
                          width: `${torrent.progress}%`,
                          backgroundColor: getDownloaderStyle(torrent.client_id).dot,
                        }"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex-shrink-0">
                <NDropdown
                  v-if="!torrent.nomenu"
                  :options="getDropdownOptions(torrent)"
                  @select="(key) => handleDropdownSelect(key as string, torrent)"
                >
                  <NButton text>
                    <IconifyIcon
                      icon="lucide:more-vertical"
                      class="size-5"
                    />
                  </NButton>
                </NDropdown>
              </div>
            </div>
          </div>
        </div>
      </div>

        <!-- List View -->
        <div
          v-else
          class="torrent-list"
        >
        <div
          v-for="torrent in filteredTorrents"
          :key="torrent.id"
          class="torrent-list-item"
        >
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
              <span
                v-if="torrent.downloader_name"
                class="downloader-tag"
                :style="{
                  backgroundColor: getDownloaderStyle(torrent.client_id).bg,
                  color: getDownloaderStyle(torrent.client_id).text,
                }"
              >
                <span
                  class="downloader-dot"
                  :style="{ backgroundColor: getDownloaderStyle(torrent.client_id).dot }"
                />
                {{ torrent.downloader_name }}
              </span>
              <span v-if="torrent.save_path" class="save-path truncate">
                {{ torrent.save_path }}
              </span>
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
                    backgroundColor: getDownloaderStyle(torrent.client_id).dot,
                  }"
                />
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
                <IconifyIcon
                  icon="lucide:more-vertical"
                  class="size-5"
                />
              </NButton>
            </NDropdown>
          </div>
        </div>
      </div>
      </template>

      <EmptyState
        v-else-if="!loading"
        title="没有下载任务"
        :subtitle="selectedDownloader ? '当前筛选的下载器中没有正在下载的任务' : '所有下载器中均没有正在下载的任务'"
      >
        <template #icon>
          <IconifyIcon
            icon="lucide:download-cloud"
            class="size-16"
            style="color: hsl(var(--muted-foreground))"
          />
        </template>
      </EmptyState>
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

    <!-- 新增下载弹窗 -->
    <NModal
      v-model:show="addModalShow"
      title="新增下载"
      preset="card"
      class="w-[560px]"
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
              <NUpload
                v-model:file-list="fileList"
                :max="5"
                accept=".torrent"
              >
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
  font-size: 1.25rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  line-height: 1.4;
  margin: 0;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.view-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.type-tab-group {
  display: inline-flex;
  background-color: hsl(var(--muted) / 0.4);
  border-radius: 0.625rem;
  padding: 0.25rem;
  gap: 0.125rem;
}

.type-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  background-color: transparent;
  color: hsl(var(--muted-foreground));
  border: none;
  cursor: pointer;
}

.type-tab-btn:hover {
  color: hsl(var(--foreground));
}

.type-tab-active {
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.type-tab-active .tab-count {
  background-color: hsl(var(--muted-foreground) / 0.15);
  color: hsl(var(--muted-foreground));
}

/* ===== Grid View ===== */
.torrent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 0.75rem;
}

.torrent-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  transition: box-shadow 0.2s;
  overflow: hidden;
  min-width: 0;
}

.torrent-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.torrent-card-inner {
  padding: 1rem;
}

.torrent-poster {
  width: 80px;
  height: 80px;
  object-fit: cover;
  flex-shrink: 0;
  background-color: hsl(var(--muted));
}

.torrent-poster-placeholder {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  background-color: hsl(var(--muted));
}

.torrent-title {
  font-size: 1rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
  margin-bottom: 0.25rem;
}

/* ===== List View ===== */
.torrent-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.torrent-list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  transition: box-shadow 0.2s;
}

.torrent-list-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.torrent-list-poster {
  width: 40px;
  height: 40px;
  object-fit: cover;
  flex-shrink: 0;
  background-color: hsl(var(--muted));
}

.torrent-list-poster-placeholder {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background-color: hsl(var(--muted));
}

.torrent-list-info {
  min-width: 0;
  flex: 1;
}

.torrent-list-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
  margin-bottom: 0.25rem;
}

.torrent-list-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.torrent-list-progress {
  width: 180px;
  flex-shrink: 0;
}

.torrent-list-speed {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.25rem;
  text-align: right;
}

.torrent-list-actions {
  flex-shrink: 0;
}

/* ===== Common ===== */
.torrent-speed {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.25rem;
}

.downloader-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.downloader-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.save-path {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.progress-text {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  width: 2.5rem;
  flex-shrink: 0;
  text-align: right;
}

.progress-track {
  flex: 1;
  height: 0.5rem;
  background-color: hsl(var(--muted));
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  min-width: 4px;
  transition: width 0.5s ease;
  border-radius: 9999px;
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  .header-row {
    margin-bottom: 0.5rem;
  }

  .toolbar-row {
    width: 100%;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .torrent-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .torrent-card-inner {
    padding: 0.625rem;
  }

  .torrent-poster,
  .torrent-poster-placeholder {
    width: 48px;
    height: 48px;
  }

  .torrent-title {
    font-size: 0.8125rem;
    margin-bottom: 0.125rem;
  }

  .downloader-tag {
    font-size: 0.6875rem;
    padding: 0.1rem 0.375rem;
  }

  .save-path {
    font-size: 0.6875rem;
  }

  .torrent-speed {
    font-size: 0.75rem;
    margin-top: 0.125rem;
  }

  .progress-text {
    font-size: 0.75rem;
    width: 2rem;
  }

  .torrent-list-item {
    padding: 0.625rem;
    gap: 0.5rem;
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
    padding: 0.2rem;
    overflow-x: auto;
    max-width: 100%;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .type-tab-group::-webkit-scrollbar {
    display: none;
  }

  .type-tab-btn {
    padding: 0.3rem 0.75rem;
    font-size: 0.8125rem;
    white-space: nowrap;
  }
}
</style>
