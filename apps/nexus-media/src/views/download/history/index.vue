<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NPagination,
  NSpace,
  NSpin,
  NTooltip,
  useMessage,
} from 'naive-ui';

import { getDownloadHistoryApi } from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import { useDownloadStore } from '#/store';
import { getImgUrl } from '#/utils/image';

const downloadStore = useDownloadStore();
const message = useMessage();
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(30);
const total = ref(0);
const viewMode = ref<'grid' | 'list'>('grid');

const history = computed(() => downloadStore.history);

async function fetchData(page = 1) {
  loading.value = true;
  currentPage.value = page;
  try {
    const res = (await getDownloadHistoryApi(page, pageSize.value)) as any;
    const list = Array.isArray(res) ? res : res?.data || [];
    downloadStore.setHistory(list);
    total.value =
      list.length >= pageSize.value
        ? page * pageSize.value + 1
        : page * pageSize.value;
  } finally {
    loading.value = false;
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

function getMediaTypeLabel(type?: string) {
  const map: Record<string, string> = {
    movie: '电影',
    tv: '电视剧',
  };
  return (type && map[type]) || type || '';
}

function handlePageChange(page: number) {
  fetchData(page);
}

async function copyLink(url: string) {
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    message.success('下载链接已复制');
  } catch {
    message.error('复制失败');
  }
}

onMounted(() => fetchData(1));
</script>

<template>
  <div class="p-4">
    <div class="header-row">
      <h1 class="page-title">近期下载</h1>
      <div class="toolbar-actions">
        <NButton @click="fetchData(currentPage)">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          刷新
        </NButton>
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

    <NSpin :show="loading">
      <template v-if="history.length > 0">
        <!-- Grid View -->
        <div v-if="viewMode === 'grid'" class="history-grid">
          <NCard
            v-for="item in history"
            :key="`${item.id}-${item.date}`"
            size="small"
            :bordered="false"
            class="history-card"
          >
            <div class="flex gap-3">
              <div class="history-poster-wrapper">
                <img
                  v-if="item.image"
                  :src="getImgUrl(item.image)"
                  class="history-poster rounded"
                  alt=""
                />
                <div
                  v-else
                  class="history-poster-placeholder flex items-center justify-center rounded"
                >
                  <IconifyIcon
                    icon="lucide:film"
                    class="size-8"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <NTooltip :show-arrow="false">
                  <template #trigger>
                    <div class="history-title truncate">{{ item.title }}</div>
                  </template>
                  {{ item.title }}
                </NTooltip>
                <div class="history-meta">
                  <span v-if="item.year">{{ item.year }}</span>
                  <span v-if="item.media_type">{{
                    getMediaTypeLabel(item.media_type)
                  }}</span>
                  <span v-if="item.vote">评分 {{ item.vote }}</span>
                </div>
                <div v-if="item.overview" class="history-torrent truncate">
                  {{ item.overview }}
                </div>
                <div class="history-footer">
                  <span v-if="item.site" class="history-site">{{
                    item.site
                  }}</span>
                  <NSpace align="center" size="small">
                    <NButton
                      v-if="item.enclosure"
                      size="tiny"
                      text
                      @click="copyLink(item.enclosure)"
                    >
                      <template #icon>
                        <IconifyIcon icon="lucide:link" class="size-3.5" />
                      </template>
                      复制链接
                    </NButton>
                    <span class="history-date">{{
                      formatDate(item.date)
                    }}</span>
                  </NSpace>
                </div>
              </div>
            </div>
          </NCard>
        </div>

        <!-- List View -->
        <div v-else class="history-list">
          <div
            v-for="item in history"
            :key="`${item.id}-${item.date}`"
            class="history-list-item"
          >
            <img
              v-if="item.image"
              :src="`/img?url=${item.image}`"
              class="history-list-poster rounded"
              alt=""
            />
            <div
              v-else
              class="history-list-poster-placeholder flex items-center justify-center rounded"
            >
              <IconifyIcon
                icon="lucide:film"
                class="size-5"
                style="color: hsl(var(--muted-foreground))"
              />
            </div>

            <div class="history-list-info">
              <NTooltip :show-arrow="false">
                <template #trigger>
                  <div class="history-list-title truncate">
                    {{ item.title }}
                  </div>
                </template>
                {{ item.title }}
              </NTooltip>
              <div class="history-list-meta">
                <span v-if="item.year">{{ item.year }}</span>
                <span v-if="item.media_type">{{
                  getMediaTypeLabel(item.media_type)
                }}</span>
                <span v-if="item.vote">评分 {{ item.vote }}</span>
                <span v-if="item.site" class="history-site">{{
                  item.site
                }}</span>
              </div>
            </div>

            <div class="history-list-actions">
              <NButton
                v-if="item.enclosure"
                size="tiny"
                text
                @click="copyLink(item.enclosure)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:link" class="size-3.5" />
                </template>
                <span class="hidden sm:inline">复制链接</span>
              </NButton>
              <span class="history-date">{{ formatDate(item.date) }}</span>
            </div>
          </div>
        </div>
      </template>

      <EmptyState
        v-else-if="!loading"
        title="暂无下载历史"
        subtitle="还没有下载记录"
      >
        <template #icon>
          <IconifyIcon
            icon="lucide:clock"
            class="size-16"
            style="color: hsl(var(--muted-foreground))"
          />
        </template>
      </EmptyState>

      <div v-if="history.length > 0" class="mt-4 flex justify-end">
        <NPagination
          v-model:page="currentPage"
          :page-size="pageSize"
          :item-count="total"
          @update:page="handlePageChange"
        />
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.page-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--foreground));
}

.toolbar-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

/* ===== Grid View ===== */
.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 0.75rem;
}

.history-card {
  overflow: hidden;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition: box-shadow 0.2s;
}

.history-card:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.history-poster-wrapper {
  flex-shrink: 0;
}

.history-poster {
  width: 80px;
  height: 100px;
  object-fit: cover;
  background-color: hsl(var(--muted));
}

.history-poster-placeholder {
  width: 80px;
  height: 100px;
  background-color: hsl(var(--muted));
}

.history-title {
  margin-bottom: 0.375rem;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.history-torrent {
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.history-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

/* ===== List View ===== */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-list-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  overflow: hidden;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  transition: box-shadow 0.2s;
}

.history-list-item:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.history-list-poster {
  flex-shrink: 0;
  width: 40px;
  height: 50px;
  object-fit: cover;
  background-color: hsl(var(--muted));
}

.history-list-poster-placeholder {
  flex-shrink: 0;
  width: 40px;
  height: 50px;
  background-color: hsl(var(--muted));
}

.history-list-info {
  flex: 1;
  min-width: 0;
}

.history-list-title {
  margin-bottom: 0.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

.history-list-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.history-list-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
  align-items: center;
}

/* ===== Common ===== */
.history-site {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  color: hsl(var(--accent-foreground));
  background-color: hsl(var(--accent));
  border-radius: 9999px;
}

.history-date {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  .history-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .history-poster,
  .history-poster-placeholder {
    width: 60px;
    height: 80px;
  }

  .history-list-item {
    gap: 0.5rem;
    padding: 0.625rem;
  }

  .history-list-poster,
  .history-list-poster-placeholder {
    width: 32px;
    height: 40px;
  }

  .history-list-title {
    font-size: 0.875rem;
  }
}
</style>
