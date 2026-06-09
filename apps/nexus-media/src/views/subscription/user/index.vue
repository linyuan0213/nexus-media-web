<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import {
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NSpace,
  NSpin,
  NTag,
} from 'naive-ui';

import { deleteRssAutomationApi, getRssAutomationApi } from '#/api';
import { useSubscriptionStore } from '#/store';

const subscriptionStore = useSubscriptionStore();
const loading = ref(false);

const columns = [
  { title: '名称', key: 'name', ellipsis: { tooltip: true } },
  { title: '地址', key: 'address', ellipsis: { tooltip: true } },
  { title: '解析器', key: 'parser', width: 120 },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row: any) {
      return h(
        NTag,
        { type: row.status === 1 ? 'success' : 'error' },
        {
          default: () => (row.status === 1 ? '启用' : '停用'),
        },
      );
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render(row: any) {
      return h(
        NSpace,
        {},
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                type: 'error',
                onClick: () => handleDelete(row.id),
              },
              { default: () => '删除' },
            ),
          ],
        },
      );
    },
  },
];

async function fetchData() {
  loading.value = true;
  try {
    const res = await getRssAutomationApi();
    subscriptionStore.setRssAutomationItems(res as any);
  } finally {
    loading.value = false;
  }
}

async function handleDelete(id: number) {
  await deleteRssAutomationApi(id);
  await fetchData();
}

onMounted(fetchData);
</script>

<script lang="ts">
import { h } from 'vue';
</script>

<template>
  <div class="p-4">
    <NCard title="自定义 RSS自动化">
      <NSpin :show="loading">
        <NDataTable
          v-if="subscriptionStore.rssAutomationItems.length > 0"
          :columns="columns"
          :data="subscriptionStore.rssAutomationItems"
          :bordered="false"
          :single-line="false"
          remote
        />
        <NEmpty v-else description="暂无自定义 RSS自动化" />
      </NSpin>
    </NCard>
  </div>
</template>
