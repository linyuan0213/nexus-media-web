<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSpin,
  NSwitch,
  NSelect,
  useNotification,
} from 'naive-ui';

import {
  deleteSiteApi,
  getSitesApi,
  saveSiteApi,
  testSiteApi,
  getSiteFaviconsApi,
} from '#/api/modules/site';
import { getFilterGroupsApi } from '#/api/modules/filter';
import { getDownloadSettingsApi } from '#/api/modules/download';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { IconifyIcon } from '@vben/icons';
import { useSiteStore } from '#/store';

interface SiteForm {
  id?: number;
  name: string;
  pri: string;
  signurl: string;
  cookie: string;
  rssurl: string;
  public: string;
  rss_enable: boolean;
  brush_enable: boolean;
  statistic_enable: boolean;
  parse: boolean;
  unread_msg_notify: boolean;
  chrome: boolean;
  proxy: boolean;
  subtitle: boolean;
  tag: boolean;
  ua: string;
  headers: string;
  rule: string;
  download_setting: string;
  limit_interval: string;
  limit_count: string;
  limit_seconds: string;
}

const siteStore = useSiteStore();
const notification = useNotification();
const loading = ref(false);
const testLoading = ref<number | null>(null);
const activeType = ref('all');
const editModalShow = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<any>(null);
const editingSite = ref<SiteForm | null>(null);

const favicons = ref<Record<string, string>>({});
const faviconLoadFailed = ref<Record<string, boolean>>({});
const filterGroups = ref<Array<{ label: string; value: string }>>([{ label: '默认', value: '' }]);
const downloadSettings = ref<Array<{ label: string; value: string }>>([{ label: '默认', value: '' }]);

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

async function fetchSites() {
  loading.value = true;
  try {
    const [sitesRes, favRes, filterRes, dlRes]: any = await Promise.all([
      getSitesApi(),
      getSiteFaviconsApi(),
      getFilterGroupsApi(),
      getDownloadSettingsApi(),
    ]);
    const list = Array.isArray(sitesRes) ? sitesRes : (sitesRes?.data || []);
    siteStore.setSites(list);

    // requestClient 已自动解包 { code: 0, data: {...} }
    const favData = (typeof favRes === 'object' && !Array.isArray(favRes)) ? favRes : (favRes?.data || {});
    favicons.value = favData;

    const fg = Array.isArray(filterRes) ? filterRes : (filterRes?.data || []);
    filterGroups.value = [{ label: '默认', value: '' }, ...fg.map((g: any) => ({
      label: g.name || String(g.id),
      value: String(g.id),
    }))];

    const ds = Array.isArray(dlRes) ? dlRes : (dlRes?.data || []);
    downloadSettings.value = [{ label: '默认', value: '' }, ...ds.map((d: any) => ({
      label: d.name || String(d.id),
      value: String(d.id),
    }))];
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

function getSiteTypeLabel(publicFlag?: boolean): string {
  return publicFlag ? 'BT' : 'PT';
}

function getSiteTypeColor(publicFlag?: boolean): any {
  return publicFlag ? 'warning' : 'success';
}

function parseNoteBool(val?: string | boolean): boolean {
  if (typeof val === 'boolean') return val;
  return val === 'Y' || val === 'y' || val === '1';
}

function parseNoteStr(val?: string): string {
  return val || '';
}

function buildNote(form: SiteForm): string {
  const note: Record<string, any> = {};
  if (form.rule) note.rule = form.rule;
  if (form.download_setting) note.download_setting = form.download_setting;
  if (form.parse) note.parse = 'Y';
  if (form.ua) note.ua = form.ua;
  if (form.headers) note.headers = form.headers;
  if (form.chrome) note.chrome = 'Y';
  if (form.proxy) note.proxy = 'Y';
  if (form.unread_msg_notify) note.message = 'Y';
  if (form.subtitle) note.subtitle = 'Y';
  if (form.tag) note.tag = 'Y';
  if (form.public === 'Y') note.public = 'Y';
  else note.public = 'N';
  if (form.limit_interval) note.limit_interval = form.limit_interval;
  if (form.limit_count) note.limit_count = form.limit_count;
  if (form.limit_seconds) note.limit_seconds = form.limit_seconds;
  return JSON.stringify(note);
}

function handleAdd() {
  editingSite.value = {
    name: '',
    pri: '1',
    signurl: '',
    cookie: '',
    rssurl: '',
    public: 'N',
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
    limit_interval: '',
    limit_count: '',
    limit_seconds: '',
  };
  editModalShow.value = true;
}

function handleEdit(item: any) {
  const note = item.note || {};
  const isNoteStr = typeof item.note === 'string';
  const parsedNote = isNoteStr ? (() => { try { return JSON.parse(item.note); } catch { return {}; } })() : note;

  editingSite.value = {
    id: item.id,
    name: item.name || '',
    pri: String(item.pri ?? '1'),
    signurl: item.signurl || '',
    cookie: item.cookie || '',
    rssurl: item.rssurl || '',
    public: item.public ? 'Y' : 'N',
    rss_enable: !!item.rss_enable,
    brush_enable: !!item.brush_enable,
    statistic_enable: !!item.statistic_enable,
    parse: parseNoteBool(parsedNote?.parse),
    unread_msg_notify: parseNoteBool(parsedNote?.message),
    chrome: parseNoteBool(parsedNote?.chrome),
    proxy: parseNoteBool(parsedNote?.proxy),
    subtitle: parseNoteBool(parsedNote?.subtitle),
    tag: parseNoteBool(parsedNote?.tag),
    ua: parseNoteStr(parsedNote?.ua),
    headers: parseNoteStr(parsedNote?.headers),
    rule: parseNoteStr(parsedNote?.rule),
    download_setting: parseNoteStr(parsedNote?.download_setting),
    limit_interval: parseNoteStr(parsedNote?.limit_interval),
    limit_count: parseNoteStr(parsedNote?.limit_count),
    limit_seconds: parseNoteStr(parsedNote?.limit_seconds),
  };
  editModalShow.value = true;
}

async function handleSave() {
  if (!editingSite.value?.name) {
    notification.warning({ content: '请输入站点名称' });
    return;
  }
  if (!editingSite.value?.signurl) {
    notification.warning({ content: '请输入站点地址' });
    return;
  }
  try {
    const form = editingSite.value;
    const uses: string[] = [];
    if (form.rss_enable && form.rssurl) uses.push('D');
    if (form.brush_enable && form.rssurl && (form.cookie || form.headers)) uses.push('S');
    if (form.statistic_enable && (form.rssurl || form.signurl) && (form.cookie || form.headers)) uses.push('T');

    await saveSiteApi({
      id: form.id,
      name: form.name,
      pri: form.pri,
      signurl: form.signurl,
      rssurl: form.rssurl,
      cookie: form.cookie,
      note: buildNote(form),
      include: uses.join(''),
    });
    notification.success({ content: '保存成功' });
    editModalShow.value = false;
    await fetchSites();
  } catch (err: any) {
    notification.error({ content: '保存失败', description: err?.message || '' });
  }
}

function handleDelete(item: any) {
  deleteTarget.value = item;
  deleteModalShow.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteSiteApi(deleteTarget.value.id);
    notification.success({ content: '删除成功' });
    await fetchSites();
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  } finally {
    deleteModalShow.value = false;
    deleteTarget.value = null;
  }
}

async function handleTest(item: any) {
  testLoading.value = item.id;
  try {
    await testSiteApi(item.id);
    notification.success({ content: `「${item.name}」连接正常` });
  } catch (err: any) {
    notification.error({ content: `「${item.name}」连接失败`, description: err?.message || '' });
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

    <!-- 类型筛选 -->
    <div class="mb-4">
      <div class="type-tab-group">
        <button
          v-for="tab in typeTabs"
          :key="tab.value"
          class="type-tab-btn"
          :class="{ 'type-tab-active': activeType === tab.value }"
          @click="activeType = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <NSpin :show="loading">
      <div v-if="filteredSites.length > 0" class="grid-site-card">
        <div
          v-for="site in filteredSites"
          :key="site.id"
          class="site-card"
        >
          <!-- 卡片头部 -->
          <div class="site-card-header">
            <div class="site-header-left">
              <!-- Logo -->
              <div class="site-logo">
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

              <div class="site-header-info">
                <div class="site-name-row">
                  <span class="site-name">{{ site.name }}</span>
                  <span
                    class="site-type-badge"
                    :class="site.public ? 'site-type-bt' : 'site-type-pt'"
                  >
                    {{ getSiteTypeLabel(site.public) }}
                  </span>
                </div>
                <div class="site-pri">
                    优先级: {{ site.pri }}
                </div>
              </div>
            </div>

            <NSpace>
              <NButton
                text
                size="small"
                :loading="testLoading === site.id"
                @click="handleTest(site)"
                title="连通性测试"
              >
                <IconifyIcon icon="lucide:activity" class="h-4 w-4" />
              </NButton>
              <NButton text size="small" @click="handleEdit(site)" title="编辑">
                <IconifyIcon icon="lucide:pencil" class="h-4 w-4" />
              </NButton>
              <NButton text size="small" type="error" @click="handleDelete(site)" title="删除">
                <IconifyIcon icon="lucide:trash-2" class="h-4 w-4" />
              </NButton>
            </NSpace>
          </div>

          <!-- 卡片内容 -->
          <div class="site-card-body">
            <!-- 地址信息 -->
            <dl class="site-info-list">
              <div v-if="site.signurl" class="info-row">
                <dt class="info-label">站点地址</dt>
                <dd class="info-value truncate">
                  <a :href="site.signurl" target="_blank" class="site-link">{{ site.signurl }}</a>
                </dd>
              </div>
              <div v-if="site.cookie" class="info-row">
                <dt class="info-label">Cookie</dt>
                <dd class="info-value">***</dd>
              </div>
              <div v-if="site.rssurl" class="info-row">
                <dt class="info-label">RSS</dt>
                <dd class="info-value">已配置</dd>
              </div>
              <div v-if="(site as any).rule" class="info-row">
                <dt class="info-label">过滤规则</dt>
                <dd><span class="site-feature-tag site-feature-rule">{{ (site as any).rule }}</span></dd>
              </div>
            </dl>

            <!-- 功能标签 -->
            <div class="tag-list">
              <span v-if="site.rss_enable" class="site-feature-tag site-feature-rss">RSS订阅</span>
              <span v-if="site.brush_enable" class="site-feature-tag site-feature-brush">刷流</span>
              <span v-if="site.statistic_enable" class="site-feature-tag site-feature-stat">数据统计</span>
              <span v-if="site.parse" class="site-feature-tag site-feature-parse">解析详情</span>
              <span v-if="site.unread_msg_notify" class="site-feature-tag site-feature-msg">消息通知</span>
              <span v-if="site.chrome" class="site-feature-tag site-feature-chrome">浏览器仿真</span>
              <span v-if="site.proxy" class="site-feature-tag site-feature-proxy">代理</span>
            </div>
          </div>
        </div>
      </div>

      <EmptyState
        v-else
        title="没有站点"
        subtitle="没有添加任何站点，请点击「新增站点」按钮"
      />
    </NSpin>

    <!-- 编辑/新增弹窗 -->
    <NModal
      v-model:show="editModalShow"
      :title="editingSite?.id ? '编辑站点' : '新增站点'"
      preset="card"
      class="w-[720px]"
      :bordered="false"
      :segmented="{ content: true }"
    >
      <NForm v-if="editingSite" label-placement="left" label-width="120" size="small">
        <!-- 基础信息 -->
        <div class="form-section">
          <div class="form-section-title">基础信息</div>
          <div class="form-grid-2">
            <NFormItem label="名称" required>
              <NInput v-model:value="editingSite.name" placeholder="自定义站点名称" />
            </NFormItem>
            <NFormItem label="优先级" required>
              <NInput v-model:value="editingSite.pri" placeholder="1-50，越小优先级越高" />
            </NFormItem>
          </div>
          <NFormItem label="站点地址" required>
            <NInput v-model:value="editingSite.signurl" placeholder="https://example.com" />
          </NFormItem>
          <div class="form-grid-2">
            <NFormItem label="站点类型">
              <NSelect
                v-model:value="editingSite.public"
                :options="[
                  { label: 'PT站点（私有）', value: 'N' },
                  { label: 'BT站点（公开）', value: 'Y' },
                ]"
              />
            </NFormItem>
            <NFormItem label="过滤规则">
              <NSelect v-model:value="editingSite.rule" :options="filterGroups" clearable />
            </NFormItem>
          </div>
        </div>

        <!-- 认证信息 -->
        <div class="form-section">
          <div class="form-section-title">认证信息</div>
          <NFormItem label="Cookie">
            <NInput v-model:value="editingSite.cookie" type="textarea" :rows="2" placeholder="站点Cookie，用于签到、数据统计等" />
          </NFormItem>
          <NFormItem label="User-Agent">
            <NInput v-model:value="editingSite.ua" placeholder="站点访问User-Agent，为空使用全局配置" />
          </NFormItem>
          <NFormItem label="请求头参数">
            <NInput
              v-model:value="editingSite.headers"
              type="textarea"
              :rows="2"
              placeholder='自定义请求头参数，格式{"xxx": "xxx"}'
            />
          </NFormItem>
        </div>

        <!-- RSS设置 -->
        <div class="form-section">
          <div class="form-section-title">RSS设置</div>
          <NFormItem label="RSS订阅地址">
            <NInput v-model:value="editingSite.rssurl" placeholder="站点RSS订阅URL" />
          </NFormItem>
          <div class="form-grid-2">
            <NFormItem label="下载设置">
              <NSelect v-model:value="editingSite.download_setting" :options="downloadSettings" clearable />
            </NFormItem>
            <NFormItem>
              <!-- 占位 -->
            </NFormItem>
          </div>
        </div>

        <!-- 功能开关 -->
        <div class="form-section">
          <div class="form-section-title">功能开关</div>
          <div class="switch-grid">
            <div class="switch-item">
              <span class="switch-label">RSS订阅</span>
              <NSwitch v-model:value="editingSite.rss_enable" />
            </div>
            <div class="switch-item">
              <span class="switch-label">刷流任务</span>
              <NSwitch v-model:value="editingSite.brush_enable" />
            </div>
            <div class="switch-item">
              <span class="switch-label">数据统计</span>
              <NSwitch v-model:value="editingSite.statistic_enable" />
            </div>
            <div class="switch-item">
              <span class="switch-label">解析种子详情</span>
              <NSwitch v-model:value="editingSite.parse" />
            </div>
            <div class="switch-item">
              <span class="switch-label">消息通知</span>
              <NSwitch v-model:value="editingSite.unread_msg_notify" />
            </div>
            <div class="switch-item">
              <span class="switch-label">浏览器仿真</span>
              <NSwitch v-model:value="editingSite.chrome" />
            </div>
            <div class="switch-item">
              <span class="switch-label">使用代理</span>
              <NSwitch v-model:value="editingSite.proxy" />
            </div>
            <div class="switch-item">
              <span class="switch-label">下载字幕</span>
              <NSwitch v-model:value="editingSite.subtitle" />
            </div>
            <div class="switch-item">
              <span class="switch-label">下载器标签</span>
              <NSwitch v-model:value="editingSite.tag" />
            </div>
          </div>
        </div>

        <!-- 流控规则 -->
        <div class="form-section">
          <div class="form-section-title">流控规则</div>
          <div class="form-grid-3">
            <NFormItem label="单位时间(分)">
              <NInput v-model:value="editingSite.limit_interval" placeholder="10" />
            </NFormItem>
            <NFormItem label="访问次数">
              <NInput v-model:value="editingSite.limit_count" placeholder="10" />
            </NFormItem>
            <NFormItem label="间隔(秒)">
              <NInput v-model:value="editingSite.limit_seconds" placeholder="5" />
            </NFormItem>
          </div>
        </div>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton size="small" @click="editModalShow = false">取消</NButton>
          <NButton type="primary" size="small" @click="handleSave">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 删除确认 -->
    <NModal
      v-model:show="deleteModalShow"
      title="确认删除"
      preset="dialog"
      positive-text="确认"
      negative-text="取消"
      type="warning"
      @positive-click="confirmDelete"
    >
      <p>确定要删除站点「{{ deleteTarget?.name }}」吗？</p>
    </NModal>
  </div>
</template>

<style scoped>
.type-tab-group {
  display: inline-flex;
  border-radius: 0.5rem;
  border: 1px solid hsl(var(--border));
  overflow: hidden;
}

.type-tab-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
}

.type-tab-btn:hover {
  background-color: hsl(var(--accent));
}

.type-tab-active {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* 站点卡片网格 */
.grid-site-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1rem;
}

/* 站点卡片 */
.site-card {
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  background-color: hsl(var(--card));
  transition: all 0.2s ease;
  overflow: hidden;
}

.site-card:hover {
  border-color: hsl(var(--primary) / 0.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

/* 卡片头部 */
.site-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid hsl(var(--border));
}

.site-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
}

.site-logo {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  overflow: hidden;
  flex-shrink: 0;
  background-color: hsl(var(--accent));
  display: flex;
  align-items: center;
  justify-content: center;
}

.site-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.site-logo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  color: hsl(var(--primary));
}

.site-header-info {
  min-width: 0;
  flex: 1;
}

.site-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.site-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.site-pri {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.125rem;
}

/* 卡片内容 */
.site-card-body {
  padding: 0.875rem 1rem;
}

.site-info-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.info-row {
  display: flex;
  align-items: center;
  font-size: 0.8125rem;
}

.info-label {
  width: 4.5rem;
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  min-width: 0;
  color: hsl(var(--card-foreground));
}

.site-link {
  color: hsl(var(--primary));
  text-decoration: none;
}

.site-link:hover {
  text-decoration: underline;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
}

.site-type-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.4;
}

.site-type-pt {
  background-color: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.site-type-bt {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.site-feature-tag {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.4;
}

.site-feature-rss {
  background-color: hsla(210, 80%, 55%, 0.1);
  color: hsl(210, 80%, 55%);
}

.site-feature-brush {
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.site-feature-stat {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.site-feature-parse {
  background-color: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.site-feature-msg {
  background-color: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.site-feature-chrome {
  background-color: hsla(185, 70%, 45%, 0.1);
  color: hsl(185, 70%, 45%);
}

.site-feature-proxy {
  background-color: hsla(280, 70%, 55%, 0.1);
  color: hsl(280, 70%, 55%);
}

.site-feature-rule {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

/* 表单样式 */
.form-section {
  margin-bottom: 1rem;
}

.form-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid hsl(var(--border));
}

.form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem 1rem;
}

.switch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  background-color: hsl(var(--accent) / 0.3);
}

.switch-label {
  font-size: 0.8125rem;
  color: hsl(var(--card-foreground));
}

@media (max-width: 640px) {
  .grid-site-card {
    grid-template-columns: 1fr;
  }

  .form-grid-2,
  .form-grid-3 {
    grid-template-columns: 1fr;
  }

  .switch-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .site-card-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}
</style>
