<script lang="ts" setup>
import type { HistoryItem } from '../types';

import { computed } from 'vue';

import { formatDate, modeLabel, typeLabel } from '../types';

interface Props {
  item: HistoryItem;
}

const props = defineProps<Props>();

const rows = computed(() => [
  { label: '标题', value: props.item.TITLE || '-' },
  { label: '年份', value: props.item.YEAR || '-' },
  { label: '媒体类型', value: typeLabel(props.item.TYPE) },
  { label: '季集', value: props.item.SEASON_EPISODE || '-' },
  { label: 'TMDB ID', value: props.item.TMDBID || '-', mono: true },
  {
    label: '识别来源',
    value: props.item.ANCHOR_PROVIDER || props.item.SOURCE || '自动识别',
  },
  { label: '锚点 ID', value: props.item.ANCHOR_EXTERNAL_ID || '-', mono: true },
  { label: 'Identity ID', value: props.item.IDENTITY_ID || '-', mono: true },
  { label: '内容画像', value: props.item.CONTENT_PROFILE || '-' },
  { label: '转移方式', value: modeLabel(props.item) },
  { label: '源后端', value: props.item.SOURCE || 'local' },
  { label: '媒体库后端', value: props.item.DST_BACKEND || 'local' },
  { label: '记录时间', value: formatDate(props.item.DATE) },
  { label: '记录 ID', value: `#${props.item.ID}`, mono: true },
]);
</script>

<template>
  <div>
    <h2 class="section-title">媒体元数据</h2>
    <div class="kv">
      <div v-for="row in rows" :key="row.label" class="kv-row">
        <span>{{ row.label }}</span>
        <span :class="{ mono: row.mono }">{{ row.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 12px;
  font-size: 0.74rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.02em;
}

.kv {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.kv-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 12px;
  padding: 9px 12px;
  font-size: 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
}

.kv-row:last-child {
  border-bottom: 0;
}

.kv-row > :first-child {
  color: hsl(var(--muted-foreground));
}

.kv-row > :last-child {
  overflow-wrap: anywhere;
}

.mono {
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
}

@media (max-width: 640px) {
  .kv-row {
    grid-template-columns: 100px minmax(0, 1fr);
  }
}
</style>
