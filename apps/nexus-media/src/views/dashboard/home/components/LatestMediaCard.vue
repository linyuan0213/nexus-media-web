<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NEmpty } from 'naive-ui';

interface LatestItem {
  id: number | string;
  image?: string;
  link?: string;
  name: string;
  type?: string;
}

interface Props {
  items: LatestItem[];
}

defineProps<Props>();

function openLink(link?: string) {
  if (link) window.open(link, '_blank', 'noopener');
}
</script>

<template>
  <div v-if="items.length > 0" class="latest-wall">
    <div
      v-for="item in items"
      :key="item.id"
      class="latest-item group"
      role="button"
      tabindex="0"
      @click="openLink(item.link)"
      @keydown.enter="openLink(item.link)"
    >
      <div class="latest-poster">
        <img
          v-if="item.image"
          :src="item.image"
          :alt="item.name"
          class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center"
          style="color: var(--tblr-text-muted)"
        >
          <IconifyIcon icon="lucide:image-off" class="size-6 opacity-40" />
        </div>
        <span
          class="latest-type"
          :class="item.type === 'movie' ? 'type-movie' : 'type-tv'"
        >
          {{ item.type === 'movie' ? '电影' : '剧集' }}
        </span>
      </div>
      <span class="latest-name">{{ item.name }}</span>
    </div>
  </div>
  <NEmpty v-else description="暂无最近入库" class="py-10" />
</template>

<style scoped>
.latest-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.latest-item {
  min-width: 0;
  cursor: pointer;
}

.latest-poster {
  position: relative;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  background: rgb(var(--tblr-primary-rgb) / 6%);
  border-radius: var(--tblr-card-border-radius);
  box-shadow: var(--tblr-box-shadow-card);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.latest-item:hover .latest-poster,
.latest-item:focus-visible .latest-poster {
  box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 12%);
  transform: translateY(-2px);
}

.latest-item:focus-visible {
  outline: 2px solid var(--tblr-primary);
  outline-offset: 2px;
  border-radius: var(--tblr-card-border-radius);
}

.latest-type {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 0 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.125rem;
  color: #fff;
  border-radius: 4px;
}

.type-movie {
  background: var(--tblr-primary);
}

.type-tv {
  background: var(--tblr-teal);
}

.latest-name {
  display: block;
  margin-top: 0.375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: var(--tblr-text-muted);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .latest-wall {
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 0.5rem;
  }
}
</style>
