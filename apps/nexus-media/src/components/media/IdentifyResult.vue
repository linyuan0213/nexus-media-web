<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';
import { NModal, NSpin } from 'naive-ui';

interface IdentifyResultData {
  name?: string;
  type?: string;
  category?: string;
  cn_name?: string;
  en_name?: string;
  title?: string;
  year?: string;
  season?: string;
  episode?: string;
  tmdbid?: number;
  overview?: string;
  vote_average?: number;
  org_string?: string;
  rev_string?: string;
  resource_pix?: string;
  resource_type?: string;
  resource_effect?: string;
  video_encode?: string;
  audio_encode?: string;
  resource_team?: string;
  part?: string;
  customization?: string;
  replaced_words?: string[];
  ignored_words?: string[];
  offset_words?: string[];
}

const props = defineProps<{
  show: boolean;
  loading?: boolean;
  result: IdentifyResultData;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

function handleClose() {
  emit('update:show', false);
}
</script>

<template>
  <NModal
    :show="props.show"
    title="识别结果"
    preset="card"
    style="width: 640px; max-width: 92vw;"
    :bordered="false"
    segmented
    @update:show="handleClose"
  >
    <NSpin :show="props.loading">
      <div v-if="props.result.name === '无法识别'" class="text-center py-8">
        <IconifyIcon
          icon="lucide:alert-circle"
          class="size-12 mx-auto mb-3"
          style="color: hsl(var(--destructive));"
        />
        <div class="text-lg font-medium" style="color: hsl(var(--card-foreground));">
          无法识别
        </div>
        <div class="text-sm mt-1" style="color: hsl(var(--muted-foreground));">
          未能从文件名中识别出媒体信息
        </div>
      </div>
      <div v-else-if="props.result.name" class="identify-result">
        <!-- 原始名称 -->
        <div class="identify-section">
          <div class="identify-section-label">资源名称</div>
          <div class="identify-orig-name">{{ props.result.org_string }}</div>
        </div>
        <!-- 处理后名称 -->
        <div
          v-if="
            props.result.rev_string &&
            props.result.rev_string !== props.result.org_string
          "
          class="identify-section"
        >
          <div class="identify-section-label">识别词处理后</div>
          <div class="identify-rev-name">{{ props.result.rev_string }}</div>
        </div>
        <!-- 识别标签 -->
        <div class="identify-tags">
          <span v-if="props.result.type" class="identify-tag identify-tag-type">
            {{ props.result.type }}
          </span>
          <span
            v-if="
              props.result.category &&
              props.result.category !== props.result.type
            "
            class="identify-tag identify-tag-category"
          >
            {{ props.result.category }}
          </span>
          <span
            v-if="props.result.cn_name"
            class="identify-tag identify-tag-title"
            :title="props.result.cn_name"
          >
            {{ props.result.cn_name }}
          </span>
          <span
            v-if="
              props.result.en_name &&
              props.result.en_name !== props.result.cn_name
            "
            class="identify-tag identify-tag-en"
            :title="props.result.en_name"
          >
            {{ props.result.en_name }}
          </span>
          <span v-if="props.result.tmdbid" class="identify-tag identify-tag-tmdb">
            {{ props.result.tmdbid }}
          </span>
          <span v-if="props.result.year" class="identify-tag identify-tag-year">
            {{ props.result.year }}
          </span>
          <span
            v-if="props.result.season || props.result.episode"
            class="identify-tag identify-tag-season"
          >
            {{ props.result.season }} {{ props.result.episode }}
          </span>
          <span v-if="props.result.resource_pix" class="identify-tag identify-tag-pix">
            {{ props.result.resource_pix }}
          </span>
          <span v-if="props.result.resource_type" class="identify-tag identify-tag-source">
            {{ props.result.resource_type }}
          </span>
          <span v-if="props.result.resource_effect" class="identify-tag identify-tag-effect">
            {{ props.result.resource_effect }}
          </span>
          <span v-if="props.result.video_encode" class="identify-tag identify-tag-video">
            {{ props.result.video_encode }}
          </span>
          <span v-if="props.result.audio_encode" class="identify-tag identify-tag-audio">
            {{ props.result.audio_encode }}
          </span>
          <span v-if="props.result.resource_team" class="identify-tag identify-tag-team">
            {{ props.result.resource_team }}
          </span>
          <span v-if="props.result.part" class="identify-tag identify-tag-part">
            {{ props.result.part }}
          </span>
          <span
            v-if="props.result.customization"
            class="identify-tag identify-tag-custom"
          >
            {{ props.result.customization }}
          </span>
        </div>
        <!-- 识别词 -->
        <div
          v-if="
            (props.result.replaced_words &&
              props.result.replaced_words.length) ||
            (props.result.ignored_words &&
              props.result.ignored_words.length) ||
            (props.result.offset_words &&
              props.result.offset_words.length)
          "
          class="identify-words-section"
        >
          <div class="identify-section-label">识别词应用</div>
          <div class="identify-words-list">
            <span
              v-for="word in props.result.replaced_words"
              :key="'r-' + word"
              class="identify-word-tag identify-word-replaced"
            >
              替换: {{ word }}
            </span>
            <span
              v-for="word in props.result.ignored_words"
              :key="'i-' + word"
              class="identify-word-tag identify-word-ignored"
            >
              忽略: {{ word }}
            </span>
            <span
              v-for="word in props.result.offset_words"
              :key="'o-' + word"
              class="identify-word-tag identify-word-offset"
            >
              偏移: {{ word }}
            </span>
          </div>
        </div>
        <!-- 详细信息表格 -->
        <div class="identify-details-table">
          <div v-if="props.result.title" class="identify-detail-row">
            <span class="identify-detail-label">TMDB标题</span>
            <span class="identify-detail-value">{{ props.result.title }}</span>
          </div>
          <div v-if="props.result.overview" class="identify-detail-row">
            <span class="identify-detail-label">简介</span>
            <span class="identify-detail-value text-sm">{{ props.result.overview }}</span>
          </div>
          <div v-if="props.result.vote_average" class="identify-detail-row">
            <span class="identify-detail-label">评分</span>
            <span class="identify-detail-value">{{ props.result.vote_average }}</span>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-8" style="color: hsl(var(--muted-foreground));">
        暂无识别结果
      </div>
    </NSpin>
  </NModal>
</template>

<style scoped>
.identify-result {
  padding: 0.5rem 0;
}

.identify-section {
  margin-bottom: 0.75rem;
}

.identify-section-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.25rem;
}

.identify-orig-name {
  font-size: 0.85rem;
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--muted) / 0.3);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  word-break: break-all;
  line-height: 1.5;
}

.identify-rev-name {
  font-size: 0.85rem;
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 0.1);
  border: 1px solid hsl(var(--warning) / 0.25);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  word-break: break-all;
  line-height: 1.5;
}

.identify-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0.75rem 0;
  padding: 0.75rem 0;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
}

.identify-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 0.25rem;
  font-weight: 500;
  white-space: nowrap;
}

.identify-tag-type {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.identify-tag-category {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}

.identify-tag-title {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.identify-tag-en {
  background-color: hsl(var(--warning) / 0.1);
  color: hsl(var(--warning));
}

.identify-tag-tmdb {
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.identify-tag-year {
  background-color: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

.identify-tag-season {
  background-color: hsl(var(--success) / 0.1);
  color: hsl(var(--success));
}

.identify-tag-pix {
  background-color: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.identify-tag-source {
  background-color: hsl(var(--success) / 0.15);
  color: hsl(var(--success));
}

.identify-tag-effect {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.identify-tag-video {
  background-color: hsl(var(--card-foreground) / 0.08);
  color: hsl(var(--card-foreground));
}

.identify-tag-audio {
  background-color: hsl(var(--card-foreground) / 0.08);
  color: hsl(var(--card-foreground));
}

.identify-tag-team {
  background-color: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

.identify-tag-part {
  background-color: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
}

.identify-tag-custom {
  background-color: hsl(var(--accent));
  color: hsl(var(--card-foreground));
}

.identify-words-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
}

.identify-words-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

.identify-word-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

.identify-word-replaced {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.identify-word-ignored {
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.identify-word-offset {
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.identify-details-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
}

.identify-detail-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.identify-detail-label {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  width: 4rem;
  flex-shrink: 0;
  padding-top: 0.125rem;
}

.identify-detail-value {
  font-size: 0.85rem;
  color: hsl(var(--card-foreground));
  flex: 1;
  word-break: break-word;
  line-height: 1.5;
}
</style>
