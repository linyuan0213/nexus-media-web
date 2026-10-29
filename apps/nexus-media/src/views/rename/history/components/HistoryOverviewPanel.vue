<script lang="ts" setup>
import type { HistoryItem } from '../types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  fileStateMeta,
  formatDate,
  joinPath,
  modeLabel,
  typeLabel,
} from '../types';

interface Props {
  item: HistoryItem;
}

const props = defineProps<Props>();

const sourceState = computed(() => fileStateMeta(props.item.SOURCE_STATE));
const destState = computed(() => fileStateMeta(props.item.DEST_STATE));
const sourcePath = computed(() =>
  joinPath(props.item.SOURCE_PATH, props.item.SOURCE_FILENAME),
);
const destPath = computed(() =>
  joinPath(props.item.DEST_PATH, props.item.DEST_FILENAME),
);
const provider = computed(
  () => props.item.ANCHOR_PROVIDER || props.item.SOURCE || '自动识别',
);
</script>

<template>
  <div class="overview">
    <h2 class="section-title">生命周期</h2>
    <div class="timeline">
      <div class="tl-item is-current">
        <span class="tl-dot"></span>
        <div class="tl-title">
          已识别
          <span class="tl-time">{{ formatDate(item.DATE) }}</span>
        </div>
        <div class="tl-desc">
          {{ provider }} · {{ item.TITLE || item.SOURCE_FILENAME }}
          <template v-if="item.TMDBID">· TMDB ID {{ item.TMDBID }}</template>
        </div>
      </div>

      <div class="tl-item is-current">
        <span class="tl-dot"></span>
        <div class="tl-title">
          已转移
          <span class="tl-time">{{ formatDate(item.DATE) }}</span>
        </div>
        <div class="tl-desc">
          {{ modeLabel(item) }}
          <template v-if="destPath">
            → <code>{{ destPath }}</code>
          </template>
          <template v-else>· 未记录媒体库目标</template>
        </div>
      </div>

      <div
        class="tl-item"
        :class="{ 'is-muted': sourceState.tone !== 'success' }"
      >
        <span class="tl-dot"></span>
        <div class="tl-title">
          源文件
          <span class="tl-time">{{ sourceState.label }}</span>
        </div>
        <div class="tl-desc">
          <code>{{ sourcePath || '未记录源文件路径' }}</code>
        </div>
      </div>

      <div
        class="tl-item"
        :class="{ 'is-muted': destState.tone !== 'success' }"
      >
        <span class="tl-dot"></span>
        <div class="tl-title">
          媒体库文件
          <span class="tl-time">{{ destState.label }}</span>
        </div>
        <div class="tl-desc">
          <code>{{ destPath || '未记录媒体库文件路径' }}</code>
        </div>
      </div>
    </div>

    <h2 class="section-title">识别信息</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">媒体类型</div>
        <div class="info-value">{{ typeLabel(item.TYPE) }}</div>
      </div>
      <div class="info-item">
        <div class="info-label">转移方式</div>
        <div class="info-value">{{ modeLabel(item) }}</div>
      </div>
      <div class="info-item">
        <div class="info-label">媒体库后端</div>
        <div class="info-value">{{ item.DST_BACKEND || 'local' }}</div>
      </div>
      <div class="info-item">
        <div class="info-label">记录 ID</div>
        <div class="info-value mono">#{{ item.ID }}</div>
      </div>
      <div v-if="item.SEASON_EPISODE" class="info-item">
        <div class="info-label">季集</div>
        <div class="info-value">{{ item.SEASON_EPISODE }}</div>
      </div>
      <div class="info-item">
        <div class="info-label">TMDB ID</div>
        <div class="info-value mono">{{ item.TMDBID || '-' }}</div>
      </div>
    </div>

    <div class="hint">
      <IconifyIcon icon="lucide:info" class="size-4" />
      <span>
        文件状态来自最近一次检测或删除操作。需要确认时可在「文件」中重新检测。
      </span>
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

.overview > .section-title:not(:first-child) {
  margin-top: 20px;
}

.timeline {
  position: relative;
  padding-left: 27px;
  margin: 4px 0 2px;
}

.timeline::before {
  position: absolute;
  top: 5px;
  bottom: 8px;
  left: 7px;
  content: '';
  border-left: 1.5px dashed hsl(var(--border));
}

.tl-item {
  position: relative;
  padding-bottom: 16px;
}

.tl-item:last-child {
  padding-bottom: 0;
}

.tl-dot {
  position: absolute;
  top: 2px;
  left: -27px;
  width: 15px;
  height: 15px;
  background: hsl(var(--success));
  border: 3px solid hsl(var(--card));
  border-radius: 50%;
  box-shadow: 0 0 0 1px hsl(var(--success) / 35%);
}

.tl-item.is-current .tl-dot {
  box-shadow:
    0 0 0 1px hsl(var(--success) / 45%),
    0 0 0 4px hsl(var(--success) / 12%);
}

.tl-item.is-muted .tl-dot {
  background: hsl(var(--muted-foreground) / 55%);
  box-shadow: 0 0 0 1px hsl(var(--border));
}

.tl-title {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  font-size: 0.82rem;
  font-weight: 600;
}

.tl-time {
  font-size: 0.68rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.tl-desc {
  margin-top: 3px;
  font-size: 0.73rem;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.tl-desc code {
  padding: 1px 4px;
  font-family: var(--font-mono, monospace);
  font-size: 0.69rem;
  background: hsl(var(--muted));
  border-radius: 4px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  background: hsl(var(--border));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.info-item {
  padding: 10px 12px;
  background: hsl(var(--card));
}

/* 奇数项时让最后一项铺满整行，避免出现灰色空格 */
.info-item:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.info-label {
  margin-bottom: 4px;
  font-size: 0.67rem;
  color: hsl(var(--muted-foreground));
}

.info-value {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.77rem;
  font-weight: 500;
  white-space: nowrap;
}

.info-value.mono {
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  font-weight: 400;
}

.hint {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  padding: 9px 11px;
  margin-top: 16px;
  font-size: 0.71rem;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
}

@media (max-width: 640px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
