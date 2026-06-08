<script lang="ts" setup>
import { ref, onMounted } from 'vue';

import {
  NButton,
  NCard,
  NCheckbox,
  NModal,
  NSpace,
  NSpin,
  NTag,
} from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import {
  getLibraryHomeApi,
  getLibraryHistoryApi,
} from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

interface LibraryItem {
  id: number;
  name: string;
  link?: string;
  image?: string;
  image_list?: string[];
}

interface ResumeItem {
  id: number;
  name: string;
  link?: string;
  image?: string;
  type: string;
  percent?: number;
}

interface LatestItem {
  id: number;
  name: string;
  link?: string;
  image?: string;
  type: string;
}

const libraries = ref<LibraryItem[]>([]);
const resumes = ref<ResumeItem[]>([]);
const latests = ref<LatestItem[]>([]);
const loading = ref(false);
const serverSuccess = ref(true);

// 同步弹窗
const syncModalShow = ref(false);
const syncProgress = ref(0);
const syncing = ref(false);
const syncLibraries = ref<number[]>([]);

// 播放记录弹窗
const historyModalShow = ref(false);
const historyLoading = ref(false);
const historyList = ref<any[]>([]);

// 统计数据弹窗
const statsModalShow = ref(false);
const statsData = ref<Record<string, any>>({});

async function fetchData() {
  loading.value = true;
  try {
    const res = await getLibraryHomeApi();
    const data = res?.data || res;
    if (data && data.ServerSucess !== false) {
      serverSuccess.value = true;
      libraries.value = data.Librarys || [];
      resumes.value = data.Resumes || [];
      latests.value = data.Latests || [];
      statsData.value = data;
    } else {
      serverSuccess.value = false;
    }
  } catch {
    serverSuccess.value = false;
  } finally {
    loading.value = false;
  }
}

function handleSync() {
  syncModalShow.value = true;
  syncProgress.value = 0;
  syncLibraries.value = libraries.value.map((l) => l.id);
}

function startMediaSync() {
  syncing.value = true;
  syncProgress.value = 0;
  // TODO: 调用同步接口
  const timer = setInterval(() => {
    syncProgress.value += 10;
    if (syncProgress.value >= 100) {
      clearInterval(timer);
      syncing.value = false;
    }
  }, 500);
}

async function showHistory() {
  historyModalShow.value = true;
  historyLoading.value = true;
  try {
    const res = await getLibraryHistoryApi();
    historyList.value = Array.isArray(res) ? res : (res?.data || []);
  } finally {
    historyLoading.value = false;
  }
}

function showStats() {
  statsModalShow.value = true;
}

function getTypeColor(type: string) {
  return type === 'movie' ? 'bg-green-500' : 'bg-blue-500';
}

function getTypeLabel(type: string) {
  return type || '未知';
}

function replaceLocalhost(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://127.0.0.1') || url.startsWith('https://127.0.0.1')) {
    return url.replace(/127\.0\.0\.1:\d+/, window.location.host);
  }
  if (url.startsWith('http://localhost') || url.startsWith('https://localhost')) {
    return url.replace(/localhost:\d+/, window.location.host);
  }
  return url;
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader title="我的媒体库">
      <template #actions>
        <NSpace>
          <NButton type="primary" :disabled="!serverSuccess" @click="handleSync">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
            </template>
            媒体库同步
          </NButton>
          <NButton :disabled="!serverSuccess" @click="showStats">
            <template #icon>
              <IconifyIcon icon="lucide:bar-chart-3" class="size-4" />
            </template>
            统计数据
          </NButton>
          <NButton :disabled="!serverSuccess" @click="showHistory">
            <template #icon>
              <IconifyIcon icon="lucide:history" class="size-4" />
            </template>
            播放记录
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <!-- 媒体服务器连接失败 -->
      <div v-if="!serverSuccess && !loading" class="mt-8">
        <EmptyState
          title="媒体服务器连接失败！"
          subtitle="当前无法连接媒体服务器获取数据，请确认Emby/Jellyfin/Plex配置是否正确。"
        />
      </div>

      <template v-else>
        <!-- 媒体库 -->
        <div v-if="libraries.length > 0" class="page-body mt-4">
          <div class="grid gap-3 grid-normal-card">
            <a
              v-for="lib in libraries"
              :key="lib.id"
              class="card card-link-pop rounded-3 overflow-hidden"
              :href="replaceLocalhost(lib.link)"
              target="_blank"
            >
              <img
                v-if="lib.image"
                :src="lib.image"
                class="w-100 object-cover"
                style="aspect-ratio: 2/1;"
                alt=""
              />
              <div v-else-if="lib.image_list && lib.image_list.length" class="relative">
                <img
                  :src="lib.image_list[0]"
                  class="w-100 object-cover"
                  style="aspect-ratio: 2/1;"
                  alt=""
                />
              </div>
              <div class="m-2 text-center text-sm">{{ lib.name }}</div>
            </a>
          </div>
        </div>

        <!-- 正在观看 -->
        <div v-if="resumes.length > 0" class="mt-8">
          <div class="page-header mb-4">
            <h2 class="text-lg font-semibold">正在观看</h2>
          </div>
          <div class="grid gap-3 grid-normal-card align-items-start">
            <a
              v-for="item in resumes"
              :key="item.id"
              class="card card-link-pop rounded-3 overflow-hidden relative"
              :href="replaceLocalhost(item.link)"
              target="_blank"
            >
              <img
                :src="item.image || '/static/img/no-image.png'"
                class="w-100 object-cover"
                style="aspect-ratio: 2/1;"
                alt=""
              />
              <span
                class="absolute top-2 left-2 text-white text-xs px-2 py-0.5 rounded-full"
                :class="getTypeColor(item.type)"
              >
                {{ getTypeLabel(item.type) }}
              </span>
              <div v-if="item.percent" class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                <div class="h-full bg-green-500" :style="{ width: `${item.percent}%` }" />
              </div>
              <div class="m-2 text-center text-sm truncate">{{ item.name }}</div>
            </a>
          </div>
        </div>

        <!-- 最新入库 -->
        <div v-if="latests.length > 0" class="mt-8">
          <div class="page-header mb-4">
            <h2 class="text-lg font-semibold">最新入库</h2>
          </div>
          <div class="grid gap-3 grid-media-card align-items-start">
            <a
              v-for="item in latests"
              :key="item.id"
              class="card card-link-pop overflow-hidden rounded-3 relative"
              :href="replaceLocalhost(item.link)"
              target="_blank"
            >
              <img
                :src="item.image || '/static/img/no-image.png'"
                class="w-100 object-cover"
                style="aspect-ratio: 2/3;"
                alt=""
              />
              <span
                class="absolute top-2 left-2 text-white text-xs px-2 py-0.5 rounded-full"
                :class="getTypeColor(item.type)"
              >
                {{ getTypeLabel(item.type) }}
              </span>
              <div class="m-2 text-center text-sm truncate">{{ item.name }}</div>
            </a>
          </div>
        </div>

        <!-- 无数据 -->
        <div v-if="libraries.length === 0 && !loading && serverSuccess" class="mt-8">
          <EmptyState
            title="暂无媒体库"
            subtitle="请配置媒体服务器后同步"
          />
        </div>
      </template>
    </NSpin>

    <!-- 同步弹窗 -->
    <NModal
      v-model:show="syncModalShow"
      title="媒体库同步"
      preset="card"
      class="w-[480px]"
      :closable="!syncing"
      :mask-closable="!syncing"
    >
      <div class="text-center mb-4">
        <div class="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        </div>
        <div class="font-medium">媒体服务器</div>
        <div class="text-sm text-gray-500 mt-1">{{ syncing ? '同步中...' : '准备就绪' }}</div>
      </div>

      <details class="m-3">
        <summary class="cursor-pointer text-sm text-gray-600">媒体库列表</summary>
        <div class="mt-2 space-y-2">
          <NCheckbox
            v-for="lib in libraries"
            :key="lib.id"
            :checked="syncLibraries.includes(lib.id)"
            :value="lib.id"
          >
            {{ lib.name }}
          </NCheckbox>
        </div>
      </details>

      <div class="card-progress">
        <div class="h-1 bg-gray-200 rounded overflow-hidden">
          <div
            class="h-full bg-green-500 transition-all duration-300"
            :style="{ width: `${syncProgress}%` }"
          />
        </div>
      </div>

      <template #footer>
        <NSpace justify="center">
          <NButton :disabled="syncing" @click="syncModalShow = false">关闭</NButton>
          <NButton type="primary" :loading="syncing" @click="startMediaSync">
            {{ syncing ? '同步中...' : '开始同步' }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 播放记录弹窗 -->
    <NModal
      v-model:show="historyModalShow"
      title="播放记录"
      preset="card"
      class="w-[720px]"
    >
      <NSpin :show="historyLoading">
        <div v-if="historyList.length > 0" class="space-y-3 max-h-[500px] overflow-auto">
          <div
            v-for="(item, idx) in historyList"
            :key="idx"
            class="flex items-center gap-3 p-2 rounded hover:bg-gray-50"
          >
            <div class="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              :class="item.type === 'PL' ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground'"
            >
              <IconifyIcon
                :icon="item.type === 'PL' ? 'lucide:play' : 'lucide:log-in'"
                class="h-5 w-5"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ item.event }}</div>
              <div class="text-sm text-gray-500">{{ item.date }}</div>
            </div>
            <NTag size="small" :type="item.type === 'PL' ? 'primary' : 'default'">
              {{ item.type === 'PL' ? '播放' : '登录' }}
            </NTag>
          </div>
        </div>
        <EmptyState
          v-else
          title="暂无播放记录"
          subtitle="媒体服务器暂无播放数据"
        />
      </NSpin>
    </NModal>

    <!-- 统计数据弹窗 -->
    <NModal
      v-model:show="statsModalShow"
      title="统计数据"
      preset="card"
      class="w-[480px]"
    >
      <div class="grid grid-cols-3 gap-4">
        <NCard size="small">
          <div class="text-2xl font-bold text-primary">{{ statsData.MediaCount?.MovieCount || 0 }}</div>
          <div class="text-sm text-gray-500">电影数量</div>
        </NCard>
        <NCard size="small">
          <div class="text-2xl font-bold text-primary">{{ statsData.MediaCount?.SeriesCount || 0 }}</div>
          <div class="text-sm text-gray-500">剧集数量</div>
        </NCard>
        <NCard size="small">
          <div class="text-2xl font-bold text-primary">{{ statsData.MediaCount?.EpisodeCount || 0 }}</div>
          <div class="text-sm text-gray-500">总集数</div>
        </NCard>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.grid-normal-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}
.grid-media-card {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}
.card-link-pop {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card-link-pop:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
