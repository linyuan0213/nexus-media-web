<script lang="ts" setup>
import type { SiteForm, SiteItem, SiteSelectOption } from './types';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSelect, NSpace, NSpin } from 'naive-ui';

import { getDownloadSettingsApi } from '#/api/modules/download';
import { getFilterGroupsApi } from '#/api/modules/filter';
import {
  deleteSiteApi,
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
      if (activeType.value === 'bt') return s.site_public;
      return !s.site_public;
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

onMounted(fetchSites);
</script>

<template>
  <div class="p-4">
    <PageHeader title="站点维护">
      <template #actions>
        <NSpace align="center">
          <div class="filter-type">
            <span class="filter-type-label">类型</span>
            <NSelect
              v-model:value="activeType"
              :options="typeOptions"
              size="small"
              :consistent-menu-width="false"
              style="width: 90px"
            />
          </div>
          <NButton :loading="syncLoading" @click="handleSyncThirdParty">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            同步站点
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

    <div class="site-layout">
      <aside class="source-sidebar">
        <nav class="source-nav" role="tablist">
          <button
            v-for="item in sourceOptions"
            :key="item.key"
            class="source-nav-item"
            :class="{ 'source-nav-active': activeSource === item.key }"
            :aria-selected="activeSource === item.key"
            role="tab"
            type="button"
            @click="activeSource = item.key"
          >
            <IconifyIcon :icon="item.icon" class="source-nav-icon" />
            <span class="source-nav-label">{{ item.label }}</span>
            <span class="source-nav-count">{{
              sourceCounts[item.key] || 0
            }}</span>
          </button>
        </nav>
      </aside>

      <main class="site-main">
        <NSpin :show="loading">
          <div v-if="groupedSites.length > 0" class="site-groups">
            <section
              v-for="group in groupedSites"
              :key="group.source"
              class="site-group"
            >
              <div class="site-group-header">
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
            v-else
            title="没有站点"
            subtitle="当前筛选条件下没有站点"
          />
        </NSpin>
      </main>
    </div>

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
.site-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.source-sidebar {
  position: sticky;
  top: 1rem;
  flex-shrink: 0;
  width: 180px;
}

.source-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.875rem;
}

.source-nav-item {
  position: relative;
  display: flex;
  gap: 0.625rem;
  align-items: center;
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 0.625rem;
  transition: all 0.2s ease;
}

.source-nav-item::before {
  position: absolute;
  top: 50%;
  left: 0.25rem;
  width: 0.1875rem;
  height: 1rem;
  content: '';
  background: hsl(var(--primary));
  border-radius: 9999px;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 0.2s ease;
}

.source-nav-item:hover {
  color: hsl(var(--card-foreground));
  background: hsl(var(--accent) / 50%);
}

.source-nav-active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.source-nav-active::before {
  opacity: 1;
}

.source-nav-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
}

.source-nav-label {
  flex: 1;
  text-align: left;
}

.source-nav-count {
  flex-shrink: 0;
  min-width: 1.25rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  text-align: center;
  background: hsl(var(--background));
  border-radius: 9999px;
}

.source-nav-active .source-nav-count {
  color: hsl(var(--primary));
  background: hsl(var(--background));
}

.site-main {
  flex: 1;
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

.filter-type {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.5rem;
  align-items: center;
}

.filter-type-label {
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

@media (max-width: 768px) {
  .site-layout {
    flex-direction: column;
    gap: 1rem;
  }

  .source-sidebar {
    position: static;
    width: 100%;
  }

  .source-nav {
    flex-flow: row wrap;
  }

  .source-nav-item {
    flex: 1;
    min-width: 120px;
  }

  .filter-type-label {
    display: none;
  }

  .grid-site-card {
    grid-template-columns: 1fr;
  }
}
</style>
