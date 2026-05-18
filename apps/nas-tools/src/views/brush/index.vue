<script lang="ts" setup>
import { ref, computed, h, onMounted } from 'vue';

import {
  NButton,
  NCard,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NModal,
  NDropdown,
  NDataTable,
  useNotification,
} from 'naive-ui';

import {
  deleteBrushTaskApi,
  getBrushTasksApi,
  runBrushTaskApi,
  toggleBrushTaskApi,
  getBrushTaskTorrentsApi,
  addBrushTaskApi,
  updateBrushTaskApi,
  getBrushRulesApi,
  type BrushApi,
} from '#/api/modules/brush';
import { getSitesApi } from '#/api/modules/site';
import { getDownloadersApi } from '#/api/modules/download';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { IconifyIcon } from '@vben/icons';
import BrushTaskForm from '#/components/brush/BrushTaskForm.vue';

const notification = useNotification();
const loading = ref(false);
const tasks = ref<BrushApi.BrushTask[]>([]);
const sites = ref<Array<{ label: string; value: string }>>([]);
const downloaders = ref<Array<{ label: string; value: string }>>([]);
const brushRules = ref<BrushApi.BrushRule[]>([]);

const ruleNameMap = computed(() => {
  const map: Record<number, string> = {};
  for (const r of brushRules.value) {
    map[r.id] = r.name;
  }
  return map;
});

const searchKeyword = ref('');
const filterState = ref<string>('');
const filterSite = ref<string>('');

const torrentModalShow = ref(false);
const torrentTaskName = ref('');
const torrents = ref<BrushApi.BrushTorrent[]>([]);
const torrentLoading = ref(false);

const editModalShow = ref(false);
const editingTask = ref<BrushApi.BrushTask | null>(null);

const detailModalShow = ref(false);
const detailTask = ref<BrushApi.BrushTask | null>(null);

const stateOptions = [
  { label: '全部状态', value: '' },
  { label: '运行中', value: 'Y' },
  { label: '已停止', value: 'S' },
  { label: '已停用', value: 'N' },
];

const filteredTasks = computed(() => {
  let result = tasks.value;
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase();
    result = result.filter(t =>
      (t.name?.toLowerCase().includes(kw)) ||
      (t.site?.toLowerCase().includes(kw)) ||
      (t.downloader_name?.toLowerCase().includes(kw)),
    );
  }
  if (filterState.value) {
    result = result.filter(t => t.state === filterState.value);
  }
  if (filterSite.value) {
    result = result.filter(t => String(t.site_id) === filterSite.value);
  }
  return result;
});

const summary = computed(() => {
  const items = tasks.value;
  if (!items.length) return null;
  const running = items.filter(t => t.state === 'Y').length;
  const stopped = items.filter(t => t.state === 'S').length;
  const disabled = items.filter(t => t.state === 'N').length;
  const totalDownloads = items.reduce((sum, t) => sum + (t.download_count || 0), 0);
  const totalRemoves = items.reduce((sum, t) => sum + (t.remove_count || 0), 0);
  return {
    total: items.length,
    running,
    stopped,
    disabled,
    totalDownloads,
    totalRemoves,
  };
});

async function fetchData() {
  loading.value = true;
  try {
    const [taskRes, ruleRes] = await Promise.all([
      getBrushTasksApi(),
      getBrushRulesApi(),
    ]);
    const list = Array.isArray(taskRes) ? taskRes : (taskRes?.data || []);
    tasks.value = list;
    const rules = Array.isArray(ruleRes) ? ruleRes : (ruleRes?.data || []);
    brushRules.value = rules;
    await refreshTaskCounts(list);
  } finally {
    loading.value = false;
  }
}

async function refreshTaskCounts(taskList: BrushApi.BrushTask[]) {
  if (!taskList.length) return;
  const results = await Promise.allSettled(
    taskList.map((task) => getBrushTaskTorrentsApi(task.id)),
  );
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const raw: any = result.value;
      const torrents = Array.isArray(raw)
        ? raw
        : (raw?.data || raw?.list || []);
      const task = tasks.value[index];
      if (task) {
        task.download_count = torrents.length;
        task.remove_count = torrents.filter(
          (t: any) => !t.DOWNLOAD_ID || t.DOWNLOAD_ID === '0',
        ).length;
      }
    }
  });
}

async function fetchSites() {
  try {
    const res: any = await getSitesApi({ brush: true });
    const list = Array.isArray(res) ? res : (res?.data || []);
    sites.value = list.map((s: any) => ({ label: s.name, value: String(s.id) }));
  } catch { /* ignore */ }
}

async function fetchDownloaders() {
  try {
    const res: any = await getDownloadersApi();
    const data = res?.data || res || {};
    downloaders.value = Object.values(data).map((d: any) => ({
      label: d.name || d.id,
      value: String(d.id),
    }));
  } catch { /* ignore */ }
}

async function handleToggle(task: BrushApi.BrushTask) {
  const enable = task.state !== 'Y';
  try {
    await toggleBrushTaskApi(task.id, enable);
    notification.success({ content: enable ? '任务已启用' : '任务已停用' });
    await fetchData();
  } catch (err: any) {
    notification.error({ content: '操作失败', description: err?.message || '' });
  }
}

async function handleRun(task: BrushApi.BrushTask) {
  try {
    await runBrushTaskApi(task.id);
    notification.success({ content: '任务已触发运行' });
  } catch (err: any) {
    notification.error({ content: '运行失败', description: err?.message || '' });
  }
}

async function handleDelete(task: BrushApi.BrushTask) {
  try {
    await deleteBrushTaskApi(task.id);
    notification.success({ content: '任务已删除' });
    await fetchData();
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  }
}

async function openTorrents(task: BrushApi.BrushTask) {
  torrentTaskName.value = task.name || '';
  torrentModalShow.value = true;
  torrentLoading.value = true;
  try {
    const res: any = await getBrushTaskTorrentsApi(task.id);
    // requestClient 已提取 data 字段，res 直接是数组或嵌套结构
    const list = Array.isArray(res) ? res : (res?.data || res?.list || []);
    torrents.value = list;
  } catch (err: any) {
    notification.error({ content: '获取种子列表失败', description: err?.message || '' });
    torrents.value = [];
  } finally {
    torrentLoading.value = false;
  }
}

function openEdit(task?: BrushApi.BrushTask) {
  editingTask.value = task || null;
  editModalShow.value = true;
}

async function openDetail(task: BrushApi.BrushTask) {
  detailTask.value = { ...task };
  detailModalShow.value = true;
  try {
    const res: any = await getBrushTaskTorrentsApi(task.id);
    const list = Array.isArray(res) ? res : (res?.data || res?.list || []);
    if (list.length > 0) {
      detailTask.value.download_count = list.length;
      detailTask.value.remove_count = list.filter(
        (t: any) => !t.DOWNLOAD_ID || t.DOWNLOAD_ID === '0',
      ).length;
    }
  } catch {
    /* ignore */
  }
}

function getStateType(state?: string) {
  if (state === 'Y') return 'success';
  if (state === 'N') return 'error';
  return 'default';
}

function getStateLabel(state?: string) {
  if (state === 'Y') return '运行中';
  if (state === 'S') return '已停止';
  if (state === 'N') return '已停用';
  return '未知';
}

function getFreeType(free?: string) {
  if (!free || free === 'FREE') return 'success';
  if (free === '2XFREE') return 'warning';
  return 'default';
}

function getFreeLabel(free?: string) {
  if (!free) return '全部';
  if (free === 'FREE') return '免费';
  if (free === '2XFREE') return '2X免费';
  if (free === 'NORMAL') return '普通';
  return free;
}

function formatInterval(interval?: string) {
  if (!interval) return '-';
  const val = String(interval).trim();
  if (/^\d+$/.test(val)) return `${val} 分钟`;
  return val;
}

function formatFileSize(size?: string | number): string {
  if (!size) return '-';
  const bytes = typeof size === 'string' ? parseInt(size, 10) : size;
  if (isNaN(bytes) || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(1)} ${units[idx]}`;
}

function getDownloaderName(did?: string | number): string {
  if (!did) return '-';
  const id = String(did);
  const d = downloaders.value.find((item) => item.value === id);
  return d?.label || id;
}

function getActionOptions(row: BrushApi.BrushTask) {
  return [
    { label: '立即运行', key: 'run', icon: () => h(IconifyIcon, { icon: 'lucide:zap', class: 'h-4 w-4' }) },
    { label: '查看详情', key: 'detail', icon: () => h(IconifyIcon, { icon: 'lucide:eye', class: 'h-4 w-4' }) },
    { label: '编辑任务', key: 'edit', icon: () => h(IconifyIcon, { icon: 'lucide:pencil', class: 'h-4 w-4' }) },
    { type: 'divider', key: 'd1' },
    { label: '删除任务', key: 'delete', icon: () => h(IconifyIcon, { icon: 'lucide:trash-2', class: 'h-4 w-4' }) },
  ];
}

function handleActionSelect(key: string, row: BrushApi.BrushTask) {
  if (key === 'run') handleRun(row);
  if (key === 'detail') openDetail(row);
  if (key === 'torrents') openTorrents(row);
  if (key === 'edit') openEdit(row);
  if (key === 'delete') handleDelete(row);
}

async function handleFormSubmit(data: any) {
  try {
    if (editingTask.value) {
      await updateBrushTaskApi(data as any);
    } else {
      await addBrushTaskApi(data as any);
    }
    notification.success({ content: editingTask.value ? '任务已更新' : '任务已创建' });
    editModalShow.value = false;
    editingTask.value = null;
    await fetchData();
  } catch (err: any) {
    notification.error({ content: '保存失败', description: err?.message || '' });
  }
}

function handleFormCancel() {
  editModalShow.value = false;
  editingTask.value = null;
}

onMounted(() => {
  fetchData();
  fetchSites();
  fetchDownloaders();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="刷流任务">
      <template #actions>
        <NSpace>
          <NButton type="primary" size="small" @click="openEdit()">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="h-4 w-4" />
            </template>
            新增任务
          </NButton>
          <NButton size="small" @click="fetchData">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            刷新
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <!-- 统计卡片 -->
    <div v-if="summary" class="stats-overview">
      <NCard size="small" class="stat-card">
        <div class="stat-icon">
          <IconifyIcon icon="lucide:list" class="h-5 w-5" />
        </div>
        <div class="stat-value">{{ summary.total }}</div>
        <div class="stat-label">任务总数</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-success">
          <IconifyIcon icon="lucide:activity" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-success">{{ summary.running }}</div>
        <div class="stat-label">运行中</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-muted">
          <IconifyIcon icon="lucide:pause-circle" class="h-5 w-5" />
        </div>
        <div class="stat-value">{{ summary.stopped }}</div>
        <div class="stat-label">已停止</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-error">
          <IconifyIcon icon="lucide:power-off" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-error">{{ summary.disabled }}</div>
        <div class="stat-label">已停用</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-primary">
          <IconifyIcon icon="lucide:download" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-primary">{{ summary.totalDownloads }}</div>
        <div class="stat-label">总下载数</div>
      </NCard>
      <NCard size="small" class="stat-card">
        <div class="stat-icon stat-icon-warning">
          <IconifyIcon icon="lucide:trash-2" class="h-5 w-5" />
        </div>
        <div class="stat-value stat-warning">{{ summary.totalRemoves }}</div>
        <div class="stat-label">总删除数</div>
      </NCard>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <NInput
        v-model:value="searchKeyword"
        placeholder="搜索任务名称、站点、下载器"
        clearable
        style="width: 260px"
        size="small"
      >
        <template #prefix>
          <IconifyIcon icon="lucide:search" class="h-4 w-4" style="color: hsl(var(--muted-foreground))" />
        </template>
      </NInput>
      <NSelect
        v-model:value="filterState"
        :options="stateOptions"
        placeholder="状态筛选"
        clearable
        style="width: 130px"
        size="small"
      />
      <NSelect
        v-model:value="filterSite"
        :options="[{ label: '全部站点', value: '' }, ...sites]"
        placeholder="站点筛选"
        clearable
        style="width: 150px"
        size="small"
      />
    </div>

    <!-- 任务卡片列表 -->
    <NSpin :show="loading">
      <div v-if="filteredTasks.length > 0" class="task-grid">
        <NCard
          v-for="task in filteredTasks"
          :key="task.id"
          size="small"
          class="task-card"
          :class="{ 'task-card-active': task.state === 'Y' }"
        >
          <!-- 第一行：名称 + 操作 -->
          <div class="task-row-header">
            <div class="task-title-group">
              <div
                class="status-dot"
                :class="{ 'status-dot-active': task.state === 'Y' }"
              />
              <div class="task-title-text">
                <div class="task-name" :title="task.name">{{ task.name }}</div>
                <div class="task-meta">
                  <span class="meta-item">
                    <IconifyIcon icon="lucide:globe" class="h-3 w-3" />
                    {{ task.site || '-' }}
                  </span>
                  <span class="meta-sep">/</span>
                  <span class="meta-item">
                    <IconifyIcon icon="lucide:hard-drive" class="h-3 w-3" />
                    {{ getDownloaderName(task.downloader) }}
                  </span>
                  <span class="meta-sep">/</span>
                  <span class="meta-item">
                    <IconifyIcon icon="lucide:clock" class="h-3 w-3" />
                    {{ formatInterval(task.interval) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="task-badges">
              <span
                class="task-badge"
                :class="`task-badge-${getStateType(task.state)}`"
              >
                {{ getStateLabel(task.state) }}
              </span>
              <span
                v-if="task.free"
                class="task-badge task-badge-free"
              >
                {{ getFreeLabel(task.free) }}
              </span>
              <span
                v-if="task.rule_id && ruleNameMap[task.rule_id]"
                class="task-badge task-badge-rule"
              >
                <IconifyIcon icon="lucide:filter" class="h-3 w-3" />
                {{ ruleNameMap[task.rule_id] }}
              </span>
            </div>
          </div>

          <!-- 第二行：统计数据 -->
          <div class="task-row-stats">
            <div class="stat-item">
              <div class="stat-item-value">{{ task.download_count || 0 }}</div>
              <div class="stat-item-label">下载</div>
            </div>
            <div class="stat-item">
              <div class="stat-item-value">{{ task.remove_count || 0 }}</div>
              <div class="stat-item-label">删除</div>
            </div>
            <div class="stat-item">
              <div class="stat-item-value">{{ task.upload_size || '-' }}</div>
              <div class="stat-item-label">上传</div>
            </div>
            <div class="stat-item">
              <div class="stat-item-value">{{ task.download_size || '-' }}</div>
              <div class="stat-item-label">下载量</div>
            </div>
            <div class="stat-item">
              <div class="stat-item-value">{{ task.seed_size != null ? `${task.seed_size}GB` : '-' }}</div>
              <div class="stat-item-label">保种</div>
            </div>
            <div class="stat-item">
              <div class="stat-item-value">{{ task.total_size != null ? `${task.total_size}GB` : '-' }}</div>
              <div class="stat-item-label">总量</div>
            </div>
          </div>

          <!-- 第三行：操作 -->
          <div class="task-row-actions">
            <NButton
              size="small"
              :type="task.state === 'Y' ? 'default' : 'primary'"
              :ghost="task.state !== 'Y'"
              @click="handleToggle(task)"
            >
              {{ task.state === 'Y' ? '停用' : '启用' }}
            </NButton>
            <NButton size="small" @click="handleRun(task)">
              <template #icon>
                <IconifyIcon icon="lucide:zap" class="h-4 w-4" />
              </template>
              运行
            </NButton>
            <NButton size="small" @click="openDetail(task)">
              <template #icon>
                <IconifyIcon icon="lucide:eye" class="h-4 w-4" />
              </template>
              详情
            </NButton>
            <NButton size="small" @click="openTorrents(task)">
              <template #icon>
                <IconifyIcon icon="lucide:file-text" class="h-4 w-4" />
              </template>
              种子
            </NButton>
            <NDropdown
              trigger="click"
              :options="getActionOptions(task)"
              @select="(key: string) => handleActionSelect(key, task)"
            >
              <NButton size="small" text>
                <IconifyIcon icon="lucide:more-vertical" class="h-4 w-4" />
              </NButton>
            </NDropdown>
          </div>
        </NCard>
      </div>

      <EmptyState
        v-else-if="!loading"
        title="没有任务"
        subtitle="当前没有符合条件的刷流任务"
      />
    </NSpin>

    <!-- 详情弹窗 -->
    <NModal
      v-model:show="detailModalShow"
      :title="detailTask?.name || '任务详情'"
      preset="card"
      class="w-[800px]"
      :bordered="false"
      :segmented="{ content: true }"
    >
      <div v-if="detailTask" class="brush-detail-body">
        <!-- 头部信息 -->
        <div class="brush-detail-header">
          <div class="brush-detail-header-left">
            <div
              class="brush-detail-status-dot"
              :class="{ active: detailTask.state === 'Y' }"
            />
            <div class="brush-detail-header-info">
              <div class="brush-detail-header-title">{{ detailTask.name }}</div>
              <div class="brush-detail-header-meta">
                <span class="brush-detail-meta-item">
                  <IconifyIcon icon="lucide:globe" class="h-3.5 w-3.5" />
                  {{ detailTask.site || '-' }}
                </span>
                <span class="brush-detail-meta-sep">·</span>
                <span class="brush-detail-meta-item">
                  <IconifyIcon icon="lucide:hard-drive" class="h-3.5 w-3.5" />
                  {{ getDownloaderName(detailTask.downloader) }}
                </span>
              </div>
            </div>
          </div>
          <div class="brush-detail-header-tags">
            <span
              class="task-badge"
              :class="`task-badge-${getStateType(detailTask.state)}`"
            >
              {{ getStateLabel(detailTask.state) }}
            </span>
            <span
              v-if="detailTask.free"
              class="task-badge task-badge-free"
            >
              {{ getFreeLabel(detailTask.free) }}
            </span>
            <span
              v-if="detailTask.rule_id && ruleNameMap[detailTask.rule_id]"
              class="task-badge task-badge-rule"
            >
              <IconifyIcon icon="lucide:filter" class="h-3 w-3" />
              {{ ruleNameMap[detailTask.rule_id] }}
            </span>
          </div>
        </div>

        <!-- 关键指标 -->
        <div class="brush-detail-metrics">
          <div class="brush-detail-metric-card">
            <div class="brush-detail-metric-icon">
              <IconifyIcon icon="lucide:download" class="h-4 w-4" />
            </div>
            <div class="brush-detail-metric-value">{{ detailTask.download_count || 0 }}</div>
            <div class="brush-detail-metric-label">已下载</div>
          </div>
          <div class="brush-detail-metric-card">
            <div class="brush-detail-metric-icon delete">
              <IconifyIcon icon="lucide:trash-2" class="h-4 w-4" />
            </div>
            <div class="brush-detail-metric-value delete">{{ detailTask.remove_count || 0 }}</div>
            <div class="brush-detail-metric-label">已删除</div>
          </div>
          <div class="brush-detail-metric-card">
            <div class="brush-detail-metric-icon upload">
              <IconifyIcon icon="lucide:arrow-up" class="h-4 w-4" />
            </div>
            <div class="brush-detail-metric-value">{{ detailTask.upload_size || '-' }}</div>
            <div class="brush-detail-metric-label">上传量</div>
          </div>
          <div class="brush-detail-metric-card">
            <div class="brush-detail-metric-icon download">
              <IconifyIcon icon="lucide:arrow-down" class="h-4 w-4" />
            </div>
            <div class="brush-detail-metric-value">{{ detailTask.download_size || '-' }}</div>
            <div class="brush-detail-metric-label">下载量</div>
          </div>
        </div>

        <!-- 配置信息 -->
        <div class="brush-detail-config">
          <div class="brush-detail-config-title">配置信息</div>
          <div class="brush-detail-config-grid">
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">刷新间隔</span>
              <span class="brush-detail-config-value">{{ formatInterval(detailTask.interval) }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">保种体积</span>
              <span class="brush-detail-config-value">{{ detailTask.seed_size != null ? detailTask.seed_size + ' GB' : '-' }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">保存目录</span>
              <span class="brush-detail-config-value path">{{ detailTask.savepath || '默认' }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">标签</span>
              <span class="brush-detail-config-value">{{ detailTask.label || '-' }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">消息推送</span>
              <span class="brush-detail-config-value">
                <span
                  class="task-badge"
                  :class="detailTask.sendmessage ? 'task-badge-success' : 'task-badge-default'"
                >
                  {{ detailTask.sendmessage ? '开启' : '关闭' }}
                </span>
              </span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">转移媒体库</span>
              <span class="brush-detail-config-value">
                <span
                  class="task-badge"
                  :class="detailTask.transfer ? 'task-badge-success' : 'task-badge-default'"
                >
                  {{ detailTask.transfer ? '开启' : '关闭' }}
                </span>
              </span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">开启时段</span>
              <span class="brush-detail-config-value">{{ detailTask.time_range || '全天' }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">最后更新</span>
              <span class="brush-detail-config-value">{{ detailTask.lst_mod_date || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 规则面板 -->
        <div class="brush-detail-rules">
          <div v-if="detailTask.rss_rule && Object.keys(detailTask.rss_rule).length" class="brush-detail-rule-group">
            <div class="brush-detail-rule-group-title">
              <IconifyIcon icon="lucide:filter" class="h-3.5 w-3.5" />
              选种规则
            </div>
            <div class="brush-detail-rule-tags">
              <NTag
                v-for="(value, key) in detailTask.rss_rule"
                :key="key"
                size="small"
                round
                type="primary"
              >
                {{ key }}: {{ value }}
              </NTag>
            </div>
          </div>
          <div v-if="detailTask.remove_rule && Object.keys(detailTask.remove_rule).length" class="brush-detail-rule-group">
            <div class="brush-detail-rule-group-title">
              <IconifyIcon icon="lucide:trash-2" class="h-3.5 w-3.5" />
              删种规则
            </div>
            <div class="brush-detail-rule-tags">
              <NTag
                v-for="(value, key) in detailTask.remove_rule"
                :key="key"
                size="small"
                round
                type="error"
              >
                {{ key }}: {{ value }}
              </NTag>
            </div>
          </div>
          <div v-if="detailTask.stop_rule && Object.keys(detailTask.stop_rule).length" class="brush-detail-rule-group">
            <div class="brush-detail-rule-group-title">
              <IconifyIcon icon="lucide:octagon" class="h-3.5 w-3.5" />
              停种规则
            </div>
            <div class="brush-detail-rule-tags">
              <NTag
                v-for="(value, key) in detailTask.stop_rule"
                :key="key"
                size="small"
                round
                type="success"
              >
                {{ key }}: {{ value }}
              </NTag>
            </div>
          </div>
        </div>

        <!-- RSS地址 -->
        <div v-if="detailTask.rss_url" class="brush-detail-rss">
          <div class="brush-detail-rss-label">RSS 订阅地址</div>
          <div class="brush-detail-rss-url">{{ detailTask.rss_url }}</div>
        </div>
      </div>
    </NModal>

    <!-- 种子列表弹窗 -->
    <NModal
      v-model:show="torrentModalShow"
      :title="`${torrentTaskName} - 种子列表`"
      preset="card"
      class="w-[900px]"
      :bordered="false"
      :segmented="{ content: true }"
    >
      <NSpin :show="torrentLoading">
        <NDataTable
          v-if="torrents.length > 0"
          :columns="[
            { title: '标题', key: 'TORRENT_NAME', width: 300, ellipsis: { tooltip: true } },
            { title: '大小', key: 'TORRENT_SIZE', width: 100, render: (row: any) => formatFileSize(row.TORRENT_SIZE) },
            { title: '下载器', key: 'DOWNLOADER', width: 120, render: (row: any) => getDownloaderName(row.DOWNLOADER) },
            { title: '添加时间', key: 'LST_MOD_DATE', width: 160 },
            { title: '状态', key: 'DOWNLOAD_ID', width: 80, render: (row: any) => h(NTag, { size: 'small', type: row.DOWNLOAD_ID ? 'success' : 'error' }, () => row.DOWNLOAD_ID ? '正常' : '已删除') },
          ]"
          :data="torrents"
          :bordered="false"
          size="small"
          striped
        />
        <EmptyState
          v-else-if="!torrentLoading"
          title="暂无种子"
          subtitle="该任务暂无下载的种子记录"
        />
      </NSpin>
    </NModal>

    <!-- 编辑/新增弹窗 -->
    <NModal
      v-model:show="editModalShow"
      :title="editingTask ? '编辑任务' : '新增任务'"
      preset="card"
      class="w-[780px]"
      :bordered="false"
      :segmented="{ content: true }"
      :mask-closable="false"
    >
      <BrushTaskForm
        :task="editingTask"
        :sites="sites"
        :downloaders="downloaders"
        @submit="handleFormSubmit"
        @cancel="handleFormCancel"
      />
    </NModal>
  </div>
</template>

<style scoped>
.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-card {
  text-align: center;
}

.stat-card :deep(.n-card__content) {
  padding: 0.875rem 0.5rem;
}

.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background-color: hsl(var(--accent));
  color: hsl(var(--primary));
  margin-bottom: 0.375rem;
}

.stat-icon-success {
  background-color: hsl(var(--success) / 0.15);
  color: hsl(var(--success));
}

.stat-icon-muted {
  background-color: hsl(var(--muted-foreground) / 0.15);
  color: hsl(var(--muted-foreground));
}

.stat-icon-primary {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
}

.stat-icon-warning {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

.stat-icon-error {
  background-color: hsl(var(--destructive) / 0.15);
  color: hsl(var(--destructive));
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--card-foreground));
  line-height: 1.2;
}

.stat-success {
  color: hsl(var(--success));
}

.stat-primary {
  color: hsl(var(--primary));
}

.stat-warning {
  color: hsl(var(--warning));
}

.stat-error {
  color: hsl(var(--destructive));
}

.stat-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.25rem;
}

.filter-bar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

/* 任务卡片网格 */
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 0.75rem;
}

.task-card {
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.task-card:hover {
  border-color: hsl(var(--border));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.task-card-active {
  border-left-color: hsl(var(--success));
}

.task-card :deep(.n-card__content) {
  padding: 1rem;
}

/* 第一行：名称 + 操作 */
.task-row-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.task-title-group {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  min-width: 0;
  flex: 1;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background-color: hsl(var(--muted-foreground));
  margin-top: 0.5rem;
  flex-shrink: 0;
}

.status-dot-active {
  background-color: hsl(var(--success));
  box-shadow: 0 0 0 2px hsl(var(--success) / 0.2);
}

.task-title-text {
  min-width: 0;
  flex: 1;
}

.task-name {
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
  word-break: break-word;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.meta-sep {
  color: hsl(var(--border));
  font-size: 0.8125rem;
}

.task-badges {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.task-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.4;
}

.task-badge-success {
  background-color: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.task-badge-error {
  background-color: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

.task-badge-default {
  background-color: hsl(var(--muted) / 0.3);
  color: hsl(var(--muted-foreground));
}

.task-badge-free {
  background-color: hsl(var(--success));
  color: hsl(var(--success-foreground, var(--primary-foreground)));
}

.task-badge-rule {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background-color: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.task-badge-info {
  background-color: hsla(210, 80%, 55%, 0.1);
  color: hsl(210, 80%, 55%);
}

.task-badge-warning {
  background-color: hsl(var(--warning) / 0.15);
  color: hsl(var(--warning));
}

/* 第二行：统计数据 */
.task-row-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.625rem;
  background-color: hsl(var(--accent));
  border-radius: 0.5rem;
}

.stat-item {
  text-align: center;
}

.stat-item-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.stat-item-label {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.125rem;
}

/* 第三行：操作按钮 */
.task-row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

/* 详情弹窗 */
.brush-detail-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.5rem 0;
}

/* 头部 */
.brush-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.brush-detail-header-left {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  min-width: 0;
}

.brush-detail-status-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 9999px;
  background-color: hsl(var(--muted-foreground));
  margin-top: 0.5rem;
  flex-shrink: 0;
}

.brush-detail-status-dot.active {
  background-color: hsl(var(--success));
  box-shadow: 0 0 0 3px hsl(var(--success) / 0.2);
}

.brush-detail-header-info {
  min-width: 0;
}

.brush-detail-header-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: hsl(var(--card-foreground));
  line-height: 1.3;
  word-break: break-word;
}

.brush-detail-header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
  flex-wrap: wrap;
}

.brush-detail-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.brush-detail-meta-sep {
  color: hsl(var(--border));
  font-size: 0.875rem;
}

.brush-detail-header-tags {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* 关键指标卡片 */
.brush-detail-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.brush-detail-metric-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0.5rem;
  background-color: hsl(var(--accent));
  border-radius: 0.75rem;
  text-align: center;
  transition: all 0.2s ease;
}

.brush-detail-metric-card:hover {
  background-color: hsl(var(--accent) / 0.8);
}

.brush-detail-metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background-color: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  margin-bottom: 0.5rem;
}

.brush-detail-metric-icon.delete {
  background-color: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

.brush-detail-metric-icon.upload {
  background-color: hsl(var(--success) / 0.1);
  color: hsl(var(--success));
}

.brush-detail-metric-icon.download {
  background-color: hsl(var(--info) / 0.1);
  color: hsl(var(--info));
}

.brush-detail-metric-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: hsl(var(--card-foreground));
  line-height: 1.2;
}

.brush-detail-metric-value.delete {
  color: hsl(var(--destructive));
}

.brush-detail-metric-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.25rem;
}

/* 配置信息 */
.brush-detail-config {
  padding: 1rem;
  background-color: hsl(var(--accent));
  border-radius: 0.75rem;
}

.brush-detail-config-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid hsl(var(--border));
}

.brush-detail-config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
}

.brush-detail-config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.625rem;
  background-color: hsl(var(--card));
  border-radius: 0.5rem;
}

.brush-detail-config-label {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.brush-detail-config-value {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.brush-detail-config-value.path {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 规则面板 */
.brush-detail-rules {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.brush-detail-rule-group {
  padding: 0.75rem 1rem;
  background-color: hsl(var(--accent));
  border-radius: 0.75rem;
}

.brush-detail-rule-group-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  margin-bottom: 0.5rem;
}

.brush-detail-rule-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

/* RSS地址 */
.brush-detail-rss {
  padding: 0.75rem 1rem;
  background-color: hsl(var(--accent));
  border-radius: 0.75rem;
}

.brush-detail-rss-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  margin-bottom: 0.375rem;
}

.brush-detail-rss-url {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-family: monospace;
  word-break: break-all;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
  }

  .filter-bar {
    flex-direction: column;
  }

  .filter-bar :deep(.n-input),
  .filter-bar :deep(.n-select) {
    width: 100% !important;
  }

  .brush-detail-metrics {
    grid-template-columns: repeat(2, 1fr);
  }

  .brush-detail-config-grid {
    grid-template-columns: 1fr;
  }

  .task-grid {
    grid-template-columns: 1fr;
  }

  .task-row-stats {
    grid-template-columns: repeat(3, 1fr);
  }

  .task-row-header {
    flex-wrap: wrap;
  }

  .task-badges {
    width: 100%;
    margin-top: 0.25rem;
  }
}
</style>
