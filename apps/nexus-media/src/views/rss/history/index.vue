<script lang="ts" setup>
import { ref, onMounted, computed, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  NButton,
  NDataTable,
  NModal,
  NSpace,
  NSpin,
  useNotification,
} from 'naive-ui';

import { deleteSubscriptionHistoryApi, getSubscriptionHistoryApi, redoSubscriptionHistoryApi } from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useSubscriptionStore } from '#/store';

const route = useRoute();
const router = useRouter();
const subscriptionStore = useSubscriptionStore();
const notification = useNotification();

const loading = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<any>(null);

const type = computed(() => {
  const t = route.query.t as string;
  return t === 'TV' ? 'tv' : 'movie';
});

const pageTitle = computed(() =>
  type.value === 'tv' ? '电视剧订阅历史' : '电影订阅历史'
);

const backPath = computed(() =>
  type.value === 'tv' ? '/subscription/tv' : '/subscription/movie'
);

function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return `/img?url=${encodeURIComponent(src)}`;
}

// 统一将后端可能返回的大小写字段转换为小写格式
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
    type: (item.type ?? type.value) as 'movie' | 'tv',
  }));
});

async function fetchData() {
  loading.value = true;
  try {
    const res = await getSubscriptionHistoryApi(type.value);
    subscriptionStore.setSubscriptionHistory(res);
  } finally {
    loading.value = false;
  }
}

async function handleReRss(row: any) {
  try {
    await redoSubscriptionHistoryApi(row.id, type.value);
    notification.success({ content: '重新订阅成功' });
    await fetchData();
  } catch (err: any) {
    notification.error({
      content: '重新订阅失败',
      description: err?.message || '',
    });
  }
}

function handleDelete(row: any) {
  deleteTarget.value = row;
  deleteModalShow.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteSubscriptionHistoryApi(deleteTarget.value.id);
    notification.success({ content: '已删除' });
    await fetchData();
  } catch (err: any) {
    notification.error({
      content: '删除失败',
      description: err?.message || '',
    });
  } finally {
    deleteModalShow.value = false;
    deleteTarget.value = null;
  }
}

function renderImage(row: any) {
  return h('img', {
    src: getImgUrl(row.image),
    class: 'rounded shadow-sm',
    style: 'width: 50px; aspect-ratio: 2/3; object-fit: cover',
    onError: (e: any) => { e.target.src = '/static/img/no-image.png'; },
  });
}

function renderTitle(row: any) {
  const children: any[] = [];
  children.push(
    h('div', { class: 'font-medium' }, [
      row.title,
      row.year ? ` (${row.year})` : '',
      row.season ? ` ${row.season}` : '',
    ])
  );
  if (row.tmdbid) {
    children.push(
      h('a', {
        href: `https://www.themoviedb.org/${row.type === 'tv' ? 'tv' : 'movie'}/${row.tmdbid}`,
        target: '_blank',
        class: 'text-xs hover:underline',
        style: 'color: hsl(var(--success))',
      }, row.tmdbid)
    );
  }
  if (row.total > 0) {
    children.push(
      h('div', { class: 'text-xs mt-0.5', style: 'color: hsl(var(--muted-foreground))' }, `共 ${row.total - row.start} 集`)
    );
  }
  return h('div', null, children);
}

function renderDesc(row: any) {
  return h('span', { class: 'hidden md:inline' }, row.desc);
}

function renderTime(row: any) {
  return       h('span', { class: 'text-sm', style: 'color: hsl(var(--muted-foreground))' }, row.finishTime);
}

function renderActions(row: any) {
  return h(NSpace, { size: 'small' }, {
    default: () => [
      h(NButton, {
        size: 'tiny',
        type: 'primary',
        ghost: true,
        onClick: () => handleReRss(row),
      }, { default: () => '重新订阅' }),
      h(NButton, {
        size: 'tiny',
        type: 'error',
        ghost: true,
        onClick: () => handleDelete(row),
      }, { default: () => '删除' }),
    ],
  });
}

const columns = [
  { title: '', key: 'image', width: 70, render: renderImage },
  { title: '标题', key: 'title', minWidth: 200, render: renderTitle },
  { title: '简介', key: 'desc', minWidth: 240, ellipsis: { tooltip: true }, render: renderDesc },
  { title: '完成时间', key: 'finishTime', width: 160, render: renderTime },
  { title: '操作', key: 'actions', width: 160, render: renderActions },
];

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader :title="pageTitle">
      <template #actions>
        <NButton @click="router.push(backPath)">返回</NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="historyList.length > 0" class="mt-4">
        <div class="text-sm mb-3" style="color: hsl(var(--muted-foreground))">
          共 {{ historyList.length }} 条记录
        </div>
        <NDataTable
          :columns="columns"
          :data="historyList"
          :bordered="false"
          :single-line="false"
          size="small"
          :scroll-x="700"
        />
      </div>
      <EmptyState
        v-else
        class="mt-8"
        title="没有完成的订阅"
        subtitle="当前没有已完成的订阅记录"
      />
    </NSpin>

    <!-- 删除确认 -->
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
@media (max-width: 768px) {
  .hidden.md\:inline {
    display: none;
  }
}
</style>
