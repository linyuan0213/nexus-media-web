<script lang="ts" setup>
import type { SiteItem } from '../types';

import { IconifyIcon } from '@vben/icons';

import { NButton } from 'naive-ui';

interface Props {
  site: SiteItem;
  favicon?: string;
  faviconFallback?: string;
  faviconFailed?: boolean;
  testing?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  favicon: '',
  faviconFallback: '',
  faviconFailed: false,
  testing: false,
});

const emit = defineEmits<{
  (e: 'test', site: SiteItem): void;
  (e: 'edit', site: SiteItem): void;
  (e: 'delete', site: SiteItem): void;
  (e: 'faviconError', name: string): void;
}>();

function handleFaviconError() {
  emit('faviconError', props.site.name);
}

function handleTest() {
  emit('test', props.site);
}

function handleEdit() {
  emit('edit', props.site);
}

function handleDelete() {
  emit('delete', props.site);
}

function resolveFavicon(): string {
  if (props.favicon) return props.favicon;
  return props.faviconFallback;
}

const features = [
  { key: 'rss_enable', label: 'RSS', icon: 'lucide:rss' },
  { key: 'brush_enable', label: '刷流', icon: 'lucide:refresh-cw' },
  { key: 'statistic_enable', label: '统计', icon: 'lucide:bar-chart-3' },
  { key: 'parse', label: '解析', icon: 'lucide:file-search' },
  { key: 'unread_msg_notify', label: '消息', icon: 'lucide:bell' },
  { key: 'chrome', label: '仿真', icon: 'lucide:chrome' },
  { key: 'proxy', label: '代理', icon: 'lucide:globe' },
];

const enabledFeatures = features.filter(
  (f) => props.site[f.key as keyof SiteItem],
);
</script>

<template>
  <div class="site-card">
    <div class="site-card-main">
      <div class="site-identity">
        <div class="site-logo">
          <img
            v-show="!faviconFailed"
            :src="resolveFavicon()"
            :alt="site.name"
            class="site-logo-img"
            @error="handleFaviconError"
          />
          <div v-show="faviconFailed" class="site-logo-placeholder">
            {{ site.name.charAt(0).toUpperCase() }}
          </div>
        </div>

        <div class="site-meta">
          <div class="site-name-row">
            <span class="site-name">{{ site.name }}</span>
            <span
              class="site-type-badge"
              :class="site.public ? 'site-type-bt' : 'site-type-pt'"
            >
              {{ site.public ? 'BT' : 'PT' }}
            </span>
          </div>
          <div class="site-url">
            <IconifyIcon icon="lucide:link" class="site-url-icon" />
            <a
              v-if="site.signurl"
              :href="site.signurl"
              target="_blank"
              class="site-url-link"
              >{{ site.signurl }}</a
            >
            <span v-else class="site-url-empty">未配置地址</span>
          </div>
        </div>

        <div class="site-header-actions">
          <NButton
            text
            size="small"
            :loading="testing"
            aria-label="连通性测试"
            title="连通性测试"
            @click="handleTest"
          >
            <IconifyIcon icon="lucide:activity" class="action-icon" />
          </NButton>
          <NButton
            text
            size="small"
            aria-label="编辑"
            title="编辑"
            @click="handleEdit"
          >
            <IconifyIcon icon="lucide:pencil" class="action-icon" />
          </NButton>
          <NButton
            text
            size="small"
            type="error"
            aria-label="删除"
            title="删除"
            @click="handleDelete"
          >
            <IconifyIcon icon="lucide:trash-2" class="action-icon" />
          </NButton>
        </div>
      </div>

      <div class="site-status">
        <div class="status-item">
          <IconifyIcon icon="lucide:gauge" class="status-icon" />
          <span class="status-label">优先级</span>
          <span class="status-value">{{ site.pri ?? '-' }}</span>
        </div>
        <div
          v-if="site.cookie || site.api_key || site.bearer_token"
          class="status-item"
        >
          <IconifyIcon icon="lucide:key-round" class="status-icon" />
          <span class="status-label">认证</span>
          <span class="status-value status-ok">已配置</span>
        </div>
        <div v-else class="status-item">
          <IconifyIcon icon="lucide:key-round" class="status-icon" />
          <span class="status-label">认证</span>
          <span class="status-value">未配置</span>
        </div>
        <div v-if="site.rssurl" class="status-item">
          <IconifyIcon icon="lucide:rss" class="status-icon" />
          <span class="status-label">RSS</span>
          <span class="status-value status-ok">已配置</span>
        </div>
        <div v-else class="status-item">
          <IconifyIcon icon="lucide:rss" class="status-icon" />
          <span class="status-label">RSS</span>
          <span class="status-value">未配置</span>
        </div>
      </div>

      <div v-if="enabledFeatures.length > 0" class="site-features">
        <div
          v-for="feature in enabledFeatures"
          :key="feature.key"
          class="feature-chip"
          :title="feature.label"
        >
          <IconifyIcon :icon="feature.icon" class="feature-icon" />
          <span class="feature-label">{{ feature.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.site-card {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  transition: all 0.2s ease;
}

.site-card:hover {
  border-color: hsl(var(--primary) / 40%);
  box-shadow: 0 4px 16px hsl(var(--foreground) / 6%);
}

.site-card-main {
  padding: 1rem;
}

.site-identity {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  margin-bottom: 1rem;
}

.site-logo {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  overflow: hidden;
  background: hsl(var(--accent));
  border-radius: 0.75rem;
}

.site-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.site-logo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1.125rem;
  font-weight: 700;
  color: hsl(var(--primary));
}

.site-header-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
  align-items: center;
  margin-left: auto;
}

.site-header-actions :deep(.n-button) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: 0.5rem;
  transition: background-color 0.2s ease;
}

.site-header-actions :deep(.n-button):not(.n-button--disabled):hover {
  background: hsl(var(--accent));
}

.site-header-actions
  :deep(.n-button.n-button--error-type):not(.n-button--disabled):hover {
  background: hsl(var(--destructive) / 12%);
}

.action-icon {
  width: 1rem;
  height: 1rem;
}

.site-meta {
  flex: 1;
  min-width: 0;
}

.site-name-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.375rem;
}

.site-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.site-type-badge {
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  border-radius: 9999px;
}

.site-type-pt {
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
}

.site-type-bt {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 15%);
}

.site-url {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.site-url-icon {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
}

.site-url-link {
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--primary));
  white-space: nowrap;
  text-decoration: none;
}

.site-url-link:hover {
  text-decoration: underline;
}

.site-url-empty {
  font-style: italic;
}

.site-status {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.875rem;
  background: hsl(var(--accent) / 40%);
  border-radius: 0.625rem;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
  text-align: center;
}

.status-icon {
  width: 1rem;
  height: 1rem;
  color: hsl(var(--muted-foreground));
}

.status-label {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.status-value {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.status-ok {
  color: hsl(var(--success));
}

.site-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.875rem;
  border-top: 1px solid hsl(var(--border));
}

.feature-chip {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: 9999px;
}

.feature-icon {
  width: 0.875rem;
  height: 0.875rem;
}

@media (max-width: 640px) {
  .site-identity {
    flex-wrap: wrap;
  }

  .site-header-actions {
    justify-content: flex-end;
    width: 100%;
    margin-top: 0.75rem;
    margin-left: 0;
  }

  .site-status {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
