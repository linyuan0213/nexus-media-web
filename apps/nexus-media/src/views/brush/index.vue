<script lang="ts" setup>
import type { BrushApi } from '#/api/modules/brush';

import { computed, h, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NDataTable,
  NDropdown,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  useNotification,
} from 'naive-ui';

import {
  addBrushTaskApi,
  deleteBrushTaskApi,
  getBrushRulesApi,
  getBrushTasksApi,
  getBrushTaskTorrentsApi,
  runBrushTaskApi,
  toggleBrushTaskApi,
  updateBrushTaskApi,
} from '#/api/modules/brush';
import { getDownloadersApi } from '#/api/modules/download';
import { getSitesApi } from '#/api/modules/site';
import BrushTaskForm from '#/components/brush/BrushTaskForm.vue';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

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
];

const filteredTasks = computed(() => {
  let result = tasks.value;
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase();
    result = result.filter(
      (t) =>
        t.name?.toLowerCase().includes(kw) ||
        t.site?.toLowerCase().includes(kw) ||
        t.downloader_name?.toLowerCase().includes(kw),
    );
  }
  if (filterState.value) {
    result = result.filter((t) => t.state === filterState.value);
  }
  if (filterSite.value) {
    result = result.filter((t) => String(t.site_id) === filterSite.value);
  }
  return result;
});

const summary = computed(() => {
  const items = tasks.value;
  if (items.length === 0) return null;
  const running = items.filter((t) => t.state === 'Y').length;
  const stopped = items.filter((t) => t.state === 'S').length;
  const disabled = items.filter((t) => t.state === 'N').length;
  const totalDownloads = items.reduce(
    (sum, t) => sum + (t.download_count || 0),
    0,
  );
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
    const list = Array.isArray(taskRes)
      ? taskRes
      : (taskRes as any)?.data || [];
    tasks.value = list;
    const rules = Array.isArray(ruleRes)
      ? ruleRes
      : (ruleRes as any)?.data || [];
    brushRules.value = rules;
    await refreshTaskCounts(list);
  } finally {
    loading.value = false;
  }
}

async function refreshTaskCounts(taskList: BrushApi.BrushTask[]) {
  if (taskList.length === 0) return;
  const results = await Promise.allSettled(
    taskList.map((task) => getBrushTaskTorrentsApi(task.id)),
  );
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const raw: any = result.value;
      const torrents = Array.isArray(raw) ? raw : raw?.data || raw?.list || [];
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
    const list = Array.isArray(res) ? res : res?.data || [];
    sites.value = list.map((s: any) => ({
      label: s.name,
      value: String(s.id),
    }));
  } catch {
    /* ignore */
  }
}

async function fetchDownloaders() {
  try {
    const res: any = await getDownloadersApi();
    const data = res?.data || res || {};
    downloaders.value = Object.values(data).map((d: any) => ({
      label: d.name || d.id,
      value: String(d.id),
    }));
  } catch {
    /* ignore */
  }
}

async function handleToggle(task: BrushApi.BrushTask, enable?: boolean) {
  const target = enable ?? task.state !== 'Y';
  try {
    await toggleBrushTaskApi(task.id, target);
    notification.success({ content: target ? '任务已启用' : '任务已停用' });
    await fetchData();
  } catch (error: any) {
    notification.error({
      content: '操作失败',
      description: error?.message || '',
    });
  }
}

function getMoreOptions() {
  return [
    {
      label: '立即运行',
      key: 'run',
      icon: () => h(IconifyIcon, { icon: 'lucide:zap', class: 'h-4 w-4' }),
    },
    {
      label: '编辑任务',
      key: 'edit',
      icon: () => h(IconifyIcon, { icon: 'lucide:pencil', class: 'h-4 w-4' }),
    },
    {
      label: '种子列表',
      key: 'torrents',
      icon: () =>
        h(IconifyIcon, { icon: 'lucide:file-text', class: 'h-4 w-4' }),
    },
    { type: 'divider', key: 'd1' },
    {
      label: '删除任务',
      key: 'delete',
      type: 'error',
      icon: () => h(IconifyIcon, { icon: 'lucide:trash-2', class: 'h-4 w-4' }),
    },
  ];
}

function handleMoreSelect(key: string, row: BrushApi.BrushTask) {
  if (key === 'run') handleRun(row);
  if (key === 'edit') openEdit(row);
  if (key === 'torrents') openTorrents(row);
  if (key === 'delete') handleDelete(row);
}

async function handleRun(task: BrushApi.BrushTask) {
  try {
    await runBrushTaskApi(task.id);
    notification.success({ content: '任务已触发运行' });
  } catch (error: any) {
    notification.error({
      content: '运行失败',
      description: error?.message || '',
    });
  }
}

async function handleDelete(task: BrushApi.BrushTask) {
  try {
    await deleteBrushTaskApi(task.id);
    notification.success({ content: '任务已删除' });
    await fetchData();
  } catch (error: any) {
    notification.error({
      content: '删除失败',
      description: error?.message || '',
    });
  }
}

async function openTorrents(task: BrushApi.BrushTask) {
  torrentTaskName.value = task.name || '';
  torrentModalShow.value = true;
  torrentLoading.value = true;
  try {
    const res: any = await getBrushTaskTorrentsApi(task.id);
    // requestClient 已提取 data 字段，res 直接是数组或嵌套结构
    const list = Array.isArray(res) ? res : res?.data || res?.list || [];
    torrents.value = list;
  } catch (error: any) {
    notification.error({
      content: '获取种子列表失败',
      description: error?.message || '',
    });
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
    const list = Array.isArray(res) ? res : res?.data || res?.list || [];
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
  if (state === 'S') return 'error';
  return 'default';
}

function getRowClass(state?: string) {
  if (state === 'Y') return 'task-row task-row-running';
  if (state === 'N') return 'task-row task-row-disabled';
  return 'task-row task-row-stopped';
}

function getStateLabel(state?: string) {
  if (state === 'Y') return '运行中';
  if (state === 'S') return '已停止';
  if (state === 'N') return '已停用';
  return '未知';
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

function formatFileSize(size?: number | string): string {
  if (!size) return '-';
  const bytes = typeof size === 'string' ? Number.parseInt(size, 10) : size;
  if (Number.isNaN(bytes) || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(1)} ${units[idx]}`;
}

function getDownloaderName(did?: number | string): string {
  if (!did) return '-';
  const id = String(did);
  const d = downloaders.value.find((item) => item.value === id);
  return d?.label || id;
}

async function handleFormSubmit(data: any) {
  try {
    await (editingTask.value
      ? updateBrushTaskApi(data as any)
      : addBrushTaskApi(data as any));
    notification.success({
      content: editingTask.value ? '任务已更新' : '任务已创建',
    });
    editModalShow.value = false;
    editingTask.value = null;
    await fetchData();
  } catch (error: any) {
    notification.error({
      content: '保存失败',
      description: error?.message || '',
    });
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

    <!-- 任务列表卡片 -->
    <NCard :bordered="false" :segmented="{ content: true }" class="task-card">
      <template #header>
        <div class="card-header">
          <div class="filter-controls">
            <NInput
              v-model:value="searchKeyword"
              placeholder="搜索任务名称、站点、下载器"
              clearable
              class="filter-input"
              size="small"
            >
              <template #prefix>
                <IconifyIcon
                  icon="lucide:search"
                  class="h-3.5 w-3.5 text-muted"
                />
              </template>
            </NInput>
            <NSelect
              v-model:value="filterState"
              :options="stateOptions"
              placeholder="状态"
              clearable
              size="small"
              style="width: 100px"
            />
            <NSelect
              v-model:value="filterSite"
              :options="[{ label: '全部站点', value: '' }, ...sites]"
              placeholder="站点"
              clearable
              size="small"
              style="width: 130px"
            />
          </div>
          <div v-if="summary" class="filter-summary">
            <span class="summary-pill">
              <strong>{{ summary.total }}</strong> 个任务
            </span>
            <span class="summary-pill summary-pill-running">
              <IconifyIcon icon="lucide:activity" class="h-3 w-3" />
              <strong>{{ summary.running }}</strong> 运行
            </span>
            <span class="summary-pill summary-pill-stopped">
              <IconifyIcon icon="lucide:pause-circle" class="h-3 w-3" />
              <strong>{{ summary.stopped }}</strong> 停止
            </span>
            <span v-if="summary.disabled > 0" class="summary-pill">
              <strong>{{ summary.disabled }}</strong> 停用
            </span>
          </div>
        </div>
      </template>

      <NSpin :show="loading">
        <div v-if="filteredTasks.length > 0" class="task-list">
          <div
            v-for="task in filteredTasks"
            :key="task.id"
            :class="getRowClass(task.state)"
            @click="openDetail(task)"
          >
            <div class="task-content">
              <div class="task-main">
                <div class="task-title-line">
                  <span class="task-name" :title="task.name">{{
                    task.name
                  }}</span>
                  <span
                    class="task-badge"
                    :class="`task-badge-${getStateType(task.state)}`"
                    >{{ getStateLabel(task.state) }}</span
                  >
                  <span v-if="task.free" class="task-badge task-badge-free">{{
                    getFreeLabel(task.free)
                  }}</span>
                  <span
                    v-if="task.rule_id && ruleNameMap[task.rule_id]"
                    class="task-badge task-badge-rule"
                  >
                    <IconifyIcon icon="lucide:filter" class="h-3 w-3" />
                    <span>{{ ruleNameMap[task.rule_id] }}</span>
                  </span>
                </div>
                <div class="task-actions" @click.stop>
                  <NSwitch
                    :value="task.state === 'Y'"
                    size="small"
                    @update:value="(v) => handleToggle(task, v)"
                  />
                  <NDropdown
                    trigger="click"
                    :options="getMoreOptions()"
                    @select="(key) => handleMoreSelect(key, task)"
                  >
                    <NButton text aria-label="更多操作" size="small">
                      <IconifyIcon
                        icon="lucide:more-vertical"
                        class="h-4 w-4"
                      />
                    </NButton>
                  </NDropdown>
                </div>
              </div>
              <div class="task-meta">
                {{ task.site || '-' }} ·
                {{ task.downloader_name || getDownloaderName(task.downloader) }}
                ·
                {{ formatInterval(task.interval) }}
              </div>
              <div class="task-stats">
                <span class="task-stat">
                  <IconifyIcon icon="lucide:arrow-up" class="h-3.5 w-3.5" />
                  上传 {{ task.upload_size || '-' }}
                </span>
                <span class="task-stat">
                  <IconifyIcon icon="lucide:arrow-down" class="h-3.5 w-3.5" />
                  下载 {{ task.download_size || '-' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <EmptyState
          v-else-if="!loading"
          title="暂无刷流任务"
          subtitle="点击「新增任务」创建第一个刷流任务"
        />
      </NSpin>
    </NCard>

    <!-- 详情弹窗 -->
    <NModal
      v-model:show="detailModalShow"
      :title="detailTask?.name || '任务详情'"
      preset="card"
      :style="{ width: '800px', maxWidth: '92vw' }"
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
            ></div>
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
            <span v-if="detailTask.free" class="task-badge task-badge-free">
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
            <div class="brush-detail-metric-value">
              {{ detailTask.download_count || 0 }}
            </div>
            <div class="brush-detail-metric-label">已下载</div>
          </div>
          <div class="brush-detail-metric-card">
            <div class="brush-detail-metric-icon delete">
              <IconifyIcon icon="lucide:trash-2" class="h-4 w-4" />
            </div>
            <div class="brush-detail-metric-value delete">
              {{ detailTask.remove_count || 0 }}
            </div>
            <div class="brush-detail-metric-label">已删除</div>
          </div>
          <div class="brush-detail-metric-card">
            <div class="brush-detail-metric-icon upload">
              <IconifyIcon icon="lucide:arrow-up" class="h-4 w-4" />
            </div>
            <div class="brush-detail-metric-value">
              {{ detailTask.upload_size || '-' }}
            </div>
            <div class="brush-detail-metric-label">上传量</div>
          </div>
          <div class="brush-detail-metric-card">
            <div class="brush-detail-metric-icon download">
              <IconifyIcon icon="lucide:arrow-down" class="h-4 w-4" />
            </div>
            <div class="brush-detail-metric-value">
              {{ detailTask.download_size || '-' }}
            </div>
            <div class="brush-detail-metric-label">下载量</div>
          </div>
        </div>

        <!-- 配置信息 -->
        <div class="brush-detail-config">
          <div class="brush-detail-config-title">
            <IconifyIcon icon="lucide:settings" class="h-3.5 w-3.5" />
            配置信息
          </div>
          <div class="brush-detail-config-grid">
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">刷新间隔</span>
              <span class="brush-detail-config-value">{{
                formatInterval(detailTask.interval)
              }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">保种体积</span>
              <span class="brush-detail-config-value">{{
                detailTask.seed_size != null
                  ? `${detailTask.seed_size} GB`
                  : '-'
              }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">保存目录</span>
              <span class="brush-detail-config-value path">{{
                detailTask.savepath || '默认'
              }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">标签</span>
              <span class="brush-detail-config-value">{{
                detailTask.label || '-'
              }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">消息推送</span>
              <span class="brush-detail-config-value">
                <span
                  class="task-badge"
                  :class="
                    detailTask.sendmessage
                      ? 'task-badge-success'
                      : 'task-badge-default'
                  "
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
                  :class="
                    detailTask.transfer
                      ? 'task-badge-success'
                      : 'task-badge-default'
                  "
                >
                  {{ detailTask.transfer ? '开启' : '关闭' }}
                </span>
              </span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">开启时段</span>
              <span class="brush-detail-config-value">{{
                detailTask.time_range || '全天'
              }}</span>
            </div>
            <div class="brush-detail-config-item">
              <span class="brush-detail-config-label">最后更新</span>
              <span class="brush-detail-config-value">{{
                detailTask.lst_mod_date || '-'
              }}</span>
            </div>
          </div>
        </div>

        <!-- 规则面板 -->
        <div class="brush-detail-rules">
          <div
            v-if="
              detailTask.rss_rule && Object.keys(detailTask.rss_rule).length > 0
            "
            class="brush-detail-rule-group"
          >
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
          <div
            v-if="
              detailTask.remove_rule &&
              Object.keys(detailTask.remove_rule).length > 0
            "
            class="brush-detail-rule-group"
          >
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
          <div
            v-if="
              detailTask.stop_rule &&
              Object.keys(detailTask.stop_rule).length > 0
            "
            class="brush-detail-rule-group"
          >
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
      :style="{ width: '900px', maxWidth: '92vw' }"
      :bordered="false"
      :segmented="{ content: true }"
    >
      <NSpin :show="torrentLoading">
        <NDataTable
          v-if="torrents.length > 0"
          :columns="[
            {
              title: '标题',
              key: 'TORRENT_NAME',
              width: 300,
              ellipsis: { tooltip: true },
            },
            {
              title: '大小',
              key: 'TORRENT_SIZE',
              width: 100,
              render: (row: any) => formatFileSize(row.TORRENT_SIZE),
            },
            {
              title: '下载器',
              key: 'DOWNLOADER',
              width: 120,
              render: (row: any) => getDownloaderName(row.DOWNLOADER),
            },
            { title: '添加时间', key: 'LST_MOD_DATE', width: 160 },
            {
              title: '状态',
              key: 'DOWNLOAD_ID',
              width: 80,
              render: (row: any) =>
                h(
                  NTag,
                  {
                    size: 'small',
                    type: row.DOWNLOAD_ID ? 'success' : 'error',
                  },
                  () => (row.DOWNLOAD_ID ? '正常' : '已删除'),
                ),
            },
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
      :style="{ width: '780px', maxWidth: '92vw' }"
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
.task-card {
  border-radius: 0.75rem;
}

.card-header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.filter-input {
  width: 260px;
  max-width: 100%;
}

.filter-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.8125rem;
}

.summary-pill {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.125rem 0.5rem;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--accent));
  border-radius: 0.375rem;
}

.summary-pill strong {
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.summary-pill-running {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 12%);
}

.summary-pill-running strong {
  color: hsl(var(--success));
}

.summary-pill-stopped {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 12%);
}

.summary-pill-stopped strong {
  color: hsl(var(--destructive));
}

.text-muted {
  color: hsl(var(--muted-foreground));
}

.task-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .task-list {
    grid-template-columns: 1fr;
  }
}

.task-row {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  transition: all 0.2s ease;
}

.task-row:hover {
  background-color: hsl(var(--accent) / 60%);
  border-color: hsl(var(--border) / 70%);
  box-shadow: 0 4px 12px -2px hsl(var(--border) / 30%);
  transform: translateY(-1px);
}

.task-row-running {
  background-color: hsl(var(--success) / 5%);
  border-left: 4px solid hsl(var(--success));
}

.task-row-running:hover {
  background-color: hsl(var(--success) / 8%);
}

.task-row-stopped {
  border-left: 4px solid hsl(var(--destructive));
}

.task-row-disabled {
  border-left: 4px solid hsl(var(--muted-foreground));
}

.task-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.task-main {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.task-title-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.task-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.task-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.75rem;
  align-items: center;
}

.task-meta {
  font-size: 0.8125rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.task-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: center;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.task-stat {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}

.task-badge {
  display: inline-flex;
  gap: 0.1875rem;
  align-items: center;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  border-radius: 0.25rem;
}

.task-badge-success {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 12%);
}

.task-badge-error {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 12%);
}

.task-badge-default {
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 30%);
}

.task-badge-free {
  color: hsl(var(--success-foreground, var(--primary-foreground)));
  background-color: hsl(var(--success));
}

.task-badge-rule {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 12%);
}

.task-badge-info {
  color: hsl(var(--info));
  background-color: hsl(var(--info) / 12%);
}

.task-badge-warning {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 12%);
}

@media (max-width: 768px) {
  .card-header {
    align-items: flex-start;
  }

  .filter-input {
    width: 100%;
  }

  .filter-summary {
    width: 100%;
  }

  .task-main {
    flex-direction: column;
    gap: 0.625rem;
  }

  .task-actions {
    justify-content: flex-end;
    width: 100%;
  }

  .brush-detail-metrics {
    grid-template-columns: repeat(2, 1fr);
  }

  .brush-detail-config-grid {
    grid-template-columns: 1fr;
  }
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
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.brush-detail-header-left {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  min-width: 0;
}

.brush-detail-status-dot {
  flex-shrink: 0;
  width: 0.625rem;
  height: 0.625rem;
  margin-top: 0.5rem;
  background-color: hsl(var(--muted-foreground));
  border-radius: 9999px;
}

.brush-detail-status-dot.active {
  background-color: hsl(var(--success));
  box-shadow: 0 0 0 3px hsl(var(--success) / 20%);
}

.brush-detail-header-info {
  min-width: 0;
}

.brush-detail-header-title {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  color: hsl(var(--card-foreground));
  overflow-wrap: break-word;
}

.brush-detail-header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.375rem;
}

.brush-detail-meta-item {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.brush-detail-meta-sep {
  font-size: 0.875rem;
  color: hsl(var(--border));
}

.brush-detail-header-tags {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
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
  text-align: center;
  background-color: hsl(var(--accent));
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.brush-detail-metric-card:hover {
  background-color: hsl(var(--accent) / 80%);
}

.brush-detail-metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin-bottom: 0.5rem;
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  border-radius: 0.5rem;
}

.brush-detail-metric-icon.delete {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 10%);
}

.brush-detail-metric-icon.upload {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 10%);
}

.brush-detail-metric-icon.download {
  color: hsl(var(--info));
  background-color: hsl(var(--info) / 10%);
}

.brush-detail-metric-value {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.2;
  color: hsl(var(--card-foreground));
}

.brush-detail-metric-value.delete {
  color: hsl(var(--destructive));
}

.brush-detail-metric-label {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* 配置信息 */
.brush-detail-config {
  padding: 1rem;
  background-color: hsl(var(--accent));
  border-radius: 0.75rem;
}

.brush-detail-config-title {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.brush-detail-config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
}

.brush-detail-config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  gap: 0.375rem;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
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
  margin-bottom: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.brush-detail-rss-url {
  font-family: monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  word-break: break-all;
}
</style>
