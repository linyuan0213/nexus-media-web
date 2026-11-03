<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NDivider,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
} from 'naive-ui';

import {
  getMetadataProvidersApi,
  searchMediaApi,
  searchMetadataApi,
} from '#/api/modules/media';
import { getStorageBackendsApi } from '#/api/modules/storage';
import { SYNC_MODES } from '#/api/modules/sync';
import MediaPoster from '#/components/media/MediaPoster.vue';
import { getContentProfileLabel } from '#/plugin-framework';

import PathPickerModal from './PathPickerModal.vue';

export interface TransferFormData {
  path: string;
  outpath: string;
  syncmod: string;
  type: string;
  content_profile?: string;
  provider?: string;
  external_id?: string;
  selectedLabel?: string;
  query?: string;
  tmdb?: number;
  season?: number;
  episode_format?: string;
  episode_details?: string;
  episode_part?: string;
  episode_offset?: string;
  min_filesize?: number;
  src_backend_id?: string;
  dst_backend_id?: string;
}

const props = defineProps<{
  contentProfile?: string;
  externalId?: string;
  loading?: boolean;
  outpath?: string;
  path: string;
  provider?: string;
  selectedLabel?: string;
  show: boolean;
  srcBackendId?: string;
  syncmod?: string;
  type?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'submit', data: TransferFormData): void;
}>();

const form = ref<TransferFormData>({
  path: '',
  outpath: '',
  syncmod: 'copy',
  type: 'movie',
  content_profile: 'default',
  provider: 'tmdb',
  external_id: '',
  selectedLabel: '',
  query: '',
  season: undefined,
  episode_format: '',
  episode_details: '',
  episode_part: '',
  episode_offset: '',
});

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      form.value = {
        path: props.path,
        outpath: props.outpath || '',
        syncmod: props.syncmod || 'copy',
        type: props.type || 'movie',
        content_profile: props.contentProfile || 'default',
        provider: props.provider || 'tmdb',
        external_id: props.externalId || '',
        selectedLabel: props.selectedLabel || '',
        query: '',
        tmdb: undefined,
        season: undefined,
        episode_format: '',
        episode_details: '',
        episode_part: '',
        episode_offset: '',
        min_filesize: undefined,
        src_backend_id: props.srcBackendId || 'local',
        dst_backend_id: 'local',
      };
      form.value.query =
        form.value.path
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '') || '';
      void loadProviders().then(ensureSource);
    }
  },
);

const providers = ref<Record<string, any>[]>([]);
const providersLoading = ref(false);
const metadataLoading = ref(false);
const metadataResults = ref<Record<string, any>[]>([]);

const profileOptions = computed(() => {
  const labels = new Map<string, string>([
    ['anime', '动漫'],
    ['default', '默认（TMDB）'],
  ]);
  for (const provider of providers.value) {
    for (const profile of provider.content_profiles || []) {
      if (!labels.has(profile)) {
        labels.set(profile, getContentProfileLabel(profile) || profile);
      }
    }
  }
  return [...labels.entries()].map(([value, label]) => ({ label, value }));
});

const sourceOptions = computed(() => {
  const profile = form.value.content_profile || 'default';
  return providers.value
    .filter((provider) => {
      const profiles = provider.content_profiles || [];
      return profiles.length === 0 || profiles.includes(profile);
    })
    .map((provider) => ({
      label: provider.name || provider.provider,
      value: provider.provider,
    }));
});

const isTmdbSource = computed(() => form.value.provider === 'tmdb');

async function loadProviders() {
  if (providers.value.length > 0) return;
  providersLoading.value = true;
  try {
    const response: any = await getMetadataProvidersApi();
    providers.value = Array.isArray(response) ? response : response?.data || [];
  } catch {
    providers.value = [];
  } finally {
    providersLoading.value = false;
  }
}

function ensureSource() {
  const options = sourceOptions.value;
  if (!options.some((item) => item.value === form.value.provider)) {
    form.value.provider =
      options.find((item) => item.value === 'tmdb')?.value ||
      options[0]?.value ||
      'tmdb';
  }
  if (form.value.provider === 'tmdb' && form.value.external_id) {
    form.value.tmdb = Number(form.value.external_id) || undefined;
  }
}

watch(
  () => form.value.content_profile,
  (profile, previous) => {
    if (!props.show || profile === previous) return;
    form.value.external_id = '';
    form.value.selectedLabel = '';
    form.value.tmdb = undefined;
    metadataResults.value = [];
    if (profile === 'default') {
      form.value.provider = 'tmdb';
    } else if (profile === 'anime') {
      form.value.provider =
        sourceOptions.value.find((item) => item.value === 'bangumi')?.value ||
        sourceOptions.value[0]?.value ||
        'tmdb';
    } else {
      form.value.provider = sourceOptions.value[0]?.value || '';
    }
  },
);

function handleSourceChange(value: string) {
  form.value.provider = value;
  form.value.external_id = '';
  form.value.selectedLabel = '';
  form.value.tmdb = undefined;
  metadataResults.value = [];
}

function searchMetadata() {
  if (isTmdbSource.value) {
    openTmdbSearch();
    return;
  }
  void handleMetadataSearch();
}

async function handleMetadataSearch() {
  if (!form.value.query?.trim()) return;
  metadataLoading.value = true;
  try {
    const response: any = await searchMetadataApi({
      content_profile: form.value.content_profile || 'default',
      provider: form.value.provider || undefined,
      query: form.value.query.trim(),
      limit: 20,
    });
    metadataResults.value = Array.isArray(response)
      ? response
      : response?.data || [];
  } catch {
    metadataResults.value = [];
  } finally {
    metadataLoading.value = false;
  }
}

function metadataProvider(result: Record<string, any>) {
  return String(result.provider || result.ref?.provider || '');
}

function metadataExternalId(result: Record<string, any>) {
  return String(
    result.external_id || result.ref?.external_id || result.id || '',
  );
}

function selectMetadataResult(result: Record<string, any>) {
  form.value.provider = metadataProvider(result) || form.value.provider;
  form.value.external_id = metadataExternalId(result);
  form.value.selectedLabel = [
    result.title || metadataExternalId(result),
    result.year ? `(${result.year})` : '',
  ]
    .filter(Boolean)
    .join(' ');
  if (result.media_type) form.value.type = String(result.media_type);
  metadataResults.value = [];
}

function handleClose() {
  emit('update:show', false);
}

function handleSubmit() {
  emit('submit', { ...form.value });
}

// 路径选择（复用 PathPickerModal）
const pickerShow = ref(false);
const pickerTarget = ref<'dst' | 'src'>('src');

function openPathPicker(target: 'dst' | 'src') {
  pickerTarget.value = target;
  pickerShow.value = true;
}

function handlePathConfirm(path: string, backendId: string) {
  if (pickerTarget.value === 'src') {
    form.value.path = path;
    form.value.src_backend_id = backendId;
  } else {
    form.value.outpath = path;
    form.value.dst_backend_id = backendId;
  }
}

// TMDB search
const tmdbSearchShow = ref(false);
const tmdbSearchKeyword = ref('');
const tmdbSearchLoading = ref(false);
const tmdbSearchResults = ref<any[]>([]);

// 存储后端选项（用于源/目标后端选择）
const backendOptions = ref<Array<{ label: string; value: string }>>([
  { label: '本地', value: 'local' },
]);

async function loadBackends() {
  try {
    const res: any = await getStorageBackendsApi();
    const items: Array<{ enabled: boolean; id: number; name: string }> =
      res?.items || [];
    backendOptions.value = [
      { label: '本地', value: 'local' },
      ...items
        .filter((b) => b.enabled)
        .map((b) => ({ label: b.name, value: String(b.id) })),
    ];
  } catch {
    // 加载失败时保持仅本地选项
  }
}

loadBackends();

function openTmdbSearch() {
  tmdbSearchShow.value = true;
  tmdbSearchKeyword.value = form.value.path
    ? form.value.path
        .split('/')
        .pop()
        ?.replace(/\.\w+$/, '') || ''
    : '';
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
  } finally {
    tmdbSearchLoading.value = false;
  }
}

function selectTmdbMedia(media: any) {
  form.value.tmdb = media.id || media.tmdb_id || undefined;
  // 选中结果时同步媒体类型（此前不同步，电视剧/动漫会按默认“电影”查询导致查不到 TMDB）
  const t = String(media.media_type || media.type || '').toLowerCase();
  if (t === 'anime' || t === '动漫') {
    form.value.type = 'anime';
  } else if (t === 'tv' || t === '剧集' || t === '电视剧') {
    form.value.type = 'tv';
  } else if (t === 'movie' || t === '电影') {
    form.value.type = 'movie';
  }
  tmdbSearchShow.value = false;
  tmdbSearchResults.value = [];
}
</script>

<template>
  <div>
    <!-- 转移弹窗 -->
    <NModal
      :show="props.show"
      title="转移"
      preset="card"
      style="width: 560px; max-width: 92vw"
      :bordered="false"
      segmented
      @update:show="handleClose"
    >
      <NForm label-placement="left" label-width="80">
        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="源后端">
            <NSelect
              v-model:value="form.src_backend_id"
              :options="backendOptions"
              size="small"
            />
          </NFormItem>
          <NFormItem label="目标后端">
            <NSelect
              v-model:value="form.dst_backend_id"
              :options="backendOptions"
              size="small"
            />
          </NFormItem>
        </div>
        <NFormItem label="输入路径">
          <NInput
            v-model:value="form.path"
            readonly
            size="small"
            :title="form.path"
          >
            <template #suffix>
              <NButton
                size="tiny"
                text
                @click="openPathPicker('src')"
                title="浏览选择目录"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:folder-open" class="size-4" />
                </template>
              </NButton>
            </template>
          </NInput>
        </NFormItem>
        <NFormItem label="输出路径">
          <NInput
            v-model:value="form.outpath"
            placeholder="留空则转移至媒体库"
            size="small"
          >
            <template #suffix>
              <NButton
                size="tiny"
                text
                @click="openPathPicker('dst')"
                title="浏览选择目录"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:folder-open" class="size-4" />
                </template>
              </NButton>
            </template>
          </NInput>
        </NFormItem>
        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="转移方式">
            <NSelect
              v-model:value="form.syncmod"
              :options="SYNC_MODES"
              size="small"
            />
          </NFormItem>
          <NFormItem label="类型">
            <NRadioGroup v-model:value="form.type" size="small">
              <NRadioButton value="movie">电影</NRadioButton>
              <NRadioButton value="tv">电视剧</NRadioButton>
              <NRadioButton value="anime">动漫</NRadioButton>
            </NRadioGroup>
          </NFormItem>
        </div>
        <NFormItem label="内容画像">
          <NSelect
            v-model:value="form.content_profile"
            :loading="providersLoading"
            :options="profileOptions"
            size="small"
          />
        </NFormItem>
        <NFormItem label="元数据来源">
          <NSelect
            :value="form.provider"
            :loading="providersLoading"
            :options="sourceOptions"
            placeholder="默认 TMDB"
            size="small"
            @update:value="handleSourceChange"
          />
        </NFormItem>
        <template v-if="isTmdbSource">
          <NFormItem label="TMDB ID">
            <NSpace align="center" :wrap="false" style="width: 100%">
              <NInputNumber
                v-model:value="form.tmdb"
                placeholder="自动识别"
                :min="0"
                :show-button="false"
                clearable
                size="small"
                style="flex: 1"
              />
              <NButton size="small" @click="openTmdbSearch">
                <template #icon>
                  <IconifyIcon icon="lucide:search" class="size-4" />
                </template>
                搜索
              </NButton>
            </NSpace>
          </NFormItem>
        </template>
        <template v-else>
          <NFormItem label="内容编号 / 关键词">
            <NSpace align="center" :wrap="false" style="width: 100%">
              <NInput
                v-model:value="form.query"
                placeholder="输入编号或关键词"
                size="small"
                style="flex: 1"
                @keyup.enter="searchMetadata"
              />
              <NButton
                size="small"
                :loading="metadataLoading"
                @click="searchMetadata"
              >
                搜索
              </NButton>
            </NSpace>
          </NFormItem>
          <NFormItem label="已选结果">
            <span v-if="form.external_id" class="selected-result">
              <span class="selected-provider">{{ form.provider }}</span>
              {{ form.selectedLabel || form.external_id }}
            </span>
            <span v-else class="empty-result">请搜索并选择元数据结果</span>
          </NFormItem>
          <div v-if="metadataResults.length > 0" class="metadata-results">
            <button
              v-for="result in metadataResults"
              :key="`${metadataProvider(result)}:${metadataExternalId(result)}`"
              type="button"
              class="metadata-item"
              @click="selectMetadataResult(result)"
            >
              <span class="metadata-title">
                {{ result.title || metadataExternalId(result) }}
                <small v-if="result.year">({{ result.year }})</small>
              </span>
              <span class="metadata-ref">
                {{ metadataProvider(result) }} ·
                {{ metadataExternalId(result) }}
              </span>
            </button>
          </div>
        </template>
        <template v-if="form.type !== 'movie'">
          <NDivider style="margin: 0.5rem 0">季集设置</NDivider>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NFormItem label="季">
              <NInputNumber
                v-model:value="form.season"
                placeholder="如 1"
                :min="1"
                :show-button="false"
                clearable
                size="small"
              />
            </NFormItem>
            <NFormItem label="指定集数">
              <NInput
                v-model:value="form.episode_format"
                placeholder="如 1,2,3"
                size="small"
              />
            </NFormItem>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NFormItem label="定位集数">
              <NInput
                v-model:value="form.episode_details"
                placeholder="如 E01"
                size="small"
              />
            </NFormItem>
            <NFormItem label="集数偏移">
              <NInput
                v-model:value="form.episode_offset"
                placeholder="如 -10"
                size="small"
              />
            </NFormItem>
          </div>
          <NFormItem label="指定 Part">
            <NInput
              v-model:value="form.episode_part"
              placeholder="如 Part1"
              size="small"
            />
          </NFormItem>
        </template>
        <NFormItem label="过滤大小">
          <NInputNumber
            v-model:value="form.min_filesize"
            placeholder="MB，0 为不限制"
            :min="0"
            :show-button="false"
            clearable
            size="small"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="handleClose">取消</NButton>
          <NButton
            type="primary"
            size="small"
            :loading="props.loading"
            @click="handleSubmit"
          >
            转移
          </NButton>
        </div>
      </template>
    </NModal>

    <!-- TMDB 查询弹窗 -->
    <NModal
      v-model:show="tmdbSearchShow"
      title="查询 TMDB ID"
      preset="card"
      style="width: 560px; max-width: 92vw"
      :bordered="false"
      segmented
    >
      <NSpace vertical>
        <NSpace align="center">
          <NInput
            v-model:value="tmdbSearchKeyword"
            placeholder="输入名称查询"
            size="small"
            style="width: 320px"
            @keyup.enter="handleTmdbSearch"
          />
          <NButton
            type="primary"
            size="small"
            :loading="tmdbSearchLoading"
            @click="handleTmdbSearch"
          >
            <template #icon>
              <IconifyIcon icon="lucide:search" class="size-4" />
            </template>
            搜索
          </NButton>
        </NSpace>
        <NSpin :show="tmdbSearchLoading">
          <div v-if="tmdbSearchResults.length > 0" class="tmdb-result-grid">
            <NCard
              v-for="media in tmdbSearchResults"
              :key="media.id"
              size="small"
              :bordered="false"
              class="tmdb-result-card"
              hoverable
              @click="selectTmdbMedia(media)"
            >
              <div class="flex gap-3">
                <MediaPoster
                  v-if="media.image || media.poster"
                  :src="media.image || media.poster"
                  :content-profile="media.content_profile"
                  class="tmdb-poster rounded"
                  alt=""
                />
                <div
                  v-else
                  class="tmdb-poster-placeholder flex items-center justify-center rounded"
                >
                  <IconifyIcon
                    icon="lucide:image"
                    class="size-6"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="tmdb-title truncate">
                    {{ media.title }}
                    <span v-if="media.year" class="tmdb-year"
                      >({{ media.year }})</span
                    >
                  </div>
                  <div v-if="media.overview" class="tmdb-overview line-clamp-3">
                    {{ media.overview }}
                  </div>
                </div>
              </div>
            </NCard>
          </div>
          <NEmpty
            v-else-if="!tmdbSearchLoading && tmdbSearchKeyword"
            title="未找到相关媒体"
            subtitle="请尝试其他关键词"
          />
        </NSpin>
      </NSpace>
    </NModal>

    <!-- 路径选择器（输入/输出） -->
    <PathPickerModal
      v-model:show="pickerShow"
      :initial-backend-id="
        pickerTarget === 'src'
          ? form.src_backend_id || 'local'
          : form.dst_backend_id || 'local'
      "
      :initial-path="pickerTarget === 'src' ? form.path : form.outpath"
      :title="pickerTarget === 'src' ? '选择输入路径' : '选择输出路径'"
      @confirm="handlePathConfirm"
    />
  </div>
</template>

<style scoped>
.tmdb-result-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 50vh;
  overflow-y: auto;
}

.tmdb-result-card {
  cursor: pointer;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition: box-shadow 0.2s;
}

.tmdb-result-card:hover {
  box-shadow: 0 2px 8px hsl(var(--foreground) / 8%);
}

.tmdb-poster {
  flex-shrink: 0;
  width: 60px;
  height: 80px;
  object-fit: cover;
  background-color: hsl(var(--muted));
}

.tmdb-poster-placeholder {
  flex-shrink: 0;
  width: 60px;
  height: 80px;
  background-color: hsl(var(--muted));
}

.tmdb-title {
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.tmdb-year {
  font-size: 0.8rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.tmdb-overview {
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.selected-result {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  font-size: 0.8125rem;
}

.selected-provider {
  padding: 0.05rem 0.4rem;
  font-size: 0.6875rem;
  color: hsl(var(--accent-foreground));
  background: hsl(var(--accent));
  border-radius: 9999px;
}

.empty-result {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.metadata-results {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 12rem;
  margin-bottom: 0.75rem;
  overflow-y: auto;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.45rem 0.6rem;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: 0.45rem;
}

.metadata-item:hover {
  border-color: hsl(var(--primary) / 50%);
}

.metadata-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.metadata-ref {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}
</style>
