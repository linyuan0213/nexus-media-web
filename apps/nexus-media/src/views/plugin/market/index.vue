<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotification, NButton, NInput, NTag, NSpin, NEmpty, NCard, NBadge } from 'naive-ui';
import { useAccessStore, useUserStore } from '@vben/stores';
import { IconifyIcon } from '@vben/icons';

import PageHeader from '#/components/page/PageHeader.vue';
import { getPluginsApi, installPluginApi, enablePluginApi } from '#/api/modules/plugin_framework';
import { generateAccess } from '#/router/access';
import { accessRoutes } from '#/router/routes';

const notification = useNotification();
const router = useRouter();
const loading = ref(false);
const plugins = ref<any[]>([]);
const category = ref('all');
const source = ref('all');
const searchQuery = ref('');
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const categories = [
  { key: 'all', label: '全部', icon: 'lucide:layout-grid' },
  { key: 'system', label: '系统', icon: 'lucide:cpu' },
  { key: 'media', label: '媒体', icon: 'lucide:film' },
  { key: 'download', label: '下载', icon: 'lucide:download' },
  { key: 'site', label: '站点', icon: 'lucide:globe' },
  { key: 'tool', label: '工具', icon: 'lucide:wrench' },
];

const sources = [
  { key: 'all', label: '全部来源' },
  { key: 'builtin', label: '内置' },
  { key: 'thirdparty', label: '第三方' },
];

const filteredPlugins = computed(() => {
  let result = plugins.value;
  if (category.value !== 'all') {
    result = result.filter((p) => p.category === category.value);
  }
  if (source.value === 'builtin') {
    result = result.filter((p) => p.is_builtin);
  } else if (source.value === 'thirdparty') {
    result = result.filter((p) => !p.is_builtin);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags?.some((t: string) => t.toLowerCase().includes(q))
    );
  }
  return result;
});

async function refreshSidebarMenus() {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const userInfo = userStore.userInfo;
  if (!userInfo) return;
  accessStore.setIsAccessChecked(false);
  const { accessibleMenus, accessibleRoutes } = await generateAccess({
    roles: userInfo.roles ?? [],
    router,
    routes: accessRoutes,
  });
  accessStore.setAccessMenus(accessibleMenus);
  accessStore.setAccessRoutes(accessibleRoutes);
  accessStore.setIsAccessChecked(true);
}

async function fetchPlugins() {
  loading.value = true;
  try {
    plugins.value = await getPluginsApi();
  } catch (err: any) {
    notification.error({ content: '获取插件列表失败', description: err?.message || '' });
  } finally {
    loading.value = false;
  }
}

async function handleInstall(pluginId: string) {
  try {
    await enablePluginApi(pluginId);
    notification.success({ content: '安装成功' });
    await fetchPlugins();
    await refreshSidebarMenus();
  } catch (err: any) {
    notification.error({ content: '安装失败', description: err?.message || '' });
  }
}

async function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploading.value = true;
  try {
    await installPluginApi(file);
    notification.success({ content: '安装成功' });
    await fetchPlugins();
    await refreshSidebarMenus();
  } catch (err: any) {
    notification.error({ content: '安装失败', description: err?.message || '' });
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

function getCategoryLabel(key: string) {
  return categories.find((c) => c.key === key)?.label || key;
}

onMounted(fetchPlugins);
</script>

<template>
  <div class="p-4">
    <PageHeader title="插件市场">
      <template #actions>
        <NButton
          size="small"
          :loading="uploading"
          @click="fileInput?.click()"
        >
          <template #icon>
            <IconifyIcon icon="lucide:upload" class="h-4 w-4" />
          </template>
          安装本地插件
        </NButton>
        <input
          ref="fileInput"
          type="file"
          accept=".zip"
          class="hidden"
          @change="handleFileUpload"
        />
      </template>
    </PageHeader>

    <!-- 搜索和筛选 -->
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <NInput
        v-model:value="searchQuery"
        placeholder="搜索插件名称、描述或标签..."
        class="w-full sm:w-72"
        clearable
      >
        <template #prefix>
          <IconifyIcon icon="lucide:search" class="h-4 w-4 text-muted-foreground" />
        </template>
      </NInput>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="market-cat-btn"
          :class="{ active: category === cat.key }"
          @click="category = cat.key"
        >
          <IconifyIcon :icon="cat.icon" class="h-3.5 w-3.5" />
          <span>{{ cat.label }}</span>
        </button>
      </div>

      <div class="flex flex-wrap gap-2 border-l border-border pl-4">
        <button
          v-for="src in sources"
          :key="src.key"
          class="market-cat-btn"
          :class="{ active: source === src.key }"
          @click="source = src.key"
        >
          <span>{{ src.label }}</span>
        </button>
      </div>
    </div>

    <!-- 插件卡片网格 -->
    <NSpin :show="loading">
      <div
        v-if="filteredPlugins.length > 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <NCard
          v-for="plugin in filteredPlugins"
          :key="plugin.id"
          size="small"
          class="market-card"
        >
          <div class="market-card-body">
            <!-- 图标和标题区 -->
            <div class="flex items-start gap-3">
              <div
                class="market-icon"
                :style="{
                  backgroundColor: plugin.color ? plugin.color + '18' : 'hsl(var(--primary) / 0.08)',
                  color: plugin.color || 'hsl(var(--primary))',
                }"
              >
                <IconifyIcon
                  :icon="plugin.icon || 'lucide:puzzle'"
                  class="h-6 w-6"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="market-name truncate">{{ plugin.name }}</span>
                  <NBadge
                    v-if="plugin.enabled"
                    value="已启用"
                    type="success"
                    size="small"
                  />
                </div>
                <div class="market-version">
                  v{{ plugin.version }}
                  <NTag
                    v-if="plugin.is_builtin"
                    size="tiny"
                    :bordered="false"
                    type="success"
                    class="ml-1"
                  >内置</NTag>
                  <NTag
                    v-else
                    size="tiny"
                    :bordered="false"
                    type="warning"
                    class="ml-1"
                  >第三方</NTag>
                </div>
              </div>
            </div>

            <!-- 描述 -->
            <div class="market-desc">
              {{ plugin.description || '暂无描述' }}
            </div>

            <!-- 标签 -->
            <div class="market-tags">
              <NTag
                v-for="tag in plugin.tags || []"
                :key="tag"
                size="tiny"
                :bordered="false"
                class="market-tag"
              >
                {{ tag }}
              </NTag>
              <NTag
                size="tiny"
                :bordered="false"
                type="info"
                class="market-tag"
              >
                {{ getCategoryLabel(plugin.category) }}
              </NTag>
            </div>

            <!-- 底部操作 -->
            <div class="market-footer">
              <span class="market-author">{{ plugin.author || '未知作者' }}</span>
              <NButton
                v-if="!plugin.installed"
                size="tiny"
                type="primary"
                @click="handleInstall(plugin.id)"
              >
                安装
              </NButton>
              <NTag
                v-else-if="!plugin.enabled"
                size="tiny"
                :bordered="false"
                type="default"
              >
                已安装
              </NTag>
            </div>
          </div>
        </NCard>
      </div>

      <!-- 空状态 -->
      <div v-else class="market-empty">
        <NEmpty description="暂无插件">
          <template #icon>
            <IconifyIcon icon="lucide:puzzle" class="h-12 w-12 text-muted-foreground/40" />
          </template>
          <template #extra>
            <div class="mt-2 text-sm text-muted-foreground">
              点击右上角「安装本地插件」上传插件包
            </div>
          </template>
        </NEmpty>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.market-cat-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 0.2);
  border: 1px solid transparent;
  transition: all 0.2s ease;
  cursor: pointer;
}

.market-cat-btn:hover {
  background-color: hsl(var(--muted) / 0.35);
  color: hsl(var(--foreground));
}

.market-cat-btn.active {
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 0.25);
}

.market-card {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid hsl(var(--border) / 0.6);
}

.market-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px hsl(var(--border) / 0.35);
  border-color: hsl(var(--border));
}

.market-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.market-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  flex-shrink: 0;
}

.market-name {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
}

.market-version {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.125rem;
}

.market-desc {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  min-height: 2.5rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.market-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

:deep(.market-tag) {
  font-size: 0.6875rem;
  padding: 0 0.375rem;
  height: 1.375rem;
  background-color: hsl(var(--muted) / 0.25);
  color: hsl(var(--muted-foreground));
}

.market-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border) / 0.4);
}

.market-author {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.market-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
}
</style>
