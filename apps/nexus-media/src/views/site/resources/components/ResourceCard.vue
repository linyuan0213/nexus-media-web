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
      <div class="resource-title-row">
        <IconifyIcon
          icon="lucide:film"
          class="h-8 w-8 shrink-0"
          :style="{ color: 'hsl(var(--primary))' }"
        />
        <div
          class="resource-title"
          :style="{ color: 'hsl(var(--card-foreground))' }"
        >
          <NTooltip :show-arrow="false">
            <template #trigger>
              <span class="resource-title-text">{{ item.title }}</span>
            </template>
            {{ item.title }}
          </NTooltip>
        </div>
        <div
          v-if="getFreeTag(item)"
          class="resource-free-badge"
          :style="{
            background: `hsl(var(--${getFreeTag(item)!.type}))`,
            color: `hsl(var(--${getFreeTag(item)!.type}-foreground, var(--primary-foreground)))`,
          }"
        >
          {{ getFreeTag(item)!.label }}
        </div>
      </div>

      <div v-if="parseLabels(item.labels).length > 0" class="resource-badges">
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
        class="resource-desc"
        :style="{
          background: 'hsl(var(--accent) / 40%)',
          color: 'hsl(var(--muted-foreground))',
        }"
      >
        <IconifyIcon icon="lucide:quote" class="h-3 w-3 shrink-0" />
        <span>{{ item.description }}</span>
      </div>

      <div
        class="resource-meta"
        :style="{ color: 'hsl(var(--muted-foreground))' }"
      >
        <span class="meta-item">
          <IconifyIcon icon="lucide:hard-drive" class="h-3.5 w-3.5" />
          <span class="meta-text">{{ formatSize(item.size) }}</span>
        </span>
        <span class="meta-item meta-up">
          <IconifyIcon icon="lucide:arrow-up" class="h-3.5 w-3.5" />
          <span class="meta-text">{{ item.seeders || 0 }}</span>
        </span>
        <span class="meta-item meta-down">
          <IconifyIcon icon="lucide:arrow-down" class="h-3.5 w-3.5" />
          <span class="meta-text">{{ item.leechers || 0 }}</span>
        </span>
        <span v-if="item.pubdate" class="meta-item">
          <IconifyIcon icon="lucide:clock" class="h-3.5 w-3.5" />
          <span class="meta-text">{{ formatDate(item.pubdate) }}</span>
        </span>
      </div>

      <div class="resource-actions">
        <NButton
          size="tiny"
          type="primary"
          ghost
          @click="emit('download', item)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:download" class="h-3.5 w-3.5" />
          </template>
          下载
        </NButton>
        <NButton
          v-if="item.page_url"
          size="tiny"
          @click="emit('openUrl', item.page_url!)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:external-link" class="h-3.5 w-3.5" />
          </template>
          详情
        </NButton>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.resource-card {
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.resource-card:hover {
  box-shadow: 0 2px 10px hsl(var(--foreground) / 5%);
}

.resource-card :deep(.n-card__content) {
  padding: 0;
}

.resource-card-inner {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
}

.resource-title-row {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.resource-title {
  flex: 1;
  min-width: 0;
}

.resource-title-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
  -webkit-box-orient: vertical;
}

.resource-free-badge {
  flex-shrink: 0;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
  border-radius: 0.25rem;
}

.resource-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.resource-tag {
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
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

.resource-desc {
  display: flex;
  gap: 0.25rem;
  align-items: flex-start;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.45;
  border-radius: 0.25rem;
}

.resource-desc span {
  flex: 1;
  min-width: 0;
  overflow-wrap: break-word;
}

.resource-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.75rem;
}

.meta-item {
  display: inline-flex;
  gap: 0.1875rem;
  align-items: center;
}

.meta-text {
  font-weight: 500;
}

.meta-up {
  color: hsl(var(--success));
}

.meta-down {
  color: hsl(var(--warning));
}

.resource-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
  margin-top: auto;
}

@media (max-width: 640px) {
  .resource-card-inner {
    padding: 0.625rem;
  }

  .resource-meta {
    gap: 0.375rem;
  }
}
</style>
