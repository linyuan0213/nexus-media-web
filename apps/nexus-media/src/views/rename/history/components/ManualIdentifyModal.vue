<script lang="ts" setup>
import type { HistoryItem } from '../types';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  NSpin,
} from 'naive-ui';

import {
  getMetadataProvidersApi,
  searchMediaApi,
  searchMetadataApi,
} from '#/api/modules/media';
import { manualTransferApi, SYNC_MODES } from '#/api/modules/sync';
import { getContentProfileLabel } from '#/plugin-framework';
import { useAppNotification } from '#/utils/notify';

interface Props {
  item: HistoryItem | null;
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:show': [value: boolean];
  success: [];
}>();

const notification = useAppNotification();
const loading = ref(false);
const providersLoading = ref(false);
const providers = ref<Record<string, any>[]>([]);
let providerCache: null | Record<string, any>[] = null;

const form = ref({
  logid: 0,
  path: '',
  syncmod: 'copy',
  type: 'movie',
  content_profile: 'default',
  provider: '',
  external_id: '',
  selectedLabel: '',
  query: '',
  tmdb: undefined as number | undefined,
  season: undefined as number | undefined,
  min_filesize: undefined as number | undefined,
  episode_format: '',
  episode_details: '',
  episode_part: '',
  episode_offset: '',
});

const tmdbSearchShow = ref(false);
const tmdbSearchKeyword = ref('');
const tmdbSearchLoading = ref(false);
const tmdbSearchResults = ref<any[]>([]);

const metadataSearchLoading = ref(false);
const metadataResults = ref<Record<string, any>[]>([]);

const typeOptions = [
  { label: '电影', value: 'movie' },
  { label: '电视剧', value: 'tv' },
  { label: '动漫', value: 'anime' },
];

const isCustomProfile = computed(
  () =>
    Boolean(form.value.content_profile) &&
    !['anime', 'default'].includes(form.value.content_profile),
);

const profileOptions = computed(() => {
  const labels = new Map<string, string>([
    ['anime', '动漫'],
    ['default', '默认（TMDB）'],
  ]);
  for (const provider of providers.value) {
    for (const profile of provider.content_profiles || []) {
      if (!labels.has(profile)) {
        // 画像名称由插件声明，不能退化成 provider 名称
        labels.set(profile, getContentProfileLabel(profile) || profile);
      }
    }
  }
  if (form.value.content_profile && !labels.has(form.value.content_profile)) {
    labels.set(form.value.content_profile, form.value.content_profile);
  }
  return [...labels.entries()].map(([value, label]) => ({ label, value }));
});

const providerOptions = computed(() =>
  providers.value
    .filter((provider) =>
      (provider.content_profiles || []).includes(form.value.content_profile),
    )
    .map((provider) => ({
      label: provider.name || provider.provider,
      value: provider.provider,
    })),
);

async function loadProviders() {
  if (providerCache) {
    providers.value = providerCache;
    return;
  }
  providersLoading.value = true;
  try {
    const response: any = await getMetadataProvidersApi();
    providers.value = Array.isArray(response) ? response : response?.data || [];
    providerCache = providers.value;
  } catch {
    providers.value = [];
  } finally {
    providersLoading.value = false;
  }
}

function filenameStem(path: string) {
  return (
    path
      .split('/')
      .pop()
      ?.replace(/\.\w+$/, '') || ''
  );
}

function ensureProvider() {
  const options = providerOptions.value;
  if (!isCustomProfile.value) {
    form.value.provider = '';
    form.value.external_id = '';
    form.value.selectedLabel = '';
    return;
  }
  const preferred = String(props.item?.ANCHOR_PROVIDER || '');
  if (options.some((option) => option.value === preferred)) {
    form.value.provider = preferred;
  } else if (!options.some((option) => option.value === form.value.provider)) {
    form.value.provider = options[0]?.value || '';
  }
  // 只有原记录锚点就是当前 provider 时才复用外部 ID；content_id 等聚合锚点必须重新搜索
  if (
    !form.value.external_id &&
    preferred &&
    preferred === form.value.provider
  ) {
    form.value.external_id = String(props.item?.ANCHOR_EXTERNAL_ID || '');
    form.value.selectedLabel = form.value.external_id;
  }
  if (!form.value.query) {
    form.value.query =
      String(props.item?.ANCHOR_EXTERNAL_ID || '') ||
      filenameStem(form.value.path);
  }
}

watch(
  () => [props.show, props.item?.ID],
  () => {
    if (!props.show || !props.item) return;
    const item = props.item;
    form.value = {
      logid: item.ID,
      path: item.SOURCE_PATH
        ? `${item.SOURCE_PATH}/${item.SOURCE_FILENAME}`
        : '',
      syncmod: item.SYNC_MODE || 'copy',
      type:
        item.TYPE === 'movie'
          ? 'movie'
          : item.TYPE === 'anime'
            ? 'anime'
            : 'tv',
      content_profile: String(item.CONTENT_PROFILE || 'default'),
      provider: '',
      external_id: '',
      selectedLabel: '',
      query: '',
      tmdb: item.TMDBID || undefined,
      season: undefined,
      min_filesize: undefined,
      episode_format: '',
      episode_details: '',
      episode_part: '',
      episode_offset: '',
    };
    metadataResults.value = [];
    void loadProviders().then(ensureProvider);
  },
  { immediate: true },
);

watch(
  () => form.value.content_profile,
  (profile, previous) => {
    if (profile === previous) return;
    form.value.external_id = '';
    form.value.selectedLabel = '';
    form.value.tmdb = undefined;
    metadataResults.value = [];
    if (!['anime', 'default'].includes(profile)) {
      form.value.provider = providerOptions.value[0]?.value || '';
    } else {
      form.value.provider = '';
    }
  },
);

function handleProviderChange(value: string) {
  form.value.provider = value;
  form.value.external_id = '';
  form.value.selectedLabel = '';
  metadataResults.value = [];
}

function openTmdbSearch() {
  tmdbSearchShow.value = true;
  tmdbSearchKeyword.value = form.value.tmdb
    ? ''
    : filenameStem(form.value.path);
  tmdbSearchResults.value = [];
}

async function handleTmdbSearch() {
  if (!tmdbSearchKeyword.value.trim()) return;
  tmdbSearchLoading.value = true;
  try {
    const res: any = await searchMediaApi({
      keyword: tmdbSearchKeyword.value,
      searchtype: 'tmdb',
    });
    tmdbSearchResults.value = Array.isArray(res) ? res : res?.data || [];
  } catch (error: any) {
    notification.error('搜索失败', { description: error?.message || '' });
  } finally {
    tmdbSearchLoading.value = false;
  }
}

function selectTmdbMedia(media: any) {
  form.value.tmdb = media.id || media.tmdb_id || undefined;
  tmdbSearchShow.value = false;
  tmdbSearchResults.value = [];
}

async function searchCustomMetadata() {
  if (!form.value.query.trim()) {
    notification.warning('请输入番号或关键词');
    return;
  }
  metadataSearchLoading.value = true;
  try {
    const response: any = await searchMetadataApi({
      content_profile: form.value.content_profile,
      provider: form.value.provider || undefined,
      query: form.value.query.trim(),
      limit: 20,
    });
    metadataResults.value = Array.isArray(response)
      ? response
      : response?.data || [];
  } catch (error: any) {
    notification.error('插件搜索失败', { description: error?.message || '' });
  } finally {
    metadataSearchLoading.value = false;
  }
}

function selectMetadataResult(result: Record<string, any>) {
  form.value.provider = String(result.provider || form.value.provider);
  form.value.external_id = String(result.external_id || '');
  form.value.selectedLabel = [
    result.title || result.external_id,
    result.year ? `(${result.year})` : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (result.media_type) form.value.type = String(result.media_type);
  metadataResults.value = [];
}

async function submit() {
  if (
    isCustomProfile.value &&
    (!form.value.provider || !form.value.external_id)
  ) {
    notification.warning('请先搜索并选择插件识别结果');
    return;
  }
  loading.value = true;
  try {
    const payload: Record<string, any> = {
      logid: form.value.logid,
      syncmod: form.value.syncmod,
      type: form.value.type,
      season: form.value.season,
      min_filesize: form.value.min_filesize,
      episode_format: form.value.episode_format || undefined,
      episode_details: form.value.episode_details || undefined,
      episode_part: form.value.episode_part || undefined,
      episode_offset: form.value.episode_offset || undefined,
      content_profile: form.value.content_profile || undefined,
    };
    if (isCustomProfile.value) {
      payload.provider = form.value.provider;
      payload.external_id = form.value.external_id;
    } else {
      payload.tmdb = form.value.tmdb;
    }
    await manualTransferApi(payload);
    notification.success('手动识别成功');
    emit('update:show', false);
    emit('success');
  } catch (error: any) {
    notification.error('手动识别失败', { description: error?.message || '' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="手动识别"
    style="width: min(620px, 94vw)"
    :mask-closable="!loading"
    @update:show="emit('update:show', $event)"
  >
    <NSpin :show="loading">
      <NForm label-placement="left" label-width="86" size="small">
        <NFormItem label="源文件">
          <NInput :value="form.path" disabled />
        </NFormItem>
        <NFormItem :label="isCustomProfile ? '载体类型' : '媒体类型'">
          <NSelect v-model:value="form.type" :options="typeOptions" />
        </NFormItem>
        <NFormItem label="内容画像">
          <NSelect
            v-model:value="form.content_profile"
            :loading="providersLoading"
            :options="profileOptions"
          />
        </NFormItem>
        <NFormItem label="转移方式">
          <NSelect v-model:value="form.syncmod" :options="SYNC_MODES" />
        </NFormItem>

        <div v-if="isCustomProfile" class="profile-hint">
          内容画像与元数据由插件 provider 提供，载体类型仅用于命名和目录。
        </div>

        <template v-if="isCustomProfile">
          <NFormItem label="元数据来源">
            <NSelect
              :value="form.provider"
              :loading="providersLoading"
              :options="providerOptions"
              placeholder="选择插件 provider"
              @update:value="handleProviderChange"
            />
          </NFormItem>
          <NFormItem label="番号 / 关键词">
            <NSpace align="center" :wrap="false" style="width: 100%">
              <NInput
                v-model:value="form.query"
                placeholder="输入番号或关键词"
                style="flex: 1"
                @keyup.enter="searchCustomMetadata"
              />
              <NButton
                :loading="metadataSearchLoading"
                @click="searchCustomMetadata"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:search" class="size-4" />
                </template>
                搜索
              </NButton>
            </NSpace>
          </NFormItem>
          <NFormItem label="已选结果">
            <span v-if="form.external_id" class="selected-result">
              <span class="selected-provider">{{ form.provider }}</span>
              {{ form.selectedLabel || form.external_id }}
            </span>
            <span v-else class="empty-result">
              请搜索并选择插件返回的结果
            </span>
          </NFormItem>
          <div v-if="metadataResults.length > 0" class="metadata-results">
            <button
              v-for="result in metadataResults"
              :key="`${result.provider}:${result.external_id}`"
              type="button"
              class="metadata-item"
              @click="selectMetadataResult(result)"
            >
              <span class="metadata-title">
                {{ result.title || result.external_id }}
                <small v-if="result.year">({{ result.year }})</small>
              </span>
              <span class="metadata-ref">
                {{ result.provider }} · {{ result.external_id }}
              </span>
            </button>
          </div>
        </template>

        <template v-else>
          <NFormItem label="TMDB ID">
            <NSpace align="center" :wrap="false" style="width: 100%">
              <NInputNumber
                v-model:value="form.tmdb"
                placeholder="输入 TMDB ID"
                style="flex: 1"
              />
              <NButton @click="openTmdbSearch">
                <template #icon>
                  <IconifyIcon icon="lucide:search" class="size-4" />
                </template>
                搜索
              </NButton>
            </NSpace>
          </NFormItem>
        </template>

        <NFormItem v-if="form.type !== 'movie'" label="季">
          <NInputNumber
            v-model:value="form.season"
            placeholder="季数"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="最小文件">
          <NInputNumber
            v-model:value="form.min_filesize"
            placeholder="MB"
            style="width: 100%"
          />
        </NFormItem>
        <NFormItem label="指定集数">
          <NInput v-model:value="form.episode_format" placeholder="如 1,2,3" />
        </NFormItem>
        <NFormItem label="指定 Part">
          <NInput v-model:value="form.episode_part" placeholder="如 Part1" />
        </NFormItem>
        <NFormItem label="定位集数">
          <NInput v-model:value="form.episode_details" placeholder="如 E01" />
        </NFormItem>
        <NFormItem label="集数偏移">
          <NInput v-model:value="form.episode_offset" placeholder="如 -10" />
        </NFormItem>
      </NForm>
    </NSpin>

    <template #footer>
      <div class="modal-footer">
        <NButton :disabled="loading" @click="emit('update:show', false)">
          取消
        </NButton>
        <NButton type="primary" :loading="loading" @click="submit">
          提交识别
        </NButton>
      </div>
    </template>
  </NModal>

  <NModal
    v-model:show="tmdbSearchShow"
    preset="card"
    title="搜索 TMDB"
    style="width: min(560px, 94vw)"
  >
    <NSpace :wrap="false">
      <NInput
        v-model:value="tmdbSearchKeyword"
        placeholder="输入标题搜索"
        @keyup.enter="handleTmdbSearch"
      />
      <NButton :loading="tmdbSearchLoading" @click="handleTmdbSearch">
        搜索
      </NButton>
    </NSpace>

    <div class="tmdb-results">
      <NSpin :show="tmdbSearchLoading">
        <div v-if="tmdbSearchResults.length === 0" class="tmdb-empty">
          输入关键词后搜索
        </div>
        <button
          v-for="media in tmdbSearchResults"
          :key="media.id || media.tmdb_id"
          type="button"
          class="tmdb-item"
          @click="selectTmdbMedia(media)"
        >
          <span class="tmdb-title">
            {{ media.title || media.name }}
            <small v-if="media.year || media.release_date">
              ({{ media.year || String(media.release_date).slice(0, 4) }})
            </small>
          </span>
          <span class="tmdb-id">#{{ media.id || media.tmdb_id }}</span>
        </button>
      </NSpin>
    </div>
  </NModal>
</template>

<style scoped>
.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.tmdb-results {
  max-height: 340px;
  margin-top: 12px;
  overflow-y: auto;
}

.tmdb-empty {
  padding: 24px 0;
  font-size: 0.76rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.tmdb-item,
.metadata-item {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px 10px;
  font-size: 0.76rem;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.tmdb-item + .tmdb-item,
.metadata-item + .metadata-item {
  margin-top: 6px;
}

.tmdb-item:hover,
.metadata-item:hover {
  background: hsl(var(--muted));
}

.tmdb-title small,
.metadata-title small {
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.tmdb-id,
.metadata-ref {
  flex: none;
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  color: hsl(var(--muted-foreground));
}

.metadata-results {
  max-height: 220px;
  margin: -4px 0 12px;
  overflow-y: auto;
}

.metadata-item {
  align-items: flex-start;
}

.metadata-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-result {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-provider {
  flex: none;
  padding: 1px 6px;
  font-size: 0.66rem;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border-radius: 4px;
}

.empty-result {
  font-size: 0.74rem;
  color: hsl(var(--muted-foreground));
}

.profile-hint {
  padding: 7px 10px;
  margin: -6px 0 10px 86px;
  font-size: 0.7rem;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 640px) {
  .profile-hint {
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .metadata-item {
    flex-direction: column;
    gap: 3px;
  }

  .metadata-ref {
    align-self: flex-start;
  }
}
</style>
