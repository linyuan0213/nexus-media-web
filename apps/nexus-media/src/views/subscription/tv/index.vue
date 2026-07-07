<script lang="ts" setup>
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  NButton,
  NDivider,
  NInput,
  NModal,
  NProgress,
  NSpace,
  NSpin,
  NTag,
} from 'naive-ui';

import { getDownloadSettingsApi } from '#/api/modules/download';
import { getFilterRulesApi } from '#/api/modules/filter';
import { searchMediaApi } from '#/api/modules/media';
import {
  addSubscriptionApi,
  getDefaultSubscriptionSettingApi,
  getSubscriptionDetailApi,
  getTvSubscriptionApi,
  refreshSubscriptionApi,
  removeSubscriptionApi,
  saveDefaultSubscriptionSettingApi,
  updateSubscriptionApi,
} from '#/api/modules/subscription';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscribeDefaultSettingModal from '#/components/subscribe/SubscribeDefaultSettingModal.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';
import { useSubscriptionStore } from '#/store';
import { getImgUrl } from '#/utils/image';
import { useAppNotification } from '#/utils/notify';
import { formatPix, formatRestype } from '#/utils/subscribe';

const subscriptionStore = useSubscriptionStore();
const router = useRouter();
const notification = useAppNotification();

const loading = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<any>(null);

const filterRuleMap = ref<Record<string, string>>({});
const downloadSettings = ref<{ label: string; value: string }[]>([]);

const downloadSettingMap = ref<Record<string, string>>({});

function nullableString(val: any): string {
  return val === null || val === undefined ? '' : String(val);
}

function getFilterRuleLabel(val: any): string {
  if (val === null || val === undefined || val === '' || val === '0') return '';
  const s = String(val);
  return filterRuleMap.value[s] || s;
}

function getDownloadSettingLabel(val: any): string {
  if (val === null || val === undefined || val === '' || val === '-1')
    return '';
  const s = String(val);
  return downloadSettingMap.value[s] || s;
}

const detailModalShow = ref(false);
const detailItem = ref<any>(null);

const subscribeEditShow = ref(false);
const subscribeEditItem = ref<null | SubscribeEditItem>(null);

const addModalShow = ref(false);
const addKeyword = ref('');
const addSearchResults = ref<any[]>([]);
const addSearchLoading = ref(false);

const settingModalShow = ref(false);

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getTvSubscriptionApi();
    const list = Array.isArray(res) ? res : res?.data || [];
    subscriptionStore.setTvSubscriptions(list);
  } finally {
    loading.value = false;
  }
}

async function fetchFilterRules() {
  try {
    const res: any = await getFilterRulesApi();
    const rules = Array.isArray(res) ? res : res?.data || [];
    const map: Record<string, string> = {};
    rules.forEach((r: any) => {
      if (r.id !== null && r.id !== undefined)
        map[String(r.id)] = r.name || String(r.id);
    });
    filterRuleMap.value = map;
  } catch {
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
        const idValue = nullableString(d.id);
        return { label: d.name || idValue, value: idValue };
      }),
    ];
    const map: Record<string, string> = {};
    list.forEach((d: any) => {
      if (d.id !== null && d.id !== undefined)
        map[String(d.id)] = d.name || String(d.id);
    });
    downloadSettingMap.value = map;
  } catch {
    downloadSettings.value = [{ label: '站点设置', value: '' }];
    downloadSettingMap.value = {};
  }
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

function hasCardTags(item: any) {
  return (
    (item.filter_rule !== null &&
      item.filter_rule !== undefined &&
      String(item.filter_rule) !== '' &&
      String(item.filter_rule) !== '0') ||
    item.over_edition ||
    item.rss_sites?.length ||
    item.search_sites?.length ||
    item.filter_restype ||
    item.filter_pix
  );
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
    await refreshSubscriptionApi('tv', String(detailItem.value.id));
    notification.success('已触发刷新');
  } catch (error: any) {
    notification.error('刷新失败', { description: error?.message || '' });
  }
}

async function handleEdit(item: any) {
  let detail: any;
  try {
    const res: any = await getSubscriptionDetailApi(item.id, 'tv');
    detail = res?.detail || res || {};
  } catch {
    detail = item;
  }
  subscribeEditItem.value = {
    rssid: String(detail.id || item.id),
    name: detail.name || item.name || '',
    year: detail.year || item.year || '',
    type: 'tv',
    season: detail.season
      ? String(Number(String(detail.season).replace(/^S/i, '')))
      : '',
    tmdbid: detail.tmdbid || item.tmdbid || '',
    image: detail.image || item.image || '',
    keyword: detail.keyword || '',
    fuzzy_match: !!detail.fuzzy_match,
    over_edition: !!(detail.over_edition || item.over_edition),
    filter_restype: detail.filter_restype || detail.restype || '',
    filter_pix: detail.filter_pix || detail.pix || '',
    filter_team: detail.filter_team || detail.team || '',
    filter_rule: nullableString(detail.filter_rule),
    filter_include: detail.filter_include || detail.include || '',
    filter_exclude: detail.filter_exclude || detail.exclude || '',
    filter_free: detail.filter_free ?? false,
    download_setting: nullableString(detail.download_setting),
    save_path: detail.save_path || '',
    total_ep: String(detail.total_ep || detail.total || item.total || ''),
    current_ep: nullableString(detail.current_ep),
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
    notification.success('已删除订阅');
  } catch (error: any) {
    notification.error('删除失败', { description: error?.message || '' });
  } finally {
    deleteModalShow.value = false;
    deleteTarget.value = null;
    await fetchData();
  }
}

async function handleConfirmSetting(data: Record<string, any>) {
  try {
    await saveDefaultSubscriptionSettingApi('tv', data);
    notification.success('默认设置已保存');
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  }
}

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
      // TV 页面：排除电影类型，其余都保留（包括电视剧、动漫、纪录片等）
      return t !== 'movie';
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
    const res: any = await getDefaultSubscriptionSettingApi('tv');
    defaults = res?.data || res || {};
  } catch {
    // ignore
  }
  subscribeEditItem.value = {
    name: media.title || '',
    year: media.year || '',
    type: 'tv',
    tmdbid: String(media.id || media.tmdb_id || ''),
    image: media.image || media.poster || '',
    season: '',
    keyword: '',
    fuzzy_match: false,
    over_edition: !!(
      defaults.over_edition && String(defaults.over_edition) === '1'
    ),
    filter_restype: defaults.restype || defaults.filter_restype || '',
    filter_pix: defaults.pix || defaults.filter_pix || '',
    filter_team: defaults.team || defaults.filter_team || '',
    filter_rule: nullableString(defaults.rule),
    filter_include: defaults.include || defaults.filter_include || '',
    filter_exclude: defaults.exclude || defaults.filter_exclude || '',
    filter_free:
      defaults.free != null && String(defaults.free) === '1'
        ? true
        : (defaults.filter_free ?? false),
    download_setting: nullableString(defaults.download_setting),
    save_path: defaults.save_path || '',
    total_ep: '',
    current_ep: '',
    rss_sites: Array.isArray(defaults.rss_sites) ? defaults.rss_sites : [],
    search_sites: Array.isArray(defaults.search_sites)
      ? defaults.search_sites
      : [],
  };
  subscribeEditShow.value = true;
}

onMounted(() => {
  fetchData();
  fetchFilterRules();
  fetchDownloadSettings();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="电视剧订阅">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="openAddModal">新增订阅</NButton>
          <NButton @click="settingModalShow = true">默认设置</NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div
        v-if="subscriptionStore.tvSubscriptions.length > 0"
        class="grid-subscription-card"
      >
        <div
          v-for="item in subscriptionStore.tvSubscriptions"
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
              v-if="item.total && item.total > 0"
              class="absolute bottom-1.5 left-1.5 right-1.5 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-5 rounded-b-md"
            >
              <div class="progress-bar-tblr">
                <div
                  class="progress-bar-tblr-fill"
                  :style="{ width: `${tvProgress(item)}%` }"
                ></div>
              </div>
              <div class="text-[10px] text-white/90 mt-1 text-right">
                {{ (item.total || 0) - (item.lack || 0) }} / {{ item.total }}
              </div>
            </div>
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
              class="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"
            >
              <span v-if="item.year">{{ item.year }}</span>
              <span
                v-if="item.year && item.season && item.season !== 'S00'"
                class="opacity-60"
                >·</span
              >
              <span v-if="item.season && item.season !== 'S00'">{{
                item.season
              }}</span>
            </div>
            <NDivider style="margin: 0.5rem 0" />
            <div
              v-if="hasCardTags(item)"
              class="flex flex-wrap items-center gap-1"
            >
              <NTag
                v-if="
                  item.filter_rule !== null &&
                  item.filter_rule !== undefined &&
                  String(item.filter_rule) !== '' &&
                  String(item.filter_rule) !== '0'
                "
                size="tiny"
                class="tag-rule"
              >
                {{ getFilterRuleLabel(item.filter_rule) }}
              </NTag>
              <NTag
                v-if="item.over_edition"
                size="tiny"
                class="tag-over-edition"
              >
                洗版
              </NTag>
              <NTag
                v-if="item.filter_restype"
                size="tiny"
                class="tag-quality"
                :title="formatRestype(item.filter_restype)"
              >
                {{ formatRestype(item.filter_restype) }}
              </NTag>
              <NTag
                v-if="item.filter_pix"
                size="tiny"
                class="tag-resolution"
                :title="formatPix(item.filter_pix)"
              >
                {{ formatPix(item.filter_pix) }}
              </NTag>
              <NTag
                v-if="item.rss_sites?.length"
                size="tiny"
                class="tag-rss-site"
              >
                订阅 {{ item.rss_sites.length }}
              </NTag>
              <NTag
                v-if="item.search_sites?.length"
                size="tiny"
                class="tag-search-site"
              >
                搜索 {{ item.search_sites.length }}
              </NTag>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="没有订阅" subtitle="当前没有正在订阅的电视剧" />
    </NSpin>

    <!-- Detail -->
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
              <p
                v-if="
                  detailItem.year ||
                  (detailItem.season && detailItem.season !== 'S00')
                "
                class="text-gray-500 mt-1 text-sm"
              >
                {{ detailItem.year }}
                <span v-if="detailItem.season && detailItem.season !== 'S00'">{{
                  detailItem.season
                }}</span>
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

          <div v-if="detailItem.total && detailItem.total > 0" class="mt-4">
            <div
              class="flex items-center justify-between text-sm text-gray-600 mb-1.5"
            >
              <span>进度</span>
              <span class="font-medium"
                >{{ (detailItem.total || 0) - (detailItem.lack || 0) }} /
                {{ detailItem.total }}</span
              >
            </div>
            <NProgress
              type="line"
              :percentage="tvProgress(detailItem)"
              :height="8"
              :border-radius="4"
              indicator-placement="inside"
            />
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
              (detailItem.filter_rule !== null &&
                detailItem.filter_rule !== undefined &&
                String(detailItem.filter_rule) !== '' &&
                String(detailItem.filter_rule) !== '0') ||
              detailItem.filter_include ||
              detailItem.filter_exclude
            "
            class="flex flex-wrap gap-1.5 mt-4"
          >
            <NTag
              v-if="detailItem.over_edition"
              size="small"
              class="tag-over-edition"
              round
            >
              洗版
            </NTag>
            <NTag
              v-if="detailItem.filter_restype"
              size="small"
              class="tag-quality"
              round
              :title="formatRestype(detailItem.filter_restype)"
            >
              {{ formatRestype(detailItem.filter_restype) }}
            </NTag>
            <NTag
              v-if="detailItem.filter_pix"
              size="small"
              class="tag-resolution"
              round
              :title="formatPix(detailItem.filter_pix)"
            >
              {{ formatPix(detailItem.filter_pix) }}
            </NTag>
            <NTag
              v-if="detailItem.filter_team"
              size="small"
              class="tag-team"
              round
            >
              {{ detailItem.filter_team }}
            </NTag>
            <NTag
              v-if="
                detailItem.filter_rule !== null &&
                detailItem.filter_rule !== undefined &&
                String(detailItem.filter_rule) !== '' &&
                String(detailItem.filter_rule) !== '0'
              "
              size="small"
              class="tag-rule"
              round
            >
              {{ getFilterRuleLabel(detailItem.filter_rule) }}
            </NTag>
            <NTag
              v-if="detailItem.filter_include"
              size="small"
              class="tag-include"
              round
            >
              {{ detailItem.filter_include }}
            </NTag>
            <NTag
              v-if="detailItem.filter_exclude"
              size="small"
              class="tag-exclude"
              round
            >
              {{ detailItem.filter_exclude }}
            </NTag>
          </div>

          <div
            v-if="
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </template>
            取消订阅
          </NButton>
          <NButton quaternary size="small" @click="handleDetailSearch">
            <template #icon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </template>
            搜索
          </NButton>
          <NButton quaternary size="small" @click="handleDetailRefresh">
            <template #icon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
            </template>
            刷新
          </NButton>
          <NButton type="primary" size="small" @click="handleDetailEdit">
            <template #icon>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </template>
            编辑
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Add -->
    <NModal
      v-model:show="addModalShow"
      title="新增订阅"
      preset="card"
      :style="{ width: '720px', maxHeight: '90vh' }"
      :bordered="false"
    >
      <NSpace vertical>
        <NSpace>
          <NInput
            v-model:value="addKeyword"
            placeholder="输入电视剧名称"
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

    <!-- Default Settings -->
    <SubscribeDefaultSettingModal
      v-model:show="settingModalShow"
      mtype="tv"
      @confirm="handleConfirmSetting"
    />

    <!-- 编辑/新增订阅 -->
    <SubscribeEditModal
      v-model:show="subscribeEditShow"
      :item="subscribeEditItem"
      @confirm="handleConfirmEdit"
    />

    <!-- Delete Confirm -->
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

:deep(.tag-rule) {
  --n-color: hsl(340deg 75% 95%) !important;
  --n-text-color: hsl(340deg 75% 50%) !important;
  --n-border: 1px solid hsl(340deg 75% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-over-edition) {
  --n-color: hsl(35deg 90% 93%) !important;
  --n-text-color: hsl(35deg 90% 45%) !important;
  --n-border: 1px solid hsl(35deg 90% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-quality) {
  --n-color: hsl(255deg 85% 95%) !important;
  --n-text-color: hsl(255deg 75% 55%) !important;
  --n-border: 1px solid hsl(255deg 75% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-resolution) {
  --n-color: hsl(185deg 80% 93%) !important;
  --n-text-color: hsl(185deg 80% 35%) !important;
  --n-border: 1px solid hsl(185deg 70% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-rss-site) {
  --n-color: hsl(220deg 70% 95%) !important;
  --n-text-color: hsl(220deg 70% 50%) !important;
  --n-border: 1px solid hsl(220deg 70% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-search-site) {
  --n-color: hsl(215deg 20% 95%) !important;
  --n-text-color: hsl(215deg 20% 45%) !important;
  --n-border: 1px solid hsl(215deg 20% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-team) {
  --n-color: hsl(160deg 70% 94%) !important;
  --n-text-color: hsl(160deg 70% 35%) !important;
  --n-border: 1px solid hsl(160deg 60% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-include) {
  --n-color: hsl(145deg 70% 94%) !important;
  --n-text-color: hsl(145deg 70% 35%) !important;
  --n-border: 1px solid hsl(145deg 60% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-exclude) {
  --n-color: hsl(340deg 75% 95%) !important;
  --n-text-color: hsl(340deg 75% 50%) !important;
  --n-border: 1px solid hsl(340deg 75% 85%) !important;

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

:deep(.site-tag-rss) {
  --n-color: hsl(var(--success) / 12%) !important;
  --n-text-color: hsl(var(--success)) !important;
}

:deep(.site-tag-search) {
  --n-color: hsl(var(--primary) / 12%) !important;
  --n-text-color: hsl(var(--primary)) !important;
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

.progress-bar-tblr {
  height: 4px;
  overflow: hidden;
  background: hsl(var(--muted) / 20%);
  border-radius: 2px;
}

.progress-bar-tblr-fill {
  height: 100%;
  background: hsl(var(--success) / 75%);
  transition: width 0.3s ease;
}

:deep(.site-tag-count) {
  --n-color: transparent !important;
  --n-text-color: hsl(var(--muted-foreground)) !important;
  --n-border: 1px solid hsl(var(--border)) !important;

  border-radius: 9999px;
}
</style>
