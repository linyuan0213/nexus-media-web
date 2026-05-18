<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { NButton, NCard, NEmpty, NSpin, NSpace, NPagination, useMessage } from 'naive-ui';

import { IconifyIcon } from '@vben/icons';

import { getDownloadHistoryApi } from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useDownloadStore } from '#/store';

const downloadStore = useDownloadStore();
const message = useMessage();
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(30);
const total = ref(0);

const history = computed(() => downloadStore.history);

async function fetchData(page = 1) {
  loading.value = true;
  currentPage.value = page;
  try {
    const res = (await getDownloadHistoryApi(page, pageSize.value)) as any;
    const list = Array.isArray(res) ? res : res?.data || [];
    downloadStore.setHistory(list);
    total.value = list.length >= pageSize.value ? page * pageSize.value + 1 : page * pageSize.value;
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
    <PageHeader title="近期下载" subtitle="最近下载的媒体资源">
      <template #actions>
        <NSpace>
          <NButton @click="fetchData(currentPage)">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
            </template>
            刷新
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="history.length > 0" class="history-grid">
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
                :src="`/img?url=${item.image}`"
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
              <div class="history-title truncate">
                {{ item.title }}
              </div>
              <div class="history-meta">
                <span v-if="item.year">{{ item.year }}</span>
                <span v-if="item.media_type">{{ item.media_type }}</span>
                <span v-if="item.vote">评分 {{ item.vote }}</span>
              </div>
              <div v-if="item.overview" class="history-torrent truncate">
                {{ item.overview }}
              </div>
              <div class="history-footer">
                <span v-if="item.site" class="history-site">{{ item.site }}</span>
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
                  <span class="history-date">{{ formatDate(item.date) }}</span>
                </NSpace>
              </div>
            </div>
          </div>
        </NCard>
      </div>

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
.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 0.75rem;
}

.history-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition: box-shadow 0.2s;
}

.history-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
  font-size: 1rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
  margin-bottom: 0.375rem;
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.375rem;
}

.history-torrent {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.5rem;
}

.history-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.history-site {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background-color: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.history-date {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .history-grid {
    grid-template-columns: 1fr;
  }

  .history-poster,
  .history-poster-placeholder {
    width: 60px;
    height: 80px;
  }
}
</style>
