<script lang="ts" setup>
import type {
  CustomRssFeedItem,
  CustomRssTestResult,
} from '#/api/modules/subscription';

import { IconifyIcon } from '@vben/icons';

import {
  NAlert,
  NButton,
  NEmpty,
  NModal,
  NScrollbar,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from 'naive-ui';

const props = defineProps<{
  show: boolean;
  loading: boolean;
  result: CustomRssTestResult | null;
  sourceName: string;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();
const message = useMessage();

function formatSize(size: number) {
  if (!size) return '大小未知';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit > 1 ? 2 : 0)} ${units[unit]}`;
}

function formatDate(value: number | string) {
  if (!value) return '时间未知';
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString();
}

async function copyLink(item: CustomRssFeedItem) {
  if (!item.enclosure) return;
  await navigator.clipboard.writeText(item.enclosure);
  message.success('下载地址已复制');
}
</script>

<template>
  <NModal
    :show="show"
    title="RSS 报文预览"
    preset="card"
    :style="{ width: '820px', maxWidth: 'calc(100vw - 32px)' }"
    @update:show="emit('update:show', $event)"
  >
    <NSpin :show="loading">
      <template v-if="result">
        <div class="preview-heading">
          <div>
            <div class="source-name">{{ sourceName }}</div>
            <div class="source-meta">
              {{ result.feed_type }} · {{ result.elapsed_ms }} ms
            </div>
          </div>
          <NSpace>
            <NTag type="info" :bordered="false">
              {{ result.item_count }} 条报文
            </NTag>
            <NTag type="success" :bordered="false">
              {{ result.download_count }} 条可下载
            </NTag>
          </NSpace>
        </div>

        <NAlert
          v-if="result.missing_download_count > 0"
          type="warning"
          :bordered="false"
          class="my-4"
        >
          {{ result.missing_download_count }}
          条报文没有下载地址，订阅轮询时会跳过。
        </NAlert>

        <NEmpty v-if="result.items.length === 0" description="RSS 中没有报文" />
        <NScrollbar v-else class="feed-list">
          <article
            v-for="(item, index) in result.items"
            :key="item.guid || item.enclosure || index"
            class="feed-item"
          >
            <div class="feed-title">{{ item.title }}</div>
            <div class="feed-meta">
              <span>{{ formatDate(item.pubdate) }}</span>
              <span>{{ formatSize(item.size) }}</span>
              <NTag
                size="small"
                :type="item.enclosure ? 'success' : 'warning'"
                :bordered="false"
              >
                {{ item.enclosure ? '含下载地址' : '仅详情链接' }}
              </NTag>
            </div>
            <div class="feed-actions">
              <NButton
                v-if="item.enclosure"
                size="tiny"
                secondary
                @click="copyLink(item)"
              >
                <template #icon><IconifyIcon icon="lucide:copy" /></template>
                复制下载地址
              </NButton>
              <NButton
                v-if="item.link"
                size="tiny"
                text
                tag="a"
                :href="item.link"
                target="_blank"
                rel="noopener noreferrer"
              >
                查看详情
                <IconifyIcon icon="lucide:external-link" class="ml-1" />
              </NButton>
            </div>
          </article>
        </NScrollbar>
      </template>
      <NEmpty v-else-if="!loading" description="暂无预览数据" />
    </NSpin>
    <template #footer>
      <div class="flex justify-end">
        <NButton @click="emit('update:show', false)">关闭</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.preview-heading {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.source-name {
  font-size: 16px;
  font-weight: 600;
}

.source-meta,
.feed-meta {
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.feed-list {
  max-height: 55vh;
}

.feed-item {
  padding: 14px 0;
  border-bottom: 1px solid hsl(var(--border));
}

.feed-item:last-child {
  border-bottom: 0;
}

.feed-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.feed-meta,
.feed-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.feed-actions {
  margin-top: 8px;
}

@media (max-width: 640px) {
  .preview-heading {
    flex-direction: column;
  }
}
</style>
