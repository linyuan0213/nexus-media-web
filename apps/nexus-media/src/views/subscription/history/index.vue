<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { NButton, NModal, NSpin, NTab, NTabs } from 'naive-ui';

import {
  deleteSubscriptionHistoryApi,
  getSubscriptionHistoryApi,
  redoSubscriptionHistoryApi,
} from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useSubscriptionStore } from '#/store';
import { useAppNotification } from '#/utils/notify';

import HistoryCard from './components/HistoryCard.vue';

const route = useRoute();
const router = useRouter();
const subscriptionStore = useSubscriptionStore();
const notification = useAppNotification();

const loading = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<any>(null);

const filterType = ref<'movie' | 'tv'>(
  String(route.query.t || '').toLowerCase() === 'tv' ? 'tv' : 'movie',
);

const pageTitle = computed(() =>
  filterType.value === 'tv' ? '电视剧订阅历史' : '电影订阅历史',
);

const backPath = computed(() =>
  filterType.value === 'tv' ? '/subscription/tv' : '/subscription/movie',
);

function handleTypeChange(value: 'movie' | 'tv') {
  if (value === filterType.value) return;
  filterType.value = value;
  fetchData();
}

const historyList = computed(() => {
  return subscriptionStore.subscriptionHistory.map((item: any) => ({
    id: (item.ID ?? item.id) as number | string,
    title: (item.NAME ?? item.title ?? item.name ?? '') as string,
    year: (item.YEAR ?? item.year ?? '') as string,
    season: (item.SEASON ?? item.season ?? '') as string,
    tmdbid: (item.TMDBID ?? item.tmdbid ?? '') as string,
    image: (item.IMAGE ?? item.image ?? '') as string,
    total: (item.TOTAL ?? item.total ?? 0) as number,
    start: (item.START ?? item.start ?? 0) as number,
    desc: (item.DESC ?? item.desc ?? '') as string,
    finishTime: (item.FINISH_TIME ?? item.date ?? '') as string,
    type: (item.type ?? filterType.value) as 'movie' | 'tv',
  }));
});

async function fetchData() {
  loading.value = true;
  try {
    const res = await getSubscriptionHistoryApi(filterType.value);
    subscriptionStore.setSubscriptionHistory(res);
  } finally {
    loading.value = false;
  }
}

async function handleReRss(item: any) {
  try {
    await redoSubscriptionHistoryApi(item.id, filterType.value);
    notification.success('重新订阅成功');
    await fetchData();
  } catch (error: any) {
    notification.error('重新订阅失败', { description: error?.message || '' });
  }
}

function handleDelete(item: any) {
  deleteTarget.value = item;
  deleteModalShow.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteSubscriptionHistoryApi(deleteTarget.value.id);
    notification.success('已删除');
    await fetchData();
  } catch (error: any) {
    notification.error('删除失败', { description: error?.message || '' });
  } finally {
    deleteModalShow.value = false;
    deleteTarget.value = null;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader :title="pageTitle">
      <template #actions>
        <NButton @click="router.push(backPath)">返回</NButton>
      </template>
    </PageHeader>

    <NTabs
      :value="filterType"
      type="segment"
      class="history-tabs"
      @update:value="handleTypeChange"
    >
      <NTab name="movie" tab="电影" />
      <NTab name="tv" tab="电视剧" />
    </NTabs>

    <NSpin :show="loading">
      <div v-if="historyList.length > 0" class="history-layout">
        <div class="history-stats">
          <IconifyIcon icon="lucide:history" class="h-4 w-4" />
          <span>共 {{ historyList.length }} 条记录</span>
        </div>
        <div class="history-list">
          <HistoryCard
            v-for="item in historyList"
            :key="item.id"
            :item="item"
            @re-rss="handleReRss"
            @delete="handleDelete"
          />
        </div>
      </div>
      <EmptyState
        v-else
        class="mt-8"
        title="没有完成的订阅"
        subtitle="当前没有已完成的订阅记录"
      />
    </NSpin>

    <NModal
      v-model:show="deleteModalShow"
      title="确认删除"
      preset="dialog"
      type="warning"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmDelete"
    >
      <p>确定要删除「{{ deleteTarget?.title }}」的订阅历史吗？</p>
    </NModal>
  </div>
</template>

<style scoped>
.history-tabs {
  margin-top: 1rem;
}

.history-layout {
  margin-top: 1rem;
}

.history-stats {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .history-list {
    gap: 0.5rem;
  }
}
</style>
