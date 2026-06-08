<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';

import {
  NButton,
  NCollapse,
  NCollapseItem,
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
  api_key: string;
  bearer_token: string;
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
  rate_limit: string;
  rate_burst: string;
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
    const favData = (favRes && typeof favRes === 'object' && !Array.isArray(favRes)) ? favRes : (favRes?.data || {});
    favicons.value = favData || {};

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
  if (form.rate_limit) note.rate_limit = form.rate_limit;
  if (form.rate_burst) note.rate_burst = form.rate_burst;
  return JSON.stringify(note);
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
    rate_limit: '10/m',
    rate_burst: '10',
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
    api_key: item.api_key || '',
    bearer_token: item.bearer_token || '',
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
    // 优先使用独立字段，回退到 note.headers（向后兼容）
    headers: item.headers || parseNoteStr(parsedNote?.headers),
    rule: parseNoteStr(parsedNote?.rule),
    download_setting: parseNoteStr(parsedNote?.download_setting),
    rate_limit: parseNoteStr(parsedNote?.rate_limit) || '10/m',
    rate_burst: parseNoteStr(parsedNote?.rate_burst) || '10',
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
    const hasAuth = !!(form.cookie || form.api_key || form.bearer_token || form.headers);
    if (form.rss_enable && form.rssurl) uses.push('D');
    if (form.brush_enable && form.rssurl && hasAuth) uses.push('S');
    if (form.statistic_enable && (form.rssurl || form.signurl) && hasAuth) uses.push('T');

    await saveSiteApi({
      id: form.id,
      name: form.name,
      pri: form.pri,
      signurl: form.signurl,
      rssurl: form.rssurl,
      cookie: form.cookie,
      api_key: form.api_key,
      bearer_token: form.bearer_token,
      headers: form.headers,
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
              <div v-if="site.cookie || site.api_key || site.bearer_token" class="info-row">
                <dt class="info-label">认证</dt>
                <dd class="info-value">已配置</dd>
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
      class="site-edit-modal"
      :style="{ width: '680px', maxWidth: '92vw' }"
      :bordered="false"
      :segmented="{ content: true }"
    >
      <NForm v-if="editingSite" label-placement="left" label-width="110" size="small" class="site-edit-form">
        <!-- 基础信息 -->
        <div class="form-section">
          <div class="form-section-header">
            <div class="form-section-icon form-icon-info">
              <IconifyIcon icon="lucide:info" class="h-4 w-4" />
            </div>
            <span class="form-section-title">基础信息</span>
          </div>
          <div class="form-section-body">
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
        </div>

        <!-- 认证信息 -->
        <div class="form-section">
          <div class="form-section-header">
            <div class="form-section-icon form-icon-auth">
              <IconifyIcon icon="lucide:key-round" class="h-4 w-4" />
            </div>
            <span class="form-section-title">认证信息</span>
          </div>
          <div class="form-section-body">
            <div class="form-grid-2">
              <NFormItem label="Cookie">
                <NInput
                  v-model:value="editingSite.cookie"
                  type="textarea"
                  :rows="2"
                  placeholder="站点Cookie"
                />
              </NFormItem>
              <NFormItem label="API Key">
                <NInput
                  v-model:value="editingSite.api_key"
                  type="password"
                  show-password-on="click"
                  placeholder="站点API Key"
                />
              </NFormItem>
            </div>
            <div class="form-grid-2">
              <NFormItem label="Bearer Token">
                <NInput
                  v-model:value="editingSite.bearer_token"
                  type="password"
                  show-password-on="click"
                  placeholder="站点Bearer Token"
                />
              </NFormItem>
              <NFormItem label="User-Agent">
                <NInput
                  v-model:value="editingSite.ua"
                  placeholder="站点访问User-Agent，为空使用全局配置"
                />
              </NFormItem>
            </div>
            <NCollapse class="auth-advanced">
              <NCollapseItem title="高级请求头">
                <NFormItem label="自定义请求头 (JSON)">
                  <NInput
                    v-model:value="editingSite.headers"
                    type="textarea"
                    :rows="3"
                    placeholder='自定义请求头参数，格式 {"xxx": "xxx"}'
                  />
                </NFormItem>
              </NCollapseItem>
            </NCollapse>
          </div>
        </div>

        <!-- RSS设置 -->
        <div class="form-section">
          <div class="form-section-header">
            <div class="form-section-icon form-icon-rss">
              <IconifyIcon icon="lucide:rss" class="h-4 w-4" />
            </div>
            <span class="form-section-title">RSS设置</span>
          </div>
          <div class="form-section-body">
            <NFormItem label="RSS订阅地址">
              <NInput v-model:value="editingSite.rssurl" placeholder="站点RSS订阅URL" />
            </NFormItem>
            <div class="form-grid-2">
              <NFormItem label="下载设置">
                <NSelect v-model:value="editingSite.download_setting" :options="downloadSettings" clearable />
              </NFormItem>
            </div>
          </div>
        </div>

        <!-- 功能开关 -->
        <div class="form-section">
          <div class="form-section-header">
            <div class="form-section-icon form-icon-switch">
              <IconifyIcon icon="lucide:toggle-left" class="h-4 w-4" />
            </div>
            <span class="form-section-title">功能开关</span>
          </div>
          <div class="form-section-body">
            <div class="switch-grid">
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.rss_enable }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-rss">
                    <IconifyIcon icon="lucide:rss" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">RSS订阅</span>
                    <span class="switch-card-desc">自动获取种子列表</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.rss_enable" size="small" />
              </div>
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.brush_enable }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-brush">
                    <IconifyIcon icon="lucide:zap" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">刷流任务</span>
                    <span class="switch-card-desc">自动下载免费种子</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.brush_enable" size="small" />
              </div>
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.statistic_enable }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-stat">
                    <IconifyIcon icon="lucide:bar-chart-3" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">数据统计</span>
                    <span class="switch-card-desc">上传下载做种统计</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.statistic_enable" size="small" />
              </div>
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.parse }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-parse">
                    <IconifyIcon icon="lucide:file-search" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">解析种子详情</span>
                    <span class="switch-card-desc">获取种子详细信息</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.parse" size="small" />
              </div>
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.unread_msg_notify }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-msg">
                    <IconifyIcon icon="lucide:bell" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">消息通知</span>
                    <span class="switch-card-desc">未读消息提醒</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.unread_msg_notify" size="small" />
              </div>
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.chrome }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-chrome">
                    <IconifyIcon icon="lucide:chrome" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">浏览器仿真</span>
                    <span class="switch-card-desc">模拟浏览器访问</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.chrome" size="small" />
              </div>
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.proxy }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-proxy">
                    <IconifyIcon icon="lucide:globe" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">使用代理</span>
                    <span class="switch-card-desc">通过代理访问站点</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.proxy" size="small" />
              </div>
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.subtitle }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-subtitle">
                    <IconifyIcon icon="lucide:subtitles" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">下载字幕</span>
                    <span class="switch-card-desc">自动获取字幕文件</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.subtitle" size="small" />
              </div>
              <div class="switch-card" :class="{ 'switch-card-on': editingSite.tag }">
                <div class="switch-card-main">
                  <div class="switch-card-icon switch-card-tag">
                    <IconifyIcon icon="lucide:tag" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">下载器标签</span>
                    <span class="switch-card-desc">添加站点标签</span>
                  </div>
                </div>
                <NSwitch v-model:value="editingSite.tag" size="small" />
              </div>
            </div>
          </div>
        </div>

        <!-- 限流配置 -->
        <div class="form-section">
          <div class="form-section-header">
            <div class="form-section-icon form-icon-rate">
              <IconifyIcon icon="lucide:gauge" class="h-4 w-4" />
            </div>
            <span class="form-section-title">限流配置</span>
          </div>
          <div class="form-section-body">
            <div class="form-grid-2">
              <NFormItem label="速率限制">
                <NSelect
                  v-model:value="editingSite.rate_limit"
                  :options="[
                    { label: '不限流', value: '' },
                    { label: '每秒 1 次', value: '1/s' },
                    { label: '每秒 2 次', value: '2/s' },
                    { label: '每分钟 5 次', value: '5/m' },
                    { label: '每分钟 10 次（默认）', value: '10/m' },
                    { label: '每分钟 20 次', value: '20/m' },
                    { label: '每小时 50 次', value: '50/h' },
                    { label: '每小时 100 次', value: '100/h' },
                  ]"
                />
              </NFormItem>
              <NFormItem label="突发容量">
                <NInput v-model:value="editingSite.rate_burst" placeholder="10" />
              </NFormItem>
            </div>
            <div class="form-hint">
              <IconifyIcon icon="lucide:info" class="h-3 w-3" />
              <span>速率格式：次数/单位（s=秒, m=分钟, h=小时）。PT 站点建议设置为 10/m 或更低，防止触发站点流控。</span>
            </div>
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
  background-color: hsl(var(--muted) / 0.4);
  border-radius: 0.625rem;
  padding: 0.25rem;
  gap: 0.125rem;
}

.type-tab-btn {
  padding: 0.375rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  background-color: transparent;
  color: hsl(var(--muted-foreground));
  border: none;
  cursor: pointer;
}

.type-tab-btn:hover {
  color: hsl(var(--foreground));
}

.type-tab-active {
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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

/* 弹窗 */
.site-edit-modal :deep(.n-card-header) {
  padding: 1rem 1.25rem;
}

.site-edit-modal :deep(.n-card__content) {
  padding: 0.5rem 1.25rem 0.75rem;
  max-height: 70vh;
  overflow-y: auto;
}

.site-edit-form {
  padding-bottom: 0.5rem;
}

/* 表单区块 */
.form-section {
  margin-bottom: 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.625rem;
  background-color: hsl(var(--card));
  overflow: hidden;
}

.form-section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background-color: hsl(var(--muted) / 0.25);
  border-bottom: 1px solid hsl(var(--border));
}

.form-section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.625rem;
  height: 1.625rem;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

.form-icon-info {
  background-color: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.form-icon-auth {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.form-icon-rss {
  background-color: hsl(var(--success) / 0.15);
  color: hsl(var(--success));
}

.form-icon-switch {
  background-color: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.form-icon-rate {
  background-color: hsl(280 70% 55% / 0.12);
  color: hsl(280 70% 55%);
}

.form-section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.form-section-body {
  padding: 0.75rem 0.875rem;
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

/* 提示文字 */
.form-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.5rem;
  line-height: 1.5;
}

.form-hint .iconify {
  margin-top: 0.125rem;
  flex-shrink: 0;
}

/* 高级选项折叠 */
.auth-advanced {
  margin-top: 0.5rem;
}

.auth-advanced :deep(.n-collapse-item__header) {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

/* 开关卡片 */
.switch-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;
}

.switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid hsl(var(--border));
  background-color: hsl(var(--card));
  transition: all 0.2s ease;
}

.switch-card:hover {
  border-color: hsl(var(--primary) / 0.3);
  background-color: hsl(var(--accent) / 0.2);
}

.switch-card-on {
  border-color: hsl(var(--primary) / 0.4);
  background-color: hsl(var(--primary) / 0.06);
}

.switch-card-main {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
}

.switch-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  flex-shrink: 0;
  background-color: hsl(var(--muted) / 0.3);
  color: hsl(var(--muted-foreground));
  transition: all 0.2s ease;
}

.switch-card-on .switch-card-icon {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}

.switch-card-rss.switch-card-on .switch-card-icon {
  background-color: hsl(var(--success) / 0.15);
  color: hsl(var(--success));
}

.switch-card-brush.switch-card-on .switch-card-icon {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.switch-card-stat.switch-card-on .switch-card-icon {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}

.switch-card-parse.switch-card-on .switch-card-icon {
  background-color: hsl(var(--success) / 0.15);
  color: hsl(var(--success));
}

.switch-card-msg.switch-card-on .switch-card-icon {
  background-color: hsl(var(--destructive) / 0.15);
  color: hsl(var(--destructive));
}

.switch-card-chrome.switch-card-on .switch-card-icon {
  background-color: hsl(185 70% 45% / 0.15);
  color: hsl(185 70% 45%);
}

.switch-card-proxy.switch-card-on .switch-card-icon {
  background-color: hsl(280 70% 55% / 0.15);
  color: hsl(280 70% 55%);
}

.switch-card-subtitle.switch-card-on .switch-card-icon {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}

.switch-card-tag.switch-card-on .switch-card-icon {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.switch-card-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.switch-card-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.switch-card-desc {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
    grid-template-columns: 1fr;
  }

  .site-card-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .site-edit-modal :deep(.n-card__content) {
    padding: 0.5rem 0.625rem 0.5rem;
  }

  .form-section-body {
    padding: 0.5rem 0.625rem;
  }

  .form-section-header {
    padding: 0.5rem 0.625rem;
  }

  .switch-card {
    padding: 0.5rem 0.625rem;
  }

  .switch-card-desc {
    display: none;
  }
}
</style>
