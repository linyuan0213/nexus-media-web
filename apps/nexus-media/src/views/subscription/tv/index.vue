<script lang="ts" setup>
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { NButton, NInput, NModal, NProgress, NSpace, NSpin } from 'naive-ui';

import { getDownloadSettingsApi } from '#/api/modules/download';
import { getFilterRulesApi } from '#/api/modules/filter';
import { searchMediaApi, webSearchApi } from '#/api/modules/media';
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
import { getProgressApi } from '#/api/modules/system';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import SubscribeDefaultSettingModal from '#/components/subscribe/SubscribeDefaultSettingModal.vue';
import SubscribeEditModal from '#/components/subscribe/SubscribeEditModal.vue';
import SubscriptionHoverCard from '#/components/subscribe/SubscriptionHoverCard.vue';
import { useSubscriptionStore } from '#/store';
import { getImgUrl } from '#/utils/image';
import { useAppNotification } from '#/utils/notify';

const subscriptionStore = useSubscriptionStore();
const router = useRouter();
const notification = useAppNotification();

const loading = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<any>(null);

// 资源搜索进度弹窗（与探索页一致）
const searchModalVisible = ref(false);
const searchModalTitle = ref('');
const searchModalProgress = ref(0);
const searchModalText = ref('请稍候...');
let searchProgressTimer: null | ReturnType<typeof setInterval> = null;

function startSearchProgressPoll() {
  stopSearchProgressPoll();
  searchModalProgress.value = 0;
  searchModalText.value = '正在检索资源...';
  searchProgressTimer = setInterval(async () => {
    try {
      const res: any = await getProgressApi('search');
      if (res) {
        searchModalProgress.value = Math.min(res.value || 0, 100);
        searchModalText.value = res.text || '请稍候...';
        if (searchModalProgress.value >= 100) {
          stopSearchProgressPoll();
          searchModalVisible.value = false;
        }
      }
    } catch {}
  }, 3000);
}

function stopSearchProgressPoll() {
  if (searchProgressTimer) {
    clearInterval(searchProgressTimer);
    searchProgressTimer = null;
  }
}

const filterRuleMap = ref<Record<string, string>>({});
const downloadSettings = ref<{ label: string; value: string }[]>([]);

const downloadSettingMap = ref<Record<string, string>>({});

function nullableString(val: any): string {
  return val === null || val === undefined ? '' : String(val);
}

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

function handleCardClick(item: any) {
  const id = item.tmdbid || item.id;
  if (!id) return;
  router.push({ name: 'MediaDetail', query: { type: 'tv', id } });
}

function handleCardSearch(item: any) {
  if (!item?.name) {
    notification.warning('缺少名称，无法搜索');
    return;
  }
  searchModalTitle.value = `正在搜索 ${item.name} ...`;
  searchModalVisible.value = true;
  startSearchProgressPoll();
  webSearchApi({
    search_word: item.name,
    tmdbid: item.tmdbid ? String(item.tmdbid) : undefined,
    media_type: 'tv',
  })
    .then(() => {
      const checkAndNavigate = setInterval(() => {
        if (!searchModalVisible.value) {
          clearInterval(checkAndNavigate);
          router.push(
            `/media/search?s=${encodeURIComponent(item.name)}&from=subscription`,
          );
        }
      }, 500);
    })
    .catch((error: any) => {
      stopSearchProgressPoll();
      searchModalVisible.value = false;
      notification.error('搜索失败', {
        description: error?.message || '未知错误',
      });
    });
}

async function handleCardRefresh(item: any) {
  try {
    await refreshSubscriptionApi('tv', String(item.id));
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

onUnmounted(() => {
  stopSearchProgressPoll();
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
        class="subscription-flow"
      >
        <SubscriptionHoverCard
          v-for="item in subscriptionStore.tvSubscriptions"
          :key="item.id"
          :item="item"
          type="tv"
          :filter-rule-map="filterRuleMap"
          :download-setting-map="downloadSettingMap"
          @click="handleCardClick"
          @edit="handleEdit"
          @delete="handleDelete"
          @search="handleCardSearch"
          @refresh="handleCardRefresh"
        />
      </div>
      <EmptyState v-else title="没有订阅" subtitle="当前没有正在订阅的电视剧" />
    </NSpin>

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

    <!-- 资源搜索进度 -->
    <NModal
      v-model:show="searchModalVisible"
      preset="card"
      :title="searchModalTitle"
      style="width: 420px"
      :mask-closable="false"
      :closable="false"
    >
      <div class="text-center py-2">
        <NProgress
          type="line"
          :percentage="searchModalProgress"
          processing
          class="mb-2"
        />
        <div class="text-sm text-gray-500">
          {{ searchModalText }}
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.subscription-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-content: flex-start;
}

@media (hover: none) {
  .subscription-flow {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  }
}

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
