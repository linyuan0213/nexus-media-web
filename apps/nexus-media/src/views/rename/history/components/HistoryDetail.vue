<script lang="ts" setup>
import type { FileTarget, HistoryItem } from '../types';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSpin } from 'naive-ui';

import MediaPoster from '#/components/media/MediaPoster.vue';

import {
  capabilitiesOf,
  contentProfileLabel,
  formatDate,
  isCustomProfile,
  joinPath,
  modeLabel,
  statusText,
  statusTone,
  typeLabel,
} from '../types';
import HistoryEventsPanel from './HistoryEventsPanel.vue';
import HistoryFileCard from './HistoryFileCard.vue';
import HistoryMetadataPanel from './HistoryMetadataPanel.vue';
import HistoryOverviewPanel from './HistoryOverviewPanel.vue';

interface Props {
  busy?: boolean;
  item: HistoryItem | null;
  loading?: boolean;
  mobile?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  busy: false,
  loading: false,
  mobile: false,
});
const emit = defineEmits<{
  checkFiles: [];
  close: [];
  deleteFile: [target: FileTarget];
  deleteRecord: [];
  manual: [];
  reidentify: [];
}>();

type TabKey = 'events' | 'files' | 'metadata' | 'overview';

const activeTab = ref<TabKey>('overview');
const capabilities = computed(() =>
  props.item ? capabilitiesOf(props.item) : null,
);

watch(
  () => props.item?.ID,
  () => {
    activeTab.value = 'overview';
  },
);

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'files', label: '文件' },
  { key: 'metadata', label: '元数据' },
  { key: 'events', label: '事件' },
];

const sourcePath = computed(() =>
  props.item
    ? joinPath(props.item.SOURCE_PATH, props.item.SOURCE_FILENAME)
    : '',
);
</script>

<template>
  <section class="history-detail" aria-label="识别记录详情">
    <div v-if="loading" class="detail-loading">
      <NSpin size="small" />
    </div>

    <div v-else-if="!item" class="detail-empty">
      <IconifyIcon icon="lucide:mouse-pointer-click" class="size-8" />
      <p>从左侧选择一条识别记录查看详情</p>
    </div>

    <template v-else>
      <div v-if="mobile" class="mobile-detail-bar">
        <NButton quaternary size="small" @click="emit('close')">
          <template #icon>
            <IconifyIcon icon="lucide:arrow-left" class="size-4" />
          </template>
          返回列表
        </NButton>
        <span class="mobile-detail-title">识别详情</span>
        <span class="mobile-detail-spacer"></span>
      </div>

      <header class="detail-head">
        <div class="detail-poster">
          <MediaPoster
            :src="item.image || item.POSTER"
            :content-profile="item.CONTENT_PROFILE"
            :alt="item.TITLE"
          />
        </div>

        <div class="detail-main">
          <div class="detail-title">
            {{ item.TITLE || item.SOURCE_FILENAME }}
            <span v-if="item.YEAR" class="detail-year">({{ item.YEAR }})</span>
            <span class="status-pill" :class="`tone-${statusTone(item)}`">
              <span class="status-dot"></span>
              {{ statusText(item) }}
            </span>
          </div>

          <div class="detail-meta">
            <span class="meta-pill primary">{{ typeLabel(item.TYPE) }}</span>
            <span
              v-if="isCustomProfile(item.CONTENT_PROFILE)"
              class="meta-pill profile"
              title="由插件注入的内容画像"
            >
              {{ contentProfileLabel(item.CONTENT_PROFILE) }}
            </span>
            <span v-if="item.SEASON_EPISODE" class="meta-pill">
              {{ item.SEASON_EPISODE }}
            </span>
            <span class="meta-pill">{{ modeLabel(item) }}</span>
            <span class="meta-time">{{ formatDate(item.DATE) }}</span>
          </div>

          <div class="detail-actions">
            <NButton
              type="primary"
              size="small"
              :disabled="!capabilities?.reidentify || busy"
              :loading="busy"
              @click="emit('reidentify')"
            >
              <template #icon>
                <IconifyIcon icon="lucide:activity" class="size-3.5" />
              </template>
              重新识别
            </NButton>
            <NButton
              size="small"
              :disabled="!capabilities?.manual_identify || busy"
              @click="emit('manual')"
            >
              <template #icon>
                <IconifyIcon icon="lucide:pencil" class="size-3.5" />
              </template>
              手动识别
            </NButton>
            <NButton
              size="small"
              quaternary
              type="error"
              :disabled="!capabilities?.delete_record || busy"
              @click="emit('deleteRecord')"
            >
              <template #icon>
                <IconifyIcon icon="lucide:eraser" class="size-3.5" />
              </template>
              移除此记录
            </NButton>
          </div>
        </div>
      </header>

      <nav class="detail-tabs" role="tablist" aria-label="详情分区">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="detail-body">
        <HistoryOverviewPanel v-if="activeTab === 'overview'" :item="item" />

        <div v-else-if="activeTab === 'files'">
          <div class="notice">
            <IconifyIcon icon="lucide:info" class="size-4" />
            <span>
              文件操作与记录操作已分离。删除文件不会删除识别记录；删除记录也不会删除任何文件。
            </span>
          </div>

          <HistoryFileCard
            :item="item"
            target="source"
            @delete="emit('deleteFile', 'source')"
          />
          <HistoryFileCard
            :item="item"
            target="library"
            @delete="emit('deleteFile', 'library')"
          />

          <div class="files-foot">
            <span class="files-hint">
              最近检测：{{
                item.SOURCE_DELETED_AT || item.DEST_DELETED_AT || '尚未检测'
              }}
            </span>
            <NButton size="tiny" :loading="busy" @click="emit('checkFiles')">
              <template #icon>
                <IconifyIcon icon="lucide:refresh-cw" class="size-3.5" />
              </template>
              检测文件状态
            </NButton>
          </div>

          <div class="record-ops">
            <span>
              记录级操作请使用顶部「重新识别 / 手动识别 / 移除此记录」。
            </span>
            <span class="path-hint" :title="sourcePath">{{ sourcePath }}</span>
          </div>
        </div>

        <HistoryMetadataPanel
          v-else-if="activeTab === 'metadata'"
          :item="item"
        />
        <HistoryEventsPanel v-else :item="item" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.history-detail {
  min-height: 560px;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
}

.detail-loading,
.detail-empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  padding: 24px;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.detail-empty p {
  margin: 0;
}

.detail-head {
  display: flex;
  gap: 15px;
  align-items: flex-start;
  padding: 18px 20px 15px;
}

.detail-poster {
  flex: none;
  width: 74px;
  height: 102px;
  overflow: hidden;
  background: hsl(var(--muted));
  border-radius: 9px;
  box-shadow: 0 6px 18px hsl(var(--foreground) / 10%);
}

.detail-poster :deep(img) {
  width: 100%;
  height: 100%;
}

.detail-main {
  flex: 1;
  min-width: 0;
}

.detail-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 1.16rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.detail-year {
  font-size: 0.92rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.status-pill {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.67rem;
  font-weight: 500;
  border-radius: 999px;
}

.status-dot {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 999px;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
  font-size: 0.74rem;
  color: hsl(var(--muted-foreground));
}

.meta-pill {
  padding: 2px 8px;
  background: hsl(var(--muted));
  border-radius: 999px;
}

.meta-pill.primary,
.meta-pill.profile {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
}

.meta-time {
  margin-left: 2px;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  margin-top: 12px;
}

.detail-tabs {
  display: flex;
  gap: 2px;
  padding: 0 20px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid hsl(var(--border));
}

.detail-tabs::-webkit-scrollbar {
  display: none;
}

.detail-tabs button {
  position: relative;
  flex: none;
  padding: 10px 12px 11px;
  font-size: 0.78rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
}

.detail-tabs button:hover {
  color: hsl(var(--foreground));
}

.detail-tabs button.is-active {
  font-weight: 600;
  color: hsl(var(--primary));
}

.detail-tabs button.is-active::after {
  position: absolute;
  right: 8px;
  bottom: -1px;
  left: 8px;
  height: 2px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 2px 2px 0 0;
}

.detail-body {
  padding: 19px 20px 22px;
}

.notice {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 9px 11px;
  margin-bottom: 14px;
  font-size: 0.72rem;
  line-height: 1.55;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 7%);
  border: 1px solid hsl(var(--primary) / 18%);
  border-radius: 7px;
}

.files-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
}

.files-hint {
  font-size: 0.69rem;
  color: hsl(var(--muted-foreground));
}

.record-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  margin-top: 16px;
  font-size: 0.71rem;
  color: hsl(var(--muted-foreground));
  border-top: 1px solid hsl(var(--border));
}

.path-hint {
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-mono, monospace);
  font-size: 0.67rem;
  white-space: nowrap;
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

.mobile-detail-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: hsl(var(--card) / 96%);
  border-bottom: 1px solid hsl(var(--border));
  backdrop-filter: blur(8px);
}

.mobile-detail-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.mobile-detail-spacer {
  width: 76px;
}

@media (max-width: 768px) {
  .history-detail {
    min-height: auto;
    border-radius: 0;
    box-shadow: none;
  }

  .detail-head {
    gap: 12px;
    padding: 14px 14px 12px;
  }

  .detail-poster {
    width: 56px;
    height: 78px;
  }

  .detail-title {
    font-size: 1rem;
  }

  .detail-tabs,
  .detail-body {
    padding-right: 14px;
    padding-left: 14px;
  }

  .detail-actions :deep(.n-button) {
    flex: 1 1 auto;
  }

  .path-hint {
    max-width: 100%;
  }
}
</style>
