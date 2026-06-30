<script lang="ts" setup>
import type { SiteItem } from '../types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSelect, NSwitch } from 'naive-ui';

interface Props {
  site: SiteItem;
  favicon?: string;
  faviconFallback?: string;
  faviconFailed?: boolean;
  testing?: boolean;
  downloadSettings?: { label: string; value: string }[];
}

const props = withDefaults(defineProps<Props>(), {
  favicon: '',
  faviconFallback: '',
  faviconFailed: false,
  testing: false,
  downloadSettings: () => [],
});

const emit = defineEmits<{
  (e: 'test', site: SiteItem): void;
  (e: 'edit', site: SiteItem): void;
  (e: 'delete', site: SiteItem): void;
  (e: 'faviconError', name: string): void;
  (e: 'update', site: SiteItem, data: Partial<SiteItem>): void;
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

function handleEnabledUpdate(enabled: boolean) {
  emit('update', props.site, { enabled });
}

function handleDownloadSettingUpdate(value: string) {
  emit('update', props.site, { download_setting: value });
}

function resolveFavicon(): string {
  return props.favicon || '';
}

const showPlaceholder = computed(
  () => !resolveFavicon() || props.faviconFailed || isThirdParty.value,
);

const isThirdParty = computed(() => props.site.source !== 'builtin');

const features = computed(() => {
  const allFeatures = [
    { key: 'search_enabled', label: '搜索', icon: 'lucide:search' },
    { key: 'rss_enable', label: 'RSS', icon: 'lucide:rss' },
    { key: 'brush_enable', label: '刷流', icon: 'lucide:refresh-cw' },
    { key: 'statistic_enable', label: '统计', icon: 'lucide:bar-chart-3' },
    { key: 'parse', label: '解析', icon: 'lucide:file-search' },
    { key: 'unread_msg_notify', label: '消息', icon: 'lucide:bell' },
    { key: 'chrome', label: '仿真', icon: 'lucide:chrome' },
    { key: 'proxy', label: '代理', icon: 'lucide:globe' },
    { key: 'subtitle', label: '字幕', icon: 'lucide:subtitles' },
    { key: 'tag', label: '标签', icon: 'lucide:tag' },
  ];
  return allFeatures.filter((f) => {
    if (f.key === 'search_enabled') return props.site.enabled !== false;
    return props.site[f.key as keyof SiteItem];
  });
});
</script>

<template>
  <div class="site-card">
    <div class="site-card-main">
      <div class="site-header">
        <div class="site-logo">
          <img
            v-if="resolveFavicon() && !isThirdParty"
            v-show="!faviconFailed"
            :src="resolveFavicon()"
            :alt="site.name"
            class="site-logo-img"
            @error="handleFaviconError"
          />
          <div v-if="showPlaceholder" class="site-logo-placeholder">
            {{ site.name.charAt(0).toUpperCase() }}
          </div>
        </div>

        <div class="site-meta">
          <div class="site-name-row">
            <span class="site-name" :title="site.name">{{ site.name }}</span>
            <span
              class="site-type-badge"
              :class="
                (site.site_public ?? site.public)
                  ? 'site-type-bt'
                  : 'site-type-pt'
              "
            >
              {{ (site.site_public ?? site.public) ? 'BT' : 'PT' }}
            </span>
          </div>
          <div v-if="!isThirdParty" class="site-url">
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

        <div v-if="!isThirdParty" class="site-actions">
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

      <div v-if="isThirdParty" class="site-control-bar">
        <div class="control-item">
          <span class="control-label">启用</span>
          <NSwitch
            :value="site.enabled !== false"
            @update:value="handleEnabledUpdate"
          />
        </div>
        <div class="control-item">
          <span class="control-label">下载设置</span>
          <NSelect
            :value="String(site.download_setting || '')"
            :options="downloadSettings"
            placeholder="请选择"
            size="small"
            style="width: 130px"
            @update:value="handleDownloadSettingUpdate"
          />
        </div>
      </div>

      <div v-if="!isThirdParty" class="site-status">
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

      <div v-if="!isThirdParty && features.length > 0" class="site-features">
        <div
          v-for="feature in features"
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
  border-radius: 0.875rem;
  transition: all 0.2s ease;
}

.site-card:hover {
  border-color: hsl(var(--primary) / 40%);
  box-shadow: 0 4px 16px hsl(var(--foreground) / 6%);
}

.site-card-main {
  padding: 1rem;
}

.site-header {
  display: flex;
  gap: 0.875rem;
  align-items: center;
}

.site-logo {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  overflow: hidden;
  background: hsl(var(--accent));
  border-radius: 0.625rem;
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

.site-meta {
  flex: 1;
  min-width: 0;
}

.site-name-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.site-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9375rem;
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
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.site-url-icon {
  flex-shrink: 0;
  width: 0.75rem;
  height: 0.75rem;
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

.site-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.25rem;
  align-items: center;
  margin-left: auto;
}

.site-actions :deep(.n-button) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: 0.5rem;
  transition: background-color 0.2s ease;
}

.site-actions :deep(.n-button):not(.n-button--disabled):hover {
  background: hsl(var(--accent));
}

.site-actions
  :deep(.n-button.n-button--error-type):not(.n-button--disabled):hover {
  background: hsl(var(--destructive) / 12%);
}

.action-icon {
  width: 1rem;
  height: 1rem;
}

.site-control-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  margin-top: 0.75rem;
  background: hsl(var(--accent) / 40%);
  border-radius: 0.5rem;
}

.control-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.control-label {
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.site-status {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.625rem;
  margin-top: 0.875rem;
  background: hsl(var(--accent) / 40%);
  border-radius: 0.5rem;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
  text-align: center;
}

.status-icon {
  width: 0.875rem;
  height: 0.875rem;
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
  margin-top: 0.875rem;
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
  .site-header {
    flex-wrap: wrap;
  }

  .site-actions {
    justify-content: flex-end;
    width: 100%;
    margin-top: 0.625rem;
    margin-left: 0;
  }

  .site-control-bar {
    gap: 0.75rem;
  }

  .site-status {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
