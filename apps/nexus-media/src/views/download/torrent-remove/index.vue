<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSpin,
  NSelect,
  NTag,
  NDataTable,
  useMessage,
} from 'naive-ui';

import { IconifyIcon } from '@vben/icons';

import {
  autoRemoveTorrentsApi,
  deleteTorrentRemoveTaskApi,
  getDownloadersApi,
  getRemoveTorrentsApi,
  getTorrentRemoveTasksApi,
  saveTorrentRemoveTaskApi,
} from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

interface RemoveTask {
  id: string | number;
  name: string;
  downloader: string;
  downloader_name: string;
  downloader_type: string;
  only_nexus_media: number;
  samedata: number;
  action: number;
    config: {
      ratio: number;
      seeding_time: number;
      upload_avs: number;
      size: number[];
      tags: string[];
      savepath_key: string;
      tracker_key: string;
      filter_status: string[];
    };
  interval: number;
  enabled: number;
}

interface DownloaderOption {
  id: string;
  name: string;
  type: string;
}

const message = useMessage();
const loading = ref(false);
const tasks = ref<RemoveTask[]>([]);
const downloaders = ref<DownloaderOption[]>([]);

const editModalShow = ref(false);
const editing = ref<Partial<RemoveTask>>({});
const editingConfig = ref<RemoveTask['config']>({
  ratio: 0,
  seeding_time: 0,
  upload_avs: 0,
  size: [],
  tags: [],
  savepath_key: '',
  tracker_key: '',
  filter_status: [],
});
const editLoading = ref(false);

const tagInput = ref('');
const filterStatusInput = ref('');
const sizeInput = ref('');

const deleteModalShow = ref(false);
const deleteTarget = ref<RemoveTask | null>(null);

const previewModalShow = ref(false);
const previewLoading = ref(false);
const previewTorrents = ref<any[]>([]);
const previewTargetName = ref('');

const expandedIds = ref<Set<string | number>>(new Set());

const taskList = computed(() => tasks.value);

const actionMap: Record<number, { label: string; type: string }> = {
  1: { label: '暂停种子', type: 'default' },
  2: { label: '删除种子', type: 'warning' },
  3: { label: '删除种子及文件', type: 'error' },
};

async function fetchData() {
  loading.value = true;
  try {
    const [tasksRes, downloadersRes] = await Promise.all([
      getTorrentRemoveTasksApi(),
      getDownloadersApi(),
    ]);
    const tasksDict = (tasksRes as any)?.data || tasksRes || {};
    tasks.value = Object.values(tasksDict);
    const dlDict = (downloadersRes as any)?.data || downloadersRes || {};
    downloaders.value = Object.entries(dlDict).map(([id, v]: [string, any]) => ({
      id,
      name: v.name || '',
      type: v.type || '',
    }));
  } finally {
    loading.value = false;
  }
}

function toggleExpand(id: string | number) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
}

function handleAdd() {
  editing.value = {
    id: '',
    name: '',
    downloader: '',
    action: 2,
    interval: 60,
    enabled: 0,
    samedata: 0,
    only_nexus_media: 1,
  };
  tagInput.value = '';
  filterStatusInput.value = '';
  sizeInput.value = '';
  editingConfig.value = {
    ratio: 0,
    seeding_time: 0,
    upload_avs: 0,
    size: [],
    tags: [],
    savepath_key: '',
    tracker_key: '',
    filter_status: [],
  };
  editModalShow.value = true;
}

function handleEdit(task: RemoveTask) {
  editing.value = { ...task };
  editingConfig.value = {
    ratio: task.config?.ratio || 0,
    seeding_time: task.config?.seeding_time || 0,
    upload_avs: task.config?.upload_avs || 0,
    size: task.config?.size || [],
    tags: task.config?.tags || [],
    savepath_key: task.config?.savepath_key || '',
    tracker_key: task.config?.tracker_key || '',
    filter_status: task.config?.filter_status || [],
  };
  tagInput.value = task.config?.tags?.join(';') || '';
  filterStatusInput.value = task.config?.filter_status?.join(';') || '';
  sizeInput.value = task.config?.size?.length === 2 ? `${task.config.size[0]}-${task.config.size[1]}` : '';
  editModalShow.value = true;
}

async function handleSave() {
  const d = editing.value;
  if (!d.name) {
    message.error('请输入名称');
    return;
  }
  if (!d.downloader) {
    message.error('请选择下载器');
    return;
  }
  if (!d.interval || Number.isNaN(Number(d.interval))) {
    message.error('请输入有效的运行间隔');
    return;
  }

  editLoading.value = true;
  try {
    const payload: Record<string, any> = {
      tid: d.id || '',
      name: d.name,
      downloader: d.downloader,
      action: d.action,
      interval: Number(d.interval),
      enabled: d.enabled,
      samedata: d.samedata,
      only_nexus_media: d.only_nexus_media,
      ratio: Number(editingConfig.value.ratio) || 0,
      seeding_time: Number(editingConfig.value.seeding_time) || 0,
      upload_avs: Number(editingConfig.value.upload_avs) || 0,
      size: sizeInput.value,
      tags: tagInput.value,
      savepath_key: editingConfig.value.savepath_key || '',
      tracker_key: editingConfig.value.tracker_key || '',
      filter_status: filterStatusInput.value,
    };

    await saveTorrentRemoveTaskApi(payload);
    message.success('保存成功');
    editModalShow.value = false;
    await fetchData();
  } catch (e: any) {
    message.error(e?.message || '保存失败');
  } finally {
    editLoading.value = false;
  }
}

function confirmDelete(task: RemoveTask) {
  deleteTarget.value = task;
  deleteModalShow.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  await deleteTorrentRemoveTaskApi(deleteTarget.value.id);
  deleteModalShow.value = false;
  deleteTarget.value = null;
  message.success('删除成功');
  await fetchData();
}

async function handlePreview(task: RemoveTask) {
  previewModalShow.value = true;
  previewLoading.value = true;
  previewTargetName.value = task.name;
  previewTorrents.value = [];
  try {
    const res = (await getRemoveTorrentsApi(task.id)) as any;
    previewTorrents.value = res?.data || res || [];
  } catch (e: any) {
    message.error(e?.message || '获取预览失败');
  } finally {
    previewLoading.value = false;
  }
}

async function handleRunNow(task: RemoveTask) {
  try {
    await autoRemoveTorrentsApi(task.id);
    message.success('任务执行完成');
    await fetchData();
  } catch (e: any) {
    message.error(e?.message || '执行失败');
  }
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(2)} GB`;
}

const previewColumns = [
  { title: '种子名称', key: 'name', ellipsis: { tooltip: true } },
  {
    title: '站点',
    key: 'site',
    width: 120,
  },
  {
    title: '大小',
    key: 'size',
    width: 100,
    render(row: any) {
      return formatSize(row.size);
    },
  },
];

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader title="自动删种任务" subtitle="按条件自动管理下载器中的种子">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="handleAdd">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            新增删种任务
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="taskList.length > 0" class="task-grid">
        <NCard
          v-for="task in taskList"
          :key="task.id"
          size="small"
          :bordered="false"
          class="task-card"
        >
          <div class="task-header">
            <div class="flex items-center gap-2">
              <span
                class="status-dot"
                :class="task.enabled ? 'status-active' : 'status-inactive'"
              />
              <span class="task-name truncate">{{ task.name }}</span>
              <NTag
                :type="actionMap[task.action]?.type as any"
                size="tiny"
              >
                {{ actionMap[task.action]?.label }}
              </NTag>
            </div>
            <div class="flex items-center gap-1">
              <NButton
                size="tiny"
                text
                @click="handleRunNow(task)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:zap" class="size-4" />
                </template>
              </NButton>
              <NButton
                size="tiny"
                text
                @click="handlePreview(task)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:eye" class="size-4" />
                </template>
              </NButton>
              <NButton
                size="tiny"
                text
                @click="handleEdit(task)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:pencil" class="size-4" />
                </template>
              </NButton>
              <NButton
                size="tiny"
                text
                type="error"
                @click="confirmDelete(task)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:trash-2" class="size-4" />
                </template>
              </NButton>
              <NButton
                size="tiny"
                text
                @click="toggleExpand(task.id)"
              >
                <template #icon>
                  <IconifyIcon
                    :icon="
                      expandedIds.has(task.id)
                        ? 'lucide:chevron-up'
                        : 'lucide:chevron-down'
                    "
                    class="size-4"
                  />
                </template>
              </NButton>
            </div>
          </div>

          <div
            v-if="expandedIds.has(task.id)"
            class="task-detail"
          >
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-label">下载器</div>
                <div class="detail-value">
                  <NTag size="tiny" type="info">{{ task.downloader_name }}</NTag>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">刷新间隔</div>
                <div class="detail-value">{{ task.interval }} 分钟</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">隔离</div>
                <div class="detail-value">
                  <NTag v-if="task.only_nexus_media" size="tiny">隔离</NTag>
                  <span v-else class="detail-muted">否</span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">处理辅种</div>
                <div class="detail-value">
                  <NTag v-if="task.samedata" size="tiny">处理</NTag>
                  <span v-else class="detail-muted">否</span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">分享率</div>
                <div class="detail-value">
                  <span v-if="task.config?.ratio">{{ task.config.ratio }} +</span>
                  <span v-else class="detail-muted">-</span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">做种时间</div>
                <div class="detail-value">
                  <span v-if="task.config?.seeding_time">{{ task.config.seeding_time }} 小时 +</span>
                  <span v-else class="detail-muted">-</span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">平均上传速度</div>
                <div class="detail-value">
                  <span v-if="task.config?.upload_avs">{{ task.config.upload_avs }} KB/s -</span>
                  <span v-else class="detail-muted">-</span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">大小范围</div>
                <div class="detail-value">
                  <span v-if="task.config?.size?.length === 2">{{ task.config.size[0] }}-{{ task.config.size[1] }} GB</span>
                  <span v-else class="detail-muted">-</span>
                </div>
              </div>
              <div
                v-if="task.config?.savepath_key"
                class="detail-item detail-item-wide"
              >
                <div class="detail-label">保存路径关键词</div>
                <div class="detail-value">
                  <NTag size="tiny" type="warning">{{ task.config.savepath_key }}</NTag>
                </div>
              </div>
              <div
                v-if="task.config?.tracker_key"
                class="detail-item detail-item-wide"
              >
                <div class="detail-label">tracker关键词</div>
                <div class="detail-value">
                  <NTag size="tiny" type="warning">{{ task.config.tracker_key }}</NTag>
                </div>
              </div>
              <div
                v-if="task.config?.filter_status?.length"
                class="detail-item detail-item-wide"
              >
                <div class="detail-label">种子状态</div>
                <div class="detail-value">
                  <NTag
                    v-for="st in task.config?.filter_status"
                    :key="st"
                    size="tiny"
                    type="info"
                    class="mr-1"
                  >{{ st }}</NTag>
                </div>
              </div>
              <div
                v-if="task.config?.tags?.length"
                class="detail-item detail-item-wide"
              >
                <div class="detail-label">标签</div>
                <div class="detail-value">
                  <NTag
                    v-for="tag in task.config.tags"
                    :key="tag"
                    size="tiny"
                    class="mr-1"
                  >{{ tag }}</NTag>
                </div>
              </div>
            </div>
          </div>
        </NCard>
      </div>

      <EmptyState
        v-else-if="!loading"
        title="没有删种任务"
        subtitle="当前没有正在运行的自动删种任务"
      >
        <template #icon>
          <IconifyIcon
            icon="lucide:trash-2"
            class="size-16"
            style="color: hsl(var(--muted-foreground))"
          />
        </template>
        <template #action>
          <NButton type="primary" @click="handleAdd">
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
      v-model:show="editModalShow"
      :title="editing.id ? '编辑删种任务' : '新增删种任务'"
      preset="card"
      class="w-[720px]"
    >
      <NForm label-placement="top">
        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="名称" required>
            <NInput v-model:value="editing.name" placeholder="别名" />
          </NFormItem>
          <NFormItem label="下载器" required>
            <NSelect
              v-model:value="editing.downloader"
              :options="downloaders.map((d) => ({ label: d.name, value: d.id }))"
              placeholder="请选择"
              clearable
            />
          </NFormItem>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <NFormItem label="动作">
            <NSelect
              v-model:value="editing.action"
              :options="[
                { label: '暂停种子', value: 1 },
                { label: '删除种子', value: 2 },
                { label: '删除种子及文件', value: 3 },
              ]"
            />
          </NFormItem>
          <NFormItem label="运行间隔（分钟）" required>
            <NInput
              v-model:value="editing.interval as any"
              placeholder="分钟"
            />
          </NFormItem>
          <NFormItem label="状态">
            <NSelect
              v-model:value="editing.enabled"
              :options="[
                { label: '启用', value: 1 },
                { label: '停用', value: 0 },
              ]"
            />
          </NFormItem>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <NFormItem label="处理辅种">
            <NSelect
              v-model:value="editing.samedata"
              :options="[
                { label: '是', value: 1 },
                { label: '否', value: 0 },
              ]"
            />
          </NFormItem>
          <NFormItem label="隔离">
            <NSelect
              v-model:value="editing.only_nexus_media"
              :options="[
                { label: '是', value: 1 },
                { label: '否', value: 0 },
              ]"
            />
          </NFormItem>
          <NFormItem label="种子大小（GB）">
            <NInput
              v-model:value="sizeInput"
              placeholder="如 1-10"
            />
          </NFormItem>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <NFormItem label="分享率">
            <NInput
              v-model:value="editingConfig.ratio as any"
              placeholder="保留一位小数"
            />
          </NFormItem>
          <NFormItem label="做种时间（小时）">
            <NInput
              v-model:value="editingConfig.seeding_time as any"
              placeholder="小时"
            />
          </NFormItem>
          <NFormItem label="平均上传速度（KB/s）">
            <NInput
              v-model:value="editingConfig.upload_avs as any"
              placeholder="KB/s"
            />
          </NFormItem>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <NFormItem label="标签">
            <NInput
              v-model:value="tagInput"
              placeholder="多个标签用;分隔"
            />
          </NFormItem>
          <NFormItem label="保存路径关键词">
            <NInput
              v-model:value="editingConfig.savepath_key"
              placeholder="支持正则"
            />
          </NFormItem>
          <NFormItem label="tracker关键词">
            <NInput
              v-model:value="editingConfig.tracker_key"
              placeholder="支持正则"
            />
          </NFormItem>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="种子状态">
            <NInput
              v-model:value="filterStatusInput"
              placeholder="多个状态用;分隔"
            />
          </NFormItem>
        </div>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="editModalShow = false">取消</NButton>
          <NButton type="primary" :loading="editLoading" @click="handleSave">
            保存
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 删除确认 -->
    <NModal
      v-model:show="deleteModalShow"
      title="删除删种任务"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="handleDelete"
    >
      确定要删除删种任务 <strong>{{ deleteTarget?.name }}</strong> 吗？
    </NModal>

    <!-- 预览弹窗 -->
    <NModal
      v-model:show="previewModalShow"
      :title="`预处理种子列表 - ${previewTargetName}`"
      preset="card"
      class="w-[640px]"
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
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 0.75rem;
}

.task-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition: box-shadow 0.2s;
}

.task-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-active {
  background-color: hsl(var(--success));
}

.status-inactive {
  background-color: hsl(var(--destructive));
}

.task-name {
  font-size: 0.95rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.task-detail {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem 1rem;
}

.detail-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.detail-item-wide {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
  min-width: 5rem;
}

.detail-value {
  font-size: 0.85rem;
  color: hsl(var(--card-foreground));
}

.detail-muted {
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .task-grid {
    grid-template-columns: 1fr;
  }

  .task-header {
    flex-wrap: wrap;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
