<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSpin,
  useMessage,
} from 'naive-ui';

import {
  clearTransferBlacklistApi,
  getFilterRulesApi,
  getSyncTasksApi,
  getSystemInfoApi,
  netTestApi,
  runSchedulerItemApi,
  runSyncTaskApi,
  truncateSubscriptionHistoryApi,
} from '#/api';
import { clearCacheApi, getCachesApi } from '#/api/modules/system';
import { requestClient } from '#/api/request';
import IdentifyResult from '#/components/media/IdentifyResult.vue';
import PageHeader from '#/components/page/PageHeader.vue';

const message = useMessage();

const systemInfo = ref<any>(null);
const runningIds = ref<Set<string>>(new Set());

const showNameTest = ref(false);
const showCacheManage = ref(false);
const nameTestInput = ref('');
const nameTestResult = ref<any>(null);
const nameTestLoading = ref(false);

interface CacheItem {
  name: string;
  type?: string;
  size?: number;
  maxsize?: number;
  hit_rate?: string;
  hits?: number;
  misses?: number;
  error?: string;
}
const caches = ref<CacheItem[]>([]);
const cacheLoading = ref(false);
const cacheClearing = ref<null | string>(null);

function cacheUsagePct(item: CacheItem): number {
  if (!item.maxsize || (item.size ?? 0) === 0) return 0;
  return Math.min(100, Math.round(((item.size ?? 0) / item.maxsize) * 100));
}

async function fetchCaches() {
  cacheLoading.value = true;
  try {
    const res: any = await getCachesApi();
    caches.value = (
      Array.isArray(res) ? res : (res?.data ?? [])
    ) as CacheItem[];
  } catch (error: any) {
    message.error(error?.message || '获取缓存列表失败');
  } finally {
    cacheLoading.value = false;
  }
}

async function handleClearCache(name?: string) {
  const label = name || '全部缓存';
  cacheClearing.value = name ?? 'all';
  try {
    await clearCacheApi(name);
    message.success(`已清理${label}`);
    await fetchCaches();
  } catch (error: any) {
    message.error(error?.message || `清理${label}失败`);
  } finally {
    cacheClearing.value = null;
  }
}

const showRuleTest = ref(false);
const ruleTestInput = ref('');
const ruleTestSubtitle = ref('');
const ruleTestSize = ref('');
const ruleTestGroup = ref('');
const ruleTestResult = ref<any>(null);
const ruleTestLoading = ref(false);
const filterGroups = ref<Array<{ id: number; name: string }>>([]);

interface NetTestTarget {
  target: string;
  status: 'error' | 'pending' | 'success';
  time: string;
  loading: boolean;
}

const NETTEST_TARGETS = [
  { target: 'api.themoviedb.org', label: 'api.themoviedb.org' },
  { target: 'www.themoviedb.org', label: 'www.themoviedb.org' },
  { target: 'image.tmdb.org', label: 'image.tmdb.org' },
  { target: 'webservice.fanart.tv', label: 'webservice.fanart.tv' },
  { target: 'api.telegram.org', label: 'api.telegram.org' },
  { target: 'qyapi.weixin.qq.com', label: 'qyapi.weixin.qq.com' },
  { target: 'frodo.douban.com', label: 'frodo.douban.com' },
  { target: 'api.github.com', label: 'api.github.com' },
  { target: 'api.openai.com', label: 'api.openai.com' },
];

const showNetTest = ref(false);
const netTestTargets = ref<NetTestTarget[]>(
  NETTEST_TARGETS.map((t) => ({
    target: t.target,
    status: 'pending',
    time: '-',
    loading: false,
  })),
);
const netTestAllLoading = ref(false);

const showCommand = ref(false);
const commands = ref<Array<{ id: string; name: string }>>([]);
const selectedCommand = ref('');
const commandLoading = ref(false);

const showBackup = ref(false);
const backupFile = ref<File | null>(null);
const backupFilePath = ref('');
const backupLoading = ref(false);
const restoreLoading = ref(false);
const isDragging = ref(false);

const showConfirm = ref(false);
const confirmTitle = ref('');
const confirmContent = ref('');
const confirmAction = ref<() => void>(() => {});
const confirmLoading = ref(false);

const showSync = ref(false);
const syncPaths = ref<
  Array<{ enabled: boolean; from: string; id: string; to: string }>
>([]);
const selectedSyncIds = ref<string[]>([]);
const syncLoading = ref(false);

interface ServiceItem {
  id: string;
  name: string;
  icon: string;
  time: string;
  color: string;
  action: 'api' | 'backup' | 'modal' | 'scheduler' | 'sync';
  item?: string;
  modal?: string;
  api?: () => Promise<any>;
}

const services = ref<ServiceItem[]>([
  {
    id: 'subscription_monitor',
    name: '订阅监控',
    icon: 'lucide:cloud-download',
    time: '',
    color: 'blue',
    action: 'scheduler',
    item: 'subscription_monitor',
  },
  {
    id: 'pttransfer',
    name: '下载文件转移',
    icon: 'lucide:replace',
    time: '',
    color: 'green',
    action: 'scheduler',
    item: 'pttransfer',
  },
  {
    id: 'sync',
    name: '目录同步',
    icon: 'lucide:refresh-cw',
    time: '实时监控',
    color: 'orange',
    action: 'modal',
    modal: 'sync',
  },
  {
    id: 'blacklist',
    name: '清理转移缓存',
    icon: 'lucide:eraser',
    time: '手动',
    color: 'red',
    action: 'api',
    api: clearTransferBlacklistApi,
  },
  {
    id: 'subscription_history',
    name: '清理订阅缓存',
    icon: 'lucide:eraser',
    time: '手动',
    color: 'purple',
    action: 'api',
    api: truncateSubscriptionHistoryApi,
  },
  {
    id: 'nametest',
    name: '名称识别测试',
    icon: 'lucide:type',
    time: '手动',
    color: 'lime',
    action: 'modal',
    modal: 'nametest',
  },
  {
    id: 'cachemanage',
    name: '缓存管理',
    icon: 'lucide:database-zap',
    time: '手动',
    color: 'orange',
    action: 'modal',
    modal: 'cachemanage',
  },
  {
    id: 'ruletest',
    name: '过滤规则测试',
    icon: 'lucide:sliders-horizontal',
    time: '手动',
    color: 'yellow',
    action: 'modal',
    modal: 'ruletest',
  },
  {
    id: 'nettest',
    name: '网络连通性测试',
    icon: 'lucide:network',
    time: '手动',
    color: 'cyan',
    action: 'modal',
    modal: 'nettest',
  },
  {
    id: 'backup',
    name: '备份&恢复',
    icon: 'lucide:archive',
    time: '手动',
    color: 'indigo',
    action: 'modal',
    modal: 'backup',
  },
  {
    id: 'command',
    name: '系统命令',
    icon: 'lucide:terminal',
    time: '手动',
    color: 'gray',
    action: 'modal',
    modal: 'command',
  },
]);

const stats = computed(() => [
  {
    label: '系统版本',
    value: systemInfo.value?.version || '-',
    icon: 'lucide:tag',
    color: 'var(--tblr-primary)',
  },
  {
    label: '运行时长',
    value: systemInfo.value?.uptime || '-',
    icon: 'lucide:clock',
    color: 'var(--tblr-teal)',
  },
  {
    label: 'Python',
    value: systemInfo.value?.python_version || '-',
    icon: 'lucide:code-2',
    color: 'var(--tblr-purple)',
  },
  {
    label: '内存占用',
    value: systemInfo.value?.memory_mb
      ? `${systemInfo.value.memory_mb} MB`
      : '-',
    icon: 'lucide:cpu',
    color: 'var(--tblr-orange)',
  },
]);

// 服务卡片 tabler 配色（低透明度底色 + 实色图标）
const SERVICE_COLOR_MAP: Record<string, { bg: string; fg: string }> = {
  blue: { bg: 'rgb(32 107 196 / 12%)', fg: 'var(--tblr-primary)' },
  green: { bg: 'rgb(47 179 68 / 12%)', fg: 'var(--tblr-success)' },
  red: { bg: 'rgb(214 57 57 / 12%)', fg: 'var(--tblr-danger)' },
  purple: { bg: 'rgb(174 62 201 / 12%)', fg: 'var(--tblr-purple)' },
  lime: { bg: 'rgb(116 184 22 / 14%)', fg: 'var(--tblr-lime)' },
  orange: { bg: 'rgb(247 103 7 / 12%)', fg: 'var(--tblr-orange)' },
  yellow: { bg: 'rgb(247 103 7 / 12%)', fg: 'var(--tblr-warning)' },
  cyan: { bg: 'rgb(23 162 184 / 12%)', fg: 'var(--tblr-cyan)' },
  indigo: { bg: 'rgb(66 153 225 / 12%)', fg: 'var(--tblr-info)' },
  gray: { bg: 'hsl(var(--accent))', fg: 'hsl(var(--muted-foreground))' },
};

function serviceColor(svc: ServiceItem) {
  return SERVICE_COLOR_MAP[svc.color] ?? SERVICE_COLOR_MAP.blue!;
}

async function fetchSystemInfo() {
  try {
    const res = await getSystemInfoApi();
    systemInfo.value = res || {};
  } catch (error: any) {
    message.error(error?.message || '获取系统信息失败');
  }
}

async function handleServiceClick(svc: ServiceItem) {
  if (runningIds.value.has(svc.id)) return;

  switch (svc.action) {
    case 'api': {
      if (!svc.api) break;
      if (svc.id === 'blacklist') {
        showConfirmDialog(
          '确认',
          '清理文件整理缓存后，已转移过的文件允许重新转移（包括识别错误的文件），是否确认？',
          async () => {
            runningIds.value.add(svc.id);
            try {
              await (svc.api as () => Promise<any>)();
              message.success(`${svc.name} 执行成功`);
            } catch (error: any) {
              message.error(error?.message || '执行失败');
            } finally {
              runningIds.value.delete(svc.id);
            }
          },
        );
      } else if (svc.id === 'subscription_history') {
        showConfirmDialog(
          '确认',
          '清理订阅缓存后，已下载过的订阅记录将被清除，是否确认？',
          async () => {
            runningIds.value.add(svc.id);
            try {
              await (svc.api as () => Promise<any>)();
              message.success(`${svc.name} 执行成功`);
            } catch (error: any) {
              message.error(error?.message || '执行失败');
            } finally {
              runningIds.value.delete(svc.id);
            }
          },
        );
      } else {
        runningIds.value.add(svc.id);
        try {
          await svc.api();
          message.success(`${svc.name} 执行成功`);
        } catch (error: any) {
          message.error(error?.message || '执行失败');
        } finally {
          runningIds.value.delete(svc.id);
        }
      }
      break;
    }

    case 'backup': {
      openModal('backup');
      break;
    }

    case 'modal': {
      openModal(svc.modal);
      break;
    }

    case 'scheduler': {
      if (!svc.item) break;
      runningIds.value.add(svc.id);
      try {
        await runSchedulerItemApi(svc.item);
        message.success(`${svc.name} 已触发执行`);
      } catch (error: any) {
        message.error(error?.message || '执行失败');
      } finally {
        runningIds.value.delete(svc.id);
      }
      break;
    }
  }
}

function openModal(modal?: string) {
  switch (modal) {
    case 'backup': {
      showBackup.value = true;
      backupFile.value = null;
      backupFilePath.value = '';
      break;
    }
    case 'cachemanage': {
      showCacheManage.value = true;
      fetchCaches();
      break;
    }
    case 'command': {
      showCommand.value = true;
      selectedCommand.value = '';
      fetchCommands();
      break;
    }
    case 'nametest': {
      showNameTest.value = true;
      nameTestInput.value = '';
      nameTestResult.value = null;
      break;
    }
    case 'nettest': {
      showNetTest.value = true;
      netTestTargets.value = NETTEST_TARGETS.map((t) => ({
        target: t.target,
        status: 'pending' as const,
        time: '-',
        loading: false,
      }));
      break;
    }
    case 'ruletest': {
      showRuleTest.value = true;
      ruleTestInput.value = '';
      ruleTestSubtitle.value = '';
      ruleTestSize.value = '';
      ruleTestGroup.value = '';
      ruleTestResult.value = null;
      fetchFilterGroups();
      break;
    }
    case 'sync': {
      showSync.value = true;
      selectedSyncIds.value = [];
      fetchSyncPaths();
      break;
    }
  }
}

function showConfirmDialog(title: string, content: string, action: () => void) {
  confirmTitle.value = title;
  confirmContent.value = content;
  confirmAction.value = action;
  showConfirm.value = true;
}

async function handleConfirm() {
  confirmLoading.value = true;
  try {
    await confirmAction.value();
  } finally {
    confirmLoading.value = false;
    showConfirm.value = false;
  }
}

async function fetchCommands() {
  commandLoading.value = true;
  try {
    const res = await requestClient.post<Array<{ id: string; name: string }>>(
      '/system/commands',
      {},
    );
    commands.value = res || [];
  } catch (error: any) {
    message.error(error?.message || '获取命令列表失败');
  } finally {
    commandLoading.value = false;
  }
}

async function fetchFilterGroups() {
  try {
    const res = await getFilterRulesApi();
    const data = Array.isArray(res) ? res : (res as any)?.data || [];
    filterGroups.value = data.map((g: any) => ({ id: g.id, name: g.name }));
  } catch (error: any) {
    message.error(error?.message || '获取规则组失败');
  }
}

async function fetchSyncPaths() {
  try {
    const res = await getSyncTasksApi();
    const data = res || {};
    syncPaths.value = Object.entries(data)
      .map(([id, item]: [string, any]) => ({
        id,
        from: item.source || '',
        to: item.dest || '',
        enabled: !!item.enabled,
      }))
      .filter((p) => p.from);
  } catch (error: any) {
    message.error(error?.message || '获取同步目录失败');
  }
}

function selectAllSync() {
  selectedSyncIds.value =
    selectedSyncIds.value.length === syncPaths.value.length
      ? []
      : syncPaths.value.map((p) => p.id);
}

async function handleSyncRun() {
  if (selectedSyncIds.value.length === 0) {
    message.warning('请选择要同步的目录');
    return;
  }
  syncLoading.value = true;
  try {
    await Promise.all(selectedSyncIds.value.map((id) => runSyncTaskApi(id)));
    message.success('目录同步已触发执行');
    showSync.value = false;
  } catch (error: any) {
    message.error(error?.message || '执行失败');
  } finally {
    syncLoading.value = false;
  }
}

const showNameTestResult = ref(false);

async function handleNameTest() {
  if (!nameTestInput.value.trim()) {
    message.warning('请输入名称');
    return;
  }
  nameTestLoading.value = true;
  showNameTestResult.value = false;
  try {
    const res = await requestClient.post(
      '/media/name_test',
      { name: nameTestInput.value },
      { timeout: 60_000 },
    );
    nameTestResult.value = res;
    showNameTestResult.value = true;
  } catch (error: any) {
    message.error(error?.message || '测试失败');
  } finally {
    nameTestLoading.value = false;
  }
}

async function handleRuleTest() {
  if (!ruleTestInput.value.trim()) {
    message.warning('请输入标题');
    return;
  }
  ruleTestLoading.value = true;
  try {
    const res = await requestClient.post<{
      flag: boolean;
      order: number;
      text: string;
    }>('/filter/rules/test', {
      title: ruleTestInput.value,
      subtitle: ruleTestSubtitle.value,
      size: ruleTestSize.value,
      rulegroup: ruleTestGroup.value || undefined,
    });
    ruleTestResult.value = res;
  } catch (error: any) {
    message.error(error?.message || '测试失败');
  } finally {
    ruleTestLoading.value = false;
  }
}

async function handleNetTest() {
  netTestAllLoading.value = true;
  await Promise.all(
    netTestTargets.value.map(async (item) => {
      item.loading = true;
      try {
        const res = await netTestApi(item.target);
        item.status = res?.res ? 'success' : 'error';
        item.time = res?.time || '-';
      } catch {
        item.status = 'error';
        item.time = '-';
      } finally {
        item.loading = false;
      }
    }),
  );
  netTestAllLoading.value = false;
}

async function handleBackupDownload() {
  backupLoading.value = true;
  try {
    const blob = await requestClient.download('/system/backup', {
      method: 'POST',
      timeout: 300_000, // 全库导出 + 打包可能耗时较长，覆盖默认 10s 超时
    });
    // 失败时后端返回 JSON 错误体（responseType 强制为 blob），需识别后抛错
    if (blob.type.includes('application/json')) {
      const err = JSON.parse(await blob.text());
      throw new Error(err?.message || err?.msg || '备份失败');
    }
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexus_media_backup_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    message.success('备份已下载');
  } catch (error: any) {
    message.error(error?.message || '备份失败');
  } finally {
    backupLoading.value = false;
  }
}

function handleFileDrop(e: DragEvent) {
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    backupFile.value = files[0] || null;
    if (files[0]) uploadBackupFile(files[0]);
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    backupFile.value = target.files[0] || null;
    if (target.files[0]) uploadBackupFile(target.files[0]);
  }
}

async function uploadBackupFile(file: File) {
  try {
    const res = await requestClient.upload('/system/backup/upload', {
      file,
      timeout: 300_000, // 备份 zip 可能较大
    });
    if (res?.filepath) {
      backupFilePath.value = res.filepath;
      message.success('文件上传成功');
    } else {
      message.error('文件上传失败');
    }
  } catch (error: any) {
    message.error(error?.message || '文件上传失败');
  }
}

async function handleRestore() {
  if (!backupFilePath.value) {
    message.warning('请先上传备份文件');
    return;
  }
  restoreLoading.value = true;
  try {
    await requestClient.post(
      '/system/backup/restore',
      { file_name: backupFilePath.value },
      { timeout: 300_000 }, // 恢复为全库导入，耗时较长
    );
    message.success('配置恢复成功');
    showBackup.value = false;
  } catch (error: any) {
    message.error(error?.message || '恢复失败');
  } finally {
    restoreLoading.value = false;
  }
}

async function handleCommand() {
  if (!selectedCommand.value) {
    message.warning('请选择命令');
    return;
  }
  commandLoading.value = true;
  try {
    await requestClient.post('/system/scheduler/run', {
      item: selectedCommand.value,
    });
    message.success('命令已执行');
    showCommand.value = false;
  } catch (error: any) {
    message.error(error?.message || '执行失败');
  } finally {
    commandLoading.value = false;
  }
}

onMounted(() => {
  fetchSystemInfo();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="服务面板">
      <template #actions>
        <NButton @click="fetchSystemInfo">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
          </template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <!-- 系统状态概览 -->
    <div class="stats-overview">
      <div v-for="(stat, idx) in stats" :key="idx" class="stat-box">
        <div class="stat-box-icon" :style="{ color: stat.color }">
          <IconifyIcon :icon="stat.icon" />
        </div>
        <div class="stat-box-content">
          <div class="stat-box-value">{{ stat.value }}</div>
          <div class="stat-box-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <!-- 服务卡片网格 -->
    <div class="service-grid">
      <div
        v-for="svc in services"
        :key="svc.id"
        class="service-card"
        :class="{ 'service-card--running': runningIds.has(svc.id) }"
        @click="handleServiceClick(svc)"
      >
        <div class="service-card-content">
          <div
            class="service-icon-wrap"
            :style="{
              backgroundColor: serviceColor(svc).bg,
              color: serviceColor(svc).fg,
            }"
          >
            <IconifyIcon :icon="svc.icon" class="service-icon" />
          </div>
          <div class="service-info">
            <div class="service-name">{{ svc.name }}</div>
            <div class="service-time">{{ svc.time }}</div>
          </div>
        </div>
        <div v-if="runningIds.has(svc.id)" class="service-running-indicator">
          <span class="running-dot"></span>
        </div>
      </div>
    </div>

    <!-- 名称识别测试弹窗 -->
    <NModal
      v-model:show="showNameTest"
      title="名称识别测试"
      preset="card"
      style="width: 640px; max-width: 95vw"
    >
      <NSpace vertical size="large">
        <div>
          <label class="form-label">资源名称</label>
          <NInput
            v-model:value="nameTestInput"
            placeholder="请输入电影/电视剧名称"
            @keyup.enter="handleNameTest"
          />
        </div>

        <IdentifyResult
          v-model:show="showNameTestResult"
          :loading="nameTestLoading"
          :result="nameTestResult || {}"
        />

        <div class="form-actions">
          <NButton @click="showNameTest = false"> 取消 </NButton>
          <NButton
            type="primary"
            :loading="nameTestLoading"
            @click="handleNameTest"
          >
            识别
          </NButton>
        </div>
      </NSpace>
    </NModal>

    <!-- 缓存管理弹窗 -->
    <NModal
      v-model:show="showCacheManage"
      title="缓存管理"
      preset="card"
      style="width: 720px; max-width: 95vw"
    >
      <NSpace vertical size="large">
        <div class="cache-header">
          <div class="cache-header-info">
            <div class="cache-header-title">识别 / TMDB 等缓存</div>
            <div class="cache-header-text">清理后将在下次访问时自动重建</div>
          </div>
          <NPopconfirm @positive-click="handleClearCache()">
            <template #trigger>
              <NButton
                size="small"
                type="error"
                :loading="cacheClearing === 'all'"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:trash-2" class="h-4 w-4" />
                </template>
                清理全部
              </NButton>
            </template>
            确定清理全部缓存吗？
          </NPopconfirm>
        </div>

        <NSpin :show="cacheLoading">
          <div class="cache-list">
            <div v-for="item in caches" :key="item.name" class="cache-item">
              <div class="cache-item-main">
                <div class="cache-item-top">
                  <span class="cache-item-name">{{ item.name }}</span>
                  <span v-if="item.type" class="cache-item-type">{{
                    item.type
                  }}</span>
                </div>
                <div v-if="item.error" class="cache-item-error">
                  {{ item.error }}
                </div>
                <template v-else>
                  <div class="cache-item-stats">
                    <span>{{ item.size ?? 0 }} / {{ item.maxsize ?? 0 }}</span>
                    <span class="cache-item-sep">·</span>
                    <span>命中率 {{ item.hit_rate ?? '0.00%' }}</span>
                  </div>
                  <div class="cache-item-bar">
                    <div
                      class="cache-item-bar-fill"
                      :class="cacheUsagePct(item) >= 80 ? 'is-warn' : ''"
                      :style="{ width: `${cacheUsagePct(item)}%` }"
                    ></div>
                  </div>
                </template>
              </div>
              <NPopconfirm @positive-click="handleClearCache(item.name)">
                <template #trigger>
                  <NButton size="tiny" :loading="cacheClearing === item.name">
                    清理
                  </NButton>
                </template>
                确定清理「{{ item.name }}」缓存吗？
              </NPopconfirm>
            </div>
            <div
              v-if="!cacheLoading && caches.length === 0"
              class="cache-empty"
            >
              暂无缓存
            </div>
          </div>
        </NSpin>
      </NSpace>
    </NModal>

    <!-- 过滤规则测试弹窗 -->
    <NModal
      v-model:show="showRuleTest"
      title="过滤规则测试"
      preset="card"
      style="width: 600px; max-width: 95vw"
    >
      <NSpace vertical size="large">
        <div class="rule-test-form">
          <div class="form-row">
            <div class="form-col">
              <label class="form-label">
                标题 <span class="required">*</span>
              </label>
              <NInput v-model:value="ruleTestInput" placeholder="种子名称" />
            </div>
            <div class="form-col form-col--small">
              <label class="form-label">
                大小(GB) <span class="required">*</span>
              </label>
              <NInput v-model:value="ruleTestSize" placeholder="种子大小" />
            </div>
            <div class="form-col form-col--small">
              <label class="form-label">
                过滤规则 <span class="required">*</span>
              </label>
              <NSelect
                v-model:value="ruleTestGroup"
                :options="
                  filterGroups.map((g) => ({
                    label: g.name,
                    value: String(g.id),
                  }))
                "
                placeholder="请选择"
                clearable
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-col form-col--full">
              <label class="form-label"> 副标题 </label>
              <NInput
                v-model:value="ruleTestSubtitle"
                type="textarea"
                placeholder="种子描述"
                :rows="3"
              />
            </div>
          </div>
          <div class="form-actions">
            <NButton @click="showRuleTest = false"> 取消 </NButton>
            <NButton
              type="primary"
              :loading="ruleTestLoading"
              @click="handleRuleTest"
            >
              测试
            </NButton>
          </div>
        </div>
        <div v-if="ruleTestResult" class="test-result">
          <div class="result-header">测试结果</div>
          <div class="result-body">
            <div class="result-item">
              <span class="result-label"> 匹配状态: </span>
              <span
                class="result-value"
                :class="ruleTestResult.flag ? 'result-success' : 'result-fail'"
              >
                {{ ruleTestResult.flag ? '通过' : '未通过' }}
              </span>
            </div>
            <div v-if="ruleTestResult.text" class="result-item">
              <span class="result-label"> 规则: </span>
              <span class="result-value">
                {{ ruleTestResult.text }}
              </span>
            </div>
            <div v-if="ruleTestResult.order !== undefined" class="result-item">
              <span class="result-label"> 优先级: </span>
              <span class="result-value">
                {{ ruleTestResult.order }}
              </span>
            </div>
          </div>
        </div>
      </NSpace>
    </NModal>

    <!-- 网络连通性测试弹窗 -->
    <NModal
      v-model:show="showNetTest"
      title="网络连通性测试"
      preset="card"
      style="width: 560px; max-width: 95vw"
    >
      <div class="nettest-table">
        <div class="nettest-header">
          <div class="nettest-col nettest-col--target">测试对象</div>
          <div class="nettest-col nettest-col--status">连通性</div>
          <div class="nettest-col nettest-col--time">耗时</div>
        </div>
        <div
          v-for="(item, idx) in netTestTargets"
          :key="idx"
          class="nettest-row"
          :class="{ 'nettest-row--alt': idx % 2 === 1 }"
        >
          <div class="nettest-col nettest-col--target">
            <div class="nettest-target">
              <IconifyIcon
                :icon="
                  item.target.includes('tmdb')
                    ? 'lucide:database'
                    : item.target.includes('fanart')
                      ? 'lucide:image'
                      : item.target.includes('telegram')
                        ? 'lucide:send'
                        : item.target.includes('weixin')
                          ? 'lucide:message-circle'
                          : item.target.includes('douban')
                            ? 'lucide:film'
                            : 'lucide:globe'
                "
                class="nettest-target-icon"
              />
              <span class="nettest-target-text">
                {{ item.target }}
              </span>
            </div>
          </div>
          <div class="nettest-col nettest-col--status">
            <span v-if="item.loading" class="nettest-loading"> 测试中... </span>
            <span
              v-else-if="item.status === 'success'"
              class="nettest-status nettest-status--success"
            >
              <IconifyIcon
                icon="lucide:check-circle"
                class="nettest-status-icon"
              />
              正常
            </span>
            <span
              v-else-if="item.status === 'error'"
              class="nettest-status nettest-status--error"
            >
              <IconifyIcon icon="lucide:x-circle" class="nettest-status-icon" />
              异常
            </span>
            <span v-else class="nettest-status"> -- </span>
          </div>
          <div class="nettest-col nettest-col--time">
            {{ item.time }}
          </div>
        </div>
      </div>
      <div class="nettest-actions">
        <NButton @click="showNetTest = false"> 取消 </NButton>
        <NButton
          type="primary"
          :loading="netTestAllLoading"
          @click="handleNetTest"
        >
          测试
        </NButton>
      </div>
    </NModal>

    <!-- 确认弹窗 -->
    <NModal
      v-model:show="showConfirm"
      preset="dialog"
      :title="confirmTitle"
      type="warning"
    >
      <div style="line-height: 1.6">
        {{ confirmContent }}
      </div>
      <template #action>
        <NSpace>
          <NButton @click="showConfirm = false"> 取消 </NButton>
          <NButton
            type="error"
            :loading="confirmLoading"
            @click="handleConfirm"
          >
            确定
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 备份恢复弹窗 -->
    <NModal
      v-model:show="showBackup"
      title="备份&恢复"
      preset="card"
      style="width: 500px; max-width: 95vw"
    >
      <NSpace vertical size="large">
        <div
          class="backup-upload-area"
          :class="{ 'backup-upload-area--dragging': isDragging }"
          @dragover.prevent
          @dragenter.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleFileDrop"
          @click="($refs.backupInput as any)?.click()"
        >
          <input
            ref="backupInput"
            type="file"
            accept=".zip"
            style="display: none"
            @change="handleFileSelect"
          />
          <IconifyIcon icon="lucide:upload-cloud" class="backup-upload-icon" />
          <div class="backup-upload-text">
            <div class="backup-upload-title">
              {{ backupFile ? backupFile.name : '上传备份文件' }}
            </div>
            <div class="backup-upload-subtitle">
              {{
                backupFile
                  ? '点击或拖拽可更换文件'
                  : '点击或者拖动备份文件到此处'
              }}
            </div>
          </div>
        </div>
        <div class="backup-actions">
          <NButton
            type="primary"
            :loading="backupLoading"
            @click="handleBackupDownload"
          >
            <template #icon>
              <IconifyIcon icon="lucide:download" class="h-4 w-4" />
            </template>
            备份当前配置
          </NButton>
          <NButton
            type="error"
            :loading="restoreLoading"
            :disabled="!backupFilePath"
            @click="handleRestore"
          >
            <template #icon>
              <IconifyIcon icon="lucide:rotate-ccw" class="h-4 w-4" />
            </template>
            恢复配置
          </NButton>
        </div>
      </NSpace>
    </NModal>

    <!-- 目录同步弹窗 -->
    <NModal
      v-model:show="showSync"
      title="手动目录同步"
      preset="card"
      style="width: 560px; max-width: 95vw"
    >
      <NSpace vertical size="large">
        <div>
          <div class="sync-header">
            <span class="sync-title">源目录</span>
            <NButton
              v-if="syncPaths.length > 0"
              text
              size="small"
              @click="selectAllSync"
            >
              {{
                selectedSyncIds.length === syncPaths.length
                  ? '取消全选'
                  : '全选'
              }}
            </NButton>
          </div>
          <div v-if="syncPaths.length === 0" class="sync-empty">
            暂无配置同步目录
          </div>
          <NCheckboxGroup v-else v-model:value="selectedSyncIds">
            <NSpace vertical style="width: 100%">
              <NCheckbox
                v-for="path in syncPaths"
                :key="path.id"
                :value="path.id"
                class="sync-checkbox"
              >
                <div class="sync-checkbox-content">
                  <div class="sync-checkbox-path">{{ path.from }}</div>
                  <div v-if="path.to" class="sync-checkbox-target">
                    → {{ path.to }}
                  </div>
                </div>
              </NCheckbox>
            </NSpace>
          </NCheckboxGroup>
        </div>
        <div class="sync-actions">
          <NButton @click="showSync = false"> 取消 </NButton>
          <NButton
            type="primary"
            :loading="syncLoading"
            :disabled="selectedSyncIds.length === 0"
            @click="handleSyncRun"
          >
            开始同步
          </NButton>
        </div>
      </NSpace>
    </NModal>

    <!-- 系统命令弹窗 -->
    <NModal
      v-model:show="showCommand"
      title="系统命令"
      preset="card"
      :style="{ width: '500px', maxWidth: '92vw' }"
    >
      <NSpace vertical>
        <NSelect
          v-model:value="selectedCommand"
          :options="commands.map((c) => ({ label: c.name, value: c.id }))"
          placeholder="选择命令"
        />
        <NButton
          type="primary"
          :loading="commandLoading"
          @click="handleCommand"
        >
          执行
        </NButton>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.875rem;
  margin-bottom: 1.5rem;
}

.stat-box {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  padding: 1rem 1.125rem;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.625rem;
  box-shadow: var(--tblr-box-shadow-card);
  transition: all 0.2s ease;
}

.stat-box:hover {
  border-color: hsl(var(--primary) / 25%);
  box-shadow: var(--tblr-box-shadow);
  transform: translateY(-1px);
}

.stat-box-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  font-size: 1.125rem;
}

.stat-box-content {
  min-width: 0;
}

.stat-box-value {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.25;
  color: hsl(var(--card-foreground));
}

.stat-box-label {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.875rem;
}

.service-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.125rem;
  cursor: pointer;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.625rem;
  box-shadow: var(--tblr-box-shadow-card);
  transition: all 0.2s ease;
}

.service-card:hover {
  border-color: hsl(var(--primary) / 30%);
  box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 10%);
  transform: translateY(-1px);
}

.service-card--running {
  cursor: not-allowed;
  opacity: 0.7;
}

.service-card-content {
  display: flex;
  flex: 1;
  gap: 0.875rem;
  align-items: center;
  min-width: 0;
}

.service-icon-wrap {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
}

.service-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.service-info {
  min-width: 0;
}

.service-name {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.3;
  color: hsl(var(--card-foreground));
}

.service-time {
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.service-running-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
}

.running-dot {
  width: 0.5rem;
  height: 0.5rem;
  background-color: hsl(var(--success));
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

.test-result {
  max-height: 200px;
  padding: 0.75rem;
  margin-top: 0.75rem;
  overflow: auto;
  font-size: 0.8125rem;
  background-color: hsl(var(--accent));
  border-radius: 0.375rem;
}

.test-result pre {
  margin: 0;
  word-break: break-all;
  white-space: pre-wrap;
}

/* 过滤规则测试 */
.rule-test-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.form-col {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.form-col--small {
  flex: 0 0 140px;
}

.form-col--full {
  flex: 1 1 100%;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.cache-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.cache-header-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.cache-header-text {
  margin-top: 0.125rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.cache-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  max-height: 62vh;
  overflow-y: auto;
}

.cache-item {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.875rem;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.625rem;
  transition: border-color 0.2s ease;
}

.cache-item:hover {
  border-color: hsl(var(--primary) / 40%);
}

.cache-item-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.cache-item-top {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.cache-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.cache-item-type {
  flex-shrink: 0;
  padding: 0.0625rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--accent));
  border-radius: 0.25rem;
}

.cache-item-stats {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.cache-item-sep {
  color: hsl(var(--border));
}

.cache-item-bar {
  height: 0.25rem;
  overflow: hidden;
  background-color: hsl(var(--accent));
  border-radius: 999px;
}

.cache-item-bar-fill {
  height: 100%;
  background-color: hsl(var(--primary));
  border-radius: 999px;
  transition: width 0.4s ease;
}

.cache-item-bar-fill.is-warn {
  background-color: hsl(var(--destructive));
}

.cache-item-error {
  font-size: 0.75rem;
  color: hsl(var(--destructive));
}

.cache-empty {
  padding: 2.5rem 0;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

@media (max-width: 640px) {
  .cache-item {
    flex-direction: column;
    align-items: stretch;
  }
}

.required {
  color: hsl(var(--destructive));
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.result-header {
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.result-body {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.result-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.result-label {
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.result-value {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.result-success {
  color: hsl(var(--success));
}

.result-fail {
  color: hsl(var(--destructive));
}

/* 网络连通性测试 */
.nettest-table {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}

.nettest-header {
  display: flex;
  padding: 0.625rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--accent));
}

.nettest-row {
  display: flex;
  align-items: center;
  padding: 0.75rem 0.875rem;
  font-size: 0.8125rem;
  border-top: 1px solid hsl(var(--border));
}

.nettest-row--alt {
  background-color: hsl(var(--accent) / 30%);
}

.nettest-col {
  display: flex;
  align-items: center;
}

.nettest-col--target {
  flex: 1;
  min-width: 0;
}

.nettest-col--status {
  flex: 0 0 80px;
  justify-content: center;
}

.nettest-col--time {
  flex: 0 0 80px;
  justify-content: center;
  color: hsl(var(--muted-foreground));
}

.nettest-target {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.nettest-target-icon {
  flex-shrink: 0;
  width: 1.125rem;
  height: 1.125rem;
  color: hsl(var(--primary));
}

.nettest-target-text {
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.nettest-loading {
  font-size: 0.75rem;
  color: hsl(var(--primary));
}

.nettest-status {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  font-size: 0.75rem;
}

.nettest-status--success {
  color: hsl(var(--success));
}

.nettest-status--error {
  color: hsl(var(--destructive));
}

.nettest-status-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.nettest-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

/* 备份恢复 */
.backup-upload-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  cursor: pointer;
  background-color: hsl(var(--accent) / 30%);
  border: 2px dashed hsl(var(--border));
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.backup-upload-area:hover {
  background-color: hsl(var(--accent) / 50%);
  border-color: hsl(var(--primary) / 40%);
}

.backup-upload-area--dragging {
  background-color: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
}

.backup-upload-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: hsl(var(--primary));
}

.backup-upload-text {
  text-align: center;
}

.backup-upload-title {
  font-size: 1rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.backup-upload-subtitle {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.backup-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

/* 目录同步 */
.sync-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.sync-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.sync-empty {
  padding: 2rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
  border: 1px dashed hsl(var(--border));
  border-radius: 0.5rem;
}

.sync-checkbox {
  width: 100%;
}

.sync-checkbox :deep(.n-checkbox-box-wrapper) {
  align-self: flex-start;
  margin-top: 0.375rem;
}

.sync-checkbox :deep(.n-checkbox__label) {
  width: 100%;
  padding: 0 0 0 0.5rem;
}

.sync-checkbox-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.5rem 0;
}

.sync-checkbox-path {
  font-size: 0.9375rem;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
  word-break: break-all;
}

.sync-checkbox-target {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.sync-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .service-grid {
    grid-template-columns: 1fr;
  }
}
</style>
