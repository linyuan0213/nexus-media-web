<script lang="ts" setup>
import type { ResourceItem } from '../types';

import { IconifyIcon } from '@vben/icons';

import { NButton, NTooltip } from 'naive-ui';

import { useResourceHelpers } from '../composables/useResourceHelpers';

interface Props {
  item: ResourceItem;
  favicons?: Record<string, string>;
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
        background: 'hsl(var(--accent))',
        color: 'hsl(var(--accent-foreground))',
      }"
    >
      <span class="poster-logo-initial">{{
        item.indexer?.charAt(0) || ''
      }}</span>
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
  padding: 0.625rem 0.875rem;
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
  width: 2.5rem;
  height: 2.5rem;
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

.poster-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poster-logo-initial {
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
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
  color: hsl(var(--tag-default));
  background-color: hsl(var(--tag-default) / 18%);
}

.resource-tag-primary {
  color: hsl(var(--tag-primary));
  background-color: hsl(var(--tag-primary) / 20%);
}

.resource-tag-danger {
  color: hsl(var(--tag-danger));
  background-color: hsl(var(--tag-danger) / 20%);
}

.resource-tag-lang {
  color: hsl(var(--tag-lang));
  background-color: hsl(var(--tag-lang) / 18%);
}

.resource-tag-quality {
  color: hsl(var(--tag-quality));
  background-color: hsl(var(--tag-quality) / 20%);
}

.resource-tag-audio {
  color: hsl(var(--tag-audio));
  background-color: hsl(var(--tag-audio) / 18%);
}

.resource-tag-source {
  color: hsl(var(--tag-source));
  background-color: hsl(var(--tag-source) / 18%);
}

.resource-tag-edition {
  color: hsl(var(--tag-edition));
  background-color: hsl(var(--tag-edition) / 18%);
}

.resource-tag-dolby {
  color: hsl(var(--tag-dolby));
  background-color: hsl(var(--tag-dolby) / 18%);
}

.resource-tag-hdr {
  color: hsl(var(--tag-hdr));
  background-color: hsl(var(--tag-hdr) / 18%);
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
    padding: 0.5rem 0.625rem;
  }

  .resource-list-poster {
    width: 2.25rem;
    height: 2.25rem;
  }

  .resource-list-main {
    flex: 1 1 calc(100% - 3rem);
  }

  .resource-list-meta {
    order: 3;
    width: 100%;
    margin-top: 0.25rem;
    margin-left: 3rem;
  }

  .resource-list-actions {
    order: 2;
    margin-left: auto;
  }
}
</style>
