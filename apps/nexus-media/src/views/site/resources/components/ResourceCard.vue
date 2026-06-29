<script lang="ts" setup>
import type { ResourceItem } from '../types';

import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NTooltip } from 'naive-ui';

import { useResourceHelpers } from '../composables/useResourceHelpers';

interface Props {
  item: ResourceItem;
}

defineProps<Props>();

const emit = defineEmits<{
  download: [item: ResourceItem];
  openUrl: [url: string];
}>();

const { formatDate, formatSize, getFreeTag, getLabelClass, parseLabels } =
  useResourceHelpers();
</script>

<template>
  <NCard size="small" class="resource-card">
    <div class="resource-card-inner">
      <!-- 左侧海报占位 -->
      <div
        class="resource-poster"
        :style="{
          background: 'hsl(var(--muted) / 60%)',
          color: 'hsl(var(--muted-foreground))',
        }"
      >
        <IconifyIcon icon="lucide:film" class="h-8 w-8 opacity-50" />
        <div
          v-if="getFreeTag(item)"
          class="resource-poster-badge"
          :style="{
            background: `hsl(var(--${getFreeTag(item)!.type}))`,
            color: `hsl(var(--${getFreeTag(item)!.type}-foreground, var(--primary-foreground)))`,
          }"
        >
          {{ getFreeTag(item)!.label }}
        </div>
      </div>

      <div class="resource-body">
        <!-- 标题 -->
        <div class="resource-title-row">
          <NTooltip :show-arrow="false">
            <template #trigger>
              <div
                class="resource-title"
                :style="{ color: 'hsl(var(--card-foreground))' }"
              >
                {{ item.title }}
              </div>
            </template>
            {{ item.title }}
          </NTooltip>
        </div>

        <!-- 标签 -->
        <div v-if="parseLabels(item.labels).length > 0" class="resource-badges">
          <span
            v-for="label in parseLabels(item.labels)"
            :key="label"
            class="resource-tag"
            :class="getLabelClass(label)"
            >{{ label }}</span
          >
        </div>

        <!-- 描述 -->
        <div
          v-if="item.description"
          class="resource-description"
          :style="{
            background: 'hsl(var(--accent) / 40%)',
            color: 'hsl(var(--muted-foreground))',
          }"
        >
          <IconifyIcon icon="lucide:quote" class="h-3 w-3 shrink-0" />
          <span>{{ item.description }}</span>
        </div>

        <!-- 元信息 -->
        <div
          class="resource-meta"
          :style="{
            background: 'hsl(var(--accent))',
          }"
        >
          <div class="meta-group">
            <span
              class="meta-icon"
              :style="{ color: 'hsl(var(--muted-foreground))' }"
            >
              <IconifyIcon icon="lucide:hard-drive" class="h-3.5 w-3.5" />
            </span>
            <span
              class="meta-value"
              :style="{ color: 'hsl(var(--card-foreground))' }"
              >{{ formatSize(item.size) }}</span
            >
          </div>
          <div class="meta-group">
            <span class="meta-icon" :style="{ color: 'hsl(var(--success))' }">
              <IconifyIcon icon="lucide:arrow-up" class="h-3.5 w-3.5" />
            </span>
            <span
              class="meta-value"
              :style="{ color: 'hsl(var(--success))' }"
              >{{ item.seeders || 0 }}</span
            >
          </div>
          <div class="meta-group">
            <span class="meta-icon" :style="{ color: 'hsl(var(--warning))' }">
              <IconifyIcon icon="lucide:arrow-down" class="h-3.5 w-3.5" />
            </span>
            <span
              class="meta-value"
              :style="{ color: 'hsl(var(--warning))' }"
              >{{ item.leechers || 0 }}</span
            >
          </div>
          <div v-if="item.pubdate" class="meta-group">
            <span
              class="meta-icon"
              :style="{ color: 'hsl(var(--muted-foreground))' }"
            >
              <IconifyIcon icon="lucide:clock" class="h-3.5 w-3.5" />
            </span>
            <span
              class="meta-value"
              :style="{ color: 'hsl(var(--card-foreground))' }"
              >{{ formatDate(item.pubdate) }}</span
            >
          </div>
        </div>

        <!-- 操作 -->
        <div class="resource-actions">
          <NButton
            size="small"
            type="primary"
            ghost
            @click="emit('download', item)"
          >
            <template #icon>
              <IconifyIcon icon="lucide:download" class="h-4 w-4" />
            </template>
            下载
          </NButton>
          <NButton
            v-if="item.page_url"
            size="small"
            @click="emit('openUrl', item.page_url!)"
          >
            <template #icon>
              <IconifyIcon icon="lucide:external-link" class="h-4 w-4" />
            </template>
            详情
          </NButton>
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.resource-card {
  overflow: hidden;
  transition: all 0.2s ease;
}

.resource-card:hover {
  box-shadow: 0 4px 12px hsl(var(--foreground) / 5%);
}

.resource-card :deep(.n-card__content) {
  padding: 0;
}

.resource-card-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.resource-poster {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 7rem;
}

.resource-poster-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.4;
  border-radius: 0.25rem;
}

.resource-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem;
}

.resource-title-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.resource-title {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: break-word;
}

.resource-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
}

.resource-tag {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  border-radius: 0.25rem;
}

.resource-tag-default {
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 30%);
}

.resource-tag-primary {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
}

.resource-tag-danger {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 10%);
}

.resource-tag-lang {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 12%);
}

.resource-tag-quality {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 15%);
}

.resource-tag-audio {
  color: hsl(var(--info));
  background-color: hsl(var(--info) / 12%);
}

.resource-tag-source {
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--accent));
}

.resource-tag-edition {
  color: hsl(var(--secondary-foreground));
  background-color: hsl(var(--secondary));
}

.resource-description {
  display: flex;
  gap: 0.375rem;
  align-items: flex-start;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-wrap: break-word;
  border-radius: 0.375rem;
}

.resource-description span {
  flex: 1;
  min-width: 0;
}

.resource-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  padding: 0.625rem;
  border-radius: 0.5rem;
}

.meta-group {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}

.meta-icon {
  display: inline-flex;
  align-items: center;
}

.meta-value {
  font-size: 0.8125rem;
  font-weight: 500;
}

.resource-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding-top: 0.25rem;
  margin-top: auto;
}

@media (max-width: 640px) {
  .resource-poster {
    height: 5.5rem;
  }

  .resource-meta {
    gap: 0.5rem;
  }
}
</style>
