<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSpin, useMessage } from 'naive-ui';

import { getLibraryHomeApi } from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

import ActivityList from './components/ActivityList.vue';
import LibraryCard from './components/LibraryCard.vue';
import MediaPosterCard from './components/MediaPosterCard.vue';
import ServerStatusLine from './components/ServerStatusLine.vue';
import StatSummary from './components/StatSummary.vue';
import StorageUsage from './components/StorageUsage.vue';

const message = useMessage();

const loading = ref(true);
const serverSuccess = ref(false);
const mediaCounts = ref<Record<string, number | string>>({});
const librarySpaces = ref<Record<string, any>>({});
const libraries = ref<any[]>([]);
const resumes = ref<any[]>([]);
const latests = ref<any[]>([]);
const activitys = ref<any[]>([]);

const hasLibraries = computed(() => libraries.value.length > 0);
const hasResumes = computed(() => resumes.value.length > 0);
const hasLatests = computed(() => latests.value.length > 0);

function typeLabel(type?: string) {
  const map: Record<string, string> = {
    movie: '电影',
    tv: '电视剧',
    series: '电视剧',
    anime: '动漫',
    music: '音乐',
  };
  return map[(type || '').toLowerCase()] || type || '';
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await getLibraryHomeApi();
    const data = (res as any)?.data || res;
    if (data) {
      serverSuccess.value = data.server_success !== false;
      mediaCounts.value = data.media_counts || {};
      librarySpaces.value = data.library_spaces || {};
      libraries.value = data.librarys || [];
      resumes.value = data.resumes || [];
      latests.value = data.latests || [];
      activitys.value = data.activitys || [];
    }
  } catch (error: any) {
    serverSuccess.value = false;
    message.error(error?.message || '获取媒体库数据失败');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4 lg:p-6">
    <PageHeader title="我的媒体库">
      <template #actions>
        <NButton @click="fetchData">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <template #default>
        <!-- 服务器状态 -->
        <ServerStatusLine class="mb-6" :connected="serverSuccess" />

        <!-- 统计摘要 -->
        <StatSummary class="mb-8" :counts="mediaCounts" />

        <!-- 媒体库列表 -->
        <section v-if="hasLibraries" class="mb-8">
          <div class="mb-4 flex items-center gap-2">
            <IconifyIcon
              icon="lucide:library"
              class="size-5"
              style="color: hsl(var(--primary))"
            />
            <h2
              class="text-lg font-semibold"
              style="color: hsl(var(--card-foreground))"
            >
              媒体库
            </h2>
          </div>
          <div
            class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <LibraryCard
              v-for="lib in libraries"
              :key="lib.id"
              :name="lib.name"
              :image="lib.image"
              :image-list="lib.image_list"
              :href="lib.link"
            />
          </div>
        </section>

        <!-- 正在观看 -->
        <section v-if="hasResumes" class="mb-8">
          <div class="mb-4 flex items-center gap-2">
            <IconifyIcon
              icon="lucide:play-circle"
              class="size-5"
              style="color: hsl(var(--primary))"
            />
            <h2
              class="text-lg font-semibold"
              style="color: hsl(var(--card-foreground))"
            >
              正在观看
            </h2>
          </div>
          <div class="flex gap-4 overflow-x-auto pb-3">
            <MediaPosterCard
              v-for="item in resumes"
              :key="item.id"
              :title="item.name"
              :image="item.image"
              :type="item.type"
              :type-label="typeLabel(item.type)"
              :percent="item.percent"
              :href="item.link"
            />
          </div>
        </section>

        <!-- 最近入库 -->
        <section v-if="hasLatests" class="mb-8">
          <div class="mb-4 flex items-center gap-2">
            <IconifyIcon
              icon="lucide:sparkles"
              class="size-5"
              style="color: hsl(var(--primary))"
            />
            <h2
              class="text-lg font-semibold"
              style="color: hsl(var(--card-foreground))"
            >
              最近入库
            </h2>
          </div>
          <div class="flex gap-4 overflow-x-auto pb-3">
            <MediaPosterCard
              v-for="item in latests"
              :key="item.id"
              :title="item.name"
              :image="item.image"
              :type="item.type"
              :type-label="typeLabel(item.type)"
              :href="item.link"
            />
          </div>
        </section>

        <!-- 底部：存储 + 动态 -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <StorageUsage
            :free-space="librarySpaces.FreeSpace"
            :total-space="librarySpaces.TotalSpace"
            :used-space="librarySpaces.UsedSpace"
            :used-percent="librarySpaces.UsedPercent"
          />

          <ActivityList class="lg:col-span-2" :items="activitys" />
        </div>
      </template>
    </NSpin>
  </div>
</template>
