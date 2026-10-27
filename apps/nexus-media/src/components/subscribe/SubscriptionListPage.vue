<script lang="ts" setup>
import type { SubscribeEditItem } from '#/components/subscribe/SubscribeEditModal.vue';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useUserStore } from '@vben/stores';

import {
  NButton,
  NInput,
  NModal,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
} from 'naive-ui';

import { getDownloadSettingsApi } from '#/api/modules/download';
import { getFilterRulesApi } from '#/api/modules/filter';
import {
  lookupMetadataApi,
  searchMediaApi,
  searchMetadataApi,
  webSearchApi,
} from '#/api/modules/media';
import {
  addSubscriptionApi,
  addSubscriptionMediaApi,
  getDefaultSubscriptionSettingApi,
  getMovieSubscriptionApi,
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
import SubscriptionDeleteModal from '#/components/subscribe/SubscriptionDeleteModal.vue';
import SubscriptionGroupCard from '#/components/subscribe/SubscriptionGroupCard.vue';
import SubscriptionHoverCard from '#/components/subscribe/SubscriptionHoverCard.vue';
import {
  getContentProfileDefaultSearchSource,
  getContentProfileDetailPath,
  getContentProfileLabel,
  getContentProfileOptions,
  getContentProfilePresentationType,
  getContentProfileSearchSources,
} from '#/plugin-framework/loader';
import { useSubscriptionStore } from '#/store';
import { useAppNotification } from '#/utils/notify';

const props = withDefaults(
  defineProps<{
    /** 载体媒体类型：决定使用电影表还是电视剧表 */
    mediaType: 'movie' | 'tv';
    /** 固定内容画像（插件订阅页使用）；为空时按画像 tab 切换 */
    contentProfile?: string;
    /** 是否显示内容画像 tab；独立插件菜单存在时可关闭 */
    showProfileTabs?: boolean;
    /** 页头标题 */
    title: string;
  }>(),
  {
    contentProfile: '',
    showProfileTabs: true,
  },
);

const router = useRouter();
const userStore = useUserStore();
const subscriptionStore = useSubscriptionStore();
const notification = useAppNotification();

type ProfileTab = { label: string; value: string };

const isSuperAdmin = computed(
  () => !!(userStore.userInfo as any)?.is_superadmin,
);
const groupView = ref(false);
const showGroupView = computed(() => isSuperAdmin.value && groupView.value);
const canEditDefault = computed(() => {
  const info: any = userStore.userInfo || {};
  const perms: string[] = info.permissions || [];
  return (
    !!info.is_superadmin ||
    perms.includes('*') ||
    perms.includes('setting:update')
  );
});

function isCustomProfile(profile: string): boolean {
  return !!profile && profile !== 'default' && profile !== 'anime';
}

const profileTabs = computed<ProfileTab[]>(() => {
  if (!props.showProfileTabs && !props.contentProfile) {
    return [
      {
        label: props.mediaType === 'movie' ? '电影' : '电视剧',
        value: 'default',
      },
    ];
  }
  if (props.contentProfile) {
    return [
      {
        label:
          getContentProfileLabel(props.contentProfile) ||
          props.contentProfile.toUpperCase(),
        value: props.contentProfile,
      },
    ];
  }
  const tabs: ProfileTab[] = [
    { label: '全部', value: 'all' },
    {
      label: props.mediaType === 'movie' ? '电影' : '电视剧',
      value: 'default',
    },
  ];
  if (props.mediaType === 'tv') {
    tabs.push({
      label: getContentProfileLabel('anime') || '动漫',
      value: 'anime',
    });
  }
  for (const option of getContentProfileOptions()) {
    if (['anime', 'default'].includes(option.value)) continue;
    const presentation =
      getContentProfilePresentationType(option.value) || 'movie';
    const belongsToTv = ['anime', 'tv'].includes(presentation);
    if (props.mediaType === 'tv' ? belongsToTv : !belongsToTv) {
      tabs.push({ label: option.label, value: option.value });
    }
  }
  return tabs;
});

const activeProfile = ref(
  props.contentProfile || profileTabs.value[0]?.value || 'default',
);
const activeProfileLabel = computed(
  () =>
    profileTabs.value.find((tab) => tab.value === activeProfile.value)?.label ||
    getContentProfileLabel(activeProfile.value) ||
    activeProfile.value.toUpperCase(),
);
const effectiveProfile = computed(() =>
  activeProfile.value === 'all' ? 'default' : activeProfile.value,
);
const customActive = computed(() => isCustomProfile(activeProfile.value));
const cardType = computed<'anime' | 'movie' | 'tv'>(() =>
  activeProfile.value === 'anime' ? 'anime' : props.mediaType,
);

function resolveItemType(item: any): 'anime' | 'movie' | 'tv' {
  const type = String(item?.type || '').toLowerCase();
  if (type === 'anime' || type === 'movie' || type === 'tv') return type;
  return cardType.value;
}

function resolveGroupType(group: SubscriptionGroup): 'anime' | 'movie' | 'tv' {
  return resolveItemType(group.items[0]);
}

watch(
  () => props.contentProfile,
  (value) => {
    if (value) activeProfile.value = value;
  },
);

const items = ref<any[]>([]);
const loading = ref(false);
const refreshing = ref(false);

const deleteShow = ref(false);
const deleteTarget = ref<any>(null);

const editShow = ref(false);
const editItem = ref<null | SubscribeEditItem>(null);

const settingShow = ref(false);
const filterRuleMap = ref<Record<string, string>>({});
const downloadSettingMap = ref<Record<string, string>>({});

// 新增订阅
const addShow = ref(false);
const addKeyword = ref('');
const addResults = ref<any[]>([]);
const addLoading = ref(false);
const addProvider = ref('');
const providerOptions = computed(() =>
  getContentProfileSearchSources(effectiveProfile.value),
);

const searchModalVisible = ref(false);
const searchModalTitle = ref('');
const searchModalProgress = ref(0);
const searchModalText = ref('');

interface SubscriptionGroup {
  image: string;
  items: any[];
  key: string;
  name: string;
  season: string;
  vote: number | string;
  year: string;
}

function groupKey(item: any): string {
  const identity = item.identity_id
    ? `id:${item.identity_id}`
    : item.anchor_provider && item.anchor_external_id
      ? `${item.anchor_provider}:${item.anchor_external_id}`
      : item.tmdbid
        ? `tmdb:${item.tmdbid}`
        : `name:${item.name}:${item.year || ''}`;
  return props.mediaType === 'tv'
    ? `${identity}:${item.season || ''}`
    : identity;
}

const groups = computed<SubscriptionGroup[]>(() => {
  const map = new Map<string, SubscriptionGroup>();
  for (const item of items.value) {
    const key = groupKey(item);
    const group = map.get(key);
    if (group) {
      group.items.push(item);
    } else {
      map.set(key, {
        key,
        name: item.name || '',
        year: item.year || '',
        season: item.season || '',
        image: item.image || '',
        vote: item.vote || '',
        items: [item],
      });
    }
  }
  return [...map.values()];
});

async function fetchOptions() {
  try {
    const [rulesRes, dsRes] = await Promise.all([
      getFilterRulesApi().catch(() => ({ data: [] })),
      getDownloadSettingsApi().catch(() => ({ data: [] })),
    ]);
    // /filter/rules 返回规则组（含 rules），订阅过滤设置保存的是组 ID。
    const groups = Array.isArray(rulesRes) ? rulesRes : rulesRes?.data || [];
    const nextRules: Record<string, string> = {};
    for (const group of groups) {
      if (group?.id !== null && group?.id !== undefined) {
        nextRules[String(group.id)] = group.name || String(group.id);
      }
    }
    filterRuleMap.value = nextRules;

    const settings = Array.isArray(dsRes) ? dsRes : dsRes?.data || [];
    const nextSettings: Record<string, string> = {};
    for (const item of settings) {
      if (item?.id !== null && item?.id !== undefined) {
        nextSettings[String(item.id)] = item.name || String(item.id);
      }
    }
    downloadSettingMap.value = nextSettings;
  } catch {
    filterRuleMap.value = {};
    downloadSettingMap.value = {};
  }
}

async function backfillMissingPosters(items: any[]) {
  const targets = items
    .filter(
      (item) =>
        !item.image &&
        typeof item.metadata_ref === 'string' &&
        item.metadata_ref.includes(':') &&
        !item.metadata_ref.startsWith('content_id:'),
    )
    .slice(0, 12);
  await Promise.allSettled(
    targets.map(async (item) => {
      const [provider, externalId] = item.metadata_ref.split(':', 2);
      if (!provider || !externalId) return;
      try {
        const record: any = await lookupMetadataApi({
          allow_missing: true,
          external_id: externalId,
          provider,
          scope: item.content_profile || 'default',
        });
        const poster = record?.images?.poster?.[0]?.url;
        if (poster) item.image = poster;
      } catch {
        // 单个来源失败不影响列表
      }
    }),
  );
}

async function fetchData() {
  loading.value = true;
  try {
    const profile = activeProfile.value;
    const filterProfile = profile === 'all' ? undefined : profile;
    const res: any =
      props.mediaType === 'movie'
        ? await getMovieSubscriptionApi(undefined, filterProfile)
        : await getTvSubscriptionApi(undefined, filterProfile);
    const list = Array.isArray(res) ? res : res?.data || [];
    items.value = list;
    if (profile === 'default' || profile === 'all') {
      if (props.mediaType === 'movie') {
        subscriptionStore.setMovieSubscriptions(list);
      } else {
        subscriptionStore.setTvSubscriptions(list);
      }
    }
    // 先展示列表，缺失海报在后台补全，避免慢源阻塞整页
    void backfillMissingPosters(list);
  } catch (error: any) {
    notification.error('加载订阅失败', {
      description: error?.message || '',
    });
  } finally {
    loading.value = false;
  }
}

function handleTabChange(value: string) {
  if (value === activeProfile.value) return;
  activeProfile.value = value;
  addProvider.value = getContentProfileDefaultSearchSource(value);
  fetchData();
}

// ---------- 卡片操作 ----------
function handleCardClick(item: any) {
  const profile = String(
    item.content_profile || effectiveProfile.value || 'default',
  );
  if (isCustomProfile(profile)) {
    const path = getContentProfileDetailPath(profile);
    if (path) {
      router.push({
        path,
        query: {
          id: item.keyword || item.anchor_external_id || item.name || item.id,
        },
      });
      return;
    }
  }
  const provider = String(item.anchor_provider || '').trim();
  const externalId = String(item.anchor_external_id || '').trim();
  if (
    provider &&
    provider !== 'tmdb' &&
    provider !== 'content_id' &&
    externalId
  ) {
    router.push({
      name: 'MediaDetail',
      query: {
        provider,
        ref: externalId,
        type: props.mediaType === 'movie' ? 'movie' : 'tv',
      },
    });
    return;
  }
  if (!item.tmdbid) return;
  router.push({
    name: 'MediaDetail',
    query: {
      type: props.mediaType === 'movie' ? 'movie' : item.type || 'tv',
      id: item.tmdbid,
    },
  });
}

async function handleCardSearch(item: any) {
  if (!item?.name) {
    notification.warning('缺少名称，无法搜索');
    return;
  }
  try {
    const resp: any = await webSearchApi({
      search_word: item.keyword || item.name,
      tmdbid: item.tmdbid ? String(item.tmdbid) : undefined,
      media_type: props.mediaType === 'movie' ? 'movie' : item.type || 'tv',
      filters: {
        content_profile: item.content_profile || effectiveProfile.value,
        metadata_source: item.provider || item.anchor_provider || undefined,
        anchor_external_id: item.anchor_external_id || undefined,
      },
    });
    const sessionId = resp?.session_id || '';
    const sidParam = sessionId
      ? `&session_id=${encodeURIComponent(sessionId)}`
      : '';
    const profileParam =
      activeProfile.value &&
      activeProfile.value !== 'default' &&
      activeProfile.value !== 'all'
        ? `&content_profile=${encodeURIComponent(activeProfile.value)}`
        : '';
    router.push(
      `/media/search?s=${encodeURIComponent(item.keyword || item.name)}&from=subscription${sidParam}&media_type=${props.mediaType}${profileParam}`,
    );
  } catch (error: any) {
    notification.error('搜索失败', { description: error?.message || '' });
  }
}

async function handleCardRefresh(item: any) {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    await refreshSubscriptionApi(
      props.mediaType,
      String(item.id),
      activeProfile.value,
    );
    notification.success('已触发刷新');
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await fetchData();
      const current = items.value.find(
        (entry: any) => String(entry.id) === String(item.id),
      );
      if (current && String(current.state) !== String(item.state)) break;
    }
  } catch (error: any) {
    notification.error('刷新失败', { description: error?.message || '' });
  } finally {
    refreshing.value = false;
  }
}

// ---------- 编辑 ----------
async function handleEdit(item: any) {
  let detail: any;
  try {
    const res: any = await getSubscriptionDetailApi(
      item.id,
      props.mediaType === 'movie' ? 'movie' : item.type || 'tv',
      item.content_profile || effectiveProfile.value,
    );
    detail = res?.detail || res || {};
  } catch {
    detail = item;
  }
  const type = detail.type || item.type || props.mediaType;
  const anchorProvider = detail.anchor_provider || item.anchor_provider || '';
  const anchorExternal =
    detail.anchor_external_id || item.anchor_external_id || '';
  const profile =
    detail.content_profile || item.content_profile || effectiveProfile.value;
  editItem.value = {
    rssid: String(detail.id || item.id),
    name: detail.name || item.name || '',
    year: detail.year || item.year || '',
    type: type === 'anime' ? 'anime' : type === 'movie' ? 'movie' : 'tv',
    tmdbid: detail.tmdbid || item.tmdbid || '',
    image: detail.image || item.image || '',
    keyword: detail.keyword || '',
    content_profile: profile,
    provider: detail.provider || item.provider || anchorProvider || '',
    metadata_ref: detail.metadata_ref || item.metadata_ref || '',
    mediaid:
      anchorProvider && anchorExternal
        ? `${anchorProvider}:${anchorExternal}`
        : detail.metadata_ref || item.metadata_ref || '',
    overview: detail.overview || item.overview || '',
    season: detail.season
      ? String(Number(String(detail.season).replace(/^S/i, '')))
      : '',
    fuzzy_match: !!detail.fuzzy_match,
    over_edition: !!(detail.over_edition || item.over_edition),
    filter_restype: detail.filter_restype || detail.restype || '',
    filter_pix: detail.filter_pix || detail.pix || '',
    filter_team: detail.filter_team || detail.team || '',
    filter_rule:
      detail.filter_rule === null || detail.filter_rule === undefined
        ? ''
        : String(detail.filter_rule),
    filter_include: detail.filter_include || detail.include || '',
    filter_exclude: detail.filter_exclude || detail.exclude || '',
    filter_free: detail.filter_free ?? false,
    download_setting:
      detail.download_setting === null || detail.download_setting === undefined
        ? ''
        : String(detail.download_setting),
    save_path: detail.save_path || '',
    total_ep: String(detail.total_ep || detail.total || item.total || ''),
    current_ep:
      detail.current_ep === null || detail.current_ep === undefined
        ? ''
        : String(detail.current_ep),
    rss_sites: Array.isArray(detail.rss_sites) ? detail.rss_sites : [],
    search_sites: Array.isArray(detail.search_sites) ? detail.search_sites : [],
  };
  editShow.value = true;
}

async function handleConfirmEdit(data: Record<string, any>) {
  try {
    if (data.rssid) {
      await updateSubscriptionApi(data);
      notification.success('保存成功');
    } else if (
      isCustomProfile(String(data.content_profile || effectiveProfile.value))
    ) {
      await addSubscriptionMediaApi({ ...data, provider: data.provider });
      notification.success('订阅成功');
    } else {
      await addSubscriptionApi(data);
      notification.success('订阅成功');
    }
    editShow.value = false;
    await fetchData();
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  }
}

// ---------- 删除 ----------
function handleDelete(item: any) {
  deleteTarget.value = item;
  deleteShow.value = true;
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  try {
    const res: any = await removeSubscriptionApi({
      name: target.name,
      type:
        props.mediaType === 'movie'
          ? 'movie'
          : target.type === 'anime'
            ? 'anime'
            : 'tv',
      year: String(target.year || ''),
      rssid: String(target.id),
      tmdbid: target.tmdbid ? String(target.tmdbid) : undefined,
      content_profile: target.content_profile || effectiveProfile.value,
    });
    const deleted = Number(res?.deleted ?? res?.data?.deleted ?? 1);
    notification.success(
      deleted > 1 ? `已删除 ${deleted} 条订阅` : '已删除订阅',
      { description: target.name },
    );
  } catch (error: any) {
    notification.error('删除失败', { description: error?.message || '' });
  } finally {
    deleteShow.value = false;
    deleteTarget.value = null;
    await fetchData();
  }
}

// ---------- 新增订阅 ----------
function openAdd() {
  addKeyword.value = '';
  addResults.value = [];
  addProvider.value = getContentProfileDefaultSearchSource(
    effectiveProfile.value,
  );
  addShow.value = true;
}

let addTimer: null | ReturnType<typeof setTimeout> = null;

function metadataRefOf(hit: any): {
  provider: string;
  externalId: string;
  code: string;
} {
  const provider = String(
    hit.provider ||
      hit.ref?.provider ||
      addProvider.value ||
      effectiveProfile.value,
  );
  const externalId = String(
    hit.ref?.external_id || hit.external_id || hit.id || '',
  );
  const extra = hit.extra || {};
  const code = String(
    extra[`${effectiveProfile.value}.content_id`] ||
      hit.content_id ||
      hit.keyword ||
      hit.title ||
      externalId,
  );
  return { provider, externalId, code };
}

async function handleAddSearch() {
  const keyword = addKeyword.value.trim();
  if (!keyword) return;
  addLoading.value = true;
  try {
    if (customActive.value) {
      const res: any = await searchMetadataApi({
        content_profile: effectiveProfile.value,
        provider: addProvider.value || undefined,
        query: keyword,
        limit: 20,
      });
      addResults.value = Array.isArray(res) ? res : res?.data || [];
    } else {
      const res: any = await searchMediaApi({
        keyword,
        searchtype: 'tmdb',
      });
      const raw = Array.isArray(res) ? res : res?.data || [];
      addResults.value = raw.filter((media: any) => {
        const type = String(media.type || media.media_type || '').toUpperCase();
        if (activeProfile.value === 'anime') return type !== 'MOVIE';
        return props.mediaType === 'movie'
          ? !type || type === 'MOVIE'
          : type !== 'MOVIE';
      });
    }
  } catch (error: any) {
    notification.error('搜索失败', { description: error?.message || '' });
  } finally {
    addLoading.value = false;
  }
}

watch(addKeyword, (value) => {
  if (addTimer) clearTimeout(addTimer);
  if (!value.trim()) {
    addResults.value = [];
    return;
  }
  addTimer = setTimeout(() => handleAddSearch(), 400);
});

async function selectAddMedia(media: any) {
  addShow.value = false;
  let defaults: any = {};
  try {
    const res: any = await getDefaultSubscriptionSettingApi(
      props.mediaType,
      effectiveProfile.value,
    );
    defaults = res?.data || res || {};
  } catch {
    // ignore
  }

  if (customActive.value) {
    const { provider, externalId, code } = metadataRefOf(media);
    const image =
      media.poster || media.images?.poster?.[0]?.url || media.image || '';
    editItem.value = {
      name: media.title || media.name || code,
      year: String(media.year || ''),
      type: 'movie',
      tmdbid: '',
      image,
      keyword: code,
      content_profile: effectiveProfile.value,
      provider,
      metadata_ref: `${provider}:${externalId}`,
      mediaid: code ? `content_id:${code}` : `${provider}:${externalId}`,
      overview: media.overview || '',
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
      filter_free:
        defaults.free != null && String(defaults.free) === '1'
          ? true
          : (defaults.filter_free ?? false),
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
    editShow.value = true;
    return;
  }

  const rawType = String(media.media_type || media.type || '').toLowerCase();
  const type: 'anime' | 'movie' | 'tv' =
    activeProfile.value === 'anime' || rawType === 'anime'
      ? 'anime'
      : rawType === 'movie' || props.mediaType === 'movie'
        ? 'movie'
        : 'tv';
  editItem.value = {
    name: media.title || '',
    year: media.year || '',
    type,
    tmdbid: String(media.id || media.tmdb_id || ''),
    image: media.image || media.poster || '',
    keyword: '',
    content_profile: effectiveProfile.value,
    season: '',
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
    filter_free:
      defaults.free != null && String(defaults.free) === '1'
        ? true
        : (defaults.filter_free ?? false),
    download_setting:
      defaults.download_setting == null
        ? ''
        : String(defaults.download_setting),
    save_path: defaults.save_path || '',
    total_ep: '',
    current_ep: '',
    rss_sites: Array.isArray(defaults.rss_sites) ? defaults.rss_sites : [],
    search_sites: Array.isArray(defaults.search_sites)
      ? defaults.search_sites
      : [],
  };
  editShow.value = true;
}

async function handleSaveSetting(data: Record<string, any>) {
  try {
    await saveDefaultSubscriptionSettingApi(
      props.mediaType,
      data,
      effectiveProfile.value,
    );
    notification.success('默认设置已保存');
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  }
}

function searchTitle(media: any): string {
  return media.title || media.name || media.content_id || '未命名';
}

function searchYear(media: any): string {
  return String(media.year || '');
}

function searchImage(media: any): string {
  return media.poster || media.images?.poster?.[0]?.url || media.image || '';
}

onMounted(() => {
  addProvider.value = getContentProfileDefaultSearchSource(
    effectiveProfile.value,
  );
  fetchData();
  fetchOptions();
});

onUnmounted(() => {
  if (addTimer) clearTimeout(addTimer);
});
</script>

<template>
  <div class="p-4">
    <PageHeader :title="props.title">
      <template #actions>
        <NSpace>
          <NButton v-if="isSuperAdmin" @click="groupView = !groupView">
            {{ groupView ? '平铺视图' : '聚合视图' }}
          </NButton>
          <NButton type="primary" @click="openAdd">新增订阅</NButton>
          <NButton v-if="canEditDefault" @click="settingShow = true">
            默认设置
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <div v-if="profileTabs.length > 1" class="subscription-tabs">
      <NRadioGroup
        :value="activeProfile"
        size="small"
        @update:value="handleTabChange"
      >
        <NRadioButton
          v-for="tab in profileTabs"
          :key="tab.value"
          :value="tab.value"
        >
          {{ tab.label }}
        </NRadioButton>
      </NRadioGroup>
    </div>

    <NSpin :show="loading">
      <div v-if="groups.length > 0">
        <div v-if="showGroupView" class="subscription-groups">
          <SubscriptionGroupCard
            v-for="group in groups"
            :key="group.key"
            :group-key="group.key"
            :items="group.items"
            :name="group.name"
            :year="group.year"
            :season="group.season"
            :image="group.image"
            :vote="group.vote"
            :type="resolveGroupType(group)"
            :type-label="customActive ? activeProfileLabel : ''"
            @delete="handleDelete"
            @edit="handleEdit"
            @refresh="handleCardRefresh"
            @search="handleCardSearch"
          />
        </div>
        <div v-else class="subscription-flow">
          <SubscriptionHoverCard
            v-for="item in items"
            :key="item.id"
            :item="item"
            :type="resolveItemType(item)"
            :type-label="customActive ? activeProfileLabel : ''"
            :filter-rule-map="filterRuleMap"
            :download-setting-map="downloadSettingMap"
            @click="handleCardClick(item)"
            @delete="handleDelete"
            @edit="handleEdit"
            @refresh="handleCardRefresh"
            @search="handleCardSearch"
          />
        </div>
      </div>
      <EmptyState
        v-else
        class="mt-8"
        :title="`没有${activeProfileLabel}订阅`"
        subtitle="可点击右上角新增订阅，或在搜索/探索页直接订阅"
      />
    </NSpin>

    <!-- 新增订阅搜索 -->
    <NModal
      v-model:show="addShow"
      preset="card"
      title="新增订阅"
      style="width: 720px; max-width: 90vw"
      :bordered="false"
    >
      <NSpace vertical>
        <NSelect
          v-if="customActive && providerOptions.length > 0"
          v-model:value="addProvider"
          :options="providerOptions"
          placeholder="选择元数据来源"
        />
        <NInput
          v-model:value="addKeyword"
          :placeholder="
            customActive ? '输入番号/关键词搜索' : '输入电影/电视剧名称搜索'
          "
          clearable
        />
        <NSpin :show="addLoading">
          <div class="max-h-[50vh] space-y-2 overflow-y-auto">
            <button
              v-for="(media, index) in addResults"
              :key="`${media.id || media.ref?.external_id || index}`"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-accent"
              @click="selectAddMedia(media)"
            >
              <img
                v-if="searchImage(media)"
                :src="searchImage(media)"
                class="h-16 w-11 rounded object-cover"
                alt=""
              />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium">
                  {{ searchTitle(media) }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ searchYear(media) }}
                </div>
              </div>
            </button>
            <EmptyState
              v-if="!addLoading && addResults.length === 0 && addKeyword"
              title="没有搜索结果"
            />
          </div>
        </NSpin>
      </NSpace>
    </NModal>

    <SubscribeEditModal
      v-model:show="editShow"
      :item="editItem"
      @confirm="handleConfirmEdit"
    />

    <SubscriptionDeleteModal
      v-model:show="deleteShow"
      :item="deleteTarget"
      kind="subscription"
      @confirm="confirmDelete"
    />

    <SubscribeDefaultSettingModal
      :show="settingShow"
      :mtype="props.mediaType"
      :content-profile="activeProfile"
      @update:show="settingShow = $event"
      @confirm="handleSaveSetting"
    />

    <NModal
      v-model:show="searchModalVisible"
      preset="card"
      :title="searchModalTitle || '搜索进度'"
      style="width: 420px; max-width: 90vw"
      :bordered="false"
    >
      <NProgress type="line" :percentage="searchModalProgress" />
      <p class="mt-3 text-sm text-muted-foreground">{{ searchModalText }}</p>
    </NModal>
  </div>
</template>

<style scoped>
.subscription-tabs {
  margin-top: 0.75rem;
}

.subscription-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-content: flex-start;
  margin-top: 1rem;
}

.subscription-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-content: flex-start;
  margin-top: 1rem;
}

@media (hover: none) {
  .subscription-flow,
  .subscription-groups {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  }
}
</style>
