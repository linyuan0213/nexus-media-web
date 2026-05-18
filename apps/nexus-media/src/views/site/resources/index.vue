<script lang="ts" setup>
import { ref, onMounted } from 'vue';

import {
  NButton,
  NCard,
  NInput,
  NSpace,
  NSpin,
  NPagination,
  NModal,
  NSelect,
  NForm,
  NFormItem,
  useNotification,
} from 'naive-ui';

import { getSiteResourcesApi, getSiteFaviconsApi } from '#/api/modules/site';
import { getIndexersApi, getDownloadSettingsApi, getDownloadDirsApi, addTorrentApi, resolveDownloadUrlApi } from '#/api/modules/download';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { IconifyIcon } from '@vben/icons';

interface SiteItem {
  id: string;
  name: string;
}

interface ResourceItem {
  id: string;
  indexer: string;
  title: string;
  description?: string;
  size?: number;
  seeders?: number;
  leechers?: number;
  pubdate?: string;
  labels?: string[];
  enclosure?: string;
  page_url?: string;
  uploadvolumefactor?: number;
  downloadvolumefactor?: number;
}

const notification = useNotification();
const loading = ref(false);
const sites = ref<SiteItem[]>([]);
const resources = ref<ResourceItem[]>([]);
const selectedSite = ref<SiteItem | null>(null);
const keyword = ref('');
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);
const favicons = ref<Record<string, string>>({});
const faviconLoadFailed = ref<Record<string, boolean>>({});

// 下载弹窗
const downloadModalVisible = ref(false);
const downloadModalLoading = ref(false);
const downloadResource = ref<ResourceItem | null>(null);
const downloadSettings = ref<Array<{ label: string; value: string }>>([]);
const downloadDirs = ref<Array<{ label: string; value: string }>>([{ label: '自动', value: '' }]);
const selectedDownloadSetting = ref('');
const selectedDownloadDir = ref('');

async function fetchSites() {
  loading.value = true;
  try {
    const [indexersRes, faviconRes]: [any, any] = await Promise.all([
      getIndexersApi(),
      getSiteFaviconsApi().catch(() => ({} as any)),
    ]);
    const list = Array.isArray(indexersRes) ? indexersRes : (indexersRes?.data || []);
    sites.value = list.map((s: any) => ({ id: s.id, name: s.name }));
    favicons.value = faviconRes?.data || faviconRes || {};
  } catch (err: any) {
    notification.error({ content: '获取站点列表失败', description: err?.message || '' });
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

function selectSite(site: SiteItem) {
  selectedSite.value = site;
  keyword.value = '';
  currentPage.value = 1;
  fetchData();
}

function backToSites() {
  selectedSite.value = null;
  resources.value = [];
  total.value = 0;
}

async function fetchData(page = 1) {
  if (!selectedSite.value) return;
  loading.value = true;
  try {
    const res: any = await getSiteResourcesApi({
      id: selectedSite.value.id,
      page: page - 1,
      keyword: keyword.value || undefined,
    });
    let data: any[] = [];
    if (Array.isArray(res)) {
      data = res;
    } else if (Array.isArray(res?.data)) {
      data = res.data;
    } else if (Array.isArray(res?.data?.list)) {
      data = res.data.list;
    } else if (res?.data) {
      data = [res.data];
    }
    resources.value = data;
    total.value = data.length || 0;
    currentPage.value = page;
  } catch (err: any) {
    notification.error({ content: '获取数据失败', description: err?.message || '' });
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  fetchData(1);
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchData(page);
}

function handleOpenUrl(url?: string) {
  if (url) {
    window.open(url, '_blank');
  }
}

// 下载弹窗
async function openDownloadModal(item: ResourceItem) {
  if (!item.enclosure && !item.page_url) {
    notification.warning({ content: '该资源暂无下载链接，请前往详情页查看' });
    return;
  }
  downloadResource.value = item;
  downloadModalVisible.value = true;
  downloadModalLoading.value = true;
  downloadSettings.value = [];
  downloadDirs.value = [{ label: '自动', value: '' }];
  selectedDownloadSetting.value = '';
  selectedDownloadDir.value = '';
  try {
    const settingsRes: any = await getDownloadSettingsApi();
    if (Array.isArray(settingsRes)) {
      downloadSettings.value = settingsRes.map((s: any) => ({
        label: s.name || String(s.id),
        value: String(s.id),
      }));
    } else if (typeof settingsRes === 'object' && !Array.isArray(settingsRes)) {
      downloadSettings.value = Object.entries(settingsRes).map(([sid, s]: [string, any]) => ({
        label: (s as any).name || sid,
        value: String((s as any).id || sid),
      }));
    }
    if (downloadSettings.value.length) {
      const first = downloadSettings.value[0]!.value;
      selectedDownloadSetting.value = first;
      await loadDownloadDirs(first);
    }
  } catch (err: any) {
    notification.error({ content: '获取下载设置失败', description: err?.message || '' });
  } finally {
    downloadModalLoading.value = false;
  }
}

async function loadDownloadDirs(val: string) {
  downloadDirs.value = [{ label: '自动', value: '' }];
  if (!val) return;
  try {
    const dirsRes: any = await getDownloadDirsApi(val);
    if (Array.isArray(dirsRes) && dirsRes.length) {
      downloadDirs.value = [{ label: '自动', value: '' }, ...dirsRes.map((d: string) => ({ label: d, value: d }))];
    }
  } catch {}
}

async function onDownloadSettingChange(val: string | null) {
  selectedDownloadSetting.value = val || '';
  selectedDownloadDir.value = '';
  await loadDownloadDirs(val || '');
}

async function confirmDownload() {
  if (!downloadResource.value) return;
  downloadModalLoading.value = true;
  try {
    let enclosure = downloadResource.value.enclosure || '';
    // m-team/yemapt 等特殊站点需要通过 page_url 获取下载链接
    if (!enclosure && downloadResource.value.page_url) {
      const res: any = await resolveDownloadUrlApi({
        page_url: downloadResource.value.page_url,
        enclosure: downloadResource.value.enclosure,
      });
      enclosure = res?.data?.url || res?.url || '';
    }
    if (!enclosure) {
      notification.error({ content: '无法获取下载链接' });
      return;
    }
    await addTorrentApi({
      urls: [enclosure],
      dl_dir: selectedDownloadDir.value || undefined,
      dl_setting: selectedDownloadSetting.value || undefined,
      page_url: downloadResource.value.page_url || undefined,
      upload_volume_factor: downloadResource.value.uploadvolumefactor ?? undefined,
      download_volume_factor: downloadResource.value.downloadvolumefactor ?? undefined,
      title: downloadResource.value.title || undefined,
      description: downloadResource.value.description || undefined,
      site: downloadResource.value.indexer || undefined,
      size: downloadResource.value.size ?? undefined,
    });
    notification.success({ content: '下载任务已提交', duration: 2000 });
    downloadModalVisible.value = false;
  } catch (err: any) {
    notification.error({ content: '下载失败', description: err?.message || '未知错误' });
  } finally {
    downloadModalLoading.value = false;
  }
}

function getFreeTag(item: ResourceItem) {
  const up = item.uploadvolumefactor ?? 1;
  const down = item.downloadvolumefactor ?? 1;
  if (down === 0 && up === 2) return { label: '2X免费', type: 'warning' as const };
  if (down === 0) return { label: '免费', type: 'success' as const };
  return null;
}

function parseLabels(labels?: string | string[]): string[] {
  if (!labels) return [];
  if (Array.isArray(labels)) return labels;
  return labels.split('|').filter(Boolean);
}

function getLabelClass(label: string): string {
  const lower = label.toLowerCase();
  // 字幕/语言类 → 绿色
  if (/国语|中字|粤语|双语|中英|英文|简繁|繁体|简体|字幕|sub/.test(lower)) {
    return 'resource-tag-lang';
  }
  // 禁止类 → 红色
  if (/禁转|禁止|禁|exclusive/.test(lower)) {
    return 'resource-tag-danger';
  }
  // 官方/官组 → 主色
  if (/官组|官方|官|official/.test(lower)) {
    return 'resource-tag-primary';
  }
  // 画质/视频编码 → 橙色
  if (/hdr|sdr|杜比视界|dolby.vision|画质|4k|2160p|1080p|720p|hevc|x264|x265|avc|vp9/.test(lower)) {
    return 'resource-tag-warning';
  }
  // 音频/音效 → 蓝色
  if (/杜比|dobly|atmos|truehd|dts|flac|aac|ac3|eac3|mp3|opus|audio/.test(lower)) {
    return 'resource-tag-info';
  }
  // 来源/压制 → 紫色
  if (/web-dl|blu-ray|bdrip|brrip|dvdrip|hdtv|tvrip|转制|压制|remux|webrip/.test(lower)) {
    return 'resource-tag-accent';
  }
  // 版本/完整性 → 青色
  if (/去广告|纯净版|完整版|未删减|导演剪辑|加长版|uncut|unrated/.test(lower)) {
    return 'resource-tag-cyan';
  }
  return 'resource-tag-default';
}

function formatSize(size?: number): string {
  if (size == null || size <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = size;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(1)} ${units[idx]}`;
}

function formatDate(date?: string): string {
  if (!date) return '-';
  return date;
}

onMounted(() => {
  fetchSites();
});
</script>

<template>
  <div class="p-4">
    <!-- 站点列表视图 -->
    <template v-if="!selectedSite">
      <PageHeader title="站点资源">
        <template #actions>
          <NSpace>
            <NButton size="small" @click="fetchSites">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
              </template>
              刷新
            </NButton>
          </NSpace>
        </template>
      </PageHeader>

      <NSpin :show="loading">
        <div v-if="sites.length > 0" class="site-grid">
          <NCard
            v-for="site in sites"
            :key="site.id"
            size="small"
            class="site-card"
            hoverable
            @click="selectSite(site)"
          >
            <div class="site-card-content">
              <div class="site-logo-wrap">
                <img
                  v-show="!faviconLoadFailed[site.name]"
                  :src="getFavicon(site.name) || getFaviconFallback(site.name)"
                  :alt="site.name"
                  class="site-logo-img"
                  @error="handleFaviconError(site.name)"
                />
                <div
                  v-show="faviconLoadFailed[site.name]"
                  class="site-logo-placeholder"
                >
                  {{ site.name.charAt(0).toUpperCase() }}
                </div>
              </div>
              <div class="site-info">
                <div class="site-name">{{ site.name }}</div>
                <div class="site-id">{{ site.id }}</div>
              </div>
              <div class="site-arrow">
                <IconifyIcon icon="lucide:chevron-right" class="h-5 w-5" />
              </div>
            </div>
          </NCard>
        </div>

        <EmptyState
          v-else-if="!loading"
          title="暂无站点"
          subtitle="没有可用的索引站点"
        >
          <template #icon>
            <IconifyIcon icon="lucide:server-off" class="h-12 w-12" />
          </template>
        </EmptyState>
      </NSpin>
    </template>

    <!-- 资源列表视图 -->
    <template v-else>
      <PageHeader :title="`${selectedSite.name} - 资源列表`">
        <template #actions>
          <NSpace>
            <NButton size="small" @click="backToSites">
              <template #icon>
                <IconifyIcon icon="lucide:arrow-left" class="h-4 w-4" />
              </template>
              返回
            </NButton>
            <NButton size="small" @click="() => fetchData()">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
              </template>
              刷新
            </NButton>
          </NSpace>
        </template>
      </PageHeader>

      <!-- 搜索栏 -->
      <div class="search-bar">
        <div class="search-row">
          <NInput
            v-model:value="keyword"
            placeholder="搜索资源名称"
            clearable
            class="search-input"
            size="small"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:search" class="h-4 w-4" style="color: hsl(var(--muted-foreground))" />
            </template>
          </NInput>
          <NButton type="primary" size="small" @click="handleSearch">
            <template #icon>
              <IconifyIcon icon="lucide:search" class="h-4 w-4" />
            </template>
            搜索
          </NButton>
        </div>
      </div>

      <!-- 统计条 -->
      <div v-if="resources.length > 0" class="stats-bar">
        <span class="stats-text">
          共 <strong>{{ total }}</strong> 条资源
        </span>
      </div>

      <NSpin :show="loading">
        <div v-if="resources.length > 0" class="resource-grid">
          <NCard
            v-for="(item, index) in resources"
            :key="`${item.indexer}-${item.title}-${index}`"
            size="small"
            class="resource-card"
          >
            <!-- 标题行 -->
            <div class="resource-header">
              <div class="resource-title-row">
                <span
                  v-if="getFreeTag(item)"
                  class="resource-free-inline"
                >
                  {{ getFreeTag(item)!.label }}
                </span>
                <div class="resource-title" :title="item.title">{{ item.title }}</div>
              </div>
              <div class="resource-badges">
                <span
                  v-for="label in parseLabels(item.labels)"
                  :key="label"
                  class="resource-tag"
                  :class="getLabelClass(label)"
                >{{ label }}</span>
              </div>
            </div>

            <!-- 副标题 -->
            <div v-if="item.description" class="resource-description">
              <IconifyIcon icon="lucide:quote" class="h-3 w-3 shrink-0" />
              <span>{{ item.description }}</span>
            </div>

            <!-- 信息行 -->
            <div class="resource-meta">
              <div class="meta-group">
                <span class="meta-icon">
                  <IconifyIcon icon="lucide:hard-drive" class="h-3.5 w-3.5" />
                </span>
                <span class="meta-value">{{ formatSize(item.size) }}</span>
              </div>
              <div class="meta-group">
                <span class="meta-icon seeders">
                  <IconifyIcon icon="lucide:arrow-up" class="h-3.5 w-3.5" />
                </span>
                <span class="meta-value seeders">{{ item.seeders || 0 }}</span>
              </div>
              <div class="meta-group">
                <span class="meta-icon leechers">
                  <IconifyIcon icon="lucide:arrow-down" class="h-3.5 w-3.5" />
                </span>
                <span class="meta-value leechers">{{ item.leechers || 0 }}</span>
              </div>
              <div v-if="item.pubdate" class="meta-group">
                <span class="meta-icon">
                  <IconifyIcon icon="lucide:clock" class="h-3.5 w-3.5" />
                </span>
                <span class="meta-value">{{ formatDate(item.pubdate) }}</span>
              </div>
            </div>

            <!-- 操作行 -->
            <div class="resource-actions">
              <NButton
                size="small"
                type="primary"
                ghost
                @click="openDownloadModal(item)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:download" class="h-4 w-4" />
                </template>
                下载
              </NButton>
              <NButton
                v-if="item.page_url"
                size="small"
                @click="handleOpenUrl(item.page_url)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:external-link" class="h-4 w-4" />
                </template>
                详情
              </NButton>
            </div>
          </NCard>
        </div>

        <EmptyState
          v-else-if="!loading"
          title="暂无资源"
          subtitle="该站点暂无资源或连接失败"
        >
          <template #icon>
            <IconifyIcon icon="lucide:database" class="h-12 w-12" />
          </template>
        </EmptyState>

        <!-- 分页 -->
        <div v-if="total > pageSize" class="pagination-bar">
          <NPagination
            v-model:page="currentPage"
            :page-size="pageSize"
            :item-count="total"
            :page-sizes="[20, 50, 100]"
            show-size-picker
            @update:page="handlePageChange"
          />
        </div>
      </NSpin>
    </template>

    <!-- 下载弹窗 -->
    <NModal
      v-model:show="downloadModalVisible"
      :title="`下载 - ${downloadResource?.title || ''}`"
      preset="card"
      class="w-[480px]"
      :bordered="false"
      :segmented="{ content: true }"
      :mask-closable="false"
    >
      <NSpin :show="downloadModalLoading">
        <NForm label-placement="top" size="small">
          <NFormItem label="下载设置">
            <NSelect
              v-model:value="selectedDownloadSetting"
              :options="downloadSettings"
              placeholder="请选择下载设置"
              clearable
              @update:value="onDownloadSettingChange"
            />
          </NFormItem>
          <NFormItem label="保存目录">
            <NSelect
              v-model:value="selectedDownloadDir"
              :options="downloadDirs"
              placeholder="请选择保存目录"
              clearable
            />
          </NFormItem>
        </NForm>
      </NSpin>

      <template #footer>
        <NSpace justify="end">
          <NButton size="small" @click="downloadModalVisible = false">取消</NButton>
          <NButton
            size="small"
            type="primary"
            :loading="downloadModalLoading"
            :disabled="!downloadResource?.enclosure && !downloadResource?.page_url"
            @click="confirmDownload"
          >
            确认下载
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
/* ===== 站点列表样式 ===== */
.site-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.site-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.site-card:hover {
  border-left-color: hsl(var(--primary));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.site-card :deep(.n-card__content) {
  padding: 1rem;
}

.site-card-content {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.site-logo-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  flex-shrink: 0;
  overflow: hidden;
}

.site-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 0.25rem;
}

.site-logo-placeholder {
  font-size: 1rem;
  font-weight: 700;
  color: hsl(var(--primary));
}

.site-info {
  flex: 1;
  min-width: 0;
}

.site-name {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  line-height: 1.3;
}

.site-id {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.125rem;
}

.site-arrow {
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}

/* ===== 资源列表样式 ===== */
.search-bar {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background-color: hsl(var(--card));
}

.search-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
}

.stats-bar {
  margin-bottom: 0.75rem;
  padding: 0 0.25rem;
}

.stats-text {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.stats-text strong {
  color: hsl(var(--card-foreground));
  font-weight: 600;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 0.75rem;
}

.resource-card {
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.resource-card:hover {
  border-left-color: hsl(var(--primary));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.resource-card :deep(.n-card__content) {
  padding: 1rem;
}

/* 标题行 */
.resource-header {
  margin-bottom: 0.75rem;
}

.resource-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
  word-break: break-word;
}

.resource-badges {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.resource-tag {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.4;
}

.resource-tag-default {
  background-color: hsl(var(--muted) / 0.3);
  color: hsl(var(--muted-foreground));
}

.resource-tag-primary {
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.resource-tag-danger {
  background-color: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

.resource-tag-lang {
  background-color: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.resource-tag-warning {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.resource-tag-info {
  background-color: hsla(210, 80%, 55%, 0.1);
  color: hsl(210, 80%, 55%);
}

.resource-tag-accent {
  background-color: hsl(var(--accent));
  color: hsl(var(--card-foreground));
}

.resource-tag-cyan {
  background-color: hsla(185, 70%, 45%, 0.1);
  color: hsl(185, 70%, 45%);
}

.resource-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.resource-free-inline {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background-color: hsl(var(--success));
  color: hsl(var(--success-foreground, var(--primary-foreground)));
  line-height: 1.4;
  margin-top: 0.15rem;
}

/* 副标题 */
.resource-description {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  margin-bottom: 0.5rem;
  border-radius: 0.375rem;
  background: hsl(var(--accent) / 0.4);
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  line-height: 1.5;
  word-break: break-word;
}

.resource-description span {
  flex: 1;
  min-width: 0;
}

/* 信息行 */
.resource-meta {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex-wrap: wrap;
  padding: 0.625rem;
  background-color: hsl(var(--accent));
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
}

.meta-group {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.meta-icon {
  color: hsl(var(--muted-foreground));
  display: inline-flex;
  align-items: center;
}

.meta-icon.seeders {
  color: hsl(var(--success));
}

.meta-icon.leechers {
  color: hsl(var(--warning));
}

.meta-value {
  font-size: 0.8125rem;
  color: hsl(var(--card-foreground));
  font-weight: 500;
}

.meta-value.seeders {
  color: hsl(var(--success));
}

.meta-value.leechers {
  color: hsl(var(--warning));
}

/* 操作行 */
.resource-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.pagination-bar {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid hsl(var(--border));
  display: flex;
  justify-content: center;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .site-grid {
    grid-template-columns: 1fr;
  }

  .search-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .resource-grid {
    grid-template-columns: 1fr;
  }

  .resource-meta {
    gap: 0.5rem;
  }
}
</style>
