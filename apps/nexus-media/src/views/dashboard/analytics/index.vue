<script lang="ts" setup>
import { ref, onMounted } from 'vue';

import {
  NButton,
  NCard,
  NEmpty,
  NModal,
  NSpace,
  NSpin,
} from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import { getSystemStatusApi } from '#/api';

const loading = ref(false);
const serverSuccess = ref(true);
const systemStatus = ref<any>(null);

const showMediaSyncModal = ref(false);
const showStatisticsModal = ref(false);
const showPlayHistoryModal = ref(false);

const librarys = ref<any[]>([]);
const resumes = ref<any[]>([]);
const latests = ref<any[]>([]);
const mediaServerType = ref('Emby');

async function fetchData() {
  loading.value = true;
  try {
    systemStatus.value = await getSystemStatusApi();
  } catch {
    serverSuccess.value = false;
  } finally {
    loading.value = false;
  }
}

function showMediasyncModal() {
  showMediaSyncModal.value = true;
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <!-- 页面标题 -->
    <div class="page-header d-print-none mb-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xl font-semibold mb-0">我的媒体库</h2>
        <NSpace>
          <NButton type="primary" @click="showMediasyncModal">
            媒体库同步
          </NButton>
          <NButton @click="showStatisticsModal = true">
            统计数据
          </NButton>
          <NButton @click="showPlayHistoryModal = true">
            播放记录
          </NButton>
        </NSpace>
      </div>
    </div>

    <NSpin :show="loading">
      <template v-if="serverSuccess">
        <!-- 系统状态概览 -->
        <NCard class="mb-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center">
              <div class="text-sm" style="color: hsl(var(--muted-foreground))">系统版本</div>
              <div class="text-lg font-bold">{{ systemStatus?.version || '-' }}</div>
            </div>
            <div class="text-center">
              <div class="text-sm" style="color: hsl(var(--muted-foreground))">运行时长</div>
              <div class="text-lg font-bold">{{ systemStatus?.uptime || '-' }}</div>
            </div>
            <div class="text-center">
              <div class="text-sm" style="color: hsl(var(--muted-foreground))">Python</div>
              <div class="text-lg font-bold">{{ systemStatus?.python_version || '-' }}</div>
            </div>
            <div class="text-center">
              <div class="text-sm" style="color: hsl(var(--muted-foreground))">媒体库</div>
              <div class="text-lg font-bold">{{ librarys.length }}</div>
            </div>
          </div>
        </NCard>

        <!-- 媒体库内容 -->
        <div v-if="librarys.length > 0" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <a
            v-for="library in librarys"
            :key="library.id"
            class="card card-link-pop rounded-3 overflow-hidden block"
            :href="library.link"
            target="_blank"
          >
            <img
              v-if="library.image"
              :src="library.image"
              class="w-full object-cover"
              style="aspect-ratio: 2/1"
              alt=""
            />
            <div v-else class="w-full flex items-center justify-center" style="aspect-ratio: 2/1; background-color: hsl(var(--muted))">
              <span style="color: hsl(var(--muted-foreground))">无图片</span>
            </div>
            <div class="m-2 text-center text-sm truncate">{{ library.name }}</div>
          </a>
        </div>

        <!-- 正在观看 -->
        <div v-if="resumes.length > 0" class="mb-6">
          <h3 class="text-lg font-semibold mb-3">正在观看</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <a
              v-for="resume in resumes"
              :key="resume.id"
              class="card card-link-pop rounded-3 overflow-hidden block relative"
              :href="resume.link"
              target="_blank"
            >
              <img
                :src="resume.image || '/static/img/music.png'"
                class="w-full object-cover"
                style="aspect-ratio: 2/1"
                alt=""
              />
              <span
                class="absolute top-2 left-2 px-2 py-0.5 text-xs rounded-full text-white"
                :class="resume.type === 'movie' ? 'bg-green-500' : 'bg-blue-500'"
              >
                {{ resume.type }}
              </span>
              <div v-if="resume.percent" class="absolute bottom-8 left-0 right-0 h-1" style="background-color: hsl(var(--muted))">
                <div class="h-full bg-green-500" :style="`width: ${resume.percent}%`"></div>
              </div>
              <div class="m-2 text-center text-sm truncate">{{ resume.name }}</div>
            </a>
          </div>
        </div>

        <!-- 最新入库 -->
        <div v-if="latests.length > 0" class="mb-6">
          <h3 class="text-lg font-semibold mb-3">最新入库</h3>
          <div class="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-3">
            <a
              v-for="latest in latests"
              :key="latest.id"
              class="card card-link-pop rounded-3 overflow-hidden block relative"
              :href="latest.link"
              target="_blank"
            >
              <img
                :src="latest.image || '/static/img/music.png'"
                class="w-full object-cover"
                style="aspect-ratio: 2/3"
                alt=""
              />
              <span
                class="absolute top-2 left-2 px-2 py-0.5 text-xs rounded-full text-white"
                :class="latest.type === 'movie' ? 'bg-green-500' : 'bg-blue-500'"
              >
                {{ latest.type }}
              </span>
              <div class="m-2 text-center text-sm truncate">{{ latest.name }}</div>
            </a>
          </div>
        </div>

        <NEmpty v-if="librarys.length === 0 && resumes.length === 0 && latests.length === 0" description="暂无媒体库数据，请先配置媒体服务器" />
      </template>

      <div v-else class="flex flex-col items-center justify-center py-20 text-center">
        <IconifyIcon icon="lucide:server-off" class="mb-4 size-12 text-muted-foreground" />
        <p class="text-lg font-semibold text-muted-foreground">媒体服务器连接失败！</p>
        <p class="text-muted-foreground">当前无法连接媒体服务器获取数据，请确认 Emby/Jellyfin/Plex 配置是否正确。</p>
      </div>
    </NSpin>

    <!-- 媒体库同步模态框 -->
    <NModal v-model:show="showMediaSyncModal" preset="card" title="媒体库同步" style="width: 500px">
      <div class="text-center py-4">
        <div class="mb-3">
          <span
            class="inline-block w-16 h-16 rounded-full bg-cover bg-center"
            :style="`background-image: url('/static/img/mediaserver/${mediaServerType}.png')`"
          ></span>
        </div>
        <div class="font-semibold mb-1">{{ mediaServerType }}</div>
      </div>
    </NModal>
  </div>
</template>
