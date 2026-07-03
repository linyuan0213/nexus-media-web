<script lang="ts" setup>
import type { SiteItem } from '../types';

import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NSpace, NSpin } from 'naive-ui';

import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

interface Props {
  sites: SiteItem[];
  loading: boolean;
  favicons: Record<string, string>;
  faviconLoadFailed: Record<string, boolean>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  faviconError: [name: string];
  refresh: [];
  select: [site: SiteItem];
}>();

function getFavicon(name: string): string {
  const data = props.favicons[name];
  if (!data) return '';
  if (data.startsWith('data:') || data.startsWith('http')) return data;
  return data;
}
</script>

<template>
  <div>
    <PageHeader title="站点资源">
      <template #actions>
        <NSpace>
          <NButton size="small" @click="emit('refresh')">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            刷新
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div>
        <div v-if="sites.length > 0" class="site-grid">
          <NCard
            v-for="site in sites"
            :key="site.id"
            size="small"
            class="site-card"
            hoverable
            @click="emit('select', site)"
          >
            <div class="site-card-content">
              <div
                class="site-logo-wrap"
                :style="{
                  background: 'hsl(var(--primary) / 10%)',
                  color: 'hsl(var(--primary))',
                }"
              >
                <img
                  v-show="
                    getFavicon(site.name) && !faviconLoadFailed[site.name]
                  "
                  :src="getFavicon(site.name)"
                  :alt="site.name"
                  class="site-logo-img"
                  @error="emit('faviconError', site.name)"
                />
                <div
                  v-show="
                    !getFavicon(site.name) || faviconLoadFailed[site.name]
                  "
                  class="site-logo-placeholder"
                >
                  {{ site.name.charAt(0).toUpperCase() }}
                </div>
              </div>
              <div class="site-info">
                <div
                  class="site-name"
                  :style="{ color: 'hsl(var(--card-foreground))' }"
                >
                  {{ site.name }}
                </div>
                <div
                  class="site-id"
                  :style="{ color: 'hsl(var(--muted-foreground))' }"
                >
                  {{ site.id }}
                </div>
              </div>
              <div
                class="site-arrow"
                :style="{ color: 'hsl(var(--muted-foreground))' }"
              >
                <IconifyIcon icon="lucide:chevron-right" class="h-5 w-5" />
              </div>
            </div>
          </NCard>
        </div>
      </div>

      <EmptyState
        v-if="!loading && sites.length === 0"
        title="暂无站点"
        subtitle="没有可用的索引站点"
      >
        <template #icon>
          <IconifyIcon
            icon="lucide:server-off"
            class="h-12 w-12"
            :style="{ color: 'hsl(var(--muted-foreground))' }"
          />
        </template>
      </EmptyState>
    </NSpin>
  </div>
</template>

<style scoped>
.site-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.site-card {
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;
}

.site-card:hover {
  border-left-color: hsl(var(--primary));
  box-shadow: 0 2px 8px hsl(var(--foreground) / 4%);
}

.site-card :deep(.n-card__content) {
  padding: 1rem;
}

.site-card-content {
  display: flex;
  gap: 0.875rem;
  align-items: center;
}

.site-logo-wrap {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  overflow: hidden;
  border-radius: 0.5rem;
}

.site-logo-img {
  width: 100%;
  height: 100%;
  padding: 0.25rem;
  object-fit: contain;
}

.site-logo-placeholder {
  font-size: 1rem;
  font-weight: 700;
}

.site-info {
  flex: 1;
  min-width: 0;
}

.site-name {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.site-id {
  margin-top: 0.125rem;
  font-size: 0.75rem;
}

.site-arrow {
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .site-grid {
    grid-template-columns: 1fr;
  }
}
</style>
