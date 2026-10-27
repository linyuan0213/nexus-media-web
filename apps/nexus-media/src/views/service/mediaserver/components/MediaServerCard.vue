<script lang="ts" setup>
import type { MediaServerInstance } from './types';

import { IconifyIcon } from '@vben/icons';

import { NButton, NTooltip } from 'naive-ui';

defineProps<{
  instance: MediaServerInstance;
}>();

const emit = defineEmits<{
  delete: [];
  edit: [];
  setDefault: [];
}>();

function icon(type: string) {
  return `/static/img/mediaserver/${type}.png`;
}
</script>

<template>
  <div
    class="instance-card"
    :class="{ 'is-default': instance.is_default === 1 }"
  >
    <div class="instance-content">
      <div class="instance-heading">
        <div class="instance-icon-wrap">
          <img
            :src="icon(instance.type)"
            class="instance-icon"
            :alt="instance.type"
            @error="($event.target as HTMLElement).style.display = 'none'"
          />
          <div class="instance-icon-fallback">
            <IconifyIcon icon="lucide:server" class="size-5" />
          </div>
        </div>
        <div class="instance-info">
          <div class="instance-name-row">
            <span class="instance-name">{{ instance.name }}</span>
            <span v-if="instance.is_default === 1" class="default-badge">
              <IconifyIcon icon="lucide:star" class="size-3" />
              默认
            </span>
          </div>
          <div class="instance-host">
            {{ instance.config.host || '未配置地址' }}
          </div>
        </div>
        <NTooltip>
          <template #trigger>
            <button
              class="default-star"
              :class="{ active: instance.is_default === 1 }"
              type="button"
              @click.stop="emit('setDefault')"
            >
              <IconifyIcon icon="lucide:star" class="size-5" />
            </button>
          </template>
          {{ instance.is_default === 1 ? '默认媒体服务器' : '设为默认' }}
        </NTooltip>
      </div>

      <div class="instance-tags">
        <span
          class="status-pill"
          :class="instance.enabled === 1 ? 'enabled' : 'disabled'"
        >
          <span class="status-dot"></span>
          {{ instance.enabled === 1 ? '启用' : '停用' }}
        </span>
        <span class="type-pill">{{ instance.type }}</span>
      </div>
    </div>

    <div class="instance-actions">
      <NTooltip>
        <template #trigger>
          <NButton size="small" text @click="emit('edit')">
            <template #icon>
              <IconifyIcon icon="lucide:pencil" class="size-4" />
            </template>
          </NButton>
        </template>
        编辑配置
      </NTooltip>
      <NTooltip>
        <template #trigger>
          <NButton size="small" text type="error" @click="emit('delete')">
            <template #icon>
              <IconifyIcon icon="lucide:trash-2" class="size-4" />
            </template>
          </NButton>
        </template>
        删除实例
      </NTooltip>
    </div>
  </div>
</template>

<style scoped>
.instance-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-top-width: 1px;
  border-radius: 12px;
}

.instance-card.is-default {
  border-top-color: hsl(var(--warning));
  border-top-width: 3px;
}

.instance-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 20px;
}

.instance-heading {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.instance-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
}

.instance-icon {
  position: absolute;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.instance-icon-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 8px;
}

.instance-info {
  flex: 1;
  min-width: 0;
}

.instance-name-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 3px;
}

.instance-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.default-badge {
  display: inline-flex;
  flex-shrink: 0;
  gap: 4px;
  align-items: center;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
  border-radius: 999px;
}

.instance-host {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.default-star {
  flex-shrink: 0;
  padding: 4px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
}

.default-star.active {
  color: hsl(var(--warning));
}

.instance-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-pill,
.type-pill {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
}

.status-pill.enabled {
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
}

.status-pill.disabled {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 12%);
}

.status-dot {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
}

.type-pill {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.instance-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 20px;
  border-top: 1px solid hsl(var(--border));
}
</style>
