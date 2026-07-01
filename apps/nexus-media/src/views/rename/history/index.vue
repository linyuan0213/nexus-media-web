<script lang="ts" setup>
import { computed, h, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NDropdown,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
} from 'naive-ui';

import {
  clearTransferHistoryApi,
  getTransferHistoryApi,
  getTransferStatisticsApi,
  searchMediaApi,
} from '#/api/modules/media';
import {
  deleteTransferHistoryApi,
  manualTransferApi,
  reIdentifyTransferHistoryApi,
  SYNC_MODES,
} from '#/api/modules/sync';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useMediaStore } from '#/store';
import { useAppNotification } from '#/utils/notify';

const mediaStore = useMediaStore();
const notification = useAppNotification();

const loading = ref(false);
const keyword = ref('');
const currentPage = ref(1);
const pageSize = ref(30);
const total = ref(0);
const totalPage = ref(1);
const clearModalShow = ref(false);
const deleteModalShow = ref(false);
const deletePayload = ref<null | {
  flag: string;
  label: string;
  logids: number[];
}>(null);
const selectedIds = ref<number[]>([]);

// manual identify modal
const manualModalShow = ref(false);
const manualLoading = ref(false);
const manualForm = ref({
  logid: 0,
  path: '',
  syncmod: 'copy',
  type: 'movie',
  tmdb: undefined as number | undefined,
  season: undefined as number | undefined,
  min_filesize: undefined as number | undefined,
  episode_format: '',
  episode_details: '',
  episode_part: '',
  episode_offset: '',
});

// tmdb search modal
const tmdbSearchShow = ref(false);
const tmdbSearchKeyword = ref('');
const tmdbSearchLoading = ref(false);
const tmdbSearchResults = ref<any[]>([]);

const historyList = computed(() => mediaStore.transferHistory);
const statistics = computed(() => mediaStore.transferStatistics);

const allSelected = computed(() => {
  if (historyList.value.length === 0) return false;
  return historyList.value.every((item) => selectedIds.value.includes(item.ID));
});

const someSelected = computed(() => {
  return (
    selectedIds.value.length > 0 &&
    selectedIds.value.length < historyList.value.length
  );
});

const statTotals = computed(() => {
  const s = statistics.value;
  if (!s) return { movie: 0, tv: 0, anime: 0 };
  const movie = s.movie_nums.reduce((a, b) => a + b, 0);
  const tv = s.tv_nums.reduce((a, b) => a + b, 0);
  const anime = s.anime_nums.reduce((a, b) => a + b, 0);
  return { movie, tv, anime };
});

async function fetchData(page = 1) {
  loading.value = true;
  currentPage.value = page;
  selectedIds.value = [];
  try {
    const res = await getTransferHistoryApi({
      keyword: keyword.value || undefined,
      page,
      pagenum: pageSize.value,
    });
    if (res) {
      total.value = res.total || 0;
      totalPage.value = res.totalPage || 1;
      mediaStore.setTransferHistory(res.result || []);
    }
  } finally {
    loading.value = false;
  }
}

async function fetchStatistics() {
  try {
    const res = await getTransferStatisticsApi(0);
    mediaStore.setTransferStatistics(res || null);
  } catch {
    // ignore
  }
}

function handleSearch() {
  fetchData(1);
}

function handlePageChange(page: number) {
  fetchData(page);
}

function handleClear() {
  clearModalShow.value = true;
}

async function confirmClear() {
  try {
    await clearTransferHistoryApi();
    notification.success('所有识别记录已清空');
    await fetchData(1);
    await fetchStatistics();
  } catch (error: any) {
    notification.error('清空失败', { description: error?.message || '' });
  } finally {
    clearModalShow.value = false;
  }
}

// batch selection
function toggleSelectAll() {
  selectedIds.value = allSelected.value
    ? []
    : historyList.value.map((item) => item.ID);
}

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id);
  if (idx === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(idx, 1);
  }
}

// single operations
function getItemOptions(_item: any) {
  return [
    {
      label: '重新识别',
      key: 'reidentify',
      icon: () => h(IconifyIcon, { icon: 'lucide:activity', class: 'size-4' }),
    },
    {
      label: '手动识别',
      key: 'manual',
      icon: () => h(IconifyIcon, { icon: 'lucide:pencil', class: 'size-4' }),
    },
    { type: 'divider', key: 'd1' },
    {
      label: '删除记录',
      key: 'del_log',
      icon: () => h(IconifyIcon, { icon: 'lucide:eraser', class: 'size-4' }),
    },
    {
      label: '删除源文件',
      key: 'del_source',
      icon: () => h(IconifyIcon, { icon: 'lucide:file-x', class: 'size-4' }),
      props: { style: 'color: hsl(var(--destructive))' },
    },
    {
      label: '删除媒体库文件',
      key: 'del_dest',
      icon: () => h(IconifyIcon, { icon: 'lucide:library', class: 'size-4' }),
      props: { style: 'color: hsl(var(--destructive))' },
    },
    {
      label: '删除源及媒体库文件',
      key: 'del_all',
      icon: () => h(IconifyIcon, { icon: 'lucide:trash-2', class: 'size-4' }),
      props: { style: 'color: hsl(var(--destructive))' },
    },
  ];
}

function getBulkOptions() {
  return [
    {
      label: '删除记录',
      key: 'del_log',
      icon: () => h(IconifyIcon, { icon: 'lucide:eraser', class: 'size-4' }),
    },
    {
      label: '删除源文件',
      key: 'del_source',
      icon: () => h(IconifyIcon, { icon: 'lucide:file-x', class: 'size-4' }),
      props: { style: 'color: hsl(var(--destructive))' },
    },
    {
      label: '删除媒体库文件',
      key: 'del_dest',
      icon: () => h(IconifyIcon, { icon: 'lucide:library', class: 'size-4' }),
      props: { style: 'color: hsl(var(--destructive))' },
    },
    {
      label: '删除源及媒体库文件',
      key: 'del_all',
      icon: () => h(IconifyIcon, { icon: 'lucide:trash-2', class: 'size-4' }),
      props: { style: 'color: hsl(var(--destructive))' },
    },
  ];
}

function handleItemAction(key: string, item: any) {
  if (key === 'reidentify') {
    doReIdentify([item.ID]);
  } else if (key === 'manual') {
    openManualModal(item);
  } else if (key.startsWith('del_')) {
    const labels: Record<string, string> = {
      del_log: '删除记录',
      del_source: '删除源文件',
      del_dest: '删除媒体库文件',
      del_all: '删除源及媒体库文件',
    };
    deletePayload.value = {
      logids: [item.ID],
      flag: key === 'del_log' ? '' : key,
      label: labels[key] ?? '',
    };
    deleteModalShow.value = true;
  }
}

function handleBulkAction(key: string) {
  if (selectedIds.value.length === 0) {
    notification.warning('请先选择记录');
    return;
  }
  const labels: Record<string, string> = {
    del_log: '删除记录',
    del_source: '删除源文件',
    del_dest: '删除媒体库文件',
    del_all: '删除源及媒体库文件',
  };
  deletePayload.value = {
    logids: [...selectedIds.value],
    flag: key === 'del_log' ? '' : key,
    label: labels[key] ?? '',
  };
  deleteModalShow.value = true;
}

async function doReIdentify(ids: number[]) {
  try {
    await reIdentifyTransferHistoryApi({ ids });
    notification.success('重新识别任务已提交');
    await fetchData(currentPage.value);
    await fetchStatistics();
  } catch (error: any) {
    notification.error('提交失败', { description: error?.message || '' });
  }
}

async function confirmDelete() {
  if (!deletePayload.value) return;
  try {
    const payload: any = { logids: deletePayload.value.logids };
    if (deletePayload.value.flag) {
      payload.flag = deletePayload.value.flag;
    }
    await deleteTransferHistoryApi(payload);
    notification.success(`${deletePayload.value.label} 成功`);
    selectedIds.value = selectedIds.value.filter(
      (id) => !deletePayload.value!.logids.includes(id),
    );
    await fetchData(currentPage.value);
    await fetchStatistics();
  } catch (error: any) {
    notification.error('删除失败', { description: error?.message || '' });
  } finally {
    deleteModalShow.value = false;
    deletePayload.value = null;
  }
}

// manual identify modal
function openManualModal(item: any) {
  manualForm.value = {
    logid: item.ID,
    path: item.SOURCE_PATH ? `${item.SOURCE_PATH}/${item.SOURCE_FILENAME}` : '',
    syncmod: item.SYNC_MODE || 'copy',
    type:
      item.TYPE === 'movie' ? 'movie' : item.TYPE === 'anime' ? 'anime' : 'tv',
    tmdb: item.TMDBID || undefined,
    season: undefined,
    min_filesize: undefined,
    episode_format: '',
    episode_details: '',
    episode_part: '',
    episode_offset: '',
  };
  manualModalShow.value = true;
}

function openTmdbSearch() {
  tmdbSearchShow.value = true;
  tmdbSearchKeyword.value = manualForm.value.tmdb
    ? ''
    : manualForm.value.path
      ? manualForm.value.path
          .split('/')
          .pop()
          ?.replace(/\.\w+$/, '') || ''
      : '';
  tmdbSearchResults.value = [];
}

async function handleTmdbSearch() {
  if (!tmdbSearchKeyword.value.trim()) return;
  tmdbSearchLoading.value = true;
  try {
    const res: any = await searchMediaApi({
      keyword: tmdbSearchKeyword.value,
      searchtype: 'tmdb',
    });
    const raw = Array.isArray(res) ? res : res?.data || [];
    tmdbSearchResults.value = raw;
  } catch (error: any) {
    notification.error('搜索失败', { description: error?.message || '' });
  } finally {
    tmdbSearchLoading.value = false;
  }
}

function selectTmdbMedia(media: any) {
  manualForm.value.tmdb = media.id || media.tmdb_id || undefined;
  tmdbSearchShow.value = false;
  tmdbSearchResults.value = [];
}

function getImgUrl(url?: string) {
  if (!url) return '/static/img/no-image.png';
  if (url.startsWith('http')) return `/img?url=${url}`;
  return url;
}

async function submitManual() {
  manualLoading.value = true;
  try {
    await manualTransferApi({
      logid: manualForm.value.logid,
      syncmod: manualForm.value.syncmod,
      tmdb: manualForm.value.tmdb,
      type: manualForm.value.type,
      season: manualForm.value.season,
      min_filesize: manualForm.value.min_filesize,
      episode_format: manualForm.value.episode_format || undefined,
      episode_details: manualForm.value.episode_details || undefined,
      episode_part: manualForm.value.episode_part || undefined,
      episode_offset: manualForm.value.episode_offset || undefined,
    });
    notification.success('手动识别成功');
    manualModalShow.value = false;
    await fetchData(currentPage.value);
    await fetchStatistics();
  } catch (error: any) {
    notification.error('手动识别失败', { description: error?.message || '' });
  } finally {
    manualLoading.value = false;
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getTypeIcon(type: string = '') {
  if (type === 'movie') return 'lucide:film';
  if (type === 'anime') return 'lucide:sparkles';
  return 'lucide:tv';
}

function getTypeColor(type: string = '') {
  if (type === 'movie') return 'var(--primary)';
  if (type === 'anime') return 'var(--warning)';
  return 'var(--success)';
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    电影: '电影',
    电视剧: '电视剧',
    动漫: '动漫',
    movie: '电影',
    tv: '电视剧',
    anime: '动漫',
  };
  return map[type] || type || '-';
}

function getModeLabel(row: any) {
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
  const raw = row.RMT_MODE || row.MODE || '';
  return modeMap[raw] || raw || '-';
}

onMounted(() => {
  fetchData(1);
  fetchStatistics();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="识别历史" subtitle="查看媒体文件识别与转移记录">
      <template #actions>
        <NSpace>
          <NInput
            v-model:value="keyword"
            placeholder="搜索标题..."
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
          <NDropdown
            :options="getBulkOptions()"
            :disabled="selectedIds.length === 0"
            @select="(key: string) => handleBulkAction(key)"
          >
            <NButton type="error" ghost :disabled="selectedIds.length === 0">
              <template #icon>
                <IconifyIcon icon="lucide:trash-2" class="size-4" />
              </template>
              批量删除
              <IconifyIcon icon="lucide:chevron-down" class="size-3 ml-1" />
            </NButton>
          </NDropdown>
          <NButton type="error" ghost @click="handleClear">
            <template #icon>
              <IconifyIcon icon="lucide:eraser" class="size-4" />
            </template>
            清空记录
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <!-- 统计卡片 -->
    <div class="stats-grid mt-4">
      <NCard size="small" :bordered="false" class="stat-card">
        <div class="flex items-center gap-3">
          <div
            class="stat-icon-wrapper"
            style="background-color: hsl(var(--primary) / 10%)"
          >
            <IconifyIcon
              icon="lucide:film"
              class="size-5"
              style="color: hsl(var(--primary))"
            />
          </div>
          <div>
            <div class="stat-label">电影</div>
            <div class="stat-value">{{ statTotals.movie }}</div>
          </div>
        </div>
      </NCard>
      <NCard size="small" :bordered="false" class="stat-card">
        <div class="flex items-center gap-3">
          <div
            class="stat-icon-wrapper"
            style="background-color: hsl(var(--success) / 10%)"
          >
            <IconifyIcon
              icon="lucide:tv"
              class="size-5"
              style="color: hsl(var(--success))"
            />
          </div>
          <div>
            <div class="stat-label">电视剧</div>
            <div class="stat-value">{{ statTotals.tv }}</div>
          </div>
        </div>
      </NCard>
      <NCard size="small" :bordered="false" class="stat-card">
        <div class="flex items-center gap-3">
          <div
            class="stat-icon-wrapper"
            style="background-color: hsl(var(--warning) / 10%)"
          >
            <IconifyIcon
              icon="lucide:sparkles"
              class="size-5"
              style="color: hsl(var(--warning))"
            />
          </div>
          <div>
            <div class="stat-label">动漫</div>
            <div class="stat-value">{{ statTotals.anime }}</div>
          </div>
        </div>
      </NCard>
    </div>

    <NSpin :show="loading" class="mt-4">
      <div v-if="historyList.length > 0">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm" style="color: hsl(var(--muted-foreground))">
            共 {{ total }} 条记录
            <span v-if="selectedIds.length > 0" class="ml-2">
              已选 {{ selectedIds.length }} 条
            </span>
          </div>
          <NCheckbox
            :checked="allSelected"
            :indeterminate="someSelected"
            @update:checked="toggleSelectAll"
          >
            全选本页
          </NCheckbox>
        </div>

        <div class="history-grid">
          <NCard
            v-for="item in historyList"
            :key="item.ID"
            size="small"
            :bordered="false"
            class="history-card"
          >
            <div class="flex gap-3">
              <div
                class="history-poster-wrapper flex items-center justify-center"
                :style="{
                  backgroundColor: `hsl(${getTypeColor(item.TYPE)} / 0.12)`,
                }"
              >
                <IconifyIcon
                  :icon="getTypeIcon(item.TYPE)"
                  class="size-6"
                  :style="{ color: `hsl(${getTypeColor(item.TYPE)})` }"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="history-title truncate">
                    {{ item.TITLE || '-' }}
                    <span v-if="item.YEAR" class="history-year"
                      >({{ item.YEAR }})</span
                    >
                  </div>
                  <NCheckbox
                    :checked="selectedIds.includes(item.ID)"
                    @update:checked="() => toggleSelect(item.ID)"
                  />
                </div>
                <div class="history-meta">
                  <span class="history-tag">{{ getTypeLabel(item.TYPE) }}</span>
                  <span v-if="item.SEASON_EPISODE" class="history-tag">
                    {{ item.SEASON_EPISODE }}
                  </span>
                  <span class="history-mode">{{ getModeLabel(item) }}</span>
                </div>
                <div v-if="item.SOURCE_FILENAME" class="history-path truncate">
                  <IconifyIcon
                    icon="lucide:arrow-right-from-line"
                    class="size-3 inline mr-1 source-icon"
                  />
                  {{ item.SOURCE_FILENAME }}
                </div>
                <div v-if="item.DEST_FILENAME" class="history-path truncate">
                  <IconifyIcon
                    icon="lucide:arrow-right-to-line"
                    class="size-3 inline mr-1 dest-icon"
                  />
                  {{ item.DEST_FILENAME }}
                </div>
                <div class="history-footer">
                  <span class="history-date">{{ formatDate(item.DATE) }}</span>
                  <NDropdown
                    :options="getItemOptions(item)"
                    @select="(key: string) => handleItemAction(key, item)"
                  >
                    <NButton size="tiny" text @click.stop>
                      <template #icon>
                        <IconifyIcon
                          icon="lucide:more-vertical"
                          class="size-4"
                        />
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

      <EmptyState v-else title="暂无识别历史" subtitle="还没有媒体文件识别记录">
        <template #icon>
          <IconifyIcon
            icon="lucide:clock"
            class="size-16"
            style="color: hsl(var(--muted-foreground))"
          />
        </template>
      </EmptyState>
    </NSpin>

    <!-- 清空确认 -->
    <NModal
      v-model:show="clearModalShow"
      title="确认清空记录"
      preset="dialog"
      type="warning"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmClear"
    >
      <p>确定要清空所有识别历史记录吗？此操作不可恢复。</p>
    </NModal>

    <!-- 删除确认 -->
    <NModal
      v-model:show="deleteModalShow"
      title="确认删除"
      preset="dialog"
      type="error"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmDelete"
    >
      <p v-if="deletePayload">
        确定要执行 <strong>{{ deletePayload.label }}</strong> 吗？
        <br />
        共 {{ deletePayload.logids.length }} 条记录，此操作不可恢复。
      </p>
    </NModal>

    <!-- 手动识别 -->
    <NModal
      v-model:show="manualModalShow"
      title="手动识别"
      preset="card"
      style="width: 560px; max-width: 92vw"
      :bordered="false"
      segmented
    >
      <NForm label-placement="left" label-width="80">
        <NFormItem label="路径">
          <NInput v-model:value="manualForm.path" readonly size="small" />
        </NFormItem>

        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="转移方式">
            <NSelect
              v-model:value="manualForm.syncmod"
              :options="SYNC_MODES"
              size="small"
            />
          </NFormItem>
          <NFormItem label="类型">
            <NRadioGroup v-model:value="manualForm.type" size="small">
              <NRadioButton value="movie">电影</NRadioButton>
              <NRadioButton value="tv">电视剧</NRadioButton>
              <NRadioButton value="anime">动漫</NRadioButton>
            </NRadioGroup>
          </NFormItem>
        </div>

        <NFormItem label="TMDB ID">
          <NSpace align="center" :wrap="false" style="width: 100%">
            <NInputNumber
              v-model:value="manualForm.tmdb"
              placeholder="留空自动识别"
              :min="0"
              :show-button="false"
              clearable
              size="small"
              style="flex: 1"
            />
            <NButton size="small" @click="openTmdbSearch">
              <template #icon>
                <IconifyIcon icon="lucide:search" class="size-4" />
              </template>
              查询
            </NButton>
          </NSpace>
        </NFormItem>

        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="季">
            <NInputNumber
              v-model:value="manualForm.season"
              placeholder="如 1"
              :min="1"
              :show-button="false"
              clearable
              size="small"
            />
          </NFormItem>
          <NFormItem label="最小大小">
            <NInputNumber
              v-model:value="manualForm.min_filesize"
              placeholder="MB"
              :min="0"
              :show-button="false"
              clearable
              size="small"
            />
          </NFormItem>
        </div>

        <NDivider style="margin: 0.5rem 0" />

        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="指定集数">
            <NInput
              v-model:value="manualForm.episode_format"
              placeholder="如 1,2,3"
              size="small"
            />
          </NFormItem>
          <NFormItem label="指定 Part">
            <NInput
              v-model:value="manualForm.episode_part"
              placeholder="如 Part1"
              size="small"
            />
          </NFormItem>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="定位集数">
            <NInput
              v-model:value="manualForm.episode_details"
              placeholder="如 E01"
              size="small"
            />
          </NFormItem>
          <NFormItem label="集数偏移">
            <NInput
              v-model:value="manualForm.episode_offset"
              placeholder="如 -10"
              size="small"
            />
          </NFormItem>
        </div>
      </NForm>

      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="manualModalShow = false">取消</NButton>
          <NButton
            type="primary"
            size="small"
            :loading="manualLoading"
            @click="submitManual"
          >
            转移
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- TMDB 查询弹窗 -->
    <NModal
      v-model:show="tmdbSearchShow"
      title="查询 TMDB ID"
      preset="card"
      style="width: 560px; max-width: 92vw"
      :bordered="false"
      segmented
    >
      <NSpace vertical>
        <NSpace align="center">
          <NInput
            v-model:value="tmdbSearchKeyword"
            placeholder="输入名称查询"
            size="small"
            style="width: 320px"
            @keyup.enter="handleTmdbSearch"
          />
          <NButton
            type="primary"
            size="small"
            :loading="tmdbSearchLoading"
            @click="handleTmdbSearch"
          >
            <template #icon>
              <IconifyIcon icon="lucide:search" class="size-4" />
            </template>
            搜索
          </NButton>
        </NSpace>

        <NSpin :show="tmdbSearchLoading">
          <div v-if="tmdbSearchResults.length > 0" class="tmdb-result-grid">
            <NCard
              v-for="media in tmdbSearchResults"
              :key="media.id"
              size="small"
              :bordered="false"
              class="tmdb-result-card"
              hoverable
              @click="selectTmdbMedia(media)"
            >
              <div class="flex gap-3">
                <img
                  v-if="media.image || media.poster"
                  :src="getImgUrl(media.image || media.poster)"
                  class="tmdb-poster rounded"
                  alt=""
                  @error="
                    (e: any) => (e.target.src = '/static/img/no-image.png')
                  "
                />
                <div
                  v-else
                  class="tmdb-poster-placeholder flex items-center justify-center rounded"
                >
                  <IconifyIcon
                    icon="lucide:image"
                    class="size-6"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="tmdb-title truncate">
                    {{ media.title }}
                    <span v-if="media.year" class="tmdb-year"
                      >({{ media.year }})</span
                    >
                  </div>
                  <div v-if="media.overview" class="tmdb-overview line-clamp-3">
                    {{ media.overview }}
                  </div>
                </div>
              </div>
            </NCard>
          </div>
          <EmptyState
            v-else-if="!tmdbSearchLoading && tmdbSearchKeyword"
            title="未找到相关媒体"
            subtitle="请尝试其他关键词"
          />
        </NSpin>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.stat-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: 0 2px 12px hsl(var(--foreground) / 8%);
}

.stat-icon-wrapper {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
}

.stat-label {
  margin-bottom: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 0.75rem;
}

.history-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}

.history-card:hover {
  border-color: hsl(var(--primary) / 25%);
  box-shadow: 0 4px 16px hsl(var(--foreground) / 10%);
}

.history-poster-wrapper {
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.5rem;
}

.history-title {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

.history-year {
  font-size: 0.85rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
  margin-bottom: 0.375rem;
}

.history-tag {
  padding: 0.125rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  border-radius: 0.25rem;
}

.history-mode {
  padding: 0.125rem 0.5rem;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted));
  border-radius: 0.25rem;
}

.history-path {
  margin-bottom: 0.125rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.source-icon {
  color: hsl(var(--destructive));
  opacity: 0.7;
}

.dest-icon {
  color: hsl(var(--success));
  opacity: 0.7;
}

.history-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.375rem;
  margin-top: 0.5rem;
  border-top: 1px solid hsl(var(--border));
}

.history-date {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.tmdb-result-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 50vh;
  overflow-y: auto;
}

.tmdb-result-card {
  cursor: pointer;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition: box-shadow 0.2s;
}

.tmdb-result-card:hover {
  box-shadow: 0 2px 8px hsl(var(--foreground) / 8%);
}

.tmdb-poster {
  flex-shrink: 0;
  width: 60px;
  height: 80px;
  object-fit: cover;
  background-color: hsl(var(--muted));
}

.tmdb-poster-placeholder {
  flex-shrink: 0;
  width: 60px;
  height: 80px;
  background-color: hsl(var(--muted));
}

.tmdb-title {
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.tmdb-year {
  font-size: 0.8rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.tmdb-overview {
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .history-grid {
    grid-template-columns: 1fr;
  }

  .history-poster-wrapper {
    width: 2.5rem;
    height: 2.5rem;
  }

  .tmdb-poster,
  .tmdb-poster-placeholder {
    width: 48px;
    height: 64px;
  }
}
</style>
