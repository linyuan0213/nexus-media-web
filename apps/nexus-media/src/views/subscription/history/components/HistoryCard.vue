<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton, NButtonGroup, NTooltip } from 'naive-ui';

import { getImgUrl, handleImageError } from '#/utils/image';

interface HistoryItem {
  id: number | string;
  title: string;
  year: string;
  season: string;
  tmdbid: string;
  image: string;
  total: number;
  start: number;
  desc: string;
  finishTime: string;
  type: 'movie' | 'tv';
}

interface Props {
  item: HistoryItem;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  delete: [item: HistoryItem];
  reRss: [item: HistoryItem];
}>();

function getTmdbUrl() {
  const type = props.item.type === 'tv' ? 'tv' : 'movie';
  return `https://www.themoviedb.org/${type}/${props.item.tmdbid}`;
}
</script>

<template>
  <div class="history-card tbl-card tbl-card-hover">
    <div class="history-card-inner">
      <div class="history-card-poster">
        <a
          :href="getTmdbUrl()"
          target="_blank"
          rel="noopener noreferrer"
          class="history-card-link"
        >
          <img
            :src="getImgUrl(item.image)"
            class="history-card-img"
            :alt="item.title"
            @error="handleImageError"
          />
        </a>
      </div>

      <div class="history-card-info">
        <div class="history-card-title" :title="item.title">
          {{ item.title }}
        </div>
        <div class="history-card-meta">
          <span v-if="item.year" class="meta-item">{{ item.year }}</span>
          <span v-if="item.season" class="meta-item">{{ item.season }}</span>
          <span class="meta-item finish-time">
            <IconifyIcon icon="lucide:check-circle" class="h-3 w-3" />
            {{ item.finishTime }}
          </span>
        </div>
        <div v-if="item.total > 0" class="history-card-episodes">
          共 {{ item.total - item.start }} 集
        </div>
        <div class="history-card-desc" :title="item.desc">
          {{ item.desc }}
        </div>
      </div>

      <div class="history-card-actions">
        <NButtonGroup>
          <NTooltip>
            <template #trigger>
              <NButton
                size="small"
                ghost
                type="primary"
                @click="emit('reRss', item)"
              >
                <IconifyIcon icon="lucide:bookmark-plus" class="h-4 w-4" />
              </NButton>
            </template>
            重新订阅
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <NButton
                size="small"
                ghost
                type="error"
                @click="emit('delete', item)"
              >
                <IconifyIcon icon="lucide:trash-2" class="h-4 w-4" />
              </NButton>
            </template>
            删除
          </NTooltip>
        </NButtonGroup>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-card {
  border-radius: calc(var(--radius) - 2px);
  transition: all 0.2s ease;
}

.history-card-inner {
  display: flex;
  gap: 1rem;
  align-items: stretch;
  padding: 0.75rem;
}

.history-card-poster {
  flex-shrink: 0;
}

.history-card-link {
  display: block;
  text-decoration: none;
}

.history-card-img {
  width: 80px;
  height: 100px;
  object-fit: cover;
  border-radius: calc(var(--radius) - 4px);
  transition: opacity 0.2s ease;
}

.history-card-link:hover .history-card-img {
  opacity: 0.85;
}

.history-card-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.25rem;
  justify-content: center;
  min-width: 0;
}

.history-card-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 1;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.35;
  color: hsl(var(--card-foreground));
  -webkit-box-orient: vertical;
}

.history-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.meta-item {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background-color: hsl(var(--accent));
  border-radius: 9999px;
}

.finish-time {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 10%);
}

.history-card-episodes {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.history-card-desc {
  display: -webkit-box;
  margin-top: 0.25rem;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 0.8rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.history-card-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.history-card-actions :deep(.n-button) {
  --n-height: 28px !important;
  --n-font-size: 12px !important;

  padding: 0 0.5rem !important;
}

@media (max-width: 640px) {
  .history-card-inner {
    gap: 0.75rem;
    padding: 0.625rem;
  }

  .history-card-img {
    width: 64px;
    height: 80px;
  }

  .history-card-actions {
    align-items: flex-start;
    padding-top: 0.25rem;
  }
}
</style>
