<script lang="ts" setup>
import type { ResourceItem } from '../types';

import { IconifyIcon } from '@vben/icons';

import { NButton, NTooltip } from 'naive-ui';

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
  <div
    class="resource-list-item"
    :style="{
      background: 'hsl(var(--card))',
      borderColor: 'hsl(var(--border))',
    }"
  >
    <!-- 列表项海报占位 -->
    <div
      class="resource-list-poster"
      :style="{
        background: 'hsl(var(--muted) / 60%)',
        color: 'hsl(var(--muted-foreground))',
      }"
    >
      <IconifyIcon icon="lucide:film" class="h-5 w-5 opacity-50" />
      <div
        v-if="getFreeTag(item)"
        class="resource-list-poster-badge"
        :style="{
          background: `hsl(var(--${getFreeTag(item)!.type}))`,
          color: `hsl(var(--${getFreeTag(item)!.type}-foreground, var(--primary-foreground)))`,
        }"
      >
        {{ getFreeTag(item)!.label }}
      </div>
    </div>

    <div class="resource-list-main">
      <div class="resource-list-header">
        <NTooltip :show-arrow="false">
          <template #trigger>
            <div
              class="resource-list-title"
              :style="{ color: 'hsl(var(--card-foreground))' }"
            >
              {{ item.title }}
            </div>
          </template>
          {{ item.title }}
        </NTooltip>
      </div>
      <div
        v-if="parseLabels(item.labels).length > 0"
        class="resource-list-badges"
      >
        <span
          v-for="label in parseLabels(item.labels)"
          :key="label"
          class="resource-tag"
          :class="getLabelClass(label)"
          >{{ label }}</span
        >
      </div>
      <div
        v-if="item.description"
        class="resource-list-description"
        :style="{
          color: 'hsl(var(--muted-foreground))',
        }"
      >
        {{ item.description }}
      </div>
    </div>

    <div
      class="resource-list-meta"
      :style="{ color: 'hsl(var(--muted-foreground))' }"
    >
      <span class="meta-group">
        <IconifyIcon icon="lucide:hard-drive" class="h-3.5 w-3.5" />
        <span
          class="meta-value"
          :style="{ color: 'hsl(var(--card-foreground))' }"
          >{{ formatSize(item.size) }}</span
        >
      </span>
      <span class="meta-group">
        <IconifyIcon
          icon="lucide:arrow-up"
          class="h-3.5 w-3.5"
          :style="{ color: 'hsl(var(--success))' }"
        />
        <span class="meta-value" :style="{ color: 'hsl(var(--success))' }">{{
          item.seeders || 0
        }}</span>
      </span>
      <span class="meta-group">
        <IconifyIcon
          icon="lucide:arrow-down"
          class="h-3.5 w-3.5"
          :style="{ color: 'hsl(var(--warning))' }"
        />
        <span class="meta-value" :style="{ color: 'hsl(var(--warning))' }">{{
          item.leechers || 0
        }}</span>
      </span>
      <span v-if="item.pubdate" class="meta-group">
        <IconifyIcon icon="lucide:clock" class="h-3.5 w-3.5" />
        <span
          class="meta-value"
          :style="{ color: 'hsl(var(--card-foreground))' }"
          >{{ formatDate(item.pubdate) }}</span
        >
      </span>
    </div>

    <div class="resource-list-actions">
      <NButton size="tiny" type="primary" ghost @click="emit('download', item)">
        <template #icon>
          <IconifyIcon icon="lucide:download" class="h-3.5 w-3.5" />
        </template>
        <span class="hidden sm:inline">下载</span>
      </NButton>
      <NButton
        v-if="item.page_url"
        size="tiny"
        @click="emit('openUrl', item.page_url!)"
      >
        <template #icon>
          <IconifyIcon icon="lucide:external-link" class="h-3.5 w-3.5" />
        </template>
        <span class="hidden sm:inline">详情</span>
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.resource-list-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 1rem;
  overflow: hidden;
  border: 1px solid;
  border-radius: var(--radius);
  transition: box-shadow 0.2s;
}

.resource-list-item:hover {
  box-shadow: 0 2px 8px hsl(var(--foreground) / 4%);
}

.resource-list-poster {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  overflow: hidden;
  border-radius: 0.5rem;
}

.resource-list-poster-badge {
  position: absolute;
  top: 0;
  left: 0;
  padding: 0.0625rem 0.25rem;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 1.3;
  border-radius: 0.25rem 0;
}

.resource-list-main {
  flex: 1;
  min-width: 0;
}

.resource-list-header {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.resource-list-title {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: break-word;
}

.resource-list-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
}

.resource-list-description {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-wrap: break-word;
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

.resource-list-meta {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.resource-list-meta .meta-group {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  font-size: 0.8125rem;
}

.resource-list-meta .meta-value {
  font-size: 0.8125rem;
  font-weight: 500;
}

.resource-list-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.375rem;
  align-items: center;
}

@media (max-width: 640px) {
  .resource-list-item {
    flex-wrap: wrap;
    padding: 0.625rem;
  }

  .resource-list-poster {
    width: 2.5rem;
    height: 2.5rem;
  }

  .resource-list-main {
    flex: 1 1 calc(100% - 3.25rem);
  }

  .resource-list-meta {
    order: 3;
    width: 100%;
    margin-top: 0.25rem;
    margin-left: 3.25rem;
  }

  .resource-list-actions {
    order: 2;
    margin-left: auto;
  }
}
</style>
