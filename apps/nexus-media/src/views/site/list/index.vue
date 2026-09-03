<script lang="ts" setup>
import type {
  SiteDefinition,
  SiteForm,
  SiteItem,
  SiteSelectOption,
} from './types';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NInput, NSelect, NSpace, NSpin } from 'naive-ui';

import { getDownloadSettingsApi } from '#/api/modules/download';
import { getFilterGroupsApi } from '#/api/modules/filter';
import {
  deleteSiteApi,
  getSiteDefinitionsApi,
  getSiteFaviconsApi,
  getSitesApi,
  saveSiteApi,
  syncIndexerSitesApi,
  testSiteApi,
  updateIndexerSiteConfigApi,
} from '#/api/modules/site';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useSiteStore } from '#/store';
import { useAppNotification } from '#/utils/notify';

import SiteBatchTestModal from './components/SiteBatchTestModal.vue';
import SiteCard from './components/SiteCard.vue';
import SiteDeleteModal from './components/SiteDeleteModal.vue';
import SiteEditModal from './components/SiteEditModal.vue';

const siteStore = useSiteStore();
const notification = useAppNotification();
const loading = ref(false);
const syncLoading = ref(false);
const testLoading = ref<null | number>(null);
const activeSource = ref('all');
const activeType = ref('all');
const searchKeyword = ref('');
const editModalShow = ref(false);
const deleteModalShow = ref(false);
const batchTestShow = ref(false);
const deleteTarget = ref<null | SiteItem>(null);
const editingSite = ref<null | SiteForm>(null);

const favicons = ref<Record<string, string>>({});
const faviconLoadFailed = ref<Record<string, boolean>>({});
const definitions = ref<SiteDefinition[]>([]);
const filterGroups = ref<SiteSelectOption[]>([{ label: '默认', value: '' }]);
const downloadSettings = ref<SiteSelectOption[]>([
  { label: '默认', value: '' },
]);

const sourceOptions = [
  { key: 'all', label: '全部来源', icon: 'lucide:layers' },
  { key: 'builtin', label: '内置索引器', icon: 'lucide:database' },
  { key: 'jackett', label: 'Jackett', icon: 'lucide:search' },
  { key: 'prowlarr', label: 'Prowlarr', icon: 'lucide:scan-search' },
];

const typeOptions = [
  { label: '全部', value: 'all' },
  { label: 'PT', value: 'pt' },
  { label: 'BT', value: 'bt' },
];

const filteredSites = computed(() => {
  let list = siteStore.sites;
  if (activeSource.value !== 'all') {
    list = list.filter(
      (s: any) => (s.source || 'builtin') === activeSource.value,
    );
  }
  if (activeType.value !== 'all') {
    list = list.filter((s: any) => {
      if (activeType.value === 'bt') return s.site_public ?? s.public;
      return !(s.site_public ?? s.public);
    });
  }
  const kw = searchKeyword.value.trim().toLowerCase();
  if (kw) {
    list = list.filter((s: any) => {
      const haystack = [s.name, s.signurl, s.rssurl, s.domain, s.site_url]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(kw);
    });
  }
  return list;
});

const groupedSites = computed(() => {
  if (activeSource.value !== 'all') {
    const option = sourceOptions.find((o) => o.key === activeSource.value);
    return [
      {
        source: activeSource.value,
        label: option?.label || activeSource.value,
        icon: option?.icon || 'lucide:search',
        header: false,
        sites: filteredSites.value,
      },
    ];
  }

  const groups: Record<string, SiteItem[]> = {};
  const orderedSources = ['builtin', 'jackett', 'prowlarr'];
  for (const source of orderedSources) {
    groups[source] = [];
  }
  for (const site of filteredSites.value) {
    const source = site.source || 'builtin';
    if (!groups[source]) groups[source] = [];
    groups[source].push(site);
  }

  return orderedSources
    .map((source) => {
      const option = sourceOptions.find((o) => o.key === source);
      return {
        source,
        label: option?.label || source,
        icon: option?.icon || 'lucide:search',
        header: true,
        sites: groups[source] || [],
      };
    })
    .filter((g) => g.sites.length > 0);
});

const sourceCounts = computed(() => {
  const counts: Record<string, number> = { all: siteStore.sites.length };
  for (const site of siteStore.sites) {
    const source = site.source || 'builtin';
    counts[source] = (counts[source] || 0) + 1;
  }
  return counts;
});

// 仅展示存在站点的来源；无站点的索引器（如 Prowlarr 0）不再出现在筛选里
const visibleSourceOptions = computed(() =>
  sourceOptions.filter(
    (o) => o.key === 'all' || (sourceCounts.value[o.key] || 0) > 0,
  ),
);

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
    site_public: false,
    rss_enable: true,
    brush_enable: true,
    statistic_enable: true,
    parse: true,
    unread_msg_notify: true,
    chrome: false,
    browser_persistent: false,
    proxy: false,
    subtitle: false,
    tag: true,
    ua: '',
    headers: '',
    rule: '',
    download_setting: '',
    rate_limit: '10/m',
    rate_burst: '10',
    search_enabled: true,
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
    notification.warning('请输入站点名称');
    return;
  }
  if (!editingSite.value.signurl) {
    notification.warning('请输入站点地址');
    return;
  }
  try {
    const payload = editModalRef.value?.buildSavePayload(editingSite.value);
    await saveSiteApi(payload);
    await updateIndexerSiteConfigApi({
      site_name: editingSite.value.name,
      enabled: editingSite.value.search_enabled,
    });
    notification.success('保存成功');
    editModalShow.value = false;
    await fetchSites();
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
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
    notification.success('删除成功');
    await fetchSites();
  } catch (error: any) {
    notification.error('删除失败', { description: error?.message || '' });
  } finally {
    deleteModalShow.value = false;
    deleteTarget.value = null;
  }
}

async function handleTest(item: SiteItem) {
  testLoading.value = item.id;
  try {
    await testSiteApi(item.id);
    notification.success(`「${item.name}」连接正常`);
  } catch (error: any) {
    notification.error(`「${item.name}」连接失败`, {
      description: error?.message || '',
    });
  } finally {
    testLoading.value = null;
  }
}

// 批量测试当前筛选出的非公开（PT）站点，排除第三方索引器（jackett/prowlarr）
const batchTestSites = computed(() =>
  filteredSites.value.filter(
    (s: any) =>
      !(s.site_public ?? s.public) &&
      (s.source || 'builtin') === 'builtin' &&
      !s.third_party,
  ),
);

function handleBatchTest() {
  if (batchTestSites.value.length === 0) {
    notification.warning('当前没有可测试的站点');
    return;
  }
  batchTestShow.value = true;
}

async function handleSyncThirdParty() {
  if (syncLoading.value) return;
  syncLoading.value = true;
  const results = await Promise.allSettled([
    syncIndexerSitesApi('jackett'),
    syncIndexerSitesApi('prowlarr'),
  ]);
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed === 0) {
    notification.success('第三方站点同步完成');
  } else if (failed < results.length) {
    notification.warning('部分第三方站点同步失败');
  } else {
    notification.error('第三方站点同步失败');
  }
  await fetchSites();
  syncLoading.value = false;
}

async function handleSiteConfigUpdate(site: SiteItem, data: Partial<SiteItem>) {
  try {
    await updateIndexerSiteConfigApi({
      site_name: site.name,
      enabled: data.enabled,
      download_setting: data.download_setting,
    });
    notification.success('保存成功');
    await fetchSites();
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  }
}

async function fetchSiteDefinitions() {
  try {
    const res: any = await getSiteDefinitionsApi();
    const list = Array.isArray(res) ? res : res?.data || [];
    definitions.value = list;
  } catch (error: any) {
    notification.error('获取站点定义失败', {
      description: error?.message || '',
    });
  }
}

onMounted(() => {
  fetchSites();
  fetchSiteDefinitions();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="站点维护">
      <template #actions>
        <NSpace align="center">
          <NButton :loading="syncLoading" @click="handleSyncThirdParty">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            同步站点
          </NButton>
          <NButton @click="handleBatchTest">
            <template #icon>
              <IconifyIcon icon="lucide:activity" class="h-4 w-4" />
            </template>
            批量测试
          </NButton>
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

    <div class="toolbar-bar">
      <div class="source-filter-bar" role="tablist" aria-label="来源筛选">
        <button
          v-for="item in visibleSourceOptions"
          :key="item.key"
          class="source-filter-item"
          :class="{ 'source-filter-active': activeSource === item.key }"
          :aria-selected="activeSource === item.key"
          role="tab"
          type="button"
          @click="activeSource = item.key"
        >
          <IconifyIcon :icon="item.icon" class="source-filter-icon" />
          <span>{{ item.label }}</span>
          <span class="source-filter-count">{{
            sourceCounts[item.key] || 0
          }}</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="filter-type">
        <NSelect
          v-model:value="activeType"
          :options="typeOptions"
          size="small"
          :consistent-menu-width="false"
          style="width: 88px"
        />
      </div>

      <div class="toolbar-spacer"></div>

      <NInput
        v-model:value="searchKeyword"
        placeholder="搜索名称 / 地址"
        clearable
        size="small"
        class="toolbar-search"
      >
        <template #prefix>
          <IconifyIcon
            icon="lucide:search"
            class="h-3.5 w-3.5 text-muted-foreground"
          />
        </template>
      </NInput>
    </div>

    <div class="site-main">
      <NSpin :show="loading">
        <div v-if="groupedSites.length > 0" class="site-groups">
          <section
            v-for="group in groupedSites"
            :key="group.source"
            class="site-group"
          >
            <div v-if="group.header" class="site-group-header">
              <IconifyIcon :icon="group.icon" class="site-group-icon" />
              <span class="site-group-title">{{ group.label }}</span>
              <span class="site-group-count"
                >{{ group.sites.length }} 个站点</span
              >
            </div>
            <div class="grid-site-card">
              <SiteCard
                v-for="site in group.sites"
                :key="site.id"
                :site="site"
                :favicon="site.third_party ? '' : getFavicon(site.name)"
                :favicon-fallback="
                  site.third_party ? '' : getFaviconFallback(site.name)
                "
                :favicon-failed="!!faviconLoadFailed[site.name]"
                :testing="testLoading === site.id"
                :download-settings="downloadSettings"
                @favicon-error="handleFaviconError"
                @test="handleTest"
                @edit="handleEdit"
                @delete="handleDelete"
                @update="handleSiteConfigUpdate"
              />
            </div>
          </section>
        </div>

        <EmptyState
          v-else-if="!loading"
          title="没有站点"
          subtitle="当前筛选条件下没有站点"
        />
      </NSpin>
    </div>

    <SiteEditModal
      ref="editModalRef"
      v-model:show="editModalShow"
      :site="editingSite"
      :definitions="definitions"
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
    <SiteBatchTestModal v-model:show="batchTestShow" :sites="batchTestSites" />
  </div>
</template>

<style scoped>
.toolbar-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
}

.source-filter-bar {
  display: flex;
  gap: 0.125rem;
  align-items: center;
  padding: 0.125rem;
  overflow-x: auto;
  scrollbar-width: none;
  background: hsl(var(--accent) / 45%);
  border-radius: 0.625rem;
}

.source-filter-bar::-webkit-scrollbar {
  display: none;
}

.source-filter-item {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.375rem;
  align-items: center;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.source-filter-item:hover {
  color: hsl(var(--card-foreground));
}

.source-filter-active {
  color: hsl(var(--primary));
  background: hsl(var(--card));
  box-shadow: 0 1px 2px hsl(var(--foreground) / 8%);
}

.source-filter-icon {
  flex-shrink: 0;
  width: 0.9375rem;
  height: 0.9375rem;
}

.source-filter-count {
  flex-shrink: 0;
  min-width: 1.125rem;
  padding: 0.0625rem 0.3125rem;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.25rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
  background: hsl(var(--background));
  border-radius: 9999px;
}

.source-filter-active .source-filter-count {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
}

.toolbar-divider {
  width: 1px;
  height: 1.25rem;
  margin: 0 0.125rem;
  background: hsl(var(--border));
}

.filter-type {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-search {
  width: 220px;
  max-width: 100%;
}

.site-main {
  min-width: 0;
}

.site-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.site-group-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.site-group-icon {
  width: 1rem;
  height: 1rem;
  color: hsl(var(--primary));
}

.site-group-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.site-group-count {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
  border-radius: 9999px;
}

.grid-site-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.875rem;
}

@media (max-width: 640px) {
  .toolbar-search {
    flex: 1 1 100%;
    width: auto;
  }
}
</style>
