<script lang="ts" setup>
import { h, onMounted, onUnmounted, ref, watch } from 'vue';

import {
  NButton,
  NDropdown,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NRadio,
  NRadioGroup,
  NSpace,
  NSpin,
  NUpload,
  NTabPane,
  NTabs,
  NSelect,
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
import PageHeader from '#/components/page/PageHeader.vue';
import { useDownloadStore } from '#/store';

const downloadStore = useDownloadStore();
const message = useMessage();
const loading = ref(false);
const refreshTimer = ref<number | null>(null);
const deleteConfirmShow = ref(false);
const deleteTargetId = ref('');
const deleteWithFiles = ref(false);

const torrents = ref<any[]>([]);
const addModalShow = ref(false);
const addType = ref<'url' | 'torrent'>('url');
const torrentUrls = ref('');
const fileList = ref<UploadFileInfo[]>([]);
const downloadDirs = ref<string[]>([]);
const downloadSettings = ref<any[]>([]);
const selectedDir = ref('');
const selectedSetting = ref('');
const addLoading = ref(false);

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
    <PageHeader title="正在下载">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="openAddModal">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            新增下载
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading && torrents.length === 0">
      <div v-if="torrents.length > 0" class="torrent-grid">
        <div
          v-for="torrent in torrents"
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
                <h3 class="torrent-title truncate">
                  {{ torrent.title || torrent.name }}
                </h3>
                <div class="torrent-speed">
                  {{ torrent.speed }}
                </div>
                <div v-if="!torrent.noprogress" class="mt-2">
                  <div class="flex items-center gap-2">
                    <div class="progress-text">{{ torrent.progress }}%</div>
                    <div class="progress-track">
                      <div
                        class="progress-fill"
                        :style="{ width: `${torrent.progress}%` }"
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

      <EmptyState
        v-else-if="!loading"
        title="没有下载任务"
        subtitle="当前下载器中没有正在下载的任务"
      >
        <template #icon>
          <IconifyIcon
            icon="lucide:download-cloud"
            class="size-16"
            style="color: hsl(var(--muted-foreground))"
          />
        </template>
        <template #action>
          <NButton type="primary" @click="openAddModal">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            新增下载
          </NButton>
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
.torrent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 0.75rem;
}

.torrent-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  transition: box-shadow 0.2s;
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

.torrent-speed {
  font-size: 0.875rem;
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
  background-color: hsl(var(--primary));
  transition: width 0.5s ease;
  border-radius: 9999px;
}

@media (max-width: 640px) {
  .torrent-grid {
    grid-template-columns: 1fr;
  }

  .torrent-poster,
  .torrent-poster-placeholder {
    width: 60px;
    height: 60px;
  }
}
</style>
