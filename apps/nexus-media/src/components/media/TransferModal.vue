<script lang="ts" setup>
import { ref, watch } from 'vue';

import {
  NButton,
  NCard,
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

import { IconifyIcon } from '@vben/icons';

import { searchMediaApi } from '#/api/modules/media';
import { SYNC_MODES } from '#/api/modules/sync';

export interface TransferFormData {
  path: string;
  outpath: string;
  syncmod: string;
  type: string;
  tmdb?: number;
  season?: number;
  min_filesize?: number;
}

const props = defineProps<{
  show: boolean;
  path: string;
  outpath?: string;
  syncmod?: string;
  type?: string;
  loading?: boolean;
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
        tmdb: undefined,
        season: undefined,
        min_filesize: undefined,
      };
    }
  },
);

function handleClose() {
  emit('update:show', false);
}

function handleSubmit() {
  emit('submit', { ...form.value });
}

// TMDB search
const tmdbSearchShow = ref(false);
const tmdbSearchKeyword = ref('');
const tmdbSearchLoading = ref(false);
const tmdbSearchResults = ref<any[]>([]);

function openTmdbSearch() {
  tmdbSearchShow.value = true;
  tmdbSearchKeyword.value = form.value.path
    ? form.value.path.split('/').pop()?.replace(/\.\w+$/, '') || ''
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
  tmdbSearchShow.value = false;
  tmdbSearchResults.value = [];
}

function getImgUrl(url?: string) {
  if (!url) return '/static/img/no-image.png';
  if (url.startsWith('http')) return `/img?url=${url}`;
  return url;
}
</script>

<template>
  <div>
    <!-- 转移弹窗 -->
    <NModal
      :show="props.show"
      title="转移"
      preset="card"
      style="width: 560px; max-width: 92vw;"
      :bordered="false"
      segmented
      @update:show="handleClose"
    >
      <NForm label-placement="left" label-width="80">
        <NFormItem label="输入路径">
          <NInput v-model:value="form.path" readonly size="small" :title="form.path" />
        </NFormItem>
        <NFormItem label="输出路径">
          <NInput
            v-model:value="form.outpath"
            placeholder="留空则转移至媒体库"
            size="small"
          />
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
        <NFormItem label="TMDB ID">
          <NSpace align="center" :wrap="false" style="width: 100%;">
            <NInputNumber
              v-model:value="form.tmdb"
              placeholder="自动识别"
              :min="0"
              :show-button="false"
              clearable
              size="small"
              style="flex: 1;"
            />
            <NButton size="small" @click="openTmdbSearch">
              <template #icon>
                <IconifyIcon icon="lucide:search" class="size-4" />
              </template>
              搜索
            </NButton>
          </NSpace>
        </NFormItem>
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
      style="width: 560px; max-width: 92vw;"
      :bordered="false"
      segmented
    >
      <NSpace vertical>
        <NSpace align="center">
          <NInput
            v-model:value="tmdbSearchKeyword"
            placeholder="输入名称查询"
            size="small"
            style="width: 320px;"
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
          <div
            v-if="tmdbSearchResults.length > 0"
            class="tmdb-result-grid"
          >
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
                <img
                  v-if="media.image || media.poster"
                  :src="getImgUrl(media.image || media.poster)"
                  class="tmdb-poster rounded"
                  alt=""
                  @error="(e: any) => (e.target.src = '/static/img/no-image.png')"
                />
                <div
                  v-else
                  class="tmdb-poster-placeholder flex items-center justify-center rounded"
                >
                  <IconifyIcon
                    icon="lucide:image"
                    class="size-6"
                    style="color: hsl(var(--muted-foreground));"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="tmdb-title truncate">
                    {{ media.title }}
                    <span v-if="media.year" class="tmdb-year">({{ media.year }})</span>
                  </div>
                  <div
                    v-if="media.overview"
                    class="tmdb-overview line-clamp-3"
                  >
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
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.tmdb-result-card:hover {
  box-shadow: 0 2px 8px hsl(var(--foreground) / 0.08);
}

.tmdb-poster {
  width: 60px;
  height: 80px;
  object-fit: cover;
  flex-shrink: 0;
  background-color: hsl(var(--muted));
}

.tmdb-poster-placeholder {
  width: 60px;
  height: 80px;
  background-color: hsl(var(--muted));
  flex-shrink: 0;
}

.tmdb-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  margin-bottom: 0.25rem;
}

.tmdb-year {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  font-weight: 400;
}

.tmdb-overview {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
}
</style>
