<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSpin, NTab, NTabs } from 'naive-ui';

import {
  deleteSubscriptionHistoryApi,
  getSubscriptionHistoryApi,
  redoSubscriptionHistoryApi,
} from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscriptionDeleteModal from '#/components/subscribe/SubscriptionDeleteModal.vue';
import {
  getContentProfileDetailPath,
  getContentProfileLabel,
  getContentProfileMediaType,
  getContentProfileOptions,
} from '#/plugin-framework/loader';
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

type HistoryTab = {
  key: string;
  label: string;
  profile: string;
  type: 'movie' | 'tv';
};

const historyTabs = computed<HistoryTab[]>(() => {
  const tabs: HistoryTab[] = [
    { key: 'movie', label: '电影', profile: 'default', type: 'movie' },
    { key: 'tv', label: '电视剧', profile: 'default', type: 'tv' },
    {
      key: 'anime',
      label: getContentProfileLabel('anime') || '动漫',
      profile: 'anime',
      type: 'tv',
    },
  ];
  for (const option of getContentProfileOptions()) {
    if (['anime', 'default'].includes(option.value)) continue;
    const mediaType = getContentProfileMediaType(option.value);
    tabs.push({
      key: option.value,
      label: option.label,
      profile: option.value,
      type: mediaType === 'tv' ? 'tv' : 'movie',
    });
  }
  return tabs;
});

const requestedTab = String(route.query.t || '').toLowerCase();
const activeKey = ref(
  historyTabs.value.some((tab) => tab.key === requestedTab)
    ? requestedTab
    : 'movie',
);
const FALLBACK_TAB: HistoryTab = {
  key: 'movie',
  label: '电影',
  profile: 'default',
  type: 'movie',
};
const activeTab = computed<HistoryTab>(
  () =>
    historyTabs.value.find((tab) => tab.key === activeKey.value) ||
    historyTabs.value[0] ||
    FALLBACK_TAB,
);
const filterType = computed(() => activeTab.value.type);
const filterProfile = computed(() => activeTab.value.profile);
const pageTitle = '订阅历史';
const backPath = computed(() => {
  if (activeTab.value.profile !== 'default') {
    // detailPath 形如 /subscription/<profile>/detail，返回列表时去掉 /detail。
    const detailPath = getContentProfileDetailPath(activeTab.value.profile);
    if (detailPath) {
      return detailPath.replace(/\/detail\/?$/, '') || detailPath;
    }
  }
  return filterType.value === 'tv' ? '/subscription/tv' : '/subscription/movie';
});

function handleTypeChange(value: string) {
  if (value === activeKey.value) return;
  activeKey.value = value;
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
    const res = await getSubscriptionHistoryApi(
      filterType.value,
      filterProfile.value,
    );
    subscriptionStore.setSubscriptionHistory(res);
  } finally {
    loading.value = false;
  }
}

async function handleReRss(item: any) {
  try {
    await redoSubscriptionHistoryApi(
      item.id,
      filterType.value,
      filterProfile.value,
    );
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
      :value="activeKey"
      type="segment"
      class="history-tabs"
      @update:value="handleTypeChange"
    >
      <NTab
        v-for="tab in historyTabs"
        :key="tab.key"
        :name="tab.key"
        :tab="tab.label"
      />
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

    <SubscriptionDeleteModal
      v-model:show="deleteModalShow"
      :item="deleteTarget"
      kind="history"
      @confirm="confirmDelete"
    />
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
