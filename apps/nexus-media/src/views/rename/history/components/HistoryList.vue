<script lang="ts" setup>
import type { HistoryItem } from '../types';

import { computed } from 'vue';

import { NCheckbox } from 'naive-ui';

import MediaPoster from '#/components/media/MediaPoster.vue';

import {
  contentProfileLabel,
  isCustomProfile,
  joinPath,
  modeLabel,
  statusText,
  statusTone,
  typeLabel,
} from '../types';

interface Props {
  items: HistoryItem[];
  selectedId: null | number;
  selectedIds: number[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [item: HistoryItem];
  toggleAll: [];
  toggleSelect: [id: number];
}>();

const allSelected = computed(
  () =>
    props.items.length > 0 &&
    props.items.every((item) => props.selectedIds.includes(item.ID)),
);
const indeterminate = computed(
  () => props.selectedIds.length > 0 && !allSelected.value,
);

function sourcePath(item: HistoryItem) {
  return joinPath(item.SOURCE_PATH, item.SOURCE_FILENAME);
}
</script>

<template>
  <aside class="history-list" aria-label="识别记录列表">
    <div class="list-head">
      <NCheckbox
        :checked="allSelected"
        :indeterminate="indeterminate"
        @update:checked="emit('toggleAll')"
      />
      <span>本页 {{ items.length }} 条</span>
    </div>

    <div v-if="items.length === 0" class="list-empty">没有匹配的识别记录</div>

    <div v-else class="list-scroll">
      <article
        v-for="item in items"
        :key="item.ID"
        class="record"
        :class="{ 'is-active': item.ID === selectedId }"
        tabindex="0"
        @click="emit('select', item)"
        @keydown.enter.prevent="emit('select', item)"
      >
        <NCheckbox
          class="record-check"
          :checked="selectedIds.includes(item.ID)"
          @click.stop
          @update:checked="emit('toggleSelect', item.ID)"
        />
        <div class="poster">
          <MediaPoster
            :src="item.image || item.POSTER"
            :content-profile="item.CONTENT_PROFILE"
            :alt="item.TITLE"
          />
        </div>
        <div class="record-main">
          <div class="record-title">
            {{ item.TITLE }}
            <span v-if="item.YEAR" class="record-year">({{ item.YEAR }})</span>
          </div>
          <div class="record-tags">
            <span class="tag">{{ typeLabel(item.TYPE) }}</span>
            <span
              v-if="isCustomProfile(item.CONTENT_PROFILE)"
              class="tag tag-profile"
              title="内容画像"
            >
              {{ contentProfileLabel(item.CONTENT_PROFILE) }}
            </span>
            <span v-if="item.SEASON_EPISODE" class="tag">
              {{ item.SEASON_EPISODE }}
            </span>
            <span
              v-if="
                item.SEEDS_SEASON &&
                item.SEEDS_EPISODE &&
                !item.SEASON_EPISODE.includes(`S${String(item.SEEDS_SEASON)}`)
              "
              class="tag"
              :title="`种子原始: S${item.SEEDS_SEASON}E${item.SEEDS_EPISODE}${item.SEEDS_END_EPISODE ? `-E${item.SEEDS_END_EPISODE}` : ''}`"
            >
              原始 S{{ item.SEEDS_SEASON }}E{{ item.SEEDS_EPISODE }}
            </span>
            <span class="tag">{{ modeLabel(item) }}</span>
          </div>
          <div class="record-path" :title="sourcePath(item)">
            {{ sourcePath(item) || '未记录源文件路径' }}
          </div>
          <div class="record-status" :class="`tone-${statusTone(item)}`">
            <span class="status-dot"></span>
            {{ statusText(item) }}
          </div>
        </div>
      </article>
    </div>
  </aside>
</template>

<style scoped>
.history-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  font-size: 0.73rem;
  color: hsl(var(--muted-foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.list-empty {
  padding: 36px 16px;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.list-scroll {
  max-height: calc(100vh - 330px);
  overflow-y: auto;
  scrollbar-width: thin;
}

.record {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 11px 12px;
  cursor: pointer;
  border-bottom: 1px solid hsl(var(--border) / 70%);
  transition: background 0.15s;
}

.record:last-child {
  border-bottom: 0;
}

.record:hover,
.record:focus-visible {
  outline: none;
  background: hsl(var(--muted) / 55%);
}

.record.is-active {
  background: hsl(var(--primary) / 7%);
}

.record.is-active::before {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 0 3px 3px 0;
}

.record-check {
  margin-top: 4px;
}

.poster {
  flex: none;
  width: 48px;
  height: 66px;
  overflow: hidden;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.poster :deep(img) {
  width: 100%;
  height: 100%;
}

.record-main {
  flex: 1;
  min-width: 0;
}

.record-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.35;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.record-year {
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.record-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.tag {
  padding: 1px 6px;
  font-size: 0.64rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 4px;
}

.tag-profile {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
}

.record-path {
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-mono, monospace);
  font-size: 0.66rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.record-status {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 7px;
  margin-top: 6px;
  font-size: 0.66rem;
  font-weight: 500;
  border-radius: 999px;
}

.status-dot {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 999px;
}

.tone-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.tone-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.tone-danger {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 9%);
}

.tone-warning {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

@media (max-width: 1024px) {
  .list-scroll {
    max-height: 420px;
  }
}

@media (max-width: 768px) {
  .list-scroll {
    min-height: 240px;
    max-height: calc(100dvh - 330px);
  }

  .record {
    gap: 8px;
    padding: 10px;
  }

  .poster {
    width: 44px;
    height: 60px;
  }

  .record-title {
    font-size: 0.82rem;
  }

  .tag {
    font-size: 0.62rem;
  }
}
</style>
