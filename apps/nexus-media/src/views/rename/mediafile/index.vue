<script lang="ts" setup>
import type {
  FileActionKey,
  FileItem,
  SearchScope,
  SortKey,
  SortOrder,
  ViewMode,
} from './types';

import { computed, onMounted, ref, watch } from 'vue';

import { NButton, NForm, NFormItem, NInput, NModal, NSpin } from 'naive-ui';

import { searchFilesApi } from '#/api/modules/media';
import IdentifyResult from '#/components/media/IdentifyResult.vue';
import TransferModal from '#/components/media/TransferModal.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useAppNotification } from '#/utils/notify';

import BatchActionBar from './components/BatchActionBar.vue';
import DestPickerModal from './components/DestPickerModal.vue';
import FileContextMenu from './components/FileContextMenu.vue';
import FileGrid from './components/FileGrid.vue';
import FileList from './components/FileList.vue';
import FileToolbar from './components/FileToolbar.vue';
import FileTree from './components/FileTree.vue';
import MobileNavDrawer from './components/MobileNavDrawer.vue';
import { useFileActions } from './composables/useFileActions';
import { useFileNavigation } from './composables/useFileNavigation';
import { useFileSelection } from './composables/useFileSelection';
import { useIsMobile } from './composables/useIsMobile';
import { parentDir } from './utils';

const notification = useAppNotification();
const { isMobile } = useIsMobile();

const nav = useFileNavigation();
const selection = useFileSelection();
const sidebarTreeRef = ref<InstanceType<typeof FileTree>>();
const actions = useFileActions({
  getBackendId: () => nav.currentBackendId.value,
  getCurrentPath: () => nav.currentPath.value,
  refresh: async () => {
    await nav.refresh();
    sidebarTreeRef.value?.clearCache();
  },
  clearSelection: () => selection.clearSelection(),
});

// ---- 视图 / 排序 / 搜索 ----
const viewMode = ref<ViewMode>(isMobile.value ? 'grid' : 'list');
const sortKey = ref<SortKey>('name');
const sortOrder = ref<SortOrder>('asc');
const searchKeyword = ref('');
const searchScope = ref<SearchScope>('dir');

const globalSearchMode = ref(false);
const globalSearchResults = ref<FileItem[]>([]);
const globalSearchLoading = ref(false);
const globalSearchIndexed = ref(0);
const globalSearchReady = ref(false);
const highlightPath = ref('');

const sortedItems = computed(() => {
  const list = [...nav.dirList.value];
  const dir = (a: FileItem, b: FileItem) =>
    a.is_dir === b.is_dir ? 0 : a.is_dir ? -1 : 1;
  const byName = (a: FileItem, b: FileItem) => a.name.localeCompare(b.name);
  const factor = sortOrder.value === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const d = dir(a, b);
    if (d !== 0) return d;
    let r: number;
    switch (sortKey.value) {
      case 'mtime': {
        r = (a.mtime ?? 0) - (b.mtime ?? 0);
        break;
      }
      case 'size': {
        r = (a.size ?? -1) - (b.size ?? -1);
        break;
      }
      default: {
        r = byName(a, b);
      }
    }
    return r === 0 ? byName(a, b) : r * factor;
  });
  return list;
});

const displayItems = computed(() => {
  if (globalSearchMode.value) return globalSearchResults.value;
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw || searchScope.value !== 'dir') return sortedItems.value;
  return sortedItems.value.filter((i) => i.name.toLowerCase().includes(kw));
});

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

watch(
  () => nav.dirList.value,
  (items) => selection.pruneSelection(items),
);

watch(searchScope, (scope) => {
  if (scope === 'dir' && globalSearchMode.value) clearGlobalSearch();
});

async function handleSearchEnter() {
  if (searchScope.value === 'dir') return;
  const kw = searchKeyword.value.trim();
  if (!kw) {
    clearGlobalSearch();
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
  } catch (error: any) {
    notification.error('搜索失败', { description: error?.message || '' });
  } finally {
    globalSearchLoading.value = false;
  }
}

function clearGlobalSearch() {
  searchKeyword.value = '';
  globalSearchMode.value = false;
  globalSearchResults.value = [];
}

function openSearchResult(item: FileItem) {
  const dir = parentDir(item.path);
  globalSearchMode.value = false;
  searchKeyword.value = '';
  highlightPath.value = item.path;
  nav.navigateTo(dir === '/' ? '' : dir);
  setTimeout(() => {
    highlightPath.value = '';
  }, 3000);
}

// ---- 行交互语义（列表/网格共用） ----
function openItem(item: FileItem) {
  if (globalSearchMode.value) {
    openSearchResult(item);
    return;
  }
  if (item.is_dir) {
    nav.navigateTo(item.path);
  }
}

function handleRowClick(
  item: FileItem,
  mods: { ctrl: boolean; shift: boolean },
) {
  if (isMobile.value) {
    if (selection.selectionMode.value) {
      selection.toggle(item);
    } else if (item.is_dir || globalSearchMode.value) {
      openItem(item);
    } else {
      selection.selectSingle(item);
    }
    return;
  }
  if (mods.shift) {
    selection.rangeSelect(item, displayItems.value);
  } else if (mods.ctrl) {
    selection.toggle(item);
  } else if (item.is_dir || globalSearchMode.value) {
    openItem(item);
  } else {
    selection.selectSingle(item);
  }
}

function handleRowDblclick(item: FileItem) {
  if (isMobile.value) return;
  if (item.is_dir || globalSearchMode.value) {
    selection.selectSingle(item);
    openItem(item);
  }
}

function handleRowLongpress(item: FileItem) {
  selection.selectionMode.value = true;
  selection.toggle(item);
}

function handleToggleSelectAll() {
  if (selection.isAllSelected(displayItems.value)) {
    selection.clearSelection();
  } else {
    selection.selectAll(displayItems.value);
  }
}

// ---- 上下文菜单 ----
const ctxMenu = ref({ show: false, x: 0, y: 0 });

const ctxItems = computed<FileItem[]>(() => {
  const sel = selection.selectedItems(displayItems.value);
  return sel.length > 0 ? sel : [];
});

const ctxOptions = computed(() => actions.buildMenuOptions(ctxItems.value));

function openContextMenu(item: FileItem, pos: { x: number; y: number }) {
  if (!selection.isSelected(item)) {
    selection.selectSingle(item);
  }
  ctxMenu.value = { show: true, x: pos.x, y: pos.y };
}

function handleContextSelect(key: FileActionKey) {
  ctxMenu.value.show = false;
  actions.dispatch(key, ctxItems.value);
}

// ---- 批量操作条 ----
const batchItems = computed(() => selection.selectedItems(displayItems.value));
const batchAllFiles = computed(() => batchItems.value.every((i) => !i.is_dir));

function handleBatchAction(key: FileActionKey) {
  actions.dispatch(key, batchItems.value);
}

// ---- 新建目录 / 上传 / 移动复制 ----
const uploadInputRef = ref<HTMLInputElement>();

function triggerUpload() {
  uploadInputRef.value?.click();
}

function handleUploadChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) {
    actions.uploadFiles(input.files);
  }
  input.value = '';
}

function handleMoveCopyConfirm(dest: string, destBackendId: string) {
  if (destBackendId !== nav.currentBackendId.value) {
    notification.warning('移动/复制仅支持同一存储后端内操作');
    return;
  }
  actions.moveCopyDialog.value.dest = dest;
  actions.submitMoveCopy();
}

// ---- 移动端抽屉 ----
const navDrawerShow = ref(false);

onMounted(() => nav.init());
</script>

<template>
  <div class="file-manager">
    <PageHeader title="文件管理" subtitle="浏览和管理媒体库文件" />

    <div class="file-manager-body">
      <!-- 桌面端侧边栏 -->
      <div v-if="!isMobile" class="sidebar tbl-card">
        <FileTree
          ref="sidebarTreeRef"
          :groups="nav.backendGroups.value"
          :current-path="nav.currentPath.value"
          :current-backend-id="nav.currentBackendId.value"
          :load-children="nav.loadChildren"
          @select="
            (path, backendId) =>
              nav.navigateToSidebarPath({
                path,
                backend_id: backendId,
                name: '',
                type: '',
              })
          "
        />
      </div>

      <!-- 主内容区 -->
      <div class="main-content">
        <FileToolbar
          :can-go-back="nav.canGoBack.value"
          :can-go-forward="nav.canGoForward.value"
          :can-go-up="nav.canGoUp.value"
          :breadcrumbs="nav.breadcrumbs.value"
          :root-name="nav.currentRootName.value"
          :root-path="nav.currentRoot.value || ''"
          :current-path="nav.currentPath.value"
          v-model:view-mode="viewMode"
          v-model:search-keyword="searchKeyword"
          v-model:search-scope="searchScope"
          :is-mobile="isMobile"
          @back="nav.goBack"
          @forward="nav.goForward"
          @up="nav.goUp"
          @refresh="nav.refresh"
          @navigate="nav.navigateTo"
          @search-enter="handleSearchEnter"
          @open-nav="navDrawerShow = true"
          @mkdir="actions.dispatch('mkdir', [])"
          @upload="triggerUpload"
        />

        <BatchActionBar
          v-if="selection.selectedCount.value > 0 && !isMobile"
          :count="selection.selectedCount.value"
          :all-files="batchAllFiles"
          @action="handleBatchAction"
          @clear="selection.clearSelection"
        />

        <div v-if="globalSearchMode" class="search-status">
          <span>
            全盘搜索「{{ searchKeyword }}」：{{ globalSearchResults.length }}
            个结果
          </span>
          <NButton size="tiny" quaternary @click="clearGlobalSearch">
            返回浏览
          </NButton>
        </div>

        <FileList
          v-if="viewMode === 'list'"
          :items="displayItems"
          :loading="globalSearchMode ? globalSearchLoading : nav.loading.value"
          :selected-paths="selection.selectedPaths.value"
          :selection-mode="selection.selectionMode.value"
          :sort-key="sortKey"
          :sort-order="sortOrder"
          :highlight-path="highlightPath"
          :empty-text="globalSearchMode ? '未找到匹配的文件' : '当前目录为空'"
          @row-click="handleRowClick"
          @row-dblclick="handleRowDblclick"
          @row-longpress="handleRowLongpress"
          @row-contextmenu="openContextMenu"
          @row-menu="openContextMenu"
          @toggle-select="selection.toggle"
          @toggle-select-all="handleToggleSelectAll"
          @toggle-sort="toggleSort"
        />
        <FileGrid
          v-else
          :items="displayItems"
          :loading="globalSearchMode ? globalSearchLoading : nav.loading.value"
          :selected-paths="selection.selectedPaths.value"
          :selection-mode="selection.selectionMode.value"
          :highlight-path="highlightPath"
          :empty-text="globalSearchMode ? '未找到匹配的文件' : '当前目录为空'"
          @row-click="handleRowClick"
          @row-dblclick="handleRowDblclick"
          @row-longpress="handleRowLongpress"
          @row-contextmenu="openContextMenu"
          @row-menu="openContextMenu"
          @toggle-select="selection.toggle"
        />

        <div
          v-if="globalSearchMode && !globalSearchReady && !globalSearchLoading"
          class="search-indexing"
        >
          索引构建中，已索引 {{ globalSearchIndexed }} 个文件...
        </div>
      </div>
    </div>

    <!-- 移动端批量操作条 -->
    <BatchActionBar
      v-if="selection.selectedCount.value > 0 && isMobile"
      mobile
      :count="selection.selectedCount.value"
      :all-files="batchAllFiles"
      @action="handleBatchAction"
      @clear="selection.clearSelection"
    />

    <!-- 移动端导航抽屉 -->
    <MobileNavDrawer
      v-model:show="navDrawerShow"
      :groups="nav.backendGroups.value"
      :backend-options="nav.backendOptions.value"
      :current-backend-id="nav.currentBackendId.value"
      :current-path="nav.currentPath.value"
      :load-children="nav.loadChildren"
      @navigate="
        (path, backendId) =>
          nav.navigateToSidebarPath({
            path,
            backend_id: backendId,
            name: '',
            type: '',
          })
      "
      @switch-backend="nav.switchBackend"
    />

    <!-- 上下文菜单 -->
    <FileContextMenu
      :show="ctxMenu.show"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :options="ctxOptions"
      @select="handleContextSelect"
      @close="ctxMenu.show = false"
    />

    <!-- 隐藏上传输入 -->
    <input
      ref="uploadInputRef"
      type="file"
      multiple
      class="upload-input"
      @change="handleUploadChange"
    />

    <!-- 转移 -->
    <TransferModal
      v-model:show="actions.transferModalShow.value"
      :path="actions.transferPath.value"
      :loading="actions.transferLoading.value"
      @submit="actions.submitTransfer"
    />

    <!-- 重命名 -->
    <NModal
      v-model:show="actions.renameDialog.value.show"
      title="重命名"
      preset="dialog"
      positive-text="确定"
      negative-text="取消"
      @positive-click="actions.submitRename"
    >
      <NForm>
        <NFormItem label="新文件名">
          <NInput v-model:value="actions.renameDialog.value.name" />
        </NFormItem>
      </NForm>
    </NModal>

    <!-- 新建目录 -->
    <NModal
      v-model:show="actions.mkdirDialog.value.show"
      title="新建目录"
      preset="dialog"
      positive-text="创建"
      negative-text="取消"
      @positive-click="actions.submitMkdir"
    >
      <NForm>
        <NFormItem label="目录名称">
          <NInput
            v-model:value="actions.mkdirDialog.value.name"
            placeholder="在当前目录下创建"
            @keyup.enter="actions.submitMkdir"
          />
        </NFormItem>
      </NForm>
    </NModal>

    <!-- 移动/复制目标选择 -->
    <DestPickerModal
      v-model:show="actions.moveCopyDialog.value.show"
      :title="
        actions.moveCopyDialog.value.mode === 'move' ? '移动到' : '复制到'
      "
      :count="actions.moveCopyDialog.value.items.length"
      :groups="nav.backendGroups.value"
      :current-backend-id="nav.currentBackendId.value"
      :current-path="nav.currentPath.value"
      :load-children="nav.loadChildren"
      @confirm="handleMoveCopyConfirm"
    />

    <!-- 硬链接查询配置 -->
    <NModal
      v-model:show="actions.hardlinkConfigShow.value"
      title="硬链接查询"
      preset="card"
      style="width: 480px; max-width: 92vw"
      :bordered="false"
      segmented
    >
      <NForm>
        <NFormItem label="目标文件">
          <NInput
            v-model:value="actions.hardlinkConfigForm.value.path"
            readonly
            size="small"
          />
        </NFormItem>
        <NFormItem label="搜索目录">
          <NInput
            v-model:value="actions.hardlinkConfigForm.value.dir"
            placeholder="留空则从文件所在目录搜索"
            size="small"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton
            size="small"
            @click="actions.hardlinkConfigShow.value = false"
          >
            取消
          </NButton>
          <NButton
            type="primary"
            size="small"
            @click="actions.submitHardlinkQuery"
          >
            查询
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- 硬链接查询结果 -->
    <NModal
      v-model:show="actions.hardlinkModalShow.value"
      title="硬链接查询结果"
      preset="card"
      style="width: 520px; max-width: 92vw"
      :bordered="false"
      segmented
    >
      <NSpin :show="actions.hardlinkLoading.value">
        <div class="hardlink-list">
          <div class="hardlink-source">
            <div class="hardlink-section-label">源文件</div>
            <div class="hardlink-path">
              {{ actions.hardlinkSourceFile.value }}
            </div>
          </div>
          <div
            v-for="(links, name) in actions.hardlinkResult.value"
            :key="name"
          >
            <template v-if="links && links.length > 0">
              <div class="hardlink-section-label">
                找到 {{ links.length }} 个硬链接
              </div>
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
              <div class="hardlink-empty">
                未找到其他硬链接（该文件只有自身一个链接）
              </div>
            </template>
          </div>
        </div>
      </NSpin>
    </NModal>

    <!-- 删除确认 -->
    <NModal
      v-model:show="actions.deleteDialog.value.show"
      title="确认删除"
      preset="dialog"
      type="error"
      positive-text="删除"
      negative-text="取消"
      @positive-click="actions.confirmDelete"
    >
      <p v-if="actions.deleteDialog.value.items.length > 0">
        确定要删除以下 {{ actions.deleteDialog.value.items.length }} 项吗？
        <br />
        <strong
          v-for="item in actions.deleteDialog.value.items.slice(0, 5)"
          :key="item.path"
          class="delete-item"
        >
          {{ item.name }}
        </strong>
        <span v-if="actions.deleteDialog.value.items.length > 5">
          等 {{ actions.deleteDialog.value.items.length }} 项
        </span>
        <br />
        此操作不可恢复。
      </p>
    </NModal>

    <!-- 识别结果 -->
    <IdentifyResult
      v-model:show="actions.identifyResultShow.value"
      :loading="actions.identifyLoading.value"
      :result="actions.identifyResult.value"
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
  min-height: 0;
}

.sidebar {
  flex-shrink: 0;
  width: 260px;
  padding: 0.5rem;
  overflow-y: auto;
}

.main-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--tblr-card-border-radius);
}

.search-status {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 1rem;
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
  background-color: var(--tblr-primary-light);
  border-bottom: 1px solid hsl(var(--border));
}

.search-indexing {
  padding: 0.75rem;
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.upload-input {
  display: none;
}

.delete-item {
  display: block;
  font-size: 0.85rem;
  word-break: break-all;
}

.hardlink-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hardlink-section-label {
  margin-bottom: 0.375rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.hardlink-source {
  padding: 0.75rem;
  background-color: hsl(var(--accent) / 50%);
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}

.hardlink-path {
  font-size: 0.85rem;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
  word-break: break-all;
}

.hardlink-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hardlink-item {
  padding: 0.5rem 0.75rem;
  background-color: hsl(var(--accent) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
}

.hardlink-item-path {
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
}

.hardlink-item-name {
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
  word-break: break-all;
}

.hardlink-empty {
  padding: 1rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
  background-color: hsl(var(--accent) / 30%);
  border: 1px dashed hsl(var(--border));
  border-radius: 0.5rem;
}

@media (max-width: 767px) {
  .file-manager {
    padding: 0.5rem;
  }

  .main-content {
    border-radius: 0.375rem;
  }
}
</style>
