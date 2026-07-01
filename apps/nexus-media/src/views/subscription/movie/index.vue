<script lang="ts" setup>
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCheckbox,
  NDivider,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTag,
} from 'naive-ui';

import { getDownloadSettingsApi, getIndexersApi } from '#/api/modules/download';
import { getFilterRulesApi } from '#/api/modules/filter';
import { searchMediaApi } from '#/api/modules/media';
import { getSitesApi } from '#/api/modules/site';
import {
  addSubscriptionApi,
  getDefaultSubscriptionSettingApi,
  getMovieSubscriptionApi,
  getSubscriptionDetailApi,
  refreshSubscriptionApi,
  removeSubscriptionApi,
  saveDefaultSubscriptionSettingApi,
  updateSubscriptionApi,
} from '#/api/modules/subscription';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';
import { useSubscriptionStore } from '#/store';
import { useAppNotification } from '#/utils/notify';

const subscriptionStore = useSubscriptionStore();
const router = useRouter();
const notification = useAppNotification();

const loading = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<any>(null);

// 站点/规则/下载设置缓存
const subscriptionSites = ref<{ label: string; value: string }[]>([]);
const searchSites = ref<{ label: string; value: string }[]>([]);
const filterRules = ref<{ label: string; value: string }[]>([]);
const downloadSettings = ref<{ label: string; value: string }[]>([]);
const downloadSettingMap = ref<Record<string, string>>({});
function getDownloadSettingLabel(val: any): string {
  if (val == null || val === '' || val === '-1') return '';
  const s = String(val);
  return downloadSettingMap.value[s] || s;
}

const filterRuleMap = ref<Record<string, string>>({});
function getFilterRuleLabel(val: any): string {
  if (val == null || val === '' || val === '-1') return '';
  const s = String(val);
  return filterRuleMap.value[s] || s;
}

// 质量/分辨率选项（与旧版模板一致）
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

// 详情弹窗
const detailModalShow = ref(false);
const detailItem = ref<any>(null);

// 编辑弹窗 (复用组件)
const subscribeEditShow = ref(false);
const subscribeEditItem = ref<null | SubscribeEditItem>(null);

// 新增订阅
const addModalShow = ref(false);
const addKeyword = ref('');
const addSearchResults = ref<any[]>([]);
const addSearchLoading = ref(false);

// 默认设置
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
    const res: any = await getMovieSubscriptionApi();
    const list = Array.isArray(res) ? res : res?.data || [];
    subscriptionStore.setMovieSubscriptions(list);
  } finally {
    loading.value = false;
  }
}

async function fetchSites() {
  try {
    const res: any = await getSitesApi();
    const sites = Array.isArray(res) ? res : res?.data || [];
    subscriptionSites.value = sites
      .filter((s: any) => s.rss_enable)
      .map((s: any) => ({ label: s.name, value: s.name }));
  } catch {
    // ignore
  }
}

async function fetchIndexers() {
  try {
    const res: any = await getIndexersApi();
    const idx = Array.isArray(res) ? res : res?.data || [];
    searchSites.value = idx.map((i: any) => ({ label: i.name, value: i.name }));
  } catch {
    // ignore
  }
}

async function fetchFilterRules() {
  try {
    const res: any = await getFilterRulesApi();
    const rules = Array.isArray(res) ? res : res?.data || [];
    filterRules.value = [
      { label: '站点规则', value: '' },
      ...rules.map((r: any) => ({
        label: r.name || r.id,
        value: String(r.id),
      })),
    ];
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
    const list = Array.isArray(res) ? res : res?.data || [];
    downloadSettings.value = [
      { label: '站点设置', value: '' },
      ...list.map((d: any) => {
        const idValue = d.id == null ? '' : String(d.id);
        return { label: d.name || idValue, value: idValue };
      }),
    ];
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

// ---------- 详情弹窗 ----------
function handleCardClick(item: any) {
  detailItem.value = item;
  detailModalShow.value = true;
}

function hasCardTags(item: any) {
  return (
    (item.filter_rule != null &&
      String(item.filter_rule) !== '' &&
      String(item.filter_rule) !== '0') ||
    item.over_edition ||
    item.rss_sites?.length ||
    item.search_sites?.length
  );
}

function getOverviewText(item: any): string {
  const ov = item?.overview;
  if (typeof ov === 'string' && ov.trim() && !ov.trim().startsWith('{'))
    return ov.trim();
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
    notification.warning('缺少名称，无法搜索');
    return;
  }
  router.push(`/media/search?s=${encodeURIComponent(name)}`);
}

async function handleDetailRefresh() {
  try {
    await refreshSubscriptionApi('movie', String(detailItem.value.id));
    notification.success('已触发刷新');
  } catch (error: any) {
    notification.error('刷新失败', { description: error?.message || '' });
  }
}

// ---------- 编辑弹窗 ----------
async function handleEdit(item: any) {
  let detail: any;
  try {
    const res: any = await getSubscriptionDetailApi(item.id, 'movie');
    detail = res?.detail || res || {};
  } catch {
    detail = item;
  }
  subscribeEditItem.value = {
    rssid: String(detail.id || item.id),
    name: detail.name || item.name || '',
    year: detail.year || item.year || '',
    type: 'movie',
    tmdbid: detail.tmdbid || item.tmdbid || '',
    image: detail.image || item.image || '',
    keyword: detail.keyword || '',
    fuzzy_match: !!detail.fuzzy_match,
    over_edition: !!(detail.over_edition || item.over_edition),
    filter_restype: detail.filter_restype || detail.restype || '',
    filter_pix: detail.filter_pix || detail.pix || '',
    filter_team: detail.filter_team || detail.team || '',
    filter_rule: detail.filter_rule == null ? '' : String(detail.filter_rule),
    filter_include: detail.filter_include || detail.include || '',
    filter_exclude: detail.filter_exclude || detail.exclude || '',
    download_setting:
      detail.download_setting == null ? '' : String(detail.download_setting),
    save_path: detail.save_path || '',
    rss_sites: Array.isArray(detail.rss_sites) ? detail.rss_sites : [],
    search_sites: Array.isArray(detail.search_sites) ? detail.search_sites : [],
  };
  subscribeEditShow.value = true;
}

async function handleConfirmEdit(data: Record<string, any>) {
  try {
    if (data.rssid) {
      await updateSubscriptionApi(data);
      notification.success('保存成功');
    } else {
      await addSubscriptionApi(data);
      notification.success('订阅成功');
    }
    subscribeEditShow.value = false;
    await fetchData();
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  }
}

// ---------- 删除 ----------
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
      type: 'movie',
      year: String(t.year || ''),
      rssid: String(t.id),
      tmdbid: t.tmdbid ? String(t.tmdbid) : undefined,
    });
    notification.success('已删除订阅');
  } catch (error: any) {
    notification.error('删除失败', { description: error?.message || '' });
  } finally {
    deleteModalShow.value = false;
    deleteTarget.value = null;
    await fetchData();
  }
}

// ---------- 新增订阅 ----------
let addSearchTimer: null | ReturnType<typeof setTimeout> = null;

function openAddModal() {
  addKeyword.value = '';
  addSearchResults.value = [];
  addModalShow.value = true;
}

async function handleAddSearch() {
  if (!addKeyword.value.trim()) return;
  addSearchLoading.value = true;
  try {
    const res: any = await searchMediaApi({
      keyword: addKeyword.value,
      searchtype: 'tmdb',
    });
    const raw = Array.isArray(res) ? res : res?.data || [];
    addSearchResults.value = raw.filter((m: any) => {
      const t = String(m.type || m.media_type || '').toUpperCase();
      return !t || t === 'movie';
    });
  } catch (error: any) {
    notification.error('搜索失败', { description: error?.message || '' });
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
  addModalShow.value = false;
  let defaults: any = {};
  try {
    const res: any = await getDefaultSubscriptionSettingApi('movie');
    defaults = res?.data || {};
  } catch {
    // ignore
  }
  subscribeEditItem.value = {
    name: media.title || '',
    year: media.year || '',
    type: 'movie',
    tmdbid: String(media.id || media.tmdb_id || ''),
    image: media.image || media.poster || '',
    keyword: '',
    fuzzy_match: false,
    over_edition: !!(
      defaults.over_edition && String(defaults.over_edition) === '1'
    ),
    filter_restype: defaults.restype || defaults.filter_restype || '',
    filter_pix: defaults.pix || defaults.filter_pix || '',
    filter_team: defaults.team || defaults.filter_team || '',
    filter_rule: defaults.rule == null ? '' : String(defaults.rule),
    filter_include: defaults.include || defaults.filter_include || '',
    filter_exclude: defaults.exclude || defaults.filter_exclude || '',
    download_setting:
      defaults.download_setting == null
        ? ''
        : String(defaults.download_setting),
    save_path: defaults.save_path || '',
    rss_sites: Array.isArray(defaults.rss_sites) ? defaults.rss_sites : [],
    search_sites: Array.isArray(defaults.search_sites)
      ? defaults.search_sites
      : [],
  };
  subscribeEditShow.value = true;
}

// ---------- 默认设置 ----------
async function openSettingModal() {
  settingModalShow.value = true;
  await Promise.all([fetchSites(), fetchIndexers(), fetchFilterRules()]);
  try {
    const res: any = await getDefaultSubscriptionSettingApi('movie');
    const data = res?.data || {};
    settingForm.value = {
      over_edition:
        data.over_edition && String(data.over_edition) === '1' ? '1' : '0',
      restype: data.restype || data.filter_restype || '',
      pix: data.pix || data.filter_pix || '',
      team: data.team || data.filter_team || '',
      rule: data.rule == null ? '' : String(data.rule),
      include: data.include || data.filter_include || '',
      exclude: data.exclude || data.filter_exclude || '',
      download_setting:
        data.download_setting == null ? '' : String(data.download_setting),
      rss_sites: (Array.isArray(data.rss_sites) ? data.rss_sites : []).filter(
        (s: string) => subscriptionSites.value.some((x) => x.value === s),
      ),
      search_sites: (Array.isArray(data.search_sites)
        ? data.search_sites
        : []
      ).filter((s: string) => searchSites.value.some((x) => x.value === s)),
    };
  } catch {
    // ignore
  }
}

async function confirmSetting() {
  try {
    await saveDefaultSubscriptionSettingApi('movie', {
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
    notification.success('默认设置已保存');
    settingModalShow.value = false;
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  }
}

// ---------- 站点全选 ----------
function toggleAllSites(
  target: 'settingSearch' | 'settingSubscription',
  checked: boolean,
) {
  const all = subscriptionSites.value.map((s) => s.value);
  const allSearch = searchSites.value.map((s) => s.value);
  if (target === 'settingSubscription')
    settingForm.value.rss_sites = checked ? [...all] : [];
  if (target === 'settingSearch')
    settingForm.value.search_sites = checked ? [...allSearch] : [];
}

function isAllSelected(target: 'settingSearch' | 'settingSubscription') {
  let arr: string[] = [];
  let all: string[] = [];
  if (target === 'settingSubscription') {
    arr = settingForm.value.rss_sites;
    all = subscriptionSites.value.map((s) => s.value);
  }
  if (target === 'settingSearch') {
    arr = settingForm.value.search_sites;
    all = searchSites.value.map((s) => s.value);
  }
  return all.length > 0 && arr.length === all.length;
}

onMounted(() => {
  fetchData();
  fetchFilterRules();
  fetchDownloadSettings();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="电影订阅">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="openAddModal">新增订阅</NButton>
          <NButton @click="openSettingModal">默认设置</NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div
        v-if="subscriptionStore.movieSubscriptions.length > 0"
        class="grid-subscription-card"
      >
        <div
          v-for="item in subscriptionStore.movieSubscriptions"
          :key="item.id"
          class="subscription-card overflow-hidden rounded-lg cursor-pointer tbl-card tbl-card-hover flex flex-col"
          @click="handleCardClick(item)"
        >
          <div class="relative flex-shrink-0 p-1.5 pb-0">
            <img
              :src="getImgUrl(item.image)"
              class="w-full object-cover rounded-md"
              style="aspect-ratio: 3/4"
              alt=""
              @error="(e: any) => (e.target.src = '/static/img/no-image.png')"
            />
            <div
              class="absolute top-3 left-3 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/95 bg-black/50 backdrop-blur-sm"
            >
              <span
                class="inline-block w-1.5 h-1.5 rounded-full"
                :class="getStateDot(item.state || '')"
              ></span>
              {{ getStateLabel(item.state || '') }}
            </div>
          </div>
          <div class="p-2 flex flex-col flex-1">
            <div
              class="text-[13px] font-semibold leading-tight line-clamp-2"
              :title="item.name"
            >
              {{ item.name }}
            </div>
            <div
              class="text-xs text-muted-foreground mt-1 flex items-center gap-2"
            >
              <span v-if="item.year">{{ item.year }}</span>
            </div>
            <NDivider style="margin: 0.5rem 0" />
            <div
              v-if="hasCardTags(item)"
              class="flex flex-wrap items-center gap-1"
            >
              <NTag v-if="item.filter_rule" size="tiny" class="rule-tag">
                {{ getFilterRuleLabel(item.filter_rule) }}
              </NTag>
              <NTag v-if="item.over_edition" size="tiny" class="meta-tag">
                洗版
              </NTag>
              <NTag
                v-if="item.rss_sites?.length"
                size="tiny"
                class="site-tag site-tag-count"
              >
                订阅 {{ item.rss_sites.length }}
              </NTag>
              <NTag
                v-if="item.search_sites?.length"
                size="tiny"
                class="site-tag site-tag-count"
              >
                搜索 {{ item.search_sites.length }}
              </NTag>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="没有订阅" subtitle="当前没有正在订阅的电影" />
    </NSpin>

    <!-- 详情弹窗 -->
    <NModal
      v-model:show="detailModalShow"
      title="订阅详情"
      preset="card"
      :style="{ width: '600px' }"
      :bordered="false"
    >
      <div v-if="detailItem" class="flex gap-6">
        <img
          :src="getImgUrl(detailItem.image)"
          class="rounded-xl shadow-lg"
          style="
            flex-shrink: 0;
            width: 220px;
            aspect-ratio: 2/3;
            object-fit: cover;
          "
          alt=""
          @error="(e: any) => (e.target.src = '/static/img/no-image.png')"
        />
        <div class="flex-1 min-w-0 flex flex-col">
          <div class="flex items-start justify-between">
            <div class="min-w-0">
              <h3 class="text-xl font-bold truncate" :title="detailItem.name">
                {{ detailItem.name }}
              </h3>
              <p v-if="detailItem.year" class="text-gray-500 mt-1 text-sm">
                {{ detailItem.year }}
              </p>
            </div>
            <div
              class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 flex-shrink-0 ml-2"
            >
              <span
                class="inline-block w-2 h-2 rounded-full"
                :class="getStateDot(detailItem.state || '')"
              ></span>
              <span class="text-xs text-gray-600">{{
                getStateLabel(detailItem.state || '')
              }}</span>
            </div>
          </div>

          <div
            v-if="getOverviewText(detailItem)"
            class="mt-3 text-sm text-gray-600 leading-relaxed"
          >
            {{ getOverviewText(detailItem) }}
          </div>

          <div v-if="detailItem.keyword" class="mt-2 text-sm text-gray-500">
            <span class="text-gray-400">搜索词：</span>{{ detailItem.keyword }}
          </div>

          <div
            v-if="
              detailItem.over_edition ||
              detailItem.filter_restype ||
              detailItem.filter_pix ||
              detailItem.filter_team ||
              detailItem.filter_rule ||
              detailItem.filter_include ||
              detailItem.filter_exclude
            "
            class="flex flex-wrap gap-1.5 mt-4"
          >
            <NTag
              v-if="detailItem.over_edition"
              size="small"
              type="error"
              round
            >
              洗版
            </NTag>
            <NTag
              v-if="detailItem.filter_restype"
              size="small"
              type="warning"
              round
            >
              {{ detailItem.filter_restype }}
            </NTag>
            <NTag
              v-if="detailItem.filter_pix"
              size="small"
              type="warning"
              round
            >
              {{ detailItem.filter_pix }}
            </NTag>
            <NTag v-if="detailItem.filter_team" size="small" type="info" round>
              {{ detailItem.filter_team }}
            </NTag>
            <NTag v-if="detailItem.filter_rule" size="small" type="error" round>
              {{ getFilterRuleLabel(detailItem.filter_rule) }}
            </NTag>
            <NTag
              v-if="detailItem.filter_include"
              size="small"
              type="success"
              round
            >
              {{ detailItem.filter_include }}
            </NTag>
            <NTag
              v-if="detailItem.filter_exclude"
              size="small"
              type="error"
              round
            >
              {{ detailItem.filter_exclude }}
            </NTag>
          </div>

          <div
            v-if="
              detailItem.download_setting != null &&
              String(detailItem.download_setting) !== '' &&
              String(detailItem.download_setting) !== '-1'
            "
            class="mt-3"
          >
            <span class="text-xs text-gray-400">下载设置：</span>
            <NTag size="small" type="default" round>
              {{ getDownloadSettingLabel(detailItem.download_setting) }}
            </NTag>
          </div>

          <div class="mt-auto pt-3">
            <div v-if="detailItem.rss_sites?.length" class="mb-2">
              <span class="text-xs text-gray-400">订阅站点：</span>
              <span class="text-xs text-gray-600 ml-1">{{
                detailItem.rss_sites.join(' · ')
              }}</span>
            </div>
            <div v-if="detailItem.search_sites?.length">
              <span class="text-xs text-gray-400">搜索站点：</span>
              <span class="text-xs text-gray-600 ml-1">{{
                detailItem.search_sites.join(' · ')
              }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <NSpace justify="end" :size="12">
          <NButton type="error" ghost size="small" @click="handleDetailDelete">
            <template #icon>
              <IconifyIcon icon="lucide:trash-2" class="h-4 w-4" />
            </template>
            取消订阅
          </NButton>
          <NButton quaternary size="small" @click="handleDetailSearch">
            <template #icon>
              <IconifyIcon icon="lucide:search" class="h-4 w-4" />
            </template>
            搜索
          </NButton>
          <NButton quaternary size="small" @click="handleDetailRefresh">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            刷新
          </NButton>
          <NButton type="primary" size="small" @click="handleDetailEdit">
            <template #icon>
              <IconifyIcon icon="lucide:pencil" class="h-4 w-4" />
            </template>
            编辑
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 新增订阅 -->
    <NModal
      v-model:show="addModalShow"
      title="新增订阅"
      preset="card"
      :style="{ width: '720px', maxHeight: '85vh' }"
      :bordered="false"
    >
      <NSpace vertical>
        <NSpace>
          <NInput
            v-model:value="addKeyword"
            placeholder="输入电影名称"
            @keyup.enter="handleAddSearch"
            style="width: 400px"
          />
          <NButton
            type="primary"
            :loading="addSearchLoading"
            @click="handleAddSearch"
          >
            搜索
          </NButton>
        </NSpace>
        <div
          v-if="addSearchResults.length > 0"
          class="grid-subscription-card mt-2"
          style="max-height: 50vh; overflow-y: auto"
        >
          <div
            v-for="media in addSearchResults"
            :key="media.id"
            class="subscription-card overflow-hidden rounded cursor-pointer tbl-card tbl-card-hover"
            @click="selectAddMedia(media)"
          >
            <img
              :src="getImgUrl(media.image || media.poster)"
              class="w-full object-cover"
              style="aspect-ratio: 10/6"
              alt=""
              @error="(e: any) => (e.target.src = '/static/img/no-image.png')"
            />
            <div class="p-2 text-center text-sm truncate">
              {{ media.title }} {{ media.year ? `(${media.year})` : '' }}
            </div>
          </div>
        </div>
        <EmptyState
          v-else-if="!addSearchLoading && addKeyword"
          title="未找到相关媒体"
          subtitle="请尝试其他关键词"
        />
      </NSpace>
    </NModal>

    <!-- 默认设置 -->
    <NModal
      v-model:show="settingModalShow"
      title="订阅默认设置"
      preset="card"
      :style="{ width: '720px', maxHeight: '85vh' }"
      :bordered="false"
    >
      <NForm label-placement="left" label-width="100">
        <div class="grid grid-cols-3 gap-2">
          <NFormItem label="质量">
            <NSelect
              v-model:value="settingForm.restype"
              :options="restypeOptions"
            />
          </NFormItem>
          <NFormItem label="分辨率">
            <NSelect v-model:value="settingForm.pix" :options="pixOptions" />
          </NFormItem>
          <NFormItem label="制作组">
            <NInput v-model:value="settingForm.team" placeholder="支持正则" />
          </NFormItem>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <NFormItem label="包含">
            <NInput
              v-model:value="settingForm.include"
              placeholder="关键字或正则"
            />
          </NFormItem>
          <NFormItem label="排除">
            <NInput
              v-model:value="settingForm.exclude"
              placeholder="关键字或正则"
            />
          </NFormItem>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <NFormItem label="过滤规则">
            <NSelect v-model:value="settingForm.rule" :options="filterRules" />
          </NFormItem>
          <NFormItem label="下载设置">
            <NSelect
              v-model:value="settingForm.download_setting"
              :options="downloadSettings"
              clearable
            />
          </NFormItem>
          <NFormItem label="洗版">
            <NSelect
              v-model:value="settingForm.over_edition"
              :options="[
                { label: '否', value: '0' },
                { label: '是', value: '1' },
              ]"
            />
          </NFormItem>
        </div>
        <NFormItem label="订阅站点">
          <div class="flex items-center gap-2 mb-1">
            <NCheckbox
              :checked="isAllSelected('settingSubscription')"
              @update:checked="(v) => toggleAllSites('settingSubscription', v)"
            >
              全选
            </NCheckbox>
          </div>
          <div class="flex flex-wrap gap-2">
            <NCheckbox
              v-for="site in subscriptionSites"
              :key="site.value"
              :value="site.value"
              :checked="settingForm.rss_sites.includes(site.value)"
              @update:checked="
                (v: boolean) => {
                  const set = new Set(settingForm.rss_sites);
                  if (v) set.add(site.value);
                  else set.delete(site.value);
                  settingForm.rss_sites = Array.from(set);
                }
              "
            >
              {{ site.label }}
            </NCheckbox>
          </div>
        </NFormItem>
        <NFormItem label="搜索站点">
          <div class="flex items-center gap-2 mb-1">
            <NCheckbox
              :checked="isAllSelected('settingSearch')"
              @update:checked="(v) => toggleAllSites('settingSearch', v)"
            >
              全选
            </NCheckbox>
          </div>
          <div class="flex flex-wrap gap-2">
            <NCheckbox
              v-for="site in searchSites"
              :key="site.value"
              :value="site.value"
              :checked="settingForm.search_sites.includes(site.value)"
              @update:checked="
                (v: boolean) => {
                  const set = new Set(settingForm.search_sites);
                  if (v) set.add(site.value);
                  else set.delete(site.value);
                  settingForm.search_sites = Array.from(set);
                }
              "
            >
              {{ site.label }}
            </NCheckbox>
          </div>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="settingModalShow = false">取消</NButton>
          <NButton type="primary" @click="confirmSetting">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 编辑/新增订阅 -->
    <SubscribeEditModal
      v-model:show="subscribeEditShow"
      :item="subscribeEditItem"
      @confirm="handleConfirmEdit"
    />

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
      <p>确定要删除订阅「{{ deleteTarget?.name }}」吗？</p>
    </NModal>
  </div>
</template>

<style scoped>
.grid-subscription-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.subscription-card {
  transition: all 0.2s ease;
}

.subscription-card :deep(.n-tag) {
  --n-height: 18px !important;
  --n-font-size: 10px !important;

  padding: 0 6px !important;
}

:deep(.rule-tag) {
  --n-color: hsl(var(--destructive) / 12%) !important;
  --n-text-color: hsl(var(--destructive)) !important;
  --n-border: 1px solid hsl(var(--destructive) / 25%) !important;

  border-radius: 9999px;
}

:deep(.meta-tag) {
  --n-color: hsl(var(--muted) / 25%) !important;
  --n-text-color: hsl(var(--muted-foreground)) !important;
  --n-border: 1px solid hsl(var(--border)) !important;

  border-radius: 9999px;
}

:deep(.site-tag) {
  --n-border: none !important;

  border-radius: 9999px;
}

:deep(.site-tag-count) {
  --n-color: transparent !important;
  --n-text-color: hsl(var(--muted-foreground)) !important;
  --n-border: 1px solid hsl(var(--border)) !important;

  border-radius: 9999px;
}

.state-pill {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}

.state-pill-green {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 12%);
}

.state-pill-blue {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 12%);
}

.state-pill-yellow {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 15%);
}

.state-pill-red {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 12%);
}

.state-pill-gray {
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 25%);
}

.line-clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.state-pill-dot {
  width: 0.375rem;
  height: 0.375rem;
  background-color: currentcolor;
  border-radius: 9999px;
}
</style>
