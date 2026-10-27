<script lang="ts" setup>
import type { MediaApi } from '#/api/modules/media';

import { IconifyIcon } from '@vben/icons';

import { NAlert, NButton, NCard, NEmpty, NTag } from 'naive-ui';

import ActivityList from './ActivityList.vue';
import LibraryCard from './LibraryCard.vue';
import MediaPosterCard from './MediaPosterCard.vue';
import StatSummary from './StatSummary.vue';

defineProps<{
  section: MediaApi.LibrarySection;
  scanning: boolean;
}>();

const emit = defineEmits<{
  scan: [];
  sync: [];
}>();
</script>

<template>
  <NCard class="server-section" :bordered="true" size="small">
    <div class="server-heading">
      <div class="server-identity">
        <div class="server-icon">
          <IconifyIcon icon="lucide:server" class="h-5 w-5" />
        </div>
        <div>
          <div class="server-name-row">
            <h2>{{ section.server_name }}</h2>
            <NTag size="small" :bordered="false">
              {{ section.server.type }}
            </NTag>
            <NTag
              v-if="section.server.is_default"
              size="small"
              type="primary"
              :bordered="false"
            >
              默认
            </NTag>
          </div>
          <div class="server-sync">{{ section.sync_state }}</div>
        </div>
      </div>
      <div class="server-actions">
        <NTag
          :type="section.server_success ? 'success' : 'error'"
          size="small"
          :bordered="false"
        >
          {{ section.server_success ? '连接正常' : '连接失败' }}
        </NTag>
        <NButton
          size="small"
          secondary
          :loading="scanning"
          @click="emit('scan')"
        >
          <template #icon><IconifyIcon icon="lucide:scan-line" /></template>
          扫描媒体库
        </NButton>
        <NButton size="small" secondary @click="emit('sync')">
          <template #icon><IconifyIcon icon="lucide:folder-sync" /></template>
          同步媒体库
        </NButton>
      </div>
    </div>

    <NAlert
      v-if="!section.server_success"
      type="error"
      :bordered="false"
      class="mb-4"
    >
      当前实例暂时无法读取，其他实例不受影响。请检查连接配置后重试。
    </NAlert>

    <StatSummary :counts="section.media_counts" />

    <section class="content-section">
      <div class="section-heading">
        <IconifyIcon icon="lucide:library" class="h-4 w-4" />
        <h3>媒体库</h3>
        <span>{{ section.librarys.length }}</span>
      </div>
      <div v-if="section.librarys.length" class="library-grid">
        <LibraryCard
          v-for="library in section.librarys"
          :key="`${section.server_id}:${library.id}`"
          :name="library.name"
          :image="library.image"
          :image-list="library.image_list"
          :href="library.link"
        />
      </div>
      <NEmpty v-else size="small" description="当前实例暂无媒体库" />
    </section>

    <section v-if="section.resumes.length" class="content-section">
      <div class="section-heading">
        <IconifyIcon icon="lucide:history" class="h-4 w-4" />
        <h3>正在观看</h3>
      </div>
      <div class="poster-track">
        <MediaPosterCard
          v-for="media in section.resumes"
          :key="`${section.server_id}:${media.id}`"
          :title="media.name"
          :image="media.image"
          :type="media.type"
          type-label="继续观看"
          :percent="media.percent"
          :href="media.link"
        />
      </div>
    </section>

    <section v-if="section.latests.length" class="content-section">
      <div class="section-heading">
        <IconifyIcon icon="lucide:sparkles" class="h-4 w-4" />
        <h3>最近入库</h3>
      </div>
      <div class="poster-track">
        <MediaPosterCard
          v-for="media in section.latests"
          :key="`${section.server_id}:${media.id}`"
          :title="media.name"
          :image="media.image"
          :type="media.type"
          :href="media.link"
        />
      </div>
    </section>

    <ActivityList v-if="section.activitys.length" :items="section.activitys" />
  </NCard>
</template>

<style scoped>
.server-section {
  overflow: hidden;
}

.server-heading,
.server-identity,
.server-name-row,
.server-actions,
.section-heading {
  display: flex;
  align-items: center;
}

.server-heading {
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 20px;
}

.server-identity {
  gap: 12px;
  min-width: 0;
}

.server-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 10px;
}

.server-name-row {
  flex-wrap: wrap;
  gap: 8px;
}

.server-name-row h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.server-sync {
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.server-actions {
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.content-section {
  margin-top: 24px;
}

.section-heading {
  gap: 7px;
  margin-bottom: 12px;
  color: hsl(var(--primary));
}

.section-heading h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.section-heading span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 12px;
}

.poster-track {
  display: flex;
  gap: 12px;
  padding-bottom: 6px;
  overflow-x: auto;
}

@media (min-width: 640px) {
  .library-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .library-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .library-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .server-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .server-actions {
    justify-content: flex-start;
  }
}
</style>
