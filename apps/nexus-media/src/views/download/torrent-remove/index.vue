<script lang="ts" setup>
import { h, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTooltip,
} from 'naive-ui';

import {
  autoRemoveTorrentsApi,
  deleteTorrentRemoveTaskApi,
  getDownloadersApi,
  getRemoveTorrentsApi,
  getSeedStatusesApi,
  getTorrentRemoveTasksApi,
  saveTorrentRemoveTaskApi,
} from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useAppNotification } from '#/utils/notify';

interface RemoveTask {
  id: number | string;
  name: string;
  downloader: string;
  downloader_name: string;
  downloader_type: string;
  only_nexus_media: number;
  samedata: number;
  action: number;
  config: {
    filter_status: string[];
    ratio: number;
    savepath_key: string;
    seeding_time: number;
    size: number[];
    tags: string[];
    tracker_key: string;
    upload_avs: number;
  };
  interval: number;
  enabled: number;
}

interface DownloaderOption {
  id: string;
  name: string;
  type: string;
}

const notification = useAppNotification();
const loading = ref(false);
const tasks = ref<RemoveTask[]>([]);
const downloaders = ref<DownloaderOption[]>([]);

const modalShow = ref(false);
const editing = ref<Partial<RemoveTask>>({});
const editLoading = ref(false);

const tagInput = ref('');
const filterStatusInput = ref<string[]>([]);
const seedStatusOptions = ref<{ label: string; value: string }[]>([]);
const sizeInput = ref('');

const previewModalShow = ref(false);
const previewLoading = ref(false);
const previewTorrents = ref<any[]>([]);
const previewTargetName = ref('');

const runningId = ref<null | number | string>(null);
const togglingId = ref<null | number | string>(null);

const actionMap: Record<number, { cls: string; icon: string; label: string }> =
  {
    1: { label: '暂停种子', icon: 'lucide:octagon-pause', cls: 'pause' },
    2: { label: '删除种子', icon: 'lucide:trash-2', cls: 'remove' },
    3: { label: '删除种子及文件', icon: 'lucide:folder-x', cls: 'purge' },
  };

const actionOptions = [
  { label: '暂停种子', value: 1 },
  { label: '删除种子', value: 2 },
  { label: '删除种子及文件', value: 3 },
];

async function fetchData() {
  loading.value = true;
  try {
    const [tasksRes, downloadersRes, statusesRes] = await Promise.all([
      getTorrentRemoveTasksApi(),
      getDownloadersApi(),
      getSeedStatusesApi(),
    ]);
    const tasksDict = (tasksRes as any)?.data || tasksRes || {};
    tasks.value = Object.values(tasksDict);
    const dlDict = (downloadersRes as any)?.data || downloadersRes || {};
    downloaders.value = Object.entries(dlDict).map(
      ([id, v]: [string, any]) => ({
        id,
        name: v.name || '',
        type: v.type || '',
      }),
    );
    seedStatusOptions.value = (statusesRes as any)?.data || statusesRes || [];
  } finally {
    loading.value = false;
  }
}

function openEdit(task?: RemoveTask) {
  if (task) {
    editing.value = { ...task };
    tagInput.value = task.config?.tags?.join(';') || '';
    filterStatusInput.value = task.config?.filter_status || [];
    sizeInput.value =
      task.config?.size?.length === 2
        ? `${task.config.size[0]}-${task.config.size[1]}`
        : '';
  } else {
    editing.value = {
      id: '',
      name: '',
      downloader: '',
      action: 2,
      interval: 60,
      enabled: 1,
      samedata: 0,
      only_nexus_media: 1,
      config: {
        ratio: 0,
        seeding_time: 0,
        upload_avs: 0,
        size: [],
        tags: [],
        savepath_key: '',
        tracker_key: '',
        filter_status: [],
      },
    };
    tagInput.value = '';
    filterStatusInput.value = [];
    sizeInput.value = '';
  }
  modalShow.value = true;
}

function buildPayload(
  d: Partial<RemoveTask>,
  overrides: { enabled?: number } = {},
): Record<string, any> {
  const cfg = d.config || ({} as RemoveTask['config']);
  return {
    tid: d.id || '',
    name: d.name,
    downloader: d.downloader,
    action: d.action,
    interval: Number(d.interval) || 0,
    enabled: overrides.enabled ?? d.enabled ?? 0,
    samedata: d.samedata ?? 0,
    only_nexus_media: d.only_nexus_media ?? 0,
    ratio: Number(cfg.ratio) || 0,
    seeding_time: Number(cfg.seeding_time) || 0,
    upload_avs: Number(cfg.upload_avs) || 0,
    size:
      cfg.size?.length === 2
        ? `${cfg.size[0]}-${cfg.size[1]}`
        : sizeInput.value,
    tags: cfg.tags?.join(';') ?? tagInput.value,
    savepath_key: cfg.savepath_key || '',
    tracker_key: cfg.tracker_key || '',
    filter_status: (cfg.filter_status || []).join(';'),
  };
}

async function handleSave() {
  const d = editing.value;
  if (!d.name) {
    notification.error('请输入名称');
    return;
  }
  if (!d.downloader) {
    notification.error('请选择下载器');
    return;
  }
  if (!d.interval || Number.isNaN(Number(d.interval))) {
    notification.error('请输入有效的运行间隔');
    return;
  }

  editLoading.value = true;
  try {
    const payload = buildPayload(d);
    payload.size = sizeInput.value;
    payload.tags = tagInput.value;
    payload.filter_status = filterStatusInput.value.join(';');
    await saveTorrentRemoveTaskApi(payload);
    notification.success(d.id ? '任务已更新' : '任务已创建');
    modalShow.value = false;
    await fetchData();
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  } finally {
    editLoading.value = false;
  }
}

async function doDelete(task: RemoveTask) {
  try {
    await deleteTorrentRemoveTaskApi(task.id);
    notification.success('任务已删除');
    await fetchData();
  } catch (error: any) {
    notification.error('删除失败', { description: error?.message || '' });
  }
}

async function handleToggleEnabled(task: RemoveTask, enabled: number) {
  togglingId.value = task.id;
  try {
    await saveTorrentRemoveTaskApi(buildPayload(task, { enabled }));
    task.enabled = enabled;
    notification.success(enabled ? '任务已启用' : '任务已停用');
  } catch (error: any) {
    notification.error('操作失败', { description: error?.message || '' });
  } finally {
    togglingId.value = null;
  }
}

async function handlePreview(task: RemoveTask) {
  previewModalShow.value = true;
  previewLoading.value = true;
  previewTargetName.value = task.name;
  previewTorrents.value = [];
  try {
    const res = (await getRemoveTorrentsApi(task.id)) as any;
    previewTorrents.value = res?.data || res || [];
  } catch (error: any) {
    notification.error('获取预览失败', { description: error?.message || '' });
  } finally {
    previewLoading.value = false;
  }
}

async function handleRunNow(task: RemoveTask) {
  runningId.value = task.id;
  try {
    await autoRemoveTorrentsApi(task.id);
    notification.success('任务执行完成');
    await fetchData();
  } catch (error: any) {
    notification.error('执行失败', { description: error?.message || '' });
  } finally {
    runningId.value = null;
  }
}

function buildTaskSummary(task: RemoveTask) {
  const cfg = task.config || ({} as RemoveTask['config']);
  const items: Array<{ color: string; icon: string; text: string }> = [];
  if (cfg.ratio)
    items.push({
      icon: 'lucide:trending-up',
      text: `分享率 ≥ ${cfg.ratio}`,
      color: 'primary',
    });
  if (cfg.seeding_time)
    items.push({
      icon: 'lucide:timer',
      text: `做种 ≥ ${cfg.seeding_time}h`,
      color: 'quality',
    });
  if (cfg.upload_avs)
    items.push({
      icon: 'lucide:gauge',
      text: `平均上传 ≤ ${cfg.upload_avs}KB/s`,
      color: 'hdr',
    });
  if (cfg.size?.length === 2)
    items.push({
      icon: 'lucide:hard-drive',
      text: `大小 ${cfg.size[0]}-${cfg.size[1]}GB`,
      color: 'audio',
    });
  if (cfg.tags?.length)
    items.push({
      icon: 'lucide:tags',
      text: `标签: ${cfg.tags.join(', ')}`,
      color: 'lang',
    });
  if (cfg.savepath_key)
    items.push({
      icon: 'lucide:folder-search',
      text: `路径: ${cfg.savepath_key}`,
      color: 'edition',
    });
  if (cfg.tracker_key)
    items.push({
      icon: 'lucide:radar',
      text: `Tracker: ${cfg.tracker_key}`,
      color: 'source',
    });
  if (cfg.filter_status?.length)
    items.push({
      icon: 'lucide:activity',
      text: `状态: ${cfg.filter_status.join(', ')}`,
      color: 'dolby',
    });
  if (task.samedata)
    items.push({ icon: 'lucide:copy', text: '处理辅种', color: 'default' });
  if (task.only_nexus_media)
    items.push({
      icon: 'lucide:shield',
      text: '仅处理本工具下载',
      color: 'default',
    });
  return items;
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(2)} GB`;
}

const previewColumns = [
  { title: '种子名称', key: 'name', ellipsis: { tooltip: true } },
  { title: '站点', key: 'site', width: 120 },
  {
    title: '大小',
    key: 'size',
    width: 100,
    render(row: any) {
      return formatSize(row.size);
    },
  },
];

function HelpIcon(props: { text: string }) {
  return h(
    NTooltip,
    { trigger: 'hover' },
    {
      trigger: () =>
        h(
          NIcon,
          { class: 'help-icon', size: 14 },
          { default: () => h(IconifyIcon, { icon: 'lucide:help-circle' }) },
        ),
      default: () => props.text,
    },
  );
}

function labelWithHelp(label: string, helpText: string) {
  return h('span', { class: 'form-label-help' }, [
    label,
    h(HelpIcon, { text: helpText }),
  ]);
}

onMounted(fetchData);
</script>

<template>
  <div class="remove-page">
    <PageHeader
      title="自动删种任务"
      subtitle="按条件自动暂停或删除下载器中的种子"
    >
      <template #actions>
        <NButton text size="small" @click="fetchData">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-3.5" />
          </template>
        </NButton>
      </template>
    </PageHeader>

    <div class="section-bar">
      <span class="section-count">{{ tasks.length }} 个任务</span>
      <NButton
        size="small"
        secondary
        class="add-btn-section"
        @click="openEdit()"
      >
        <template #icon>
          <IconifyIcon icon="lucide:plus" class="size-3.5" />
        </template>
        新增删种任务
      </NButton>
    </div>

    <NSpin :show="loading">
      <div v-if="tasks.length > 0" class="task-list">
        <article v-for="task in tasks" :key="task.id" class="task-card">
          <div class="card-content">
            <div class="card-top">
              <span
                class="type-chip"
                :class="`type-chip--${actionMap[task.action]?.cls || 'remove'}`"
              >
                <IconifyIcon
                  :icon="actionMap[task.action]?.icon || 'lucide:trash-2'"
                  class="size-3"
                />
                {{ actionMap[task.action]?.label || '未知动作' }}
              </span>
              <span
                class="status-dot"
                :class="task.enabled ? 'status-dot--on' : 'status-dot--off'"
                :title="task.enabled ? '已启用' : '已停用'"
              ></span>
            </div>

            <h3 class="card-name">{{ task.name }}</h3>
            <p class="card-meta">
              {{ task.downloader_name || task.downloader }} · 每
              {{ task.interval }} 分钟
            </p>

            <div v-if="buildTaskSummary(task).length > 0" class="rule-items">
              <span
                v-for="item in buildTaskSummary(task)"
                :key="item.text"
                class="rule-chip"
                :class="`rule-chip--${item.color}`"
              >
                <IconifyIcon :icon="item.icon" class="size-3" />
                {{ item.text }}
              </span>
            </div>
            <div v-else class="card-empty">
              <IconifyIcon icon="lucide:inbox" class="size-3.5" />
              无过滤条件，将处理下载器中的全部种子
            </div>

            <div class="card-footer">
              <div class="footer-status">
                <span
                  class="footer-label"
                  :class="{ 'footer-label--on': task.enabled }"
                >
                  {{ task.enabled ? '已启用' : '已停用' }}
                </span>
                <NSwitch
                  size="small"
                  :value="task.enabled"
                  :checked-value="1"
                  :unchecked-value="0"
                  :loading="togglingId === task.id"
                  @update:value="(v: any) => handleToggleEnabled(task, v)"
                />
              </div>
              <div class="card-actions">
                <NButton
                  size="small"
                  secondary
                  :loading="runningId === task.id"
                  @click="handleRunNow(task)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:zap" class="size-3.5" />
                  </template>
                  执行
                </NButton>
                <NButton size="small" secondary @click="handlePreview(task)">
                  <template #icon>
                    <IconifyIcon icon="lucide:eye" class="size-3.5" />
                  </template>
                  预览
                </NButton>
                <NButton size="small" secondary @click="openEdit(task)">
                  <template #icon>
                    <IconifyIcon icon="lucide:pencil" class="size-3.5" />
                  </template>
                  编辑
                </NButton>
                <NPopconfirm @positive-click="doDelete(task)">
                  <template #trigger>
                    <NButton
                      size="small"
                      secondary
                      type="error"
                      aria-label="删除"
                    >
                      <template #icon>
                        <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                      </template>
                    </NButton>
                  </template>
                  确定删除「{{ task.name }}」？
                </NPopconfirm>
              </div>
            </div>
          </div>
        </article>
      </div>

      <EmptyState
        v-else-if="!loading"
        title="没有删种任务"
        subtitle="创建任务后将按条件自动管理下载器中的种子"
      >
        <template #icon>
          <IconifyIcon icon="lucide:trash-2" class="h-12 w-12 opacity-50" />
        </template>
        <template #action>
          <NButton type="primary" @click="openEdit()">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            新增删种任务
          </NButton>
        </template>
      </EmptyState>
    </NSpin>

    <!-- 新增/编辑弹窗 -->
    <NModal
      v-model:show="modalShow"
      :title="editing.id ? '编辑删种任务' : '新增删种任务'"
      preset="card"
      :style="{ width: '820px', maxWidth: '95vw' }"
      :bordered="false"
      :segmented="{ content: true }"
      :mask-closable="false"
    >
      <NForm label-placement="top" size="small" class="remove-form">
        <div class="form-grid">
          <div class="group-title">
            <IconifyIcon icon="lucide:settings-2" class="h-3.5 w-3.5" />
            基本信息
          </div>
          <NFormItem label="名称" required>
            <NInput v-model:value="editing.name" placeholder="任务别名" />
          </NFormItem>
          <NFormItem label="下载器" required>
            <NSelect
              v-model:value="editing.downloader"
              :options="
                downloaders.map((d) => ({ label: d.name, value: d.id }))
              "
              placeholder="请选择"
              clearable
            />
          </NFormItem>
          <NFormItem path="action">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp(
                      '动作',
                      '满足条件后对种子执行的操作：暂停、删除种子或连同文件一起删除',
                    )
                "
              />
            </template>
            <NSelect v-model:value="editing.action" :options="actionOptions" />
          </NFormItem>
          <NFormItem path="interval">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp('运行间隔（分钟）', '任务自动执行的间隔时间')
                "
              />
            </template>
            <NInputNumber
              v-model:value="editing.interval"
              :min="1"
              placeholder="分钟"
              class="w-full"
            />
          </NFormItem>
          <NFormItem path="samedata">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp(
                      '处理辅种',
                      '开启后相同数据的辅种也会被一并处理',
                    )
                "
              />
            </template>
            <NSwitch
              v-model:value="editing.samedata"
              :checked-value="1"
              :unchecked-value="0"
            />
          </NFormItem>
          <NFormItem path="only_nexus_media">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp(
                      '隔离',
                      '仅处理通过本工具下载的种子，忽略手动添加的种子',
                    )
                "
              />
            </template>
            <NSwitch
              v-model:value="editing.only_nexus_media"
              :checked-value="1"
              :unchecked-value="0"
            />
          </NFormItem>
          <NFormItem label="启用任务">
            <NSwitch
              v-model:value="editing.enabled"
              :checked-value="1"
              :unchecked-value="0"
            />
          </NFormItem>

          <div class="group-title">
            <IconifyIcon icon="lucide:filter" class="h-3.5 w-3.5" />
            数值条件（留空 / 为 0 则不限制）
          </div>
          <NFormItem path="ratio">
            <template #label>
              <component
                :is="() => labelWithHelp('分享率', '分享率达到设定值时处理')"
              />
            </template>
            <NInputNumber
              v-model:value="editing.config!.ratio"
              :min="0"
              :precision="1"
              placeholder="如: 1"
              class="w-full"
            />
          </NFormItem>
          <NFormItem path="seeding_time">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp('做种时间（小时）', '做种超过设定时间时处理')
                "
              />
            </template>
            <NInputNumber
              v-model:value="editing.config!.seeding_time"
              :min="0"
              placeholder="如: 72"
              class="w-full"
            />
          </NFormItem>
          <NFormItem path="upload_avs">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp(
                      '平均上传速度（KB/s）',
                      '平均上传速度低于设定值时处理',
                    )
                "
              />
            </template>
            <NInputNumber
              v-model:value="editing.config!.upload_avs"
              :min="0"
              placeholder="如: 100"
              class="w-full"
            />
          </NFormItem>
          <NFormItem path="size">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp('种子大小（GB）', '仅处理大小在范围内的种子')
                "
              />
            </template>
            <NInput v-model:value="sizeInput" placeholder="如 1-10" />
          </NFormItem>

          <div class="group-title">
            <IconifyIcon icon="lucide:search" class="h-3.5 w-3.5" />
            匹配条件
          </div>
          <NFormItem path="tags">
            <template #label>
              <component
                :is="() => labelWithHelp('标签', '多个标签用英文分号 ; 分隔')"
              />
            </template>
            <NInput v-model:value="tagInput" placeholder="多个标签用;分隔" />
          </NFormItem>
          <NFormItem path="savepath_key">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp(
                      '保存路径关键词',
                      '匹配种子保存路径，支持正则',
                    )
                "
              />
            </template>
            <NInput
              v-model:value="editing.config!.savepath_key"
              placeholder="支持正则"
            />
          </NFormItem>
          <NFormItem path="tracker_key">
            <template #label>
              <component
                :is="
                  () =>
                    labelWithHelp(
                      'Tracker 关键词',
                      '匹配 tracker 地址，支持正则',
                    )
                "
              />
            </template>
            <NInput
              v-model:value="editing.config!.tracker_key"
              placeholder="支持正则"
            />
          </NFormItem>
          <NFormItem label="种子状态" class="form-item-wide">
            <NSelect
              v-model:value="filterStatusInput"
              :options="seedStatusOptions"
              multiple
              clearable
              placeholder="不选则不过滤状态"
            />
          </NFormItem>
        </div>

        <div class="form-footer">
          <NSpace>
            <NButton type="primary" :loading="editLoading" @click="handleSave">
              <template #icon>
                <IconifyIcon icon="lucide:check" class="h-4 w-4" />
              </template>
              {{ editing.id ? '保存' : '创建' }}
            </NButton>
            <NButton @click="modalShow = false">
              <template #icon>
                <IconifyIcon icon="lucide:x" class="h-4 w-4" />
              </template>
              取消
            </NButton>
          </NSpace>
        </div>
      </NForm>
    </NModal>

    <!-- 预览弹窗 -->
    <NModal
      v-model:show="previewModalShow"
      :title="`待处理种子 - ${previewTargetName}`"
      preset="card"
      :style="{ width: '640px', maxWidth: '95vw' }"
      :bordered="false"
      :segmented="{ content: true }"
    >
      <NSpin :show="previewLoading">
        <NDataTable
          v-if="previewTorrents.length > 0"
          :columns="previewColumns"
          :data="previewTorrents"
          :bordered="false"
          :single-line="false"
          size="small"
        />
        <EmptyState
          v-else-if="!previewLoading"
          title="没有满足条件的种子"
          subtitle="当前没有符合删种条件的种子"
        />
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped>
/* ========== Page Layout ========== */
.remove-page {
  padding: 1.5rem;
}

/* ========== Section Bar ========== */
.section-bar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.section-count {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.add-btn-section {
  font-size: 0.8125rem;
}

/* ========== Card List ========== */
.task-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.875rem;
}

.task-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  transition:
    box-shadow 0.15s,
    border-color 0.15s;
}

.task-card:hover {
  border-color: hsl(var(--border));
  box-shadow: 0 4px 16px -4px hsl(var(--border) / 40%);
}

.card-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 1rem 1.25rem 1.125rem;
}

.card-top {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

/* ========== Type Chip ========== */
.type-chip {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-radius: 0.25rem;
}

.type-chip--pause {
  color: hsl(var(--success));
  background: hsl(var(--success) / 8%);
}

.type-chip--remove {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 8%);
}

.type-chip--purge {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
}

/* ========== Card Actions ========== */
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
  justify-content: flex-end;
}

/* ========== Card Name & Meta ========== */
.status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot--on {
  background: hsl(var(--success));
}

.status-dot--off {
  background: hsl(var(--muted-foreground) / 50%);
}

.card-name {
  margin-top: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  overflow-wrap: break-word;
}

.card-meta {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* ========== Rule Chips ========== */
.rule-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.625rem;
}

.rule-chip {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
}

.rule-chip--primary {
  color: hsl(var(--tag-primary));
  background: hsl(var(--tag-primary) / 8%);
}

.rule-chip--quality {
  color: hsl(var(--tag-quality));
  background: hsl(var(--tag-quality) / 8%);
}

.rule-chip--hdr {
  color: hsl(var(--tag-hdr));
  background: hsl(var(--tag-hdr) / 10%);
}

.rule-chip--audio {
  color: hsl(var(--tag-audio));
  background: hsl(var(--tag-audio) / 8%);
}

.rule-chip--lang {
  color: hsl(var(--tag-lang));
  background: hsl(var(--tag-lang) / 8%);
}

.rule-chip--edition {
  color: hsl(var(--tag-edition));
  background: hsl(var(--tag-edition) / 8%);
}

.rule-chip--source {
  color: hsl(var(--tag-source));
  background: hsl(var(--tag-source) / 8%);
}

.rule-chip--dolby {
  color: hsl(var(--tag-dolby));
  background: hsl(var(--tag-dolby) / 8%);
}

.rule-chip--default {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted-foreground) / 8%);
}

/* ========== Card Empty ========== */
.card-empty {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

/* ========== Card Footer ========== */
.card-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.625rem;
  margin-top: auto;
  border-top: 1px solid hsl(var(--border) / 50%);
}

.card-content .rule-items,
.card-content .card-empty {
  margin-bottom: 0.75rem;
}

.footer-status {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.footer-label {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.footer-label--on {
  color: hsl(var(--success));
}

/* ========== Form Modal ========== */
.remove-form {
  padding: 0.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem 1rem;
}

.form-item-wide {
  grid-column: 1 / -1;
}

.group-title {
  display: flex;
  grid-column: 1 / -1;
  gap: 0.375rem;
  align-items: center;
  padding-bottom: 0.5rem;
  margin-bottom: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.group-title:not(:first-child) {
  margin-top: 1rem;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  margin-top: 1.5rem;
  border-top: 1px solid hsl(var(--border));
}

:deep(.form-label-help) {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}

:deep(.help-icon) {
  color: hsl(var(--muted-foreground));
  cursor: help;
  opacity: 0.6;
  transition: opacity 0.2s;
}

:deep(.help-icon:hover) {
  color: hsl(var(--primary));
  opacity: 1;
}

/* ========== Mobile ========== */
@media (max-width: 768px) {
  .remove-page {
    padding: 0.75rem;
  }

  .task-list {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
