<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NModal, NSpin } from 'naive-ui';

import {
  getContentProfileImageUrl,
  getContentProfilePosterPosition,
} from '#/plugin-framework/loader';
import { getImgUrl } from '#/utils/image';

interface IdentifyMatch {
  provider: string;
  source_label: string;
  external_id: string;
  title: string;
  year: string;
  media_type: string;
  content_profile: string;
  poster: string;
  score: number;
  preferred: boolean;
}

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
  seeds_season?: null | number;
  seeds_episode?: null | number;
  seeds_end_episode?: null | number;
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
  source_label?: string;
  metadata_ref?: string;
  image?: string;
  matches?: IdentifyMatch[];
  preferred_source?: null | { provider: string; label: string; reason: string };
}

const props = defineProps<{
  loading?: boolean;
  result: IdentifyResultData;
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', match: IdentifyMatch): void;
  (e: 'update:show', value: boolean): void;
}>();

function handleClose() {
  emit('update:show', false);
}

const selectedKey = ref('');

function matchKey(match: IdentifyMatch): string {
  return `${match.provider}:${match.external_id}`;
}

function selectMatch(match: IdentifyMatch) {
  selectedKey.value = matchKey(match);
  emit('select', match);
}

const activeMatch = computed<IdentifyMatch | undefined>(() => {
  const matches = props.result.matches || [];
  return (
    matches.find((item) => matchKey(item) === selectedKey.value) ||
    matches.find((item) => item.preferred) ||
    matches[0]
  );
});

const bestMatch = activeMatch;

watch(
  () => props.result,
  () => {
    selectedKey.value = '';
  },
);

const bestPosterPosition = computed(() => {
  const profile = bestMatch.value?.content_profile;
  return getContentProfilePosterPosition(profile) || '50% 50%';
});

const bestPoster = computed(() => {
  const match = bestMatch.value;
  const poster = match?.poster || props.result.image || '';
  if (!poster) return '';
  return getImgUrl(getContentProfileImageUrl(match?.content_profile, poster));
});

function matchTypeLabel(match: IdentifyMatch): string {
  const type = (match.media_type || '').toLowerCase();
  if (type === 'anime') return '动漫';
  if (type === 'tv') return '剧集';
  return '电影';
}
</script>

<template>
  <NModal
    :show="props.show"
    title="识别结果"
    preset="card"
    style="width: 640px; max-width: 92vw"
    :bordered="false"
    segmented
    @update:show="handleClose"
  >
    <NSpin :show="props.loading">
      <div v-if="props.result.name === '无法识别'" class="text-center py-8">
        <IconifyIcon
          icon="lucide:alert-circle"
          class="size-12 mx-auto mb-3"
          style="color: hsl(var(--destructive))"
        />
        <div
          class="text-lg font-medium"
          style="color: hsl(var(--card-foreground))"
        >
          无法识别
        </div>
        <div class="text-sm mt-1" style="color: hsl(var(--muted-foreground))">
          {{
            props.result.matches?.length
              ? '本地名称解析未命中，以下为多数据源匹配结果'
              : '未能从文件名中识别出媒体信息'
          }}
        </div>
      </div>
      <div v-else-if="props.result.name" class="identify-result">
        <!-- 结果摘要 -->
        <div class="identify-hero">
          <div
            v-if="bestPoster"
            class="identify-hero-poster"
            :style="{
              backgroundImage: `url(${bestPoster})`,
              backgroundPosition: bestPosterPosition,
            }"
          ></div>
          <div v-else class="identify-hero-poster identify-hero-poster-empty">
            <IconifyIcon icon="lucide:file-search" />
          </div>
          <div class="identify-hero-body">
            <div class="identify-hero-title">
              {{
                props.result.cn_name || props.result.title || props.result.name
              }}
            </div>
            <div class="identify-hero-original">
              {{ props.result.org_string }}
            </div>
            <div v-if="bestMatch" class="identify-hero-meta">
              <span class="identify-hero-source">
                {{ bestMatch.source_label }}
              </span>
              <span>{{ matchTypeLabel(bestMatch) }}</span>
              <span v-if="bestMatch.year">{{ bestMatch.year }}</span>
              <span v-if="bestMatch.preferred" class="identify-hero-known">
                优先来源
              </span>
            </div>
          </div>
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
          <span
            v-if="props.result.source_label"
            class="identify-tag identify-tag-origin"
          >
            来源: {{ props.result.source_label }}
          </span>
          <span
            v-if="props.result.tmdbid"
            class="identify-tag identify-tag-tmdb"
          >
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
          <span
            v-if="
              props.result.seeds_season &&
              props.result.seeds_episode &&
              (props.result.seeds_season !==
                (props.result.season
                  ? Number(props.result.season.replace('S', ''))
                  : null) ||
                props.result.seeds_episode !==
                  (props.result.episode
                    ? Number(props.result.episode.replace('E', ''))
                    : null))
            "
            class="identify-tag identify-tag-seeds"
          >
            S{{ props.result.seeds_season }}E{{ props.result.seeds_episode
            }}<template v-if="props.result.seeds_end_episode">
              -E{{ props.result.seeds_end_episode }}</template
            >
          </span>
          <span
            v-if="props.result.resource_pix"
            class="identify-tag identify-tag-pix"
          >
            {{ props.result.resource_pix }}
          </span>
          <span
            v-if="props.result.resource_type"
            class="identify-tag identify-tag-source"
          >
            {{ props.result.resource_type }}
          </span>
          <span
            v-if="props.result.resource_effect"
            class="identify-tag identify-tag-effect"
          >
            {{ props.result.resource_effect }}
          </span>
          <span
            v-if="props.result.video_encode"
            class="identify-tag identify-tag-video"
          >
            {{ props.result.video_encode }}
          </span>
          <span
            v-if="props.result.audio_encode"
            class="identify-tag identify-tag-audio"
          >
            {{ props.result.audio_encode }}
          </span>
          <span
            v-if="props.result.resource_team"
            class="identify-tag identify-tag-team"
          >
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
              props.result.replaced_words.length > 0) ||
            (props.result.ignored_words &&
              props.result.ignored_words.length > 0) ||
            (props.result.offset_words && props.result.offset_words.length > 0)
          "
          class="identify-words-section"
        >
          <div class="identify-section-label">识别词应用</div>
          <div class="identify-words-list">
            <span
              v-for="word in props.result.replaced_words"
              :key="`r-${word}`"
              class="identify-word-tag identify-word-replaced"
            >
              替换: {{ word }}
            </span>
            <span
              v-for="word in props.result.ignored_words"
              :key="`i-${word}`"
              class="identify-word-tag identify-word-ignored"
            >
              忽略: {{ word }}
            </span>
            <span
              v-for="word in props.result.offset_words"
              :key="`o-${word}`"
              class="identify-word-tag identify-word-offset"
            >
              偏移: {{ word }}
            </span>
          </div>
        </div>
        <!-- 详细信息表格 -->
        <div class="identify-details-table">
          <div v-if="props.result.title" class="identify-detail-row">
            <span class="identify-detail-label">标题</span>
            <span class="identify-detail-value">{{ props.result.title }}</span>
          </div>
          <div v-if="props.result.overview" class="identify-detail-row">
            <span class="identify-detail-label">简介</span>
            <span class="identify-detail-value text-sm">{{
              props.result.overview
            }}</span>
          </div>
          <div v-if="props.result.vote_average" class="identify-detail-row">
            <span class="identify-detail-label">评分</span>
            <span class="identify-detail-value">{{
              props.result.vote_average
            }}</span>
          </div>
        </div>
      </div>
      <div
        v-else
        class="text-center py-8"
        style="color: hsl(var(--muted-foreground))"
      >
        暂无识别结果
      </div>
      <!-- 多数据源匹配 -->
      <div v-if="props.result.matches?.length" class="identify-section">
        <div class="identify-section-label">
          多数据源匹配
          <span class="identify-select-hint">点击卡片切换数据源</span>
          <span
            v-if="props.result.preferred_source"
            class="identify-preferred-hint"
          >
            优先来源：{{ props.result.preferred_source.label }} ·
            {{ props.result.preferred_source.reason }}
          </span>
        </div>
        <div class="identify-matches">
          <button
            v-for="match in props.result.matches"
            :key="matchKey(match)"
            type="button"
            class="identify-match"
            :class="{
              'identify-match-preferred': match.preferred,
              'identify-match-selected':
                activeMatch && matchKey(match) === matchKey(activeMatch),
            }"
            :aria-pressed="
              activeMatch && matchKey(match) === matchKey(activeMatch)
            "
            @click="selectMatch(match)"
          >
            <span class="identify-match-provider">
              {{ match.source_label }}
            </span>
            <span class="identify-match-title" :title="match.title">
              {{ match.title }}
            </span>
            <span v-if="match.year" class="identify-match-meta">
              {{ match.year }}
            </span>
            <span class="identify-match-meta">
              {{ matchTypeLabel(match) }}
            </span>
            <span v-if="match.preferred" class="identify-match-known">
              优先来源
            </span>
            <span
              v-if="activeMatch && matchKey(match) === matchKey(activeMatch)"
              class="identify-match-selected-label"
            >
              已选择
            </span>
          </button>
        </div>
      </div>
    </NSpin>
  </NModal>
</template>

<style scoped>
.identify-result {
  padding: 0.5rem 0;
}

.identify-hero {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem;
  margin-bottom: 1rem;
  background: hsl(var(--muted) / 25%);
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
}

.identify-hero-poster {
  flex-shrink: 0;
  width: 5.5rem;
  height: 7.5rem;
  background-color: hsl(var(--muted));
  background-position: 50% 50%;
  background-size: cover;
  border-radius: 0.5rem;
  box-shadow: 0 6px 18px hsl(var(--foreground) / 10%);
}

.identify-hero-poster-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
}

.identify-hero-poster-empty svg {
  width: 2rem;
  height: 2rem;
}

.identify-hero-body {
  min-width: 0;
}

.identify-hero-title {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
  overflow-wrap: break-word;
}

.identify-hero-original {
  margin-top: 0.35rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
}

.identify-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin-top: 0.6rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.identify-hero-source {
  padding: 0.1rem 0.45rem;
  font-weight: 500;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-radius: 0.25rem;
}

.identify-hero-known {
  padding: 0.1rem 0.4rem;
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
  border-radius: 0.25rem;
}

.identify-section {
  margin-bottom: 0.75rem;
}

.identify-section-label {
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.identify-orig-name {
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: hsl(var(--card-foreground));
  word-break: break-all;
  background-color: hsl(var(--muted) / 30%);
  border-radius: 0.375rem;
}

.identify-rev-name {
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: hsl(var(--warning));
  word-break: break-all;
  background-color: hsl(var(--warning) / 10%);
  border: 1px solid hsl(var(--warning) / 25%);
  border-radius: 0.375rem;
}

.identify-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding: 0.75rem 0;
  margin: 0.75rem 0;
  border-top: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
}

.identify-tag {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 0.25rem;
}

.identify-tag-type {
  color: hsl(var(--primary-foreground));
  background-color: hsl(var(--primary));
}

.identify-tag-category {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 15%);
}

.identify-tag-title {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 15%);
}

.identify-tag-en {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 10%);
}

.identify-tag-origin {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 12%);
}

.identify-tag-tmdb {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
}

.identify-tag-year {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 10%);
}

.identify-tag-season {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 10%);
}

.identify-tag-seeds {
  font-style: italic;
  color: hsl(var(--muted-foreground));
  cursor: help;
  background-color: hsl(var(--muted));
}

.identify-tag-pix {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 12%);
}

.identify-tag-source {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 15%);
}

.identify-tag-effect {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 15%);
}

.identify-tag-video {
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--card-foreground) / 8%);
}

.identify-tag-audio {
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--card-foreground) / 8%);
}

.identify-tag-team {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 10%);
}

.identify-tag-part {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 8%);
}

.identify-tag-custom {
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--accent));
}

.identify-preferred-hint {
  margin-left: 0.5rem;
  font-weight: 400;
  color: hsl(var(--primary));
}

.identify-matches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.5rem;
}

.identify-match {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  width: 100%;
  padding: 0.6rem 0.7rem;
  font-size: 0.8rem;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.identify-match:hover {
  background: hsl(var(--accent) / 45%);
  border-color: hsl(var(--primary) / 25%);
}

.identify-match-preferred {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 35%);
}

.identify-match-selected {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 18%);
}

.identify-select-hint {
  margin-left: 0.5rem;
  font-size: 0.72rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.identify-match-selected-label {
  padding: 0.1rem 0.35rem;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-radius: 0.25rem;
}

.identify-match-provider {
  padding: 0.1rem 0.4rem;
  font-weight: 500;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-radius: 0.25rem;
}

.identify-match-title {
  flex: 1;
  min-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.identify-match-meta {
  color: hsl(var(--muted-foreground));
}

.identify-match-known {
  padding: 0.1rem 0.35rem;
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
  border-radius: 0.25rem;
}

.identify-words-section {
  padding-top: 0.75rem;
  margin-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
}

.identify-words-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.25rem;
}

.identify-word-tag {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.25rem;
}

.identify-word-replaced {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 15%);
}

.identify-word-ignored {
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted));
}

.identify-word-offset {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
}

.identify-details-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.75rem;
  margin-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
}

.identify-detail-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.identify-detail-label {
  flex-shrink: 0;
  width: 4rem;
  padding-top: 0.125rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.identify-detail-value {
  flex: 1;
  font-size: 0.85rem;
  line-height: 1.5;
  color: hsl(var(--card-foreground));
  overflow-wrap: break-word;
}
</style>
