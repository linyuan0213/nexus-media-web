<script lang="ts" setup>
import { computed, h, onMounted, ref } from 'vue';

import {
  NButton,
  NCard,
  NDropdown,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NSpace,
  NTooltip,
  useNotification,
} from 'naive-ui';

import { IconifyIcon } from '@vben/icons';

import {
  downloadSubtitleApi,
  getDirListApi,
  getLibraryPathsApi,
  nameTestApi,
  scrapMediaPathApi,
  searchFilesApi,
} from '#/api/modules/media';
import {
  deleteFilesApi,
  manualTransferUdfApi,
  renameFileApi,
} from '#/api/modules/sync';
import {
  getStorageBackendsApi,
} from '#/api/modules/storage';
import type { StorageApi } from '#/api/modules/storage';
import { findHardlinksApi } from '#/api/modules/download';
import IdentifyResult from '#/components/media/IdentifyResult.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import TransferModal from '#/components/media/TransferModal.vue';
import type { TransferFormData } from '#/components/media/TransferModal.vue';

const notification = useNotification();

const loading = ref(false);
const currentPath = ref('');
const currentBackendId = ref('local');
const dirList = ref<any[]>([]);
const libraryPaths = ref<Array<{ name: string; path: string; type: string }>>([]);
const syncSourcePaths = ref<Array<{ name: string; path: string; type: string }>>([]);
const backends = ref<StorageApi.StorageBackend[]>([]);
const backendOptions = computed(() => [
  { label: '本地', value: 'local' },
  ...backends.value.map((b) => ({ label: b.name, value: String(b.id) })),
]);
const defaultPath = ref('/');
const searchKeyword = ref('');

const rootBoundaries = computed(() => {
  return [
    ...libraryPaths.value.map((p) => p.path),
    ...syncSourcePaths.value.map((p) => p.path),
  ];
});

const currentRoot = computed(() => {
  if (!currentPath.value) return null;
  const norm = currentPath.value.replace(/\\/g, '/');
  for (const boundary of rootBoundaries.value) {
    if (norm === boundary || norm.startsWith(boundary + '/')) {
      return boundary;
    }
  }
  return null;
});

const breadcrumbs = computed(() => {
  const root = currentRoot.value;
  if (!currentPath.value || currentPath.value === '/') return [];
  const parts = currentPath.value.replace(/\\/g, '/').split('/').filter(Boolean);
  const items: Array<{ name: string; path: string }> = [];
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : '/' + part;
    if (root && (acc === root || acc.length < root.length)) continue;
    items.push({ name: part, path: acc });
  }
  return items;
});

const sortKey = ref<'name' | 'size' | 'mtime' | 'ctime'>('name');
const sortOrder = ref<'asc' | 'desc'>('asc');

const sortedDirList = computed(() => {
  const list = [...dirList.value];
  if (sortKey.value === 'name') {
    list.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return sortOrder.value === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    });
  } else if (sortKey.value === 'size') {
    list.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      const sa = a.size ?? -1;
      const sb = b.size ?? -1;
      if (sa === sb) return a.name.localeCompare(b.name);
      return sortOrder.value === 'asc' ? sa - sb : sb - sa;
    });
  } else if (sortKey.value === 'mtime') {
    list.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      const ma = a.mtime ?? 0;
      const mb = b.mtime ?? 0;
      if (ma === mb) return a.name.localeCompare(b.name);
      return sortOrder.value === 'asc' ? ma - mb : mb - ma;
    });
  } else if (sortKey.value === 'ctime') {
    list.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      const ca = a.ctime ?? 0;
      const cb = b.ctime ?? 0;
      if (ca === cb) return a.name.localeCompare(b.name);
      return sortOrder.value === 'asc' ? ca - cb : cb - ca;
    });
  }
  return list;
});

const filteredDirList = computed(() => {
  if (!searchKeyword.value.trim()) return sortedDirList.value;
  const kw = searchKeyword.value.trim().toLowerCase();
  return sortedDirList.value.filter((item) => item.name.toLowerCase().includes(kw));
});

function toggleSort(key: 'name' | 'size' | 'mtime' | 'ctime') {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

function formatTime(ts?: number) {
  if (ts == null) return '-';
  try {
    return new Date(ts * 1000).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

async function initLibraryPaths() {
  try {
    const [res, backendRes] = await Promise.all([
      getLibraryPathsApi(),
      getStorageBackendsApi(),
    ]);
    backends.value = backendRes.items || [];
    if (res) {
      libraryPaths.value = res.library_paths || [];
      syncSourcePaths.value = res.sync_source_paths || [];
      defaultPath.value = res.default_path || '/';
      // 默认打开媒体库目录
      if (defaultPath.value && defaultPath.value !== '/') {
        await fetchDirList(defaultPath.value);
      } else if (libraryPaths.value.length > 0) {
        await fetchDirList(libraryPaths.value[0].path);
      } else {
        await fetchDirList();
      }
    }
  } catch {
    await fetchDirList();
  }
}

async function fetchDirList(path?: string) {
  loading.value = true;
  try {
    const res = await getDirListApi(path, 'HIDE_FILES_FILTER', currentBackendId.value);
    if (Array.isArray(res)) {
      dirList.value = res.sort((a: any, b: any) => {
        if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
        return a.is_dir ? -1 : 1;
      });
      currentPath.value = path || '';
    }
  } catch (err: any) {
    notification.error({
      content: '加载目录失败',
      description: err?.message || '',
    });
  } finally {
    loading.value = false;
  }
}

function switchBackend(backendId: string) {
  currentBackendId.value = backendId;
  currentPath.value = '';
  fetchDirList();
}

function navigateTo(path: string) {
  fetchDirList(path || undefined);
}

const canGoUp = computed(() => {
  if (!currentPath.value) return false;
  const root = currentRoot.value;
  if (!root) return true; // 不在任何边界内，允许自由跳转
  return currentPath.value.replace(/\\/g, '/') !== root;
});

function goUp() {
  if (!canGoUp.value) return;
  const norm = currentPath.value.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  parts.pop();
  const parent = parts.length > 0 ? '/' + parts.join('/') : '/';
  navigateTo(parent === '/' ? undefined : parent);
}

function handleItemClick(item: any) {
  if (item.is_dir) {
    navigateTo(item.path);
  }
}

function getFileIcon(item: any) {
  if (item.is_dir) return 'lucide:folder';
  const ext = (item.ext || '').toLowerCase();
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts'].includes(ext)) {
    return 'lucide:film';
  }
  if (['mp3', 'aac', 'flac', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'lucide:music';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return 'lucide:image';
  }
  if (['srt', 'ass', 'ssa', 'vtt', 'sub'].includes(ext)) {
    return 'lucide:subtitles';
  }
  if (['nfo', 'xml', 'json'].includes(ext)) {
    return 'lucide:file-code';
  }
  return 'lucide:file';
}

function getFileIconColor(item: any) {
  if (item.is_dir) return 'hsl(var(--warning))';
  const ext = (item.ext || '').toLowerCase();
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts'].includes(ext)) {
    return 'hsl(var(--primary))';
  }
  if (['mp3', 'aac', 'flac', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'hsl(var(--success))';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return 'hsl(var(--warning))';
  }
  if (['srt', 'ass', 'ssa', 'vtt', 'sub'].includes(ext)) {
    return 'hsl(var(--destructive))';
  }
  return 'hsl(var(--muted-foreground))';
}

function getLibraryIcon(type: string) {
  const map: Record<string, string> = {
    movie: 'lucide:film',
    tv: 'lucide:tv',
    anime: 'lucide:sparkles',
    sync: 'lucide:refresh-cw',
    download: 'lucide:download',
  };
  return map[type] || 'lucide:folder-open';
}

function getLibraryColor(type: string) {
  const map: Record<string, string> = {
    movie: 'var(--primary)',
    tv: 'var(--success)',
    anime: 'var(--warning)',
    sync: 'var(--primary)',
    download: 'var(--success)',
  };
  return map[type] || 'var(--muted-foreground)';
}

async function handleScrap(path: string) {
  try {
    await scrapMediaPathApi(path);
    notification.success({ content: '刮削任务已提交' });
  } catch (err: any) {
    notification.error({ content: '刮削失败', description: err?.message || '' });
  }
}

async function handleSubtitle(item: any) {
  try {
    await downloadSubtitleApi(item.path, item.name);
    notification.success({ content: '字幕下载任务已提交' });
  } catch (err: any) {
    notification.error({ content: '字幕下载失败', description: err?.message || '' });
  }
}

function formatSize(bytes?: number) {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ---- 操作弹窗状态 ----
const transferModalShow = ref(false);
const transferPath = ref('');
const transferLoading = ref(false);

const renameModalShow = ref(false);
const renameForm = ref({ path: '', name: '' });

const hardlinkConfigShow = ref(false);
const hardlinkConfigForm = ref({ path: '', dir: '' });
const hardlinkModalShow = ref(false);
const hardlinkResult = ref<Record<string, Array<{ file: string; filename: string; filepath: string }>>>({});
const hardlinkSourceFile = ref('');
const hardlinkLoading = ref(false);

const deleteModalShow = ref(false);
const deletePayload = ref<{ path: string; name: string; is_dir: boolean } | null>(null);

// tmdb search
const tmdbSearchShow = ref(false);
const tmdbSearchKeyword = ref('');
const tmdbSearchLoading = ref(false);
const tmdbSearchResults = ref<any[]>([]);

// identify result
const identifyResultShow = ref(false);
const identifyResult = ref<Record<string, any>>({});
const identifyLoading = ref(false);

// ---- 全局搜索 ----
const globalSearchMode = ref(false);
const globalSearchResults = ref<any[]>([]);
const globalSearchLoading = ref(false);
const globalSearchIndexed = ref(0);
const globalSearchReady = ref(false);
const highlightedPath = ref('');

async function handleGlobalSearch() {
  const kw = searchKeyword.value.trim();
  if (!kw) {
    globalSearchMode.value = false;
    globalSearchResults.value = [];
    return;
  }
  globalSearchLoading.value = true;
  globalSearchMode.value = true;
  try {
    const res = await searchFilesApi(kw, 100);
    if (res) {
      globalSearchResults.value = res.items || [];
      globalSearchReady.value = res.ready || false;
      globalSearchIndexed.value = res.indexed || 0;
    }
  } catch (err: any) {
    notification.error({ content: '搜索失败', description: err?.message || '' });
  } finally {
    globalSearchLoading.value = false;
  }
}

function clearGlobalSearch() {
  searchKeyword.value = '';
  globalSearchMode.value = false;
  globalSearchResults.value = [];
}

function navigateToSearchResult(item: any) {
  const dir = item.path?.substring(0, item.path.lastIndexOf('/')) || '/';
  globalSearchMode.value = false;
  searchKeyword.value = '';
  highlightedPath.value = item.path;
  navigateTo(dir);
  setTimeout(() => { highlightedPath.value = ''; }, 3000);
}

async function handleIdentify(item: any) {
  const filename = item.name || item.path?.split('/').pop() || '';
  if (!filename) {
    notification.warning({ content: '无法获取文件名' });
    return;
  }
  identifyLoading.value = true;
  try {
    const res = await nameTestApi(filename);
    identifyResult.value = res || {};
    identifyResultShow.value = true;
  } catch (err: any) {
    notification.error({ content: '识别失败', description: err?.message || '' });
  } finally {
    identifyLoading.value = false;
  }
}

function openTransfer(item: any) {
  transferPath.value = item.path;
  transferModalShow.value = true;
}

async function submitTransfer(data: TransferFormData) {
  transferLoading.value = true;
  try {
    await manualTransferUdfApi({
      inpath: data.path,
      outpath: data.outpath || undefined,
      syncmod: data.syncmod,
      type: data.type,
      tmdb: data.tmdb,
      season: data.season,
      min_filesize: data.min_filesize,
    });
    notification.success({ content: '转移任务已提交' });
    transferModalShow.value = false;
  } catch (err: any) {
    notification.error({ content: '提交失败', description: err?.message || '' });
  } finally {
    transferLoading.value = false;
  }
}

function openRename(item: any) {
  renameForm.value = { path: item.path, name: item.name };
  renameModalShow.value = true;
}

async function submitRename() {
  try {
    await renameFileApi({ path: renameForm.value.path, name: renameForm.value.name });
    notification.success({ content: '重命名成功' });
    renameModalShow.value = false;
    await fetchDirList(currentPath.value || undefined);
  } catch (err: any) {
    notification.error({ content: '重命名失败', description: err?.message || '' });
  }
}

function openHardlinkConfig(item: any) {
  hardlinkConfigForm.value = {
    path: item.path,
    dir: item.path ? item.path.substring(0, item.path.lastIndexOf('/')) || '/' : '',
  };
  hardlinkConfigShow.value = true;
}

async function submitHardlinkQuery() {
  hardlinkConfigShow.value = false;
  hardlinkLoading.value = true;
  hardlinkResult.value = {};
  hardlinkSourceFile.value = hardlinkConfigForm.value.path;
  try {
    const res = await findHardlinksApi({
      files: [hardlinkConfigForm.value.path],
      dir: hardlinkConfigForm.value.dir || undefined,
    });
    hardlinkResult.value = res || {};
    hardlinkModalShow.value = true;
  } catch (err: any) {
    notification.error({ content: '查询失败', description: err?.message || '' });
  } finally {
    hardlinkLoading.value = false;
  }
}

function openDelete(item: any) {
  deletePayload.value = { path: item.path, name: item.name, is_dir: item.is_dir };
  deleteModalShow.value = true;
}

async function confirmDelete() {
  if (!deletePayload.value) return;
  try {
    await deleteFilesApi({ files: [deletePayload.value.path] });
    notification.success({ content: '删除成功' });
    deleteModalShow.value = false;
    await fetchDirList(currentPath.value || undefined);
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  }
}

function getItemOptions(item: any) {
  const common = [
    { label: '识别', key: 'identify', icon: () => h(IconifyIcon, { icon: 'lucide:scan-line', class: 'size-4' }) },
    { label: '刮削', key: 'scrap', icon: () => h(IconifyIcon, { icon: 'lucide:sparkles', class: 'size-4' }) },
  ];
  const fileOnly = [
    { label: '转移', key: 'transfer', icon: () => h(IconifyIcon, { icon: 'lucide:arrow-right-left', class: 'size-4' }) },
    { label: '字幕', key: 'subtitle', icon: () => h(IconifyIcon, { icon: 'lucide:subtitles', class: 'size-4' }) },
    { label: '硬链接查询', key: 'hardlink', icon: () => h(IconifyIcon, { icon: 'lucide:link', class: 'size-4' }) },
    { label: '重命名', key: 'rename', icon: () => h(IconifyIcon, { icon: 'lucide:pencil', class: 'size-4' }) },
  ];
  const danger = [
    { type: 'divider', key: 'd1' },
    { label: '删除', key: 'delete', icon: () => h(IconifyIcon, { icon: 'lucide:trash-2', class: 'size-4' }), props: { style: 'color: hsl(var(--destructive))' } },
  ];
  if (item.is_dir) {
    return [...common, ...danger];
  }
  return [...common, ...fileOnly, ...danger];
}

function handleItemAction(key: string, item: any) {
  if (key === 'identify') handleIdentify(item);
  else if (key === 'transfer') openTransfer(item);
  else if (key === 'scrap') handleScrap(item.path);
  else if (key === 'subtitle') handleSubtitle(item);
  else if (key === 'hardlink') openHardlinkConfig(item);
  else if (key === 'rename') openRename(item);
  else if (key === 'delete') openDelete(item);
}

onMounted(() => initLibraryPaths());
</script>

<template>
  <div class="file-manager">
    <!-- 头部 -->
    <PageHeader title="文件管理" subtitle="浏览和管理媒体库文件">
      <template #actions>
        <NSpace align="center">
          <NSelect
            v-model:value="currentBackendId"
            :options="backendOptions"
            size="small"
            style="width: 160px"
            @update:value="switchBackend"
          />
          <NInput
            v-model:value="searchKeyword"
            placeholder="全局搜索媒体文件..."
            style="width: 260px"
            size="small"
            clearable
            @keyup.enter="handleGlobalSearch"
            @clear="clearGlobalSearch"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:search" class="size-4" style="color: hsl(var(--muted-foreground));" />
            </template>
          </NInput>
          <NButton v-if="globalSearchMode" size="small" @click="clearGlobalSearch">
            <template #icon>
              <IconifyIcon icon="lucide:x" class="size-4" />
            </template>
            返回浏览
          </NButton>
          <NButton v-else size="small" @click="goUp" :disabled="!canGoUp">
            <template #icon>
              <IconifyIcon icon="lucide:arrow-up" class="size-4" />
            </template>
            上级
          </NButton>
          <NButton size="small" @click="fetchDirList(currentPath || undefined)">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
            </template>
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <div class="file-manager-body">
      <!-- 侧边栏 -->
      <div class="sidebar">
        <!-- 媒体库 -->
        <div v-if="libraryPaths.length > 0" class="sidebar-section">
          <div class="sidebar-title">媒体库</div>
          <div class="sidebar-list">
            <div
              v-for="lib in libraryPaths"
              :key="lib.path"
              class="sidebar-item"
              :class="{ active: currentPath === lib.path }"
              @click="navigateTo(lib.path)"
            >
              <div
                class="sidebar-icon"
                :style="{ backgroundColor: `hsl(${getLibraryColor(lib.type)} / 0.12)` }"
              >
                <IconifyIcon
                  :icon="getLibraryIcon(lib.type)"
                  class="size-4"
                  :style="{ color: `hsl(${getLibraryColor(lib.type)})` }"
                />
              </div>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="sidebar-label truncate">{{ lib.name }}</span>
                </template>
                {{ lib.path }}
              </NTooltip>
            </div>
          </div>
        </div>

        <!-- 同步源目录 -->
        <div v-if="syncSourcePaths.length > 0" class="sidebar-section">
          <div class="sidebar-title">同步源目录</div>
          <div class="sidebar-list">
            <div
              v-for="sp in syncSourcePaths"
              :key="sp.path"
              class="sidebar-item"
              :class="{ active: currentPath === sp.path }"
              @click="navigateTo(sp.path)"
            >
              <div
                class="sidebar-icon"
                :style="{ backgroundColor: `hsl(${getLibraryColor(sp.type)} / 0.12)` }"
              >
                <IconifyIcon
                  :icon="getLibraryIcon(sp.type)"
                  class="size-4"
                  :style="{ color: `hsl(${getLibraryColor(sp.type)})` }"
                />
              </div>
              <NTooltip trigger="hover">
                <template #trigger>
                  <span class="sidebar-label truncate">{{ sp.name }}</span>
                </template>
                {{ sp.path }}
              </NTooltip>
            </div>
          </div>
        </div>

        <!-- 快捷操作 -->
        <div class="sidebar-section">
          <div class="sidebar-title">快捷操作</div>
          <div class="sidebar-list">
            <div class="sidebar-item" @click="navigateTo(defaultPath)">
              <div class="sidebar-icon" style="background-color: hsl(var(--muted) / 0.5);">
                <IconifyIcon icon="lucide:home" class="size-4" style="color: hsl(var(--muted-foreground));" />
              </div>
              <span class="sidebar-label">默认目录</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="main-content">
        <!-- 面包屑 -->
        <div class="breadcrumb-bar">
          <NButton v-if="canGoUp" size="tiny" text class="breadcrumb-root" @click="goUp">
            <IconifyIcon icon="lucide:arrow-left" class="size-4 mr-1" />
          </NButton>
          <div class="breadcrumb-path">
            <span
              v-if="currentRoot"
              class="breadcrumb-item"
              :class="{ 'breadcrumb-active': breadcrumbs.length === 0 }"
              @click="navigateTo(currentRoot)"
            >
              {{ libraryPaths.find(p => p.path === currentRoot)?.name
                 || syncSourcePaths.find(p => p.path === currentRoot)?.name
                 || currentRoot.split('/').pop()
                 || '根目录' }}
            </span>
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
        </div>

        <!-- 全局搜索结果 -->
        <NSpin v-if="globalSearchMode" :show="globalSearchLoading" class="file-list-wrapper">
          <div v-if="globalSearchResults.length > 0" class="file-list">
            <div class="file-list-header">
              <div class="file-col-name">名称</div>
              <div class="file-col-size">大小</div>
              <div class="file-col-mtime">修改时间</div>
              <div class="file-col-ctime">创建时间</div>
            </div>
            <div
              v-for="item in globalSearchResults"
              :key="item.path"
              class="file-list-row search-result-row"
              @click="navigateToSearchResult(item)"
            >
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
                <NButton
                  size="tiny"
                  text
                  class="search-open-btn"
                  @click.stop="navigateToSearchResult(item)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:folder-open" class="size-4" />
                  </template>
                </NButton>
              </div>
              <div class="file-col-size">
                <span class="file-row-size">{{ formatSize(item.size) }}</span>
              </div>
              <div class="file-col-mtime">
                <span class="file-row-time">{{ formatTime(item.mtime) }}</span>
              </div>
              <div class="file-col-ctime">
                <span class="file-row-time">{{ formatTime(item.ctime) }}</span>
              </div>
            </div>
          </div>
          <NEmpty v-else-if="!globalSearchLoading" description="未找到匹配的文件" class="mt-8" />
          <div v-if="!globalSearchReady &amp;&amp; !globalSearchLoading" class="text-sm mt-4 text-center" style="color: hsl(var(--muted-foreground))"
            >索引构建中，已索引 {{ globalSearchIndexed }} 个文件...
          </div>
        </NSpin>

        <!-- 文件列表 -->
        <NSpin v-else :show="loading" class="file-list-wrapper">
          <div v-if="filteredDirList.length > 0" class="file-list">
            <!-- 表头 -->
            <div class="file-list-header">
              <div class="file-col-name sortable" @click="toggleSort('name')">
                名称
                <IconifyIcon
                  v-if="sortKey === 'name'"
                  :icon="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                  class="size-3 sort-icon"
                />
              </div>
              <div class="file-col-size sortable" @click="toggleSort('size')">
                大小
                <IconifyIcon
                  v-if="sortKey === 'size'"
                  :icon="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                  class="size-3 sort-icon"
                />
              </div>
              <div class="file-col-mtime sortable" @click="toggleSort('mtime')">
                修改时间
                <IconifyIcon
                  v-if="sortKey === 'mtime'"
                  :icon="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                  class="size-3 sort-icon"
                />
              </div>
              <div class="file-col-ctime sortable" @click="toggleSort('ctime')">
                创建时间
                <IconifyIcon
                  v-if="sortKey === 'ctime'"
                  :icon="sortOrder === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                  class="size-3 sort-icon"
                />
              </div>
              <div class="file-col-actions">操作</div>
            </div>

            <!-- 文件夹优先 -->
            <div
              v-for="item in filteredDirList"
              :key="item.path"
              class="file-list-row"
              :class="{ 'file-row-dir': item.is_dir, 'highlighted': item.path === highlightedPath }"
              @click="handleItemClick(item)"
            >
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
                <span v-if="!item.is_dir" class="file-row-size">{{ formatSize(item.size) }}</span>
                <span v-else class="file-row-type">文件夹</span>
              </div>
              <div class="file-col-mtime">
                <span class="file-row-time">{{ formatTime(item.mtime) }}</span>
              </div>
              <div class="file-col-ctime">
                <span class="file-row-time">{{ formatTime(item.ctime) }}</span>
              </div>
              <div class="file-col-actions" @click.stop>
                <NDropdown
                  :options="getItemOptions(item)"
                  @select="(key: string) => handleItemAction(key, item)"
                >
                  <NButton size="tiny" text>
                    <template #icon>
                      <IconifyIcon icon="lucide:more-vertical" class="size-4" />
                    </template>
                  </NButton>
                </NDropdown>
              </div>
            </div>
          </div>

          <NEmpty v-else description="当前目录为空" class="mt-8" />
        </NSpin>
      </div>
    </div>

    <TransferModal
      v-model:show="transferModalShow"
      :path="transferPath"
      :loading="transferLoading"
      @submit="submitTransfer"
    />

    <!-- 重命名弹窗 -->
    <NModal
      v-model:show="renameModalShow"
      title="重命名"
      preset="dialog"
      positive-text="确定"
      negative-text="取消"
      @positive-click="submitRename"
    >
      <NForm>
        <NFormItem label="新文件名">
          <NInput v-model:value="renameForm.name" />
        </NFormItem>
      </NForm>
    </NModal>

    <!-- 硬链接查询配置弹窗 -->
    <NModal
      v-model:show="hardlinkConfigShow"
      title="硬链接查询"
      preset="card"
      style="width: 480px; max-width: 92vw;"
      :bordered="false"
      segmented
    >
      <NForm>
        <NFormItem label="目标文件">
          <NInput v-model:value="hardlinkConfigForm.path" readonly size="small" />
        </NFormItem>
        <NFormItem label="搜索目录">
          <NInput
            v-model:value="hardlinkConfigForm.dir"
            placeholder="留空则从文件所在目录搜索"
            size="small"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="hardlinkConfigShow = false">取消</NButton>
          <NButton type="primary" size="small" @click="submitHardlinkQuery">查询</NButton>
        </div>
      </template>
    </NModal>

    <!-- 硬链接查询结果弹窗 -->
    <NModal
      v-model:show="hardlinkModalShow"
      title="硬链接查询结果"
      preset="card"
      style="width: 520px; max-width: 92vw;"
      :bordered="false"
      segmented
    >
      <NSpin :show="hardlinkLoading">
        <div class="hardlink-list">
          <!-- 源文件 -->
          <div class="hardlink-source">
            <div class="hardlink-section-label">源文件</div>
            <div class="hardlink-path">{{ hardlinkSourceFile }}</div>
          </div>
          <!-- 硬链接结果 -->
          <div v-for="(links, name) in hardlinkResult" :key="name">
            <template v-if="links && links.length > 0">
              <div class="hardlink-section-label">找到 {{ links.length }} 个硬链接</div>
              <div class="hardlink-items">
                <div
                  v-for="link in links"
                  :key="link.file"
                  class="hardlink-item"
                >
                  <div class="hardlink-item-path">{{ link.filepath }}</div>
                  <div class="hardlink-item-name">{{ link.filename }}</div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="hardlink-empty">未找到其他硬链接（该文件只有自身一个链接）</div>
            </template>
          </div>
        </div>
      </NSpin>
    </NModal>

    <!-- 删除确认弹窗 -->
    <NModal
      v-model:show="deleteModalShow"
      title="确认删除"
      preset="dialog"
      type="error"
      positive-text="删除"
      negative-text="取消"
      @positive-click="confirmDelete"
    >
      <p v-if="deletePayload">
        确定要删除 <strong>{{ deletePayload.name }}</strong> 吗？
        <br />
        此操作不可恢复。
      </p>
    </NModal>

    <!-- 识别结果 -->
    <IdentifyResult
      v-model:show="identifyResultShow"
      :loading="identifyLoading"
      :result="identifyResult"
    />
  </div>
</template>

<style scoped>
.file-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
}

.file-manager-body {
  display: flex;
  flex: 1;
  gap: 1rem;
  margin-top: 1rem;
  min-height: 0;
}

/* 侧边栏 */
.sidebar {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
}

.sidebar-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 0.5rem;
  margin-bottom: 0.375rem;
}

.sidebar-list {
  display: flex;
  flex-direction: column;
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.sidebar-item:hover {
  background-color: hsl(var(--accent));
}

.sidebar-item.active {
  background-color: hsl(var(--accent));
}

.sidebar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

.sidebar-label {
  font-size: 0.875rem;
  color: hsl(var(--card-foreground));
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  overflow: hidden;
}

.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--card));
}

.breadcrumb-root {
  flex-shrink: 0;
}

.breadcrumb-path {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  overflow-x: auto;
  white-space: nowrap;
}

.breadcrumb-item {
  font-size: 0.85rem;
  color: hsl(var(--primary));
  cursor: pointer;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  transition: background-color 0.15s;
}

.breadcrumb-item:hover {
  background-color: hsl(var(--accent));
}

.breadcrumb-item.breadcrumb-active {
  color: hsl(var(--card-foreground));
  font-weight: 500;
  cursor: default;
}

.breadcrumb-item.breadcrumb-active:hover {
  background-color: transparent;
}

.breadcrumb-separator {
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
  user-select: none;
}

/* 文件列表 */
.file-list-wrapper {
  flex: 1;
  overflow-y: auto;
}

.file-list {
  display: flex;
  flex-direction: column;
}

.file-list-header {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--muted) / 0.3);
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
  padding: 0.625rem 1rem;
  border-bottom: 1px solid hsl(var(--border) / 0.5);
  cursor: pointer;
  transition: background-color 0.15s;
}

.file-list-row:hover {
  background-color: hsl(var(--accent) / 0.5);
}

.file-row-dir {
  font-weight: 500;
}

.file-col-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.file-col-size {
  width: 100px;
  flex-shrink: 0;
  text-align: right;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  min-width: 0;
  overflow: hidden;
}

.file-col-mtime {
  width: 140px;
  flex-shrink: 0;
  text-align: right;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  min-width: 0;
  overflow: hidden;
}

.file-col-ctime {
  width: 140px;
  flex-shrink: 0;
  text-align: right;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  min-width: 0;
  overflow: hidden;
}

.file-col-actions {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.15s;
  min-width: 0;
  overflow: hidden;
}

.file-list-row:hover .file-col-actions {
  opacity: 1;
}

.search-open-btn {
  margin-left: auto;
}

.file-list-row.highlighted {
  background-color: hsl(var(--warning) / 0.15);
  border-left: 3px solid hsl(var(--warning));
  padding-left: calc(1rem - 3px);
}

.file-row-icon {
  flex-shrink: 0;
}

.file-row-name {
  font-size: 0.875rem;
  color: hsl(var(--card-foreground));
}

.file-row-size {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.file-row-type {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.file-row-time {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.hardlink-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hardlink-section-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.375rem;
}

.hardlink-source {
  padding: 0.75rem;
  background-color: hsl(var(--accent) / 0.5);
  border-radius: 0.5rem;
  border: 1px solid hsl(var(--border));
}

.hardlink-path {
  font-size: 0.85rem;
  color: hsl(var(--card-foreground));
  word-break: break-all;
  line-height: 1.4;
}

.hardlink-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hardlink-item {
  padding: 0.5rem 0.75rem;
  background-color: hsl(var(--accent) / 0.3);
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border));
}

.hardlink-item-path {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
  line-height: 1.4;
}

.hardlink-item-name {
  font-size: 0.85rem;
  color: hsl(var(--card-foreground));
  font-weight: 500;
  word-break: break-all;
  line-height: 1.4;
}

.hardlink-empty {
  padding: 1rem;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  background-color: hsl(var(--accent) / 0.3);
  border-radius: 0.5rem;
  border: 1px dashed hsl(var(--border));
}

.tmdb-result-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 50vh;
  overflow-y: auto;
}

.tmdb-result-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.tmdb-result-card:hover {
  box-shadow: 0 2px 8px hsl(var(--foreground) / 0.08);
}

.tmdb-poster {
  width: 60px;
  height: 80px;
  object-fit: cover;
  flex-shrink: 0;
  background-color: hsl(var(--muted));
}

.tmdb-poster-placeholder {
  width: 60px;
  height: 80px;
  background-color: hsl(var(--muted));
  flex-shrink: 0;
}

.tmdb-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  margin-bottom: 0.25rem;
}

.tmdb-year {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  font-weight: 400;
}

.tmdb-overview {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .file-col-size,
  .file-col-mtime,
  .file-col-ctime {
    display: none;
  }

  .file-col-actions {
    opacity: 1;
  }
}
</style>
