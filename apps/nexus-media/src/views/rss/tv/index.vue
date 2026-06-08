<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  NButton,
  NCard,
  NCheckbox,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NProgress,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  useNotification,
} from 'naive-ui';

import {
  getTvSubscriptionApi,
  refreshSubscriptionApi,
  addSubscriptionApi,
  updateSubscriptionApi,
  removeSubscriptionApi,
  getDefaultSubscriptionSettingApi,
  saveDefaultSubscriptionSettingApi,
  getSubscriptionDetailApi,
} from '#/api/modules/subscription';
import { searchMediaApi } from '#/api/modules/media';
import { getSitesApi } from '#/api/modules/site';
import { getFilterRulesApi } from '#/api/modules/filter';
import { getDownloadSettingsApi, getDownloadDirsApi, getIndexersApi } from '#/api/modules/download';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';
import { IconifyIcon } from '@vben/icons';
import { useSubscriptionStore } from '#/store';

const subscriptionStore = useSubscriptionStore();
const router = useRouter();
const notification = useNotification();

const loading = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<any>(null);

const subscriptionSites = ref<{ label: string; value: string }[]>([]);
const searchSites = ref<{ label: string; value: string }[]>([]);
const filterRules = ref<{ label: string; value: string }[]>([]);
const filterRuleMap = ref<Record<string, string>>({});
const downloadSettings = ref<{ label: string; value: string }[]>([]);
const downloadDirs = ref<{ label: string; value: string }[]>([]);

const seasonOptions = Array.from({ length: 51 }, (_, i) =>
  i === 0 ? { label: '请选择', value: '' } : { label: `第${i}季`, value: String(i) }
);

const downloadSettingMap = ref<Record<string, string>>({});

function getFilterRuleLabel(val: any): string {
  if (val == null || val === '' || val === '0') return '';
  const s = String(val);
  return filterRuleMap.value[s] || s;
}

function formatSeason(season: string | number | undefined): string {
  if (!season || season === 'S00') return '';
  const n = Number(String(season).replace(/^S/i, ''));
  if (Number.isNaN(n) || n <= 0) return '';
  return `S${String(n).padStart(2, '0')}`;
}
function getDownloadSettingLabel(val: any): string {
  if (val == null || val === '' || val === '-1') return '';
  const s = String(val);
  return downloadSettingMap.value[s] || s;
}

const restypeOptions = [
  { label: '全部', value: '' },
  { label: 'BluRay', value: 'BluRay' },
  { label: 'Remux', value: 'Remux' },
  { label: 'UHD', value: 'UHD' },
  { label: 'WEB-DL', value: 'WEB-DL' },
  { label: 'HDTV', value: 'HDTV' },
  { label: 'H265', value: 'H265' },
  { label: 'H264', value: 'H264' },
];
const pixOptions = [
  { label: '全部', value: '' },
  { label: '4k', value: '4k' },
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
];

const detailModalShow = ref(false);
const detailItem = ref<any>(null);

const subscribeEditShow = ref(false);
const subscribeEditItem = ref<SubscribeEditItem | null>(null);

const addModalShow = ref(false);
const addKeyword = ref('');
const addSearchResults = ref<any[]>([]);
const addSearchLoading = ref(false);
const addForm = ref({
  name: '',
  year: '',
  type: 'tv',
  season: '',
  tmdbid: '',
  image: '',
  keyword: '',
  fuzzy_match: false,
  over_edition: false,
  filter_restype: '',
  filter_pix: '',
  filter_team: '',
  filter_rule: '',
  filter_include: '',
  filter_exclude: '',
  download_setting: '',
  save_path: '',
  total_ep: '',
  current_ep: '',
  rss_sites: [] as string[],
  search_sites: [] as string[],
});
const addStep = ref<'search' | 'form'>('search');
const addSelectedMedia = ref<any>(null);

const settingModalShow = ref(false);
const settingForm = ref({
  over_edition: '0',
  restype: '',
  pix: '',
  team: '',
  rule: '',
  include: '',
  exclude: '',
  download_setting: '',
  rss_sites: [] as string[],
  search_sites: [] as string[],
});

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getTvSubscriptionApi();
    const list = Array.isArray(res) ? res : (res?.data || []);
    subscriptionStore.setTvSubscriptions(list);
  } finally {
    loading.value = false;
  }
}

async function fetchSites() {
  try {
    const res: any = await getSitesApi();
    const sites = Array.isArray(res) ? res : (res?.data || []);
    subscriptionSites.value = sites
      .filter((s: any) => s.rss)
      .map((s: any) => ({ label: s.name, value: s.name }));
  } catch { /* ignore */ }
}

async function fetchIndexers() {
  try {
    const res: any = await getIndexersApi();
    const idx = Array.isArray(res) ? res : (res?.data || []);
    searchSites.value = idx.map((i: any) => ({ label: i.name, value: i.name }));
  } catch { /* ignore */ }
}

async function fetchFilterRules() {
  try {
    const res: any = await getFilterRulesApi();
    const rules = Array.isArray(res) ? res : (res?.data || []);
    filterRules.value = [{ label: '站点规则', value: '' }, ...rules.map((r: any) => ({ label: r.name || r.id, value: String(r.id) }))];
    const map: Record<string, string> = {};
    rules.forEach((r: any) => {
      if (r.id != null) map[String(r.id)] = r.name || String(r.id);
    });
    filterRuleMap.value = map;
  } catch {
    filterRules.value = [{ label: '站点规则', value: '' }];
    filterRuleMap.value = {};
  }
}

async function fetchDownloadSettings() {
  try {
    const res: any = await getDownloadSettingsApi();
    const list = Array.isArray(res) ? res : (res?.data || []);
    downloadSettings.value = [
      { label: '站点设置', value: '' },
      ...list.map((d: any) => {
        const idValue = d.id != null ? String(d.id) : '';
        return { label: d.name || idValue, value: idValue };
      }),
    ];
    // 构建 ID -> 名称 映射，用于卡片展示
    const map: Record<string, string> = {};
    list.forEach((d: any) => {
      if (d.id != null) map[String(d.id)] = d.name || String(d.id);
    });
    downloadSettingMap.value = map;
  } catch {
    downloadSettings.value = [{ label: '站点设置', value: '' }];
    downloadSettingMap.value = {};
  }
}

async function fetchDownloadDirs(sid?: string) {
  try {
    const safeSid = sid && sid !== 'undefined' ? sid : undefined;
    const res: any = await getDownloadDirsApi(safeSid);
    const dirs = Array.isArray(res) ? res : (res?.data || []);
    downloadDirs.value = [{ label: '请选择', value: '' }, ...dirs.map((d: any) => ({ label: d, value: d }))];
  } catch {
    downloadDirs.value = [{ label: '请选择', value: '' }];
  }
}

function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return `/img?url=${encodeURIComponent(src)}`;
}

function getStateDot(state: string) {
  const map: Record<string, string> = {
    D: 'bg-yellow-500',
    S: 'bg-yellow-500',
    R: 'bg-green-500',
    C: 'bg-blue-500',
    E: 'bg-red-500',
    N: 'bg-gray-400',
  };
  return map[state] || 'bg-gray-400';
}

function getStateLabel(state: string) {
  const map: Record<string, string> = {
    D: '待处理',
    S: '搜索中',
    R: '监控中',
    C: '已完成',
    E: '错误',
    N: '已取消',
  };
  return map[state] || state;
}

function tvProgress(item: any) {
  if (item.total && item.total > 0) {
    return Math.round(((item.total - (item.lack || 0)) / item.total) * 100);
  }
  return 0;
}

function handleCardClick(item: any) {
  detailItem.value = item;
  detailModalShow.value = true;
}

function getOverviewText(item: any): string {
  const ov = item?.overview;
  if (typeof ov === 'string' && ov.trim() && !ov.trim().startsWith('{')) return ov.trim();
  return '';
}
function handleDetailEdit() {
  detailModalShow.value = false;
  handleEdit(detailItem.value);
}
function handleDetailDelete() {
  detailModalShow.value = false;
  handleDelete(detailItem.value);
}
function handleDetailSearch() {
  const name = detailItem.value?.name;
  if (!name) {
    notification.warning({ content: '缺少名称，无法搜索' });
    return;
  }
  router.push(`/media/search?s=${encodeURIComponent(name)}`);
}
async function handleDetailRefresh() {
  try {
    await refreshSubscriptionApi('tv', String(detailItem.value.id));
    notification.success({ content: '已触发刷新' });
  } catch (err: any) {
    notification.error({ content: '刷新失败', description: err?.message || '' });
  }
}

async function handleEdit(item: any) {
  let detail: any = {};
  try {
    const res: any = await getSubscriptionDetailApi(item.id, 'tv');
    detail = res?.detail || res || {};
  } catch { detail = item; }
  subscribeEditItem.value = {
    rssid: String(detail.id || item.id),
    name: detail.name || item.name || '',
    year: detail.year || item.year || '',
    type: 'tv',
    season: detail.season ? String(Number(String(detail.season).replace(/^S/i, ''))) : '',
    tmdbid: detail.tmdbid || item.tmdbid || '',
    image: detail.image || item.image || '',
    keyword: detail.keyword || '',
    fuzzy_match: !!detail.fuzzy_match,
    over_edition: !!(detail.over_edition || item.over_edition),
    filter_restype: detail.filter_restype || detail.restype || '',
    filter_pix: detail.filter_pix || detail.pix || '',
    filter_team: detail.filter_team || detail.team || '',
    filter_rule: detail.filter_rule != null ? String(detail.filter_rule) : '',
    filter_include: detail.filter_include || detail.include || '',
    filter_exclude: detail.filter_exclude || detail.exclude || '',
    download_setting: detail.download_setting != null ? String(detail.download_setting) : '',
    save_path: detail.save_path || '',
    total_ep: String(detail.total_ep || detail.total || item.total || ''),
    current_ep: detail.current_ep != null ? String(detail.current_ep) : '',
    rss_sites: Array.isArray(detail.rss_sites) ? detail.rss_sites : [],
    search_sites: Array.isArray(detail.search_sites) ? detail.search_sites : [],
  };
  subscribeEditShow.value = true;
}
async function handleConfirmEdit(data: Record<string, any>) {
  try {
    await updateSubscriptionApi(data);
    notification.success({ content: '保存成功' });
    subscribeEditShow.value = false;
    await fetchData();
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
    const t = deleteTarget.value;
    await removeSubscriptionApi({
      name: t.name,
      type: 'tv',
      year: String(t.year || ''),
      rssid: String(t.id),
      tmdbid: t.tmdbid ? String(t.tmdbid) : undefined,
    });
    notification.success({ content: '已删除订阅' });
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  } finally {
    deleteModalShow.value = false;
    deleteTarget.value = null;
    await fetchData();
  }
}
async function handleRefresh(item: any) {
  try {
    await refreshSubscriptionApi('tv', String(item.id));
    notification.success({ content: '已触发刷新' });
  } catch (err: any) {
    notification.error({ content: '刷新失败', description: err?.message || '' });
  }
}

let addSearchTimer: ReturnType<typeof setTimeout> | null = null;

function openAddModal() {
  addKeyword.value = '';
  addSearchResults.value = [];
  addStep.value = 'search';
  addSelectedMedia.value = null;
  addModalShow.value = true;
}
async function handleAddSearch() {
  if (!addKeyword.value.trim()) return;
  addSearchLoading.value = true;
  try {
    const res: any = await searchMediaApi({ keyword: addKeyword.value, searchtype: 'tmdb' });
    const raw = Array.isArray(res) ? res : (res?.data || []);
    addSearchResults.value = raw.filter((m: any) => {
      const t = String(m.type || m.media_type || '').toUpperCase();
      // TV 页面：排除电影类型，其余都保留（包括电视剧、动漫、纪录片等）
      return t !== 'movie';
    });
  } catch (err: any) {
    notification.error({ content: '搜索失败', description: err?.message || '' });
  } finally {
    addSearchLoading.value = false;
  }
}
watch(addKeyword, (val) => {
  if (addSearchTimer) clearTimeout(addSearchTimer);
  if (!val.trim()) {
    addSearchResults.value = [];
    return;
  }
  addSearchTimer = setTimeout(() => handleAddSearch(), 400);
});
async function selectAddMedia(media: any) {
  addSelectedMedia.value = media;
  addStep.value = 'form';
  await Promise.all([fetchSites(), fetchIndexers(), fetchFilterRules(), fetchDownloadSettings()]);
  let defaults: any = {};
  try {
    const res: any = await getDefaultSubscriptionSettingApi('tv');
    defaults = res?.data || res || {};
  } catch { /* ignore */ }
  await fetchDownloadDirs(defaults.download_setting);
  addForm.value = {
    name: media.title || '',
    year: media.year || '',
    type: 'tv',
    season: '',
    tmdbid: String(media.id || media.tmdb_id || ''),
    image: media.image || media.poster || '',
    keyword: '',
    fuzzy_match: false,
    over_edition: !!(defaults.over_edition && String(defaults.over_edition) === '1'),
    filter_restype: defaults.restype || defaults.filter_restype || '',
    filter_pix: defaults.pix || defaults.filter_pix || '',
    filter_team: defaults.team || defaults.filter_team || '',
    filter_rule: defaults.rule != null ? String(defaults.rule) : '',
    filter_include: defaults.include || defaults.filter_include || '',
    filter_exclude: defaults.exclude || defaults.filter_exclude || '',
    download_setting: defaults.download_setting != null ? String(defaults.download_setting) : '',
    save_path: defaults.save_path || '',
    total_ep: '',
    current_ep: '',
    rss_sites: Array.isArray(defaults.rss_sites) ? defaults.rss_sites : [],
    search_sites: Array.isArray(defaults.search_sites) ? defaults.search_sites : [],
  };
}
function backToAddSearch() {
  addStep.value = 'search';
  addSelectedMedia.value = null;
}
async function confirmAdd() {
  try {
    await addSubscriptionApi({
      name: addForm.value.name,
      year: addForm.value.year,
      type: 'tv',
      in_form: 'manual',
      season: addForm.value.season || undefined,
      mediaid: addForm.value.tmdbid,
      tmdbid: addForm.value.tmdbid,
      image: addForm.value.image,
      keyword: addForm.value.keyword || undefined,
      fuzzy_match: addForm.value.fuzzy_match,
      over_edition: addForm.value.over_edition,
      filter_restype: addForm.value.filter_restype,
      filter_pix: addForm.value.filter_pix,
      filter_team: addForm.value.filter_team,
      filter_rule: addForm.value.filter_rule,
      filter_include: addForm.value.filter_include,
      filter_exclude: addForm.value.filter_exclude,
      download_setting: addForm.value.download_setting || undefined,
      save_path: addForm.value.save_path || undefined,
      total_ep: addForm.value.total_ep ? Number(addForm.value.total_ep) : undefined,
      current_ep: addForm.value.current_ep ? Number(addForm.value.current_ep) : undefined,
      rss_sites: addForm.value.rss_sites,
      search_sites: addForm.value.search_sites,
    });
    notification.success({ content: '订阅成功' });
    addModalShow.value = false;
    await fetchData();
  } catch (err: any) {
    notification.error({ content: '订阅失败', description: err?.message || '' });
  }
}

async function openSettingModal() {
  settingModalShow.value = true;
  await Promise.all([fetchSites(), fetchIndexers(), fetchFilterRules()]);
  try {
    const res: any = await getDefaultSubscriptionSettingApi('tv');
    const data = res?.data || res || {};
    settingForm.value = {
      over_edition: data.over_edition && String(data.over_edition) === '1' ? '1' : '0',
      restype: data.restype || data.filter_restype || '',
      pix: data.pix || data.filter_pix || '',
      team: data.team || data.filter_team || '',
      rule: data.rule != null ? String(data.rule) : '',
      include: data.include || data.filter_include || '',
      exclude: data.exclude || data.filter_exclude || '',
      download_setting: data.download_setting != null ? String(data.download_setting) : '',
      rss_sites: Array.isArray(data.rss_sites) ? data.rss_sites : [],
      search_sites: Array.isArray(data.search_sites) ? data.search_sites : [],
    };
  } catch { /* ignore */ }
}
async function confirmSetting() {
  try {
    await saveDefaultSubscriptionSettingApi('tv', {
      over_edition: settingForm.value.over_edition,
      restype: settingForm.value.restype,
      pix: settingForm.value.pix,
      team: settingForm.value.team,
      rule: settingForm.value.rule,
      include: settingForm.value.include,
      exclude: settingForm.value.exclude,
      download_setting: settingForm.value.download_setting,
      rss_sites: settingForm.value.rss_sites,
      search_sites: settingForm.value.search_sites,
    });
    notification.success({ content: '默认设置已保存' });
    settingModalShow.value = false;
  } catch (err: any) {
    notification.error({ content: '保存失败', description: err?.message || '' });
  }
}

function toggleAllSites(target: string, checked: boolean) {
  const all = subscriptionSites.value.map(s => s.value);
  const allSearch = searchSites.value.map(s => s.value);
  if (target === 'addSubscription') addForm.value.rss_sites = checked ? [...all] : [];
  if (target === 'addSearch') addForm.value.search_sites = checked ? [...allSearch] : [];
  if (target === 'settingSubscription') settingForm.value.rss_sites = checked ? [...all] : [];
  if (target === 'settingSearch') settingForm.value.search_sites = checked ? [...allSearch] : [];
}
function isAllSelected(target: string) {
  let arr: string[] = [], all: string[] = [];
  if (target === 'addSubscription') { arr = addForm.value.rss_sites; all = subscriptionSites.value.map(s => s.value); }
  if (target === 'addSearch') { arr = addForm.value.search_sites; all = searchSites.value.map(s => s.value); }
  if (target === 'settingSubscription') { arr = settingForm.value.rss_sites; all = subscriptionSites.value.map(s => s.value); }
  if (target === 'settingSearch') { arr = settingForm.value.search_sites; all = searchSites.value.map(s => s.value); }
  return all.length > 0 && arr.length === all.length;
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader title="电视剧订阅">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="openAddModal">新增订阅</NButton>
          <NButton @click="openSettingModal">默认设置</NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="subscriptionStore.tvSubscriptions.length > 0" class="grid-subscription-card">
        <div
          v-for="item in subscriptionStore.tvSubscriptions"
          :key="item.id"
          class="subscription-card overflow-hidden rounded cursor-pointer tbl-card tbl-card-hover"
          @click="handleCardClick(item)"
        >
          <div class="relative">
            <img
              :src="getImgUrl(item.image)"
              class="w-full object-cover"
              style="aspect-ratio: 10/6"
              alt=""
              @error="(e: any) => e.target.src = '/static/img/no-image.png'"
            />
            <div
              v-if="item.total && item.total > 0"
              class="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1"
            >
              <div class="progress-bar-tblr">
                <div class="progress-bar-tblr-fill" :style="{ width: `${tvProgress(item)}%` }" />
              </div>
            </div>
          </div>
          <div class="p-2 text-center">
            <div class="text-sm font-medium truncate" :title="item.name">
              {{ item.year ? `${item.name} (${item.year})` : item.name }}
              <span v-if="item.season && item.season !== 'S00'">{{ item.season }}</span>
            </div>
            <div class="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <span class="inline-block w-2 h-2 rounded-full" :class="getStateDot(item.state || '')" />
              {{ getStateLabel(item.state || '') }}
              <span v-if="item.total && item.total > 0">({{ (item.total || 0) - (item.lack || 0) }}/{{ item.total }})</span>
            </div>
            <div v-if="item.over_edition || item.filter_restype || item.filter_pix || item.filter_team || (item.filter_rule != null && String(item.filter_rule) !== '' && String(item.filter_rule) !== '0') || item.filter_include || item.filter_exclude || (item.download_setting != null && String(item.download_setting) !== '' && String(item.download_setting) !== '-1')" class="flex flex-wrap justify-center gap-1 mt-2 border-t border-gray-200 pt-2">
              <NTag v-if="item.over_edition" size="tiny">洗版</NTag>
              <NTag v-if="item.download_setting != null && String(item.download_setting) !== '' && String(item.download_setting) !== '-1'" size="tiny" type="default">{{ getDownloadSettingLabel(item.download_setting) }}</NTag>
              <NTag v-if="item.filter_restype" size="tiny" type="warning">{{ item.filter_restype }}</NTag>
              <NTag v-if="item.filter_pix" size="tiny" type="warning">{{ item.filter_pix }}</NTag>
              <NTag v-if="item.filter_team" size="tiny" type="info">{{ item.filter_team }}</NTag>
              <NTag v-if="item.filter_rule != null && String(item.filter_rule) !== '' && String(item.filter_rule) !== '0'" size="tiny" type="error">{{ getFilterRuleLabel(item.filter_rule) }}</NTag>
              <NTag v-if="item.filter_include" size="tiny" type="success">{{ item.filter_include }}</NTag>
              <NTag v-if="item.filter_exclude" size="tiny" type="error">{{ item.filter_exclude }}</NTag>
            </div>
            <div v-if="item.rss_sites?.length || item.search_sites?.length" class="flex flex-wrap justify-center gap-1 mt-1">
              <NTag v-for="site in item.rss_sites" :key="site" size="tiny" type="info">{{ site }}</NTag>
              <NTag v-for="site in item.search_sites" :key="site" size="tiny" type="success">{{ site }}</NTag>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="没有订阅" subtitle="当前没有正在订阅的电视剧" />
    </NSpin>

    <!-- Detail -->
    <NModal v-model:show="detailModalShow" title="订阅详情" preset="card" :style="{ width: '600px' }" :bordered="false">
      <div v-if="detailItem" class="flex gap-6">
        <img :src="getImgUrl(detailItem.image)" class="rounded-xl shadow-lg" style="width: 220px; aspect-ratio: 2/3; object-fit: cover; flex-shrink: 0" alt="" @error="(e: any) => e.target.src = '/static/img/no-image.png'" />
        <div class="flex-1 min-w-0 flex flex-col">
          <div class="flex items-start justify-between">
            <div class="min-w-0">
              <h3 class="text-xl font-bold truncate" :title="detailItem.name">{{ detailItem.name }}</h3>
              <p v-if="detailItem.year || (detailItem.season && detailItem.season !== 'S00')" class="text-gray-500 mt-1 text-sm">
                {{ detailItem.year }}
                <span v-if="detailItem.season && detailItem.season !== 'S00'">{{ detailItem.season }}</span>
              </p>
            </div>
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 flex-shrink-0 ml-2">
              <span class="inline-block w-2 h-2 rounded-full" :class="getStateDot(detailItem.state || '')" />
              <span class="text-xs text-gray-600">{{ getStateLabel(detailItem.state || '') }}</span>
            </div>
          </div>

          <div v-if="detailItem.total && detailItem.total > 0" class="mt-4">
            <div class="flex items-center justify-between text-sm text-gray-600 mb-1.5">
              <span>进度</span>
              <span class="font-medium">{{ (detailItem.total || 0) - (detailItem.lack || 0) }} / {{ detailItem.total }}</span>
            </div>
            <NProgress type="line" :percentage="tvProgress(detailItem)" :height="8" :border-radius="4" :indicator-placement="'inside'" />
          </div>

          <div v-if="getOverviewText(detailItem)" class="mt-3 text-sm text-gray-600 leading-relaxed">
            {{ getOverviewText(detailItem) }}
          </div>

          <div v-if="detailItem.keyword" class="mt-2 text-sm text-gray-500">
            <span class="text-gray-400">搜索词：</span>{{ detailItem.keyword }}
          </div>

          <div v-if="detailItem.over_edition || detailItem.filter_restype || detailItem.filter_pix || detailItem.filter_team || (detailItem.filter_rule != null && String(detailItem.filter_rule) !== '' && String(detailItem.filter_rule) !== '0') || detailItem.filter_include || detailItem.filter_exclude" class="flex flex-wrap gap-1.5 mt-4">
            <NTag v-if="detailItem.over_edition" size="small" type="error" round>洗版</NTag>
            <NTag v-if="detailItem.filter_restype" size="small" type="warning" round>{{ detailItem.filter_restype }}</NTag>
            <NTag v-if="detailItem.filter_pix" size="small" type="warning" round>{{ detailItem.filter_pix }}</NTag>
            <NTag v-if="detailItem.filter_team" size="small" type="info" round>{{ detailItem.filter_team }}</NTag>
            <NTag v-if="detailItem.filter_rule != null && String(detailItem.filter_rule) !== '' && String(detailItem.filter_rule) !== '0'" size="small" type="error" round>{{ getFilterRuleLabel(detailItem.filter_rule) }}</NTag>
            <NTag v-if="detailItem.filter_include" size="small" type="success" round>{{ detailItem.filter_include }}</NTag>
            <NTag v-if="detailItem.filter_exclude" size="small" type="error" round>{{ detailItem.filter_exclude }}</NTag>
          </div>

          <div v-if="detailItem.download_setting != null && String(detailItem.download_setting) !== '' && String(detailItem.download_setting) !== '-1'" class="mt-3">
            <span class="text-xs text-gray-400">下载设置：</span>
            <NTag size="small" type="default" round>{{ getDownloadSettingLabel(detailItem.download_setting) }}</NTag>
          </div>

          <div class="mt-auto pt-3">
            <div v-if="detailItem.rss_sites?.length" class="mb-2">
              <span class="text-xs text-gray-400">订阅站点：</span>
              <span class="text-xs text-gray-600 ml-1">{{ detailItem.rss_sites.join(' · ') }}</span>
            </div>
            <div v-if="detailItem.search_sites?.length">
              <span class="text-xs text-gray-400">搜索站点：</span>
              <span class="text-xs text-gray-600 ml-1">{{ detailItem.search_sites.join(' · ') }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <NSpace justify="end" :size="12">
          <NButton type="error" ghost size="small" @click="handleDetailDelete">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </template>
            取消订阅
          </NButton>
          <NButton quaternary size="small" @click="handleDetailSearch">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </template>
            搜索
          </NButton>
          <NButton quaternary size="small" @click="handleDetailRefresh">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            </template>
            刷新
          </NButton>
          <NButton type="primary" size="small" @click="handleDetailEdit">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </template>
            编辑
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Add -->
    <NModal v-model:show="addModalShow" title="新增订阅" preset="card" :style="{ width: '720px', maxHeight: '90vh' }" :bordered="false">
      <div v-if="addStep === 'search'">
        <NSpace vertical>
          <NSpace>
            <NInput v-model:value="addKeyword" placeholder="输入电视剧名称" @keyup.enter="handleAddSearch" style="width: 400px" />
            <NButton type="primary" :loading="addSearchLoading" @click="handleAddSearch">搜索</NButton>
          </NSpace>
          <div v-if="addSearchResults.length > 0" class="grid-subscription-card mt-2" style="max-height: 50vh; overflow-y: auto;">
            <div v-for="media in addSearchResults" :key="media.id" class="subscription-card overflow-hidden rounded cursor-pointer tbl-card tbl-card-hover" @click="selectAddMedia(media)">
              <img :src="getImgUrl(media.image || media.poster)" class="w-full object-cover" style="aspect-ratio: 10/6" alt="" @error="(e: any) => e.target.src = '/static/img/no-image.png'" />
              <div class="p-2 text-center text-sm truncate">{{ media.title }} {{ media.year ? `(${media.year})` : '' }}</div>
            </div>
          </div>
          <EmptyState v-else-if="!addSearchLoading && addKeyword" title="未找到相关媒体" subtitle="请尝试其他关键词" />
        </NSpace>
      </div>
      <div v-else>
        <!-- 顶部信息栏 -->
        <div class="flex items-center gap-4 mb-5 pb-4 border-b border-gray-100">
          <img :src="getImgUrl(addSelectedMedia?.image || addSelectedMedia?.poster)" class="rounded-lg shadow" style="width: 60px; aspect-ratio: 2/3; object-fit: cover; flex-shrink: 0" alt="" />
          <div class="min-w-0">
            <h4 class="font-bold text-base truncate">{{ addForm.name || addSelectedMedia?.title }}</h4>
            <p class="text-gray-400 text-sm mt-0.5">{{ addForm.year || addSelectedMedia?.year }}</p>
          </div>
        </div>
        <NForm label-placement="left" label-width="90" size="small">
          <NFormItem label="自定义搜索词">
            <NInput v-model:value="addForm.keyword" placeholder="留空使用TMDB数据" />
          </NFormItem>
          <div class="grid grid-cols-3 gap-3">
            <NFormItem label="季"><NSelect v-model:value="addForm.season" :options="seasonOptions" /></NFormItem>
            <NFormItem label="总集数"><NInput v-model:value="addForm.total_ep" placeholder="可留空" /></NFormItem>
            <NFormItem label="开始集数"><NInput v-model:value="addForm.current_ep" placeholder="开始订阅集数" /></NFormItem>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <NFormItem label="模糊匹配"><NCheckbox v-model:checked="addForm.fuzzy_match">开启</NCheckbox></NFormItem>
            <NFormItem label="洗版"><NCheckbox v-model:checked="addForm.over_edition">开启</NCheckbox></NFormItem>
            <NFormItem />
          </div>
          <div class="grid grid-cols-3 gap-3">
            <NFormItem label="质量"><NSelect v-model:value="addForm.filter_restype" :options="restypeOptions" /></NFormItem>
            <NFormItem label="分辨率"><NSelect v-model:value="addForm.filter_pix" :options="pixOptions" /></NFormItem>
            <NFormItem label="制作组"><NInput v-model:value="addForm.filter_team" placeholder="支持正则" /></NFormItem>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <NFormItem label="包含"><NInput v-model:value="addForm.filter_include" placeholder="关键字或正则" /></NFormItem>
            <NFormItem label="排除"><NInput v-model:value="addForm.filter_exclude" placeholder="关键字或正则" /></NFormItem>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <NFormItem label="过滤规则"><NSelect v-model:value="addForm.filter_rule" :options="filterRules" /></NFormItem>
            <NFormItem label="下载设置"><NSelect v-model:value="addForm.download_setting" :options="downloadSettings" @update:value="fetchDownloadDirs" /></NFormItem>
          </div>
          <NFormItem label="保存路径"><NSelect v-model:value="addForm.save_path" :options="downloadDirs" /></NFormItem>
          <NFormItem label="订阅站点">
            <NCard size="small" :bordered="true" class="site-card">
              <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                <NCheckbox :checked="isAllSelected('addSubscription')" @update:checked="v => toggleAllSites('addSubscription', v)">全选</NCheckbox>
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <NCheckbox v-for="site in subscriptionSites" :key="site.value" :checked="addForm.rss_sites.includes(site.value)" @update:checked="(v: boolean) => { const set = new Set(addForm.rss_sites); if (v) set.add(site.value); else set.delete(site.value); addForm.rss_sites = Array.from(set); }">{{ site.label }}</NCheckbox>
              </div>
            </NCard>
          </NFormItem>
          <NFormItem label="搜索站点">
            <NCard size="small" :bordered="true" class="site-card">
              <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                <NCheckbox :checked="isAllSelected('addSearch')" @update:checked="v => toggleAllSites('addSearch', v)">全选</NCheckbox>
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <NCheckbox v-for="site in searchSites" :key="site.value" :checked="addForm.search_sites.includes(site.value)" @update:checked="(v: boolean) => { const set = new Set(addForm.search_sites); if (v) set.add(site.value); else set.delete(site.value); addForm.search_sites = Array.from(set); }">{{ site.label }}</NCheckbox>
              </div>
            </NCard>
          </NFormItem>
        </NForm>
        <div class="mt-4 flex justify-end">
          <NSpace justify="end" :size="12">
            <NButton size="small" @click="backToAddSearch">返回</NButton>
            <NButton type="primary" size="small" @click="confirmAdd">添加</NButton>
          </NSpace>
        </div>
      </div>
    </NModal>

    <!-- Default Settings -->
    <NModal v-model:show="settingModalShow" title="订阅默认设置" preset="card" :style="{ width: '720px', maxHeight: '85vh' }" :bordered="false">
      <NForm label-placement="left" label-width="100">
        <div class="grid grid-cols-3 gap-2">
          <NFormItem label="质量"><NSelect v-model:value="settingForm.restype" :options="restypeOptions" /></NFormItem>
          <NFormItem label="分辨率"><NSelect v-model:value="settingForm.pix" :options="pixOptions" /></NFormItem>
          <NFormItem label="制作组"><NInput v-model:value="settingForm.team" placeholder="支持正则" /></NFormItem>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <NFormItem label="包含"><NInput v-model:value="settingForm.include" placeholder="关键字或正则" /></NFormItem>
          <NFormItem label="排除"><NInput v-model:value="settingForm.exclude" placeholder="关键字或正则" /></NFormItem>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <NFormItem label="过滤规则"><NSelect v-model:value="settingForm.rule" :options="filterRules" /></NFormItem>
          <NFormItem label="下载设置"><NSelect v-model:value="settingForm.download_setting" :options="downloadSettings" /></NFormItem>
          <NFormItem label="洗版"><NSelect v-model:value="settingForm.over_edition" :options="[{ label: '否', value: '0' }, { label: '是', value: '1' }]" /></NFormItem>
        </div>
        <NFormItem label="订阅站点">
          <div class="flex items-center gap-2 mb-1"><NCheckbox :checked="isAllSelected('settingSubscription')" @update:checked="v => toggleAllSites('settingSubscription', v)">全选</NCheckbox></div>
          <div class="flex flex-wrap gap-2">
            <NCheckbox v-for="site in subscriptionSites" :key="site.value" :checked="settingForm.rss_sites.includes(site.value)" @update:checked="(v: boolean) => { const set = new Set(settingForm.rss_sites); if (v) set.add(site.value); else set.delete(site.value); settingForm.rss_sites = Array.from(set); }">{{ site.label }}</NCheckbox>
          </div>
        </NFormItem>
        <NFormItem label="搜索站点">
          <div class="flex items-center gap-2 mb-1"><NCheckbox :checked="isAllSelected('settingSearch')" @update:checked="v => toggleAllSites('settingSearch', v)">全选</NCheckbox></div>
          <div class="flex flex-wrap gap-2">
            <NCheckbox v-for="site in searchSites" :key="site.value" :checked="settingForm.search_sites.includes(site.value)" @update:checked="(v: boolean) => { const set = new Set(settingForm.search_sites); if (v) set.add(site.value); else set.delete(site.value); settingForm.search_sites = Array.from(set); }">{{ site.label }}</NCheckbox>
          </div>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end"><NButton @click="settingModalShow = false">取消</NButton><NButton type="primary" @click="confirmSetting">保存</NButton></NSpace>
      </template>
    </NModal>

    <!-- 编辑/新增订阅 -->
    <SubscribeEditModal
      v-model:show="subscribeEditShow"
      :item="subscribeEditItem"
      @confirm="handleConfirmEdit"
    />

    <!-- Delete Confirm -->
    <NModal v-model:show="deleteModalShow" title="确认删除" preset="dialog" positive-text="确认" negative-text="取消" type="warning" @positive-click="confirmDelete">
      <p>确定要删除订阅「{{ deleteTarget?.name }}」吗？</p>
    </NModal>
  </div>
</template>

<style scoped>
.grid-subscription-card { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.subscription-card { transition: all 0.2s ease; }
.progress-bar-tblr { height: 4px; background: hsl(var(--muted) / 0.2); border-radius: 2px; overflow: hidden; }
.progress-bar-tblr-fill { height: 100%; background: hsl(var(--success)); transition: width 0.3s ease; }
</style>
