<script lang="ts" setup>
import { computed, h, onMounted, ref } from 'vue';

import {
  NButton,
  NCard,
  NCheckbox,
  NDropdown,
  NInput,
  NModal,
  NPagination,
  NSpace,
  NSpin,
  useNotification,
} from 'naive-ui';

import { IconifyIcon } from '@vben/icons';

import {
  deleteTransferUnknownApi,
  getUnknownListApi,
  reIdentifyUnknownApi,
} from '#/api/modules/media';
import { manualTransferUdfApi } from '#/api/modules/sync';
import EmptyState from '#/components/empty/EmptyState.vue';
import IdentifyResult from '#/components/media/IdentifyResult.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import TransferModal from '#/components/media/TransferModal.vue';
import type { TransferFormData } from '#/components/media/TransferModal.vue';
import { useMediaStore } from '#/store';

const mediaStore = useMediaStore();
const notification = useNotification();

const loading = ref(false);
const reIdentifyLoading = ref(false);
const keyword = ref('');
const currentPage = ref(1);
const pageSize = ref(30);
const total = ref(0);
const totalPage = ref(1);

const unknownList = computed(() => mediaStore.unknownList);

// 批量选择
const selectedIds = ref<number[]>([]);
const allSelected = computed(() =>
  unknownList.value.length > 0 && unknownList.value.every((item) => selectedIds.value.includes(item.id)),
);
const someSelected = computed(() =>
  selectedIds.value.length > 0 && !allSelected.value,
);

// 识别弹窗
const identifyShow = ref(false);
const identifyLoading = ref(false);
const identifyResult = ref<Record<string, any>>({});

// 转移弹窗
const transferModalShow = ref(false);
const transferPath = ref('');
const transferLoading = ref(false);

async function fetchData(page = 1) {
  loading.value = true;
  currentPage.value = page;
  selectedIds.value = [];
  try {
    const res = await getUnknownListApi({
      keyword: keyword.value || undefined,
      page,
      pagenum: pageSize.value,
    });
    if (res) {
      total.value = res.total || 0;
      totalPage.value = res.totalPage || 1;
      mediaStore.setUnknownList(res.items || []);
    }
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  fetchData(1);
}

function handlePageChange(page: number) {
  fetchData(page);
}

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id);
  if (idx > -1) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = unknownList.value.map((item) => item.id);
  }
}

async function handleReIdentify() {
  if (unknownList.value.length === 0) {
    notification.warning({ content: '当前没有未识别记录' });
    return;
  }
  reIdentifyLoading.value = true;
  try {
    await reIdentifyUnknownApi();
    notification.success({ content: '重新识别任务已提交' });
    await fetchData(1);
  } catch (err: any) {
    notification.error({ content: '提交失败', description: err?.message || '' });
  } finally {
    reIdentifyLoading.value = false;
  }
}

async function handleBatchDelete() {
  if (selectedIds.value.length === 0) {
    notification.warning({ content: '请先选择要删除的记录' });
    return;
  }
  try {
    await deleteTransferUnknownApi({ ids: selectedIds.value });
    notification.success({ content: '删除成功' });
    selectedIds.value = [];
    await fetchData(currentPage.value);
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  }
}

async function handleDelete(item: any) {
  try {
    await deleteTransferUnknownApi({ ids: [item.id] });
    notification.success({ content: '删除成功' });
    await fetchData(currentPage.value);
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  }
}

async function handleIdentify(item: any) {
  const filename = item.name || item.path?.split('/').pop() || '';
  if (!filename) {
    notification.warning({ content: '无法获取文件名' });
    return;
  }
  identifyLoading.value = true;
  try {
    const { nameTestApi } = await import('#/api/modules/media');
    const res = await nameTestApi(filename);
    identifyResult.value = res || {};
    identifyShow.value = true;
  } catch (err: any) {
    notification.error({ content: '识别失败', description: err?.message || '' });
  } finally {
    identifyLoading.value = false;
  }
}

function handleTransfer(item: any) {
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
    await fetchData(currentPage.value);
  } catch (err: any) {
    notification.error({ content: '提交失败', description: err?.message || '' });
  } finally {
    transferLoading.value = false;
  }
}

function getModeLabel(mode?: string) {
  const modeMap: Record<string, string> = {
    copy: '复制',
    link: '硬链接',
    softlink: '软链接',
    move: '移动',
    rclone: 'Rclone移动',
    rclonecopy: 'Rclone复制',
    minio: 'Minio移动',
    miniocopy: 'Minio复制',
  };
  return modeMap[mode || ''] || mode || '-';
}

function getFileExt(filename?: string) {
  if (!filename) return '?';
  const ext = filename.split('.').pop()?.toUpperCase();
  return ext || '?';
}

function getItemOptions(item: any) {
  return [
    { label: '识别', key: 'identify', icon: () => h(IconifyIcon, { icon: 'lucide:scan-line', class: 'size-4' }) },
    { label: '转移', key: 'transfer', icon: () => h(IconifyIcon, { icon: 'lucide:arrow-right-left', class: 'size-4' }) },
    { type: 'divider', key: 'd1' },
    { label: '删除', key: 'delete', icon: () => h(IconifyIcon, { icon: 'lucide:trash-2', class: 'size-4' }), props: { style: 'color: hsl(var(--destructive))' } },
  ];
}

function handleItemAction(key: string, item: any) {
  if (key === 'identify') handleIdentify(item);
  else if (key === 'transfer') handleTransfer(item);
  else if (key === 'delete') handleDelete(item);
}

onMounted(() => fetchData(1));
</script>

<template>
  <div class="p-4">
    <PageHeader title="未识别列表" subtitle="无法自动识别的媒体文件">
      <template #actions>
        <NSpace>
          <NInput
            v-model:value="keyword"
            placeholder="搜索路径..."
            style="width: 200px"
            clearable
            @keyup.enter="handleSearch"
          />
          <NButton @click="handleSearch">
            <template #icon>
              <IconifyIcon icon="lucide:search" class="size-4" />
            </template>
            搜索
          </NButton>
          <NButton @click="fetchData(currentPage)">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
            </template>
            刷新
          </NButton>
          <NButton
            type="primary"
            :loading="reIdentifyLoading"
            @click="handleReIdentify"
          >
            <template #icon>
              <IconifyIcon icon="lucide:activity" class="size-4" />
            </template>
            重新识别
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading" class="mt-4">
      <div v-if="unknownList.length > 0">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm" style="color: hsl(var(--muted-foreground))">
            共 {{ total }} 条记录
            <span v-if="selectedIds.length > 0" class="ml-2">
              已选 {{ selectedIds.length }} 条
            </span>
          </div>
          <NSpace align="center">
            <NButton
              v-if="selectedIds.length > 0"
              size="small"
              type="error"
              ghost
              @click="handleBatchDelete"
            >
              <template #icon>
                <IconifyIcon icon="lucide:trash-2" class="size-4" />
              </template>
              批量删除
            </NButton>
            <NCheckbox
              :checked="allSelected"
              :indeterminate="someSelected"
              @update:checked="toggleSelectAll"
            >
              全选本页
            </NCheckbox>
          </NSpace>
        </div>

        <div class="unknown-grid">
          <NCard
            v-for="item in unknownList"
            :key="item.id"
            size="small"
            :bordered="false"
            class="unknown-card"
          >
            <div class="flex gap-3">
              <div
                class="unknown-poster-wrapper flex items-center justify-center"
                :style="{ backgroundColor: 'hsl(var(--warning) / 0.12)' }"
              >
                <span class="text-xs font-bold" style="color: hsl(var(--warning))">
                  {{ getFileExt(item.name) }}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="unknown-name truncate" :title="item.name">
                    {{ item.name || '-' }}
                  </div>
                  <NCheckbox
                    :checked="selectedIds.includes(item.id)"
                    @update:checked="() => toggleSelect(item.id)"
                  />
                </div>
                <div class="unknown-path truncate" :title="item.path">
                  <IconifyIcon icon="lucide:folder" class="size-3 inline mr-1" />
                  {{ item.path }}
                </div>
                <div v-if="item.to" class="unknown-dest truncate" :title="item.to">
                  <IconifyIcon icon="lucide:arrow-right-to-line" class="size-3 inline mr-1" />
                  {{ item.to }}
                </div>
                <div class="unknown-meta">
                  <span class="unknown-tag">未识别</span>
                  <span class="unknown-mode">{{ getModeLabel(item.rmt_mode || item.sync_mode) }}</span>
                </div>
                <div class="unknown-footer">
                  <NDropdown
                    :options="getItemOptions(item)"
                    @select="(key: string) => handleItemAction(key, item)"
                  >
                    <NButton size="tiny" text @click.stop>
                      <template #icon>
                        <IconifyIcon icon="lucide:more-vertical" class="size-4" />
                      </template>
                    </NButton>
                  </NDropdown>
                </div>
              </div>
            </div>
          </NCard>
        </div>

        <div class="mt-4 flex justify-end">
          <NPagination
            v-model:page="currentPage"
            :page-size="pageSize"
            :page-count="totalPage"
            @update:page="handlePageChange"
          />
        </div>
      </div>

      <EmptyState
        v-else
        title="暂无未识别记录"
        subtitle="所有媒体文件均已正确识别"
      >
        <template #icon>
          <IconifyIcon
            icon="lucide:check-circle"
            class="size-16"
            style="color: hsl(var(--success))"
          />
        </template>
      </EmptyState>
    </NSpin>

    <!-- 识别结果 -->
    <IdentifyResult
      v-model:show="identifyShow"
      :loading="identifyLoading"
      :result="identifyResult"
    />

    <!-- 转移弹窗 -->
    <TransferModal
      v-model:show="transferModalShow"
      :path="transferPath"
      :loading="transferLoading"
      @submit="submitTransfer"
    />
  </div>
</template>

<style scoped>
.unknown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 0.75rem;
}

.unknown-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition: box-shadow 0.2s, border-color 0.2s;
}

.unknown-card:hover {
  box-shadow: 0 4px 16px hsl(var(--foreground) / 0.1);
  border-color: hsl(var(--primary) / 0.25);
}

.unknown-poster-wrapper {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.unknown-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
  margin-bottom: 0.25rem;
}

.unknown-path {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.125rem;
  font-family: monospace;
  word-break: break-all;
}

.unknown-dest {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.25rem;
  font-family: monospace;
  word-break: break-all;
}

.unknown-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
}

.unknown-tag {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
  font-weight: 500;
}

.unknown-mode {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.unknown-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 0.25rem;
  padding-top: 0.375rem;
  border-top: 1px solid hsl(var(--border));
}

@media (max-width: 640px) {
  .unknown-grid {
    grid-template-columns: 1fr;
  }

  .unknown-poster-wrapper {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
