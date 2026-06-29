<script lang="ts" setup>
import type { SiteForm, SiteItem, SiteSelectOption } from './types';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSpace, NSpin, useNotification } from 'naive-ui';

import { getDownloadSettingsApi } from '#/api/modules/download';
import { getFilterGroupsApi } from '#/api/modules/filter';
import {
  deleteSiteApi,
  getSiteFaviconsApi,
  getSitesApi,
  saveSiteApi,
  testSiteApi,
} from '#/api/modules/site';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useSiteStore } from '#/store';

import SiteCard from './components/SiteCard.vue';
import SiteDeleteModal from './components/SiteDeleteModal.vue';
import SiteEditModal from './components/SiteEditModal.vue';
import SiteTypeTabs from './components/SiteTypeTabs.vue';

const siteStore = useSiteStore();
const notification = useNotification();
const loading = ref(false);
const testLoading = ref<null | number>(null);
const activeType = ref('all');
const editModalShow = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<null | SiteItem>(null);
const editingSite = ref<null | SiteForm>(null);

const favicons = ref<Record<string, string>>({});
const faviconLoadFailed = ref<Record<string, boolean>>({});
const filterGroups = ref<SiteSelectOption[]>([{ label: '默认', value: '' }]);
const downloadSettings = ref<SiteSelectOption[]>([
  { label: '默认', value: '' },
]);

const typeTabs = [
  { label: '全部站点', value: 'all' },
  { label: 'PT站点', value: 'pt' },
  { label: 'BT站点', value: 'bt' },
];

const filteredSites = computed(() => {
  if (activeType.value === 'all') return siteStore.sites;
  return siteStore.sites.filter((s: any) => {
    if (activeType.value === 'bt') return s.public;
    return !s.public;
  });
});

const editModalRef = ref<InstanceType<typeof SiteEditModal> | null>(null);

async function fetchSites() {
  loading.value = true;
  try {
    const [sitesRes, favRes, filterRes, dlRes]: any = await Promise.all([
      getSitesApi(),
      getSiteFaviconsApi(),
      getFilterGroupsApi(),
      getDownloadSettingsApi(),
    ]);
    const list = Array.isArray(sitesRes) ? sitesRes : sitesRes?.data || [];
    siteStore.setSites(list);

    const favData =
      favRes && typeof favRes === 'object' && !Array.isArray(favRes)
        ? favRes
        : favRes?.data || {};
    favicons.value = favData || {};

    const fg = Array.isArray(filterRes) ? filterRes : filterRes?.data || [];
    filterGroups.value = [
      { label: '默认', value: '' },
      ...fg.map((g: any) => ({
        label: g.name || String(g.id),
        value: String(g.id),
      })),
    ];

    const ds = Array.isArray(dlRes) ? dlRes : dlRes?.data || [];
    downloadSettings.value = [
      { label: '默认', value: '' },
      ...ds.map((d: any) => ({
        label: d.name || String(d.id),
        value: String(d.id),
      })),
    ];
  } finally {
    loading.value = false;
  }
}

function getFavicon(name: string): string {
  const data = favicons.value[name];
  if (!data) return '';
  if (data.startsWith('data:') || data.startsWith('http')) return data;
  return `${data}`;
}

function getFaviconFallback(name: string): string {
  return `https://www.google.com/s2/favicons?domain=${name.toLowerCase()}.com&sz=64`;
}

function handleFaviconError(name: string) {
  faviconLoadFailed.value[name] = true;
}

function handleAdd() {
  editingSite.value = {
    name: '',
    pri: '1',
    signurl: '',
    cookie: '',
    api_key: '',
    bearer_token: '',
    rssurl: '',
    public: false,
    rss_enable: true,
    brush_enable: false,
    statistic_enable: true,
    parse: false,
    unread_msg_notify: false,
    chrome: false,
    proxy: false,
    subtitle: false,
    tag: false,
    ua: '',
    headers: '',
    rule: '',
    download_setting: '',
    rate_limit: '10/m',
    rate_burst: '10',
  };
  editModalShow.value = true;
}

function handleEdit(item: SiteItem) {
  editingSite.value = editModalRef.value?.parseSiteToForm(item) ?? null;
  editModalShow.value = true;
}

async function handleSave() {
  if (!editingSite.value) return;
  if (!editingSite.value.name) {
    notification.warning({ content: '请输入站点名称' });
    return;
  }
  if (!editingSite.value.signurl) {
    notification.warning({ content: '请输入站点地址' });
    return;
  }
  try {
    const payload = editModalRef.value?.buildSavePayload(editingSite.value);
    await saveSiteApi(payload);
    notification.success({ content: '保存成功' });
    editModalShow.value = false;
    await fetchSites();
  } catch (error: any) {
    notification.error({
      content: '保存失败',
      description: error?.message || '',
    });
  }
}

function handleDelete(item: SiteItem) {
  deleteTarget.value = item;
  deleteModalShow.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteSiteApi(deleteTarget.value.id);
    notification.success({ content: '删除成功' });
    await fetchSites();
  } catch (error: any) {
    notification.error({
      content: '删除失败',
      description: error?.message || '',
    });
  } finally {
    deleteModalShow.value = false;
    deleteTarget.value = null;
  }
}

async function handleTest(item: SiteItem) {
  testLoading.value = item.id;
  try {
    await testSiteApi(item.id);
    notification.success({ content: `「${item.name}」连接正常` });
  } catch (error: any) {
    notification.error({
      content: `「${item.name}」连接失败`,
      description: error?.message || '',
    });
  } finally {
    testLoading.value = null;
  }
}

onMounted(fetchSites);
</script>

<template>
  <div class="p-4">
    <PageHeader title="站点维护">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="handleAdd">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="h-4 w-4" />
            </template>
            新增站点
          </NButton>
          <NButton @click="fetchSites">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            刷新
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <div class="mb-4">
      <SiteTypeTabs v-model:active="activeType" :tabs="typeTabs" />
    </div>

    <NSpin :show="loading">
      <div v-if="filteredSites.length > 0" class="grid-site-card">
        <SiteCard
          v-for="site in filteredSites"
          :key="site.id"
          :site="site"
          :favicon="getFavicon(site.name)"
          :favicon-fallback="getFaviconFallback(site.name)"
          :favicon-failed="!!faviconLoadFailed[site.name]"
          :testing="testLoading === site.id"
          @favicon-error="handleFaviconError"
          @test="handleTest"
          @edit="handleEdit"
          @delete="handleDelete"
        />
      </div>

      <EmptyState
        v-else
        title="没有站点"
        subtitle="没有添加任何站点，请点击「新增站点」按钮"
      />
    </NSpin>

    <SiteEditModal
      ref="editModalRef"
      v-model:show="editModalShow"
      :site="editingSite"
      :filter-groups="filterGroups"
      :download-settings="downloadSettings"
      @update:site="editingSite = $event"
      @save="handleSave"
    />

    <SiteDeleteModal
      v-model:show="deleteModalShow"
      :target="deleteTarget"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.grid-site-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1rem;
}

@media (max-width: 640px) {
  .grid-site-card {
    grid-template-columns: 1fr;
  }
}
</style>
