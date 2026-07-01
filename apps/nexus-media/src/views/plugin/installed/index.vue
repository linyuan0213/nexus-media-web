<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  NButton,
  NCard,
  NEmpty,
  NPopconfirm,
  NSpin,
  NSwitch,
  NTag,
} from 'naive-ui';

import {
  disablePluginApi,
  enablePluginApi,
  getPluginsApi,
  reloadPluginApi,
  runPluginApi,
  uninstallPluginApi,
} from '#/api/modules/plugin_framework';
import PageHeader from '#/components/page/PageHeader.vue';
import { generateAccess } from '#/router/access';
import { accessRoutes } from '#/router/routes';
import { useAppNotification } from '#/utils/notify';

import PluginConfigModal from './components/PluginConfigModal.vue';
import PluginLogDrawer from './components/PluginLogDrawer.vue';

const notification = useAppNotification();
const router = useRouter();
const loading = ref(false);
const plugins = ref<any[]>([]);
const viewMode = ref<'grid' | 'list'>('grid');
const statusFilter = ref<'all' | 'disabled' | 'enabled'>('all');
const activePlugin = ref<any>(null);
const configShow = ref(false);
const logShow = ref(false);
const logPluginId = ref('');

const statusOptions = [
  { key: 'all', label: '全部' },
  { key: 'enabled', label: '已启用' },
  { key: 'disabled', label: '已禁用' },
];

const installedPlugins = computed(() => {
  let result = plugins.value.filter((p) => p.installed);
  if (statusFilter.value === 'enabled') {
    result = result.filter((p) => p.enabled);
  } else if (statusFilter.value === 'disabled') {
    result = result.filter((p) => !p.enabled);
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
  } catch (error: any) {
    notification.error('获取插件列表失败', {
      description: error?.message || '',
    });
  } finally {
    loading.value = false;
  }
}

async function handleToggle(plugin: any) {
  try {
    if (plugin.enabled) {
      await disablePluginApi(plugin.id);
      notification.success(`${plugin.name} 已禁用`);
    } else {
      await enablePluginApi(plugin.id);
      notification.success(`${plugin.name} 已启用`);
    }
    await fetchPlugins();
    await refreshSidebarMenus();
  } catch (error: any) {
    notification.error('操作失败', { description: error?.message || '' });
  }
}

async function handleUninstall(plugin: any) {
  try {
    await uninstallPluginApi(plugin.id);
    notification.success(`${plugin.name} 已卸载`);
    await fetchPlugins();
    await refreshSidebarMenus();
  } catch (error: any) {
    notification.error('卸载失败', { description: error?.message || '' });
  }
}

async function handleRun(plugin: any) {
  try {
    await runPluginApi(plugin.id);
    notification.success(`${plugin.name} 运行任务已启动`);
  } catch (error: any) {
    notification.error('运行失败', { description: error?.message || '' });
  }
}

async function handleReload(plugin: any) {
  try {
    await reloadPluginApi(plugin.id);
    notification.success(`${plugin.name} 已重载`);
  } catch (error: any) {
    notification.error('重载失败', { description: error?.message || '' });
  }
}

function openConfig(plugin: any) {
  activePlugin.value = plugin;
  configShow.value = true;
}

function openLogs(pluginId: string) {
  logPluginId.value = pluginId;
  logShow.value = true;
}

onMounted(fetchPlugins);
</script>

<template>
  <div class="p-4">
    <PageHeader title="已安装插件">
      <template #actions>
        <div class="flex items-center gap-3">
          <!-- 状态筛选 -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in statusOptions"
              :key="opt.key"
              class="status-filter-btn"
              :class="{ active: statusFilter === opt.key }"
              @click="statusFilter = opt.key as 'all' | 'enabled' | 'disabled'"
            >
              <span>{{ opt.label }}</span>
            </button>
          </div>

          <div class="flex gap-2">
            <button
              class="view-toggle-btn"
              :class="{ active: viewMode === 'grid' }"
              @click="viewMode = 'grid'"
            >
              <IconifyIcon icon="lucide:layout-grid" class="h-4 w-4" />
            </button>
            <button
              class="view-toggle-btn"
              :class="{ active: viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              <IconifyIcon icon="lucide:list" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <!-- 网格视图 -->
      <div
        v-if="viewMode === 'grid' && installedPlugins.length > 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <NCard
          v-for="plugin in installedPlugins"
          :key="plugin.id"
          size="small"
          class="installed-card"
        >
          <div class="installed-card-body">
            <!-- 头部：图标 + 名称 + 状态 -->
            <div class="flex items-start gap-3">
              <div
                class="installed-icon"
                :style="{
                  backgroundColor: plugin.color
                    ? `${plugin.color}18`
                    : 'hsl(var(--primary) / 0.08)',
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
                  <div class="flex items-center gap-1.5">
                    <span class="installed-name truncate">{{
                      plugin.name
                    }}</span>
                    <NTag
                      v-if="plugin.is_builtin"
                      size="tiny"
                      :bordered="false"
                      type="success"
                    >
                      内置
                    </NTag>
                    <NTag v-else size="tiny" :bordered="false" type="warning">
                      第三方
                    </NTag>
                  </div>
                  <NSwitch
                    :value="plugin.enabled"
                    size="small"
                    @update:value="handleToggle(plugin)"
                  />
                </div>
                <div class="installed-version">v{{ plugin.version }}</div>
              </div>
            </div>

            <!-- 描述 -->
            <div class="installed-desc">
              {{ plugin.description || '暂无描述' }}
            </div>

            <!-- 标签 -->
            <div v-if="plugin.tags?.length" class="installed-tags">
              <NTag
                v-for="tag in plugin.tags"
                :key="tag"
                size="tiny"
                :bordered="false"
                class="installed-tag"
              >
                {{ tag }}
              </NTag>
            </div>

            <!-- 底部操作 -->
            <div class="installed-footer">
              <div class="flex gap-2">
                <NButton size="tiny" secondary @click="openConfig(plugin)">
                  <IconifyIcon
                    icon="lucide:settings"
                    class="mr-1 h-3 w-3"
                  />配置
                </NButton>
                <NButton size="tiny" secondary @click="openLogs(plugin.id)">
                  <IconifyIcon
                    icon="lucide:file-text"
                    class="mr-1 h-3 w-3"
                  />日志
                </NButton>
                <NButton
                  v-if="plugin.enabled && plugin.supports_run"
                  size="tiny"
                  secondary
                  @click="handleRun(plugin)"
                >
                  <IconifyIcon icon="lucide:play" class="mr-1 h-3 w-3" />运行
                </NButton>
                <NButton
                  v-if="plugin.enabled"
                  size="tiny"
                  secondary
                  @click="handleReload(plugin)"
                >
                  <IconifyIcon
                    icon="lucide:refresh-cw"
                    class="mr-1 h-3 w-3"
                  />重载
                </NButton>
              </div>
              <NPopconfirm @positive-click="handleUninstall(plugin)">
                <template #trigger>
                  <NButton size="tiny" quaternary type="error">
                    <IconifyIcon icon="lucide:trash-2" class="h-3.5 w-3.5" />
                  </NButton>
                </template>
                {{
                  plugin.is_builtin
                    ? '内置插件卸载后可在插件市场重新安装，确认卸载'
                    : '确认卸载'
                }}
                {{ plugin.name }}？
              </NPopconfirm>
            </div>
          </div>
        </NCard>
      </div>

      <!-- 列表视图 -->
      <div
        v-else-if="viewMode === 'list' && installedPlugins.length > 0"
        class="flex flex-col gap-3"
      >
        <div
          v-for="plugin in installedPlugins"
          :key="plugin.id"
          class="list-row"
        >
          <div class="list-row-main">
            <div
              class="list-row-icon"
              :style="{
                backgroundColor: plugin.color
                  ? `${plugin.color}18`
                  : 'hsl(var(--primary) / 0.08)',
                color: plugin.color || 'hsl(var(--primary))',
              }"
            >
              <IconifyIcon
                :icon="plugin.icon || 'lucide:puzzle'"
                class="h-5 w-5"
              />
            </div>
            <div class="list-row-info">
              <div class="list-row-name">
                {{ plugin.name }}
                <NTag
                  v-if="plugin.is_builtin"
                  size="tiny"
                  :bordered="false"
                  type="success"
                  class="ml-1"
                >
                  内置
                </NTag>
                <NTag
                  v-else
                  size="tiny"
                  :bordered="false"
                  type="warning"
                  class="ml-1"
                >
                  第三方
                </NTag>
              </div>
              <div class="list-row-meta">
                <span>v{{ plugin.version }}</span>
                <span v-if="plugin.description" class="list-row-meta-desc"
                  >· {{ plugin.description }}</span
                >
              </div>
            </div>
            <NSwitch
              :value="plugin.enabled"
              size="small"
              @update:value="handleToggle(plugin)"
            />
          </div>
          <div class="list-row-actions">
            <NButton size="tiny" secondary @click="openConfig(plugin)">
              <IconifyIcon icon="lucide:settings" class="mr-1 h-3 w-3" />配置
            </NButton>
            <NButton size="tiny" secondary @click="openLogs(plugin.id)">
              <IconifyIcon icon="lucide:file-text" class="mr-1 h-3 w-3" />日志
            </NButton>
            <NButton
              v-if="plugin.enabled && plugin.supports_run"
              size="tiny"
              secondary
              @click="handleRun(plugin)"
            >
              <IconifyIcon icon="lucide:play" class="mr-1 h-3 w-3" />运行
            </NButton>
            <NButton
              v-if="plugin.enabled"
              size="tiny"
              secondary
              @click="handleReload(plugin)"
            >
              <IconifyIcon icon="lucide:refresh-cw" class="mr-1 h-3 w-3" />重载
            </NButton>
            <NPopconfirm @positive-click="handleUninstall(plugin)">
              <template #trigger>
                <NButton size="tiny" quaternary type="error">
                  <IconifyIcon icon="lucide:trash-2" class="h-3.5 w-3.5" />
                </NButton>
              </template>
              {{
                plugin.is_builtin
                  ? '内置插件卸载后可在插件市场重新安装，确认卸载'
                  : '确认卸载'
              }}
              {{ plugin.name }}？
            </NPopconfirm>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="installed-empty">
        <NEmpty description="暂无已安装插件">
          <template #icon>
            <IconifyIcon
              icon="lucide:box"
              class="h-12 w-12 text-muted-foreground/40"
            />
          </template>
          <template #extra>
            <div class="mt-2 flex flex-col items-center gap-2">
              <span class="text-sm text-muted-foreground">暂无已安装插件</span>
              <NButton
                size="small"
                type="primary"
                @click="router.push('/plugin/market')"
              >
                <IconifyIcon icon="lucide:store" class="mr-1 h-4 w-4" />
                前往插件市场
              </NButton>
            </div>
          </template>
        </NEmpty>
      </div>
    </NSpin>

    <!-- 配置弹窗 -->
    <PluginConfigModal
      v-model:show="configShow"
      :plugin="activePlugin"
      @saved="fetchPlugins"
    />

    <!-- 日志抽屉 -->
    <PluginLogDrawer v-model:show="logShow" :plugin-id="logPluginId" />
  </div>
</template>

<style scoped>
.status-filter-btn {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background-color: hsl(var(--muted) / 20%);
  border: 1px solid transparent;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.status-filter-btn:hover {
  color: hsl(var(--foreground));
  background-color: hsl(var(--muted) / 35%);
}

.status-filter-btn.active {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 25%);
}

.view-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background-color: hsl(var(--muted) / 20%);
  border: 1px solid transparent;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.view-toggle-btn:hover {
  color: hsl(var(--foreground));
  background-color: hsl(var(--muted) / 35%);
}

.view-toggle-btn.active {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 25%);
}

.installed-card {
  border: 1px solid hsl(var(--border) / 60%);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.installed-card:hover {
  border-color: hsl(var(--border));
  box-shadow: 0 8px 24px hsl(var(--border) / 35%);
  transform: translateY(-3px);
}

.installed-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.installed-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
}

.installed-name {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

.installed-version {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.installed-desc {
  display: -webkit-box;
  min-height: 2.5rem;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.installed-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

:deep(.installed-tag) {
  height: 1.375rem;
  padding: 0 0.375rem;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 25%);
}

.installed-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  margin-top: 0.25rem;
  border-top: 1px solid hsl(var(--border) / 40%);
}

.installed-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
}

/* 列表视图 */
.list-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.list-row:hover {
  border-color: hsl(var(--border));
  box-shadow: 0 4px 12px hsl(var(--border) / 30%);
}

.list-row-main {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.list-row-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.625rem;
}

.list-row-info {
  flex: 1;
  min-width: 0;
}

.list-row-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.list-row-meta {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.list-row-meta-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-row-actions {
  display: flex;
  gap: 0.5rem;
  padding-left: 3.25rem;
}

@media (min-width: 640px) {
  .list-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .list-row-actions {
    padding-left: 0;
  }
}
</style>
