<script lang="ts" setup>
import type { FileTarget, HistoryItem } from './types';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { useMediaQuery } from '@vueuse/core';
import { NButton, NInput, NPagination } from 'naive-ui';

import {
  checkHistoryFilesApi,
  clearTransferHistoryApi,
  deleteHistoryFilesApi,
  deleteHistoryRecordsApi,
  getTransferHistoryApi,
  getTransferStatisticsApi,
} from '#/api/modules/media';
import { reIdentifyTransferHistoryApi } from '#/api/modules/sync';
import PageHeader from '#/components/page/PageHeader.vue';
import { useMediaStore } from '#/store';
import { useAppNotification } from '#/utils/notify';

import DeleteConfirmDialog from './components/DeleteConfirmDialog.vue';
import HistoryDetail from './components/HistoryDetail.vue';
import HistoryList from './components/HistoryList.vue';
import ManualIdentifyModal from './components/ManualIdentifyModal.vue';
import { joinPath } from './types';

type TypeFilter = '' | 'anime' | 'movie' | 'tv';

interface DeleteDialogState {
  confirmText: string;
  description: string;
  ids: number[];
  kind: 'clear' | 'files' | 'record';
  paths: string[];
  target?: FileTarget;
  title: string;
}

const mediaStore = useMediaStore();
const notification = useAppNotification();

const loading = ref(false);
const actionBusy = ref(false);
const keyword = ref('');
const typeFilter = ref<TypeFilter>('');
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const totalPage = ref(1);
const selectedId = ref<null | number>(null);
const isMobile = useMediaQuery('(max-width: 768px)');
const mobileDetailOpen = ref(false);
const selectedIds = ref<number[]>([]);
const manualShow = ref(false);
const manualItem = ref<HistoryItem | null>(null);
const deleteDialog = ref<DeleteDialogState | null>(null);

const items = computed(() => mediaStore.transferHistory);
const selectedRecord = computed(
  () => items.value.find((item) => item.ID === selectedId.value) || null,
);
const statisticTotals = computed(() => {
  const stats = mediaStore.transferStatistics;
  if (!stats) return { anime: 0, movie: 0, tv: 0 };
  return {
    movie: stats.movie_nums.reduce((sum, value) => sum + value, 0),
    tv: stats.tv_nums.reduce((sum, value) => sum + value, 0),
    anime: stats.anime_nums.reduce((sum, value) => sum + value, 0),
  };
});

const allTotal = computed(() => {
  const sum =
    statisticTotals.value.movie +
    statisticTotals.value.tv +
    statisticTotals.value.anime;
  return sum || total.value;
});

const typeOptions: Array<{ label: string; value: TypeFilter }> = [
  { label: '全部', value: '' },
  { label: '电影', value: 'movie' },
  { label: '电视剧', value: 'tv' },
  { label: '动漫', value: 'anime' },
];

const selectedCountText = computed(() => `已选 ${selectedIds.value.length} 条`);
const deletePaths = computed(() => {
  const state = deleteDialog.value;
  const record = selectedRecord.value;
  if (!state || state.kind !== 'files' || !record) return [];
  if (state.target === 'source') {
    return [joinPath(record.SOURCE_PATH, record.SOURCE_FILENAME)].filter(
      Boolean,
    );
  }
  return [joinPath(record.DEST_PATH, record.DEST_FILENAME)].filter(Boolean);
});
const deleteDescription = computed(() => {
  const state = deleteDialog.value;
  if (!state) return '';
  if (state.kind === 'record') {
    return '将移除选中的识别记录，并同步移除对应黑名单。此操作不会删除任何源文件或媒体库文件，且不可恢复。';
  }
  if (state.kind === 'clear') {
    return '将清空所有识别记录与对应黑名单。此操作不会删除任何源文件或媒体库文件，且不可恢复。';
  }
  return '文件将被永久删除，识别记录会保留并标记该文件已删除。此操作不可恢复。';
});

async function fetchData(page = 1, keepSelection = false) {
  loading.value = true;
  currentPage.value = page;
  if (!keepSelection) {
    selectedIds.value = [];
    if (isMobile.value) mobileDetailOpen.value = false;
  }
  try {
    const response = await getTransferHistoryApi({
      keyword: keyword.value.trim() || undefined,
      page,
      pagenum: pageSize.value,
      type: typeFilter.value || undefined,
    });
    total.value = response?.total || 0;
    totalPage.value = response?.totalPage || 1;
    mediaStore.setTransferHistory(response?.result || []);

    if (items.value.length === 0 && page > 1) {
      loading.value = false;
      await fetchData(page - 1);
      return;
    }

    if (keepSelection && selectedId.value) {
      const exists = items.value.some((item) => item.ID === selectedId.value);
      if (!exists) selectedId.value = items.value[0]?.ID ?? null;
    } else {
      selectedId.value = items.value[0]?.ID ?? null;
    }
  } finally {
    loading.value = false;
  }
}

async function fetchStatistics() {
  try {
    const response = await getTransferStatisticsApi(0);
    mediaStore.setTransferStatistics(response || null);
  } catch {
    // 统计失败不影响主列表
  }
}

function handleSearch() {
  fetchData(1);
}

function setTypeFilter(value: TypeFilter) {
  if (typeFilter.value === value) return;
  typeFilter.value = value;
  fetchData(1);
}

function handlePageChange(page: number) {
  fetchData(page);
}

function handleSelect(item: HistoryItem) {
  selectedId.value = item.ID;
  if (isMobile.value) mobileDetailOpen.value = true;
}

function toggleSelectAll() {
  const ids = items.value.map((item) => item.ID);
  const allSelected =
    ids.length > 0 && ids.every((id) => selectedIds.value.includes(id));
  selectedIds.value = allSelected ? [] : ids;
}

function toggleSelect(id: number) {
  const index = selectedIds.value.indexOf(id);
  if (index === -1) selectedIds.value.push(id);
  else selectedIds.value.splice(index, 1);
}

async function handleReidentify(item: HistoryItem) {
  actionBusy.value = true;
  try {
    await reIdentifyTransferHistoryApi({ ids: [item.ID] });
    notification.success('重新识别任务已提交');
    await fetchData(currentPage.value, true);
    await fetchStatistics();
  } catch (error: any) {
    notification.error('提交失败', { description: error?.message || '' });
  } finally {
    actionBusy.value = false;
  }
}

function handleManual(item: HistoryItem) {
  manualItem.value = item;
  manualShow.value = true;
}

async function handleManualSuccess() {
  await fetchData(currentPage.value, true);
  await fetchStatistics();
}

function openDeleteRecord(item: HistoryItem) {
  deleteDialog.value = {
    kind: 'record',
    ids: [item.ID],
    paths: [],
    title: '移除识别记录',
    description: '',
    confirmText: '移除记录',
  };
}

function openBulkDeleteRecords() {
  if (selectedIds.value.length === 0) {
    notification.warning('请先选择记录');
    return;
  }
  deleteDialog.value = {
    kind: 'record',
    ids: [...selectedIds.value],
    paths: [],
    title: `移除 ${selectedIds.value.length} 条识别记录`,
    description: '',
    confirmText: '移除记录',
  };
}

function openDeleteFile(item: HistoryItem, target: FileTarget) {
  selectedId.value = item.ID;
  deleteDialog.value = {
    kind: 'files',
    ids: [item.ID],
    target,
    paths: [],
    title: target === 'source' ? '删除源文件' : '删除媒体库文件',
    description: '',
    confirmText: target === 'source' ? '删除源文件' : '删除媒体库文件',
  };
}

function openClear() {
  deleteDialog.value = {
    kind: 'clear',
    ids: [],
    paths: [],
    title: '清空识别记录',
    description: '',
    confirmText: '清空记录',
  };
}

async function confirmDelete() {
  const state = deleteDialog.value;
  if (!state) return;
  actionBusy.value = true;
  try {
    if (state.kind === 'record') {
      const result = await deleteHistoryRecordsApi(state.ids);
      const deleted = result?.deleted ?? state.ids.length;
      notification.success(`已移除 ${deleted} 条识别记录`);
      selectedIds.value = selectedIds.value.filter(
        (id) => !state.ids.includes(id),
      );
      await fetchData(currentPage.value, true);
      if (isMobile.value) mobileDetailOpen.value = false;
    } else if (state.kind === 'clear') {
      await clearTransferHistoryApi();
      notification.success('所有识别记录已清空');
      await fetchData(1);
      if (isMobile.value) mobileDetailOpen.value = false;
    } else if (state.target && state.ids[0]) {
      const result = await deleteHistoryFilesApi(state.ids, [state.target]);
      const failed = (result?.results || []).filter(
        (item) => item.status === 'failed',
      );
      if (failed.length > 0) {
        notification.warning('部分文件删除失败', {
          description: failed.map((item) => item.message).join('；'),
        });
      } else {
        notification.success(state.title + '成功');
      }
      await fetchData(currentPage.value, true);
    }
    await fetchStatistics();
  } catch (error: any) {
    notification.error('操作失败', { description: error?.message || '' });
  } finally {
    actionBusy.value = false;
    deleteDialog.value = null;
  }
}

async function handleCheckFiles(item: HistoryItem) {
  actionBusy.value = true;
  try {
    await checkHistoryFilesApi([item.ID]);
    notification.success('文件状态已更新');
    await fetchData(currentPage.value, true);
  } catch (error: any) {
    notification.error('检测失败', { description: error?.message || '' });
  } finally {
    actionBusy.value = false;
  }
}

onMounted(async () => {
  await Promise.all([fetchData(1), fetchStatistics()]);
});
</script>

<template>
  <div
    class="history-page"
    :class="{ 'is-mobile-detail': isMobile && mobileDetailOpen }"
  >
    <template v-if="!isMobile || !mobileDetailOpen">
      <PageHeader
        title="识别历史"
        subtitle="查看媒体文件的识别、转移与文件状态"
      >
        <template #actions>
          <div class="head-actions">
            <NInput
              v-model:value="keyword"
              class="search-input"
              placeholder="搜索标题或源文件名..."
              clearable
              @keyup.enter="handleSearch"
            />
            <NButton aria-label="搜索" @click="handleSearch">
              <template #icon>
                <IconifyIcon icon="lucide:search" class="size-4" />
              </template>
              <span class="hide-sm">搜索</span>
            </NButton>
            <NButton aria-label="刷新" @click="fetchData(currentPage, true)">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
              </template>
              <span class="hide-sm">刷新</span>
            </NButton>
            <NButton
              type="error"
              ghost
              aria-label="清空记录"
              @click="openClear"
            >
              <template #icon>
                <IconifyIcon icon="lucide:eraser" class="size-4" />
              </template>
              清空记录
            </NButton>
          </div>
        </template>
      </PageHeader>

      <section class="stats" aria-label="识别统计">
        <div class="stat">
          <span class="stat-icon tone-primary">
            <IconifyIcon icon="lucide:layers" class="size-5" />
          </span>
          <div>
            <div class="stat-label">全部记录</div>
            <div class="stat-value">{{ allTotal.toLocaleString() }}</div>
          </div>
        </div>
        <div class="stat">
          <span class="stat-icon tone-success">
            <IconifyIcon icon="lucide:film" class="size-5" />
          </span>
          <div>
            <div class="stat-label">电影</div>
            <div class="stat-value">
              {{ statisticTotals.movie.toLocaleString() }}
            </div>
          </div>
        </div>
        <div class="stat">
          <span class="stat-icon tone-warning">
            <IconifyIcon icon="lucide:tv" class="size-5" />
          </span>
          <div>
            <div class="stat-label">电视剧</div>
            <div class="stat-value">
              {{ statisticTotals.tv.toLocaleString() }}
            </div>
          </div>
        </div>
        <div class="stat">
          <span class="stat-icon tone-info">
            <IconifyIcon icon="lucide:sparkles" class="size-5" />
          </span>
          <div>
            <div class="stat-label">动漫</div>
            <div class="stat-value">
              {{ statisticTotals.anime.toLocaleString() }}
            </div>
          </div>
        </div>
      </section>

      <section class="toolbar">
        <div class="type-filter" role="tablist" aria-label="媒体类型">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            type="button"
            role="tab"
            :aria-selected="typeFilter === option.value"
            :class="{ 'is-active': typeFilter === option.value }"
            @click="setTypeFilter(option.value)"
          >
            {{ option.label }}
          </button>
        </div>

        <div v-if="selectedIds.length > 0" class="bulk-bar">
          <span>{{ selectedCountText }}</span>
          <NButton
            size="tiny"
            quaternary
            type="error"
            @click="openBulkDeleteRecords"
          >
            <template #icon>
              <IconifyIcon icon="lucide:eraser" class="size-3.5" />
            </template>
            删除记录
          </NButton>
        </div>

        <span v-else class="toolbar-meta">
          共 {{ total.toLocaleString() }} 条 · 第 {{ currentPage }} /
          {{ totalPage }} 页
        </span>
      </section>
    </template>

    <div
      class="history-layout"
      :class="{ 'is-mobile-detail': isMobile && mobileDetailOpen }"
    >
      <div v-show="!isMobile || !mobileDetailOpen" class="list-column">
        <HistoryList
          :items="items"
          :selected-id="selectedId"
          :selected-ids="selectedIds"
          @select="handleSelect"
          @toggle-all="toggleSelectAll"
          @toggle-select="toggleSelect"
        />
        <div class="pager">
          <NPagination
            :page="currentPage"
            :page-count="totalPage"
            :page-size="pageSize"
            :item-count="total"
            size="small"
            @update:page="handlePageChange"
          />
        </div>
      </div>

      <HistoryDetail
        v-show="!isMobile || mobileDetailOpen"
        :item="selectedRecord"
        :loading="loading"
        :busy="actionBusy"
        :mobile="isMobile"
        @close="mobileDetailOpen = false"
        @check-files="selectedRecord && handleCheckFiles(selectedRecord)"
        @delete-file="selectedRecord && openDeleteFile(selectedRecord, $event)"
        @delete-record="selectedRecord && openDeleteRecord(selectedRecord)"
        @manual="selectedRecord && handleManual(selectedRecord)"
        @reidentify="selectedRecord && handleReidentify(selectedRecord)"
      />
    </div>

    <DeleteConfirmDialog
      :show="Boolean(deleteDialog)"
      :title="deleteDialog?.title || ''"
      :description="deleteDialog?.description || deleteDescription"
      :paths="deleteDialog?.kind === 'files' ? deletePaths : []"
      :confirm-text="deleteDialog?.confirmText || '确认'"
      :loading="actionBusy"
      @update:show="(value) => !value && (deleteDialog = null)"
      @confirm="confirmDelete"
    />

    <ManualIdentifyModal
      v-model:show="manualShow"
      :item="manualItem"
      @success="handleManualSuccess"
    />
  </div>
</template>

<style scoped>
.history-page {
  padding: 16px;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.search-input {
  width: 230px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.stat {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 12px 14px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.stat-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
}

.tone-primary {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
}

.tone-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.tone-warning {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.tone-info {
  color: hsl(var(--info, var(--primary)));
  background: hsl(var(--info, var(--primary)) / 10%);
}

.stat-label {
  margin-bottom: 2px;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.stat-value {
  font-size: 1.16rem;
  font-weight: 650;
  line-height: 1.1;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 9px 11px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.type-filter {
  display: inline-flex;
  padding: 2px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
}

.type-filter button {
  height: 27px;
  padding: 0 11px;
  font-size: 0.74rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.type-filter button:hover {
  color: hsl(var(--foreground));
}

.type-filter button.is-active {
  font-weight: 600;
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.bulk-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.73rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 6px;
}

.toolbar-meta {
  margin-left: auto;
  font-size: 0.73rem;
  color: hsl(var(--muted-foreground));
}

.history-layout {
  display: grid;
  grid-template-columns: minmax(330px, 390px) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}

.list-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.pager {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  padding: 0 2px;
}

/* 桌面端左右两栏使用同一高度，底部严格对齐；列表和详情各自内部滚动 */
@media (min-width: 1025px) {
  .history-layout {
    --pane-height: max(560px, calc(100vh - 340px));
  }

  .list-column {
    height: var(--pane-height);
  }

  .list-column :deep(.history-list) {
    flex: 1;
    min-height: 0;
  }

  .list-column :deep(.list-scroll) {
    flex: 1;
    min-height: 0;
    max-height: none;
  }

  .history-layout :deep(.history-detail) {
    height: var(--pane-height);
    min-height: 0;
    overflow-y: auto;
  }

  .history-layout :deep(.detail-tabs) {
    position: sticky;
    top: 0;
    z-index: 4;
    background: hsl(var(--card));
  }
}

@media (max-width: 1024px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .history-layout {
    grid-template-columns: 1fr;
  }

  .search-input {
    width: 180px;
  }
}

@media (max-width: 640px) {
  .history-page {
    padding: 10px;
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .stat {
    gap: 8px;
    padding: 9px 10px;
  }

  .stat-icon {
    width: 30px;
    height: 30px;
  }

  .stat-value {
    font-size: 1rem;
  }

  .head-actions {
    gap: 6px;
    width: 100%;
  }

  .search-input {
    flex: 1 1 100%;
    width: 100%;
  }

  .hide-sm {
    display: none;
  }

  .type-filter {
    width: 100%;
  }

  .type-filter button {
    flex: 1;
    padding: 0 4px;
  }

  .bulk-bar {
    justify-content: space-between;
    width: 100%;
  }

  .toolbar-meta {
    width: 100%;
    margin-left: 0;
    text-align: right;
  }

  .pager {
    justify-content: center;
  }

  .history-page.is-mobile-detail {
    padding: 0;
  }

  .history-page.is-mobile-detail .history-layout {
    gap: 0;
  }
}
</style>
