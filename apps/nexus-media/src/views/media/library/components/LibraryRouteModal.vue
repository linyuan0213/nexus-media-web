<script lang="ts" setup>
import type { MediaApi } from '#/api/modules/media';

import { ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NEmpty,
  NModal,
  NPopconfirm,
  NSpin,
  NTag,
  useMessage,
} from 'naive-ui';

import {
  deleteLibraryRouteApi,
  getLibraryRoutesApi,
} from '#/api/modules/media';
import { getContentProfileOptions } from '#/plugin-framework';

import LibraryRouteForm from './LibraryRouteForm.vue';

const props = defineProps<{
  show: boolean;
  servers: MediaApi.MediaServerOption[];
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const message = useMessage();
const loading = ref(false);
const routes = ref<MediaApi.LibraryRoute[]>([]);
const editingRoute = ref<MediaApi.LibraryRoute | null>(null);

watch(
  () => props.show,
  async (show) => {
    if (!show) return;
    editingRoute.value = null;
    await loadRoutes();
  },
);

async function loadRoutes() {
  loading.value = true;
  try {
    routes.value = await getLibraryRoutesApi();
  } finally {
    loading.value = false;
  }
}

function profileLabel(profile: string) {
  if (profile === 'default') return '普通电影 / 电视剧';
  return (
    getContentProfileOptions().find((item) => item.value === profile)?.label ||
    profile
  );
}

async function handleSaved() {
  editingRoute.value = null;
  await loadRoutes();
}

async function deleteRoute(id?: number) {
  if (!id) return;
  await deleteLibraryRouteApi(id);
  message.success('路由已删除');
  if (editingRoute.value?.id === id) editingRoute.value = null;
  await loadRoutes();
}
</script>

<template>
  <NModal
    :show="show"
    title="目录与媒体库路由"
    preset="card"
    :style="{ width: '760px', maxWidth: '92vw' }"
    @update:show="emit('update:show', $event)"
  >
    <LibraryRouteForm
      :servers="servers"
      :route="editingRoute"
      @saved="handleSaved"
      @cancel-edit="editingRoute = null"
    />

    <section class="configured-routes">
      <div class="list-heading">
        <div>
          <h3>已配置路由</h3>
          <p>按内容类型匹配，未命中时使用默认媒体服务器</p>
        </div>
        <NTag size="small" :bordered="false">{{ routes.length }} 条</NTag>
      </div>
      <NSpin :show="loading">
        <div v-if="routes.length" class="route-list">
          <div v-for="route in routes" :key="route.id" class="route-item">
            <div class="route-icon">
              <IconifyIcon icon="lucide:route" class="h-4 w-4" />
            </div>
            <div class="route-info">
              <div class="route-title">
                <strong>{{
                  route.target_path || profileLabel(route.content_profile)
                }}</strong>
                <IconifyIcon icon="lucide:arrow-right" class="h-3.5 w-3.5" />
                <span>{{ route.server_name }}</span>
                <NTag
                  size="small"
                  :type="route.enabled ? 'success' : 'default'"
                  :bordered="false"
                >
                  {{ route.enabled ? '启用' : '停用' }}
                </NTag>
              </div>
              <div class="route-meta">
                {{
                  route.library_id
                    ? `指定媒体库 ${route.library_id}`
                    : '全部媒体库（按路径匹配）'
                }}
                <template v-if="route.content_profile">
                  · {{ profileLabel(route.content_profile) }}
                </template>
                <template v-if="route.note"> · {{ route.note }}</template>
              </div>
            </div>
            <div class="route-actions">
              <NButton size="small" quaternary @click="editingRoute = route">
                <template #icon><IconifyIcon icon="lucide:pencil" /></template>
              </NButton>
              <NPopconfirm @positive-click="deleteRoute(route.id)">
                <template #trigger>
                  <NButton size="small" quaternary type="error">
                    <template #icon>
                      <IconifyIcon icon="lucide:trash-2" />
                    </template>
                  </NButton>
                </template>
                删除该路由？
              </NPopconfirm>
            </div>
          </div>
        </div>
        <NEmpty
          v-else-if="!loading"
          description="尚未配置路由，所有内容默认进入默认媒体服务器"
        />
      </NSpin>
    </section>
  </NModal>
</template>

<style scoped>
.configured-routes {
  padding-top: 20px;
  margin-top: 20px;
  border-top: 1px solid hsl(var(--border));
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.list-heading h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.list-heading p {
  margin-top: 3px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.route-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 8px;
}

.route-info {
  flex: 1;
  min-width: 0;
}

.route-title {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
}

.route-meta {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.route-actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}
</style>
