<script setup lang="ts">
import { h, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NAlert,
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPagination,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  createAPIKeyApi,
  deleteAPIKeyApi,
  getAPIKeyStatsApi,
  listAPIKeyLogsApi,
  listAPIKeysApi,
  updateAPIKeyApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

const message = useMessage();

const stats = ref({
  total_keys: 0,
  active_keys: 0,
  total_requests: 0,
  today_requests: 0,
});
const keys = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(12);
const total = ref(0);

const showCreateModal = ref(false);
const showKeyModal = ref(false);
const createdKey = ref('');
const createFormRef = ref<any>(null);
const createForm = ref({
  name: '',
  expires_days: null as null | number,
  description: '',
});
const createRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};
const expiresOptions = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '1 年', value: 365 },
  { label: '永久', value: null },
] as any[];

const showEditModal = ref(false);
const editFormRef = ref<any>(null);
const editForm = ref({ id: 0, name: '', status: 1, description: '' });
const editRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

const showLogsModal = ref(false);
const logs = ref<any[]>([]);
const logsLoading = ref(false);
const logPage = ref(1);
const logPageSize = ref(20);
const logTotal = ref(0);
const selectedKeyId = ref(0);
const selectedKeyName = ref('');

const deleteModalShow = ref(false);
const deleteTarget = ref<any>(null);

function formatTime(iso: null | string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  // 未来时间（如过期时间），显示具体日期
  if (diff < 0) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const days = Math.floor(diff / 86_400_000);
  if (days === 0) {
    const hours = Math.floor(diff / 3_600_000);
    if (hours === 0) {
      const mins = Math.floor(diff / 60_000);
      return mins <= 1 ? '刚刚' : `${mins} 分钟前`;
    }
    return `${hours} 小时前`;
  }
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const logColumns = [
  {
    title: 'Request ID',
    key: 'request_id',
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: '名称',
    key: 'request_name',
    width: 120,
    render(row: any) {
      return row.request_name || '-';
    },
  },
  {
    title: '来源',
    key: 'source_ip',
    width: 130,
    render(row: any) {
      return row.source_ip || '-';
    },
  },
  {
    title: '时间',
    key: 'request_at',
    width: 160,
    render(row: any) {
      return formatTime(row.request_at);
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 70,
    align: 'center' as const,
    render(row: any) {
      return h(
        NTag,
        { type: row.status === 1 ? 'success' : 'error', size: 'small' },
        { default: () => (row.status === 1 ? '成功' : '失败') },
      );
    },
  },
];

async function fetchKeys() {
  loading.value = true;
  try {
    const res: any = await listAPIKeysApi(page.value, pageSize.value);
    keys.value = res?.items ?? res?.data?.items ?? [];
    total.value = res?.total ?? res?.data?.total ?? 0;
  } catch (error: any) {
    message.error(error?.message || '获取列表失败');
  } finally {
    loading.value = false;
  }
}

async function fetchStats() {
  try {
    const res: any = await getAPIKeyStatsApi();
    stats.value = res ?? res?.data ?? stats.value;
  } catch {
    /* ignore */
  }
}

async function handleCreate() {
  try {
    await createFormRef.value?.validate();
    const res: any = await createAPIKeyApi({ ...createForm.value });
    createdKey.value = res?.key || res?.data?.key || '';
    showCreateModal.value = false;
    showKeyModal.value = true;
    createForm.value = { name: '', expires_days: null, description: '' };
    await fetchKeys();
    await fetchStats();
  } catch (error: any) {
    message.error(error?.message || '创建失败');
  }
}

function copyKey() {
  navigator.clipboard
    .writeText(createdKey.value)
    .then(() => message.success('已复制'));
}

function openEdit(row: any) {
  editForm.value = {
    id: row.id,
    name: row.name,
    status: row.status,
    description: row.description || '',
  };
  showEditModal.value = true;
}

async function handleUpdate() {
  try {
    await editFormRef.value?.validate();
    await updateAPIKeyApi(editForm.value.id, {
      name: editForm.value.name,
      status: editForm.value.status,
      description: editForm.value.description,
    });
    message.success('更新成功');
    showEditModal.value = false;
    await fetchKeys();
  } catch (error: any) {
    message.error(error?.message || '更新失败');
  }
}

function confirmDelete(row: any) {
  deleteTarget.value = row;
  deleteModalShow.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteAPIKeyApi(deleteTarget.value.id);
    message.success('删除成功');
    deleteModalShow.value = false;
    deleteTarget.value = null;
    await fetchKeys();
    await fetchStats();
  } catch (error: any) {
    message.error(error?.message || '删除失败');
  }
}

function openLogs(row: any) {
  selectedKeyId.value = row.id;
  selectedKeyName.value = row.name;
  logPage.value = 1;
  showLogsModal.value = true;
  fetchLogs();
}

async function fetchLogs() {
  logsLoading.value = true;
  try {
    const res: any = await listAPIKeyLogsApi(
      selectedKeyId.value,
      logPage.value,
      logPageSize.value,
    );
    logs.value = res?.items ?? res?.data?.items ?? [];
    logTotal.value = res?.total ?? res?.data?.total ?? 0;
  } catch (error: any) {
    message.error(error?.message || '获取记录失败');
  } finally {
    logsLoading.value = false;
  }
}

function handlePageChange(p: number) {
  page.value = p;
  fetchKeys();
}
function handleLogPageChange(p: number) {
  logPage.value = p;
  fetchLogs();
}

onMounted(() => {
  fetchKeys();
  fetchStats();
});
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="API Key 管理" subtitle="管理 API 访问密钥及使用记录">
      <template #actions>
        <NButton type="primary" @click="showCreateModal = true">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          创建 API Key
        </NButton>
      </template>
    </PageHeader>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
      <div class="stat-card">
        <div class="stat-value" style="color: hsl(var(--primary))">
          {{ stats.total_keys }}
        </div>
        <div class="stat-label">总 Key 数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: hsl(var(--success))">
          {{ stats.active_keys }}
        </div>
        <div class="stat-label">活跃 Key</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: hsl(var(--warning))">
          {{ stats.total_requests }}
        </div>
        <div class="stat-label">总请求数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: hsl(var(--info))">
          {{ stats.today_requests }}
        </div>
        <div class="stat-label">今日请求</div>
      </div>
    </div>

    <NSpin :show="loading" class="mt-5">
      <!-- API Key 卡片网格 -->
      <div
        v-if="keys.length > 0"
        class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="item in keys"
          :key="item.id"
          class="apikey-card"
          :class="{
            'apikey-card--expired': item.is_expired,
            'apikey-card--disabled': item.status !== 1,
          }"
        >
          <!-- 顶部：名称 + 状态 -->
          <div class="apikey-card-header">
            <div class="apikey-name">{{ item.name }}</div>
            <div class="apikey-status">
              <span
                v-if="item.is_expired"
                class="status-badge status-badge--expired"
                >已过期</span
              >
              <span
                v-else-if="item.status === 1"
                class="status-badge status-badge--active"
                >启用</span
              >
              <span v-else class="status-badge status-badge--disabled"
                >禁用</span
              >
            </div>
          </div>

          <!-- Key 值 -->
          <div class="apikey-key-section">
            <IconifyIcon
              icon="lucide:key"
              class="size-4"
              style="color: hsl(var(--muted-foreground))"
            />
            <code class="apikey-key-text">{{ item.key_prefix }}</code>
          </div>

          <!-- 信息行 -->
          <div class="apikey-info">
            <div class="apikey-info-item">
              <IconifyIcon icon="lucide:calendar" class="size-3.5" />
              <span>{{ formatTime(item.created_at) }}</span>
            </div>
            <div class="apikey-info-item">
              <IconifyIcon icon="lucide:timer" class="size-3.5" />
              <span>{{
                item.expires_at ? formatTime(item.expires_at) : '永不过期'
              }}</span>
            </div>
            <div class="apikey-info-item">
              <IconifyIcon icon="lucide:activity" class="size-3.5" />
              <span>使用 {{ item.use_count || 0 }} 次</span>
            </div>
            <div v-if="item.last_used_at" class="apikey-info-item">
              <IconifyIcon icon="lucide:clock" class="size-3.5" />
              <span>最近 {{ formatTime(item.last_used_at) }}</span>
            </div>
          </div>

          <!-- 描述 -->
          <div v-if="item.description" class="apikey-desc">
            {{ item.description }}
          </div>

          <!-- 底部操作 -->
          <div class="apikey-card-footer">
            <NTooltip>
              <template #trigger>
                <NButton text size="tiny" @click="openLogs(item)">
                  <IconifyIcon icon="lucide:scroll-text" class="size-3.5" />
                </NButton>
              </template>
              使用记录
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton text size="tiny" @click="openEdit(item)">
                  <IconifyIcon icon="lucide:pencil" class="size-3.5" />
                </NButton>
              </template>
              编辑
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  text
                  size="tiny"
                  type="error"
                  @click="confirmDelete(item)"
                >
                  <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                </NButton>
              </template>
              删除
            </NTooltip>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <IconifyIcon icon="lucide:key" class="size-8" />
        </div>
        <p class="empty-title">暂无 API Key</p>
        <p class="empty-subtitle">还没有任何 API Key，点击上方按钮创建</p>
      </div>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex justify-end mt-4">
        <NPagination
          :page="page"
          :page-size="pageSize"
          :item-count="total"
          @update:page="handlePageChange"
        />
      </div>
    </NSpin>

    <!-- 创建 API Key -->
    <NModal
      v-model:show="showCreateModal"
      title="创建 API Key"
      preset="card"
      :style="{ width: '480px', maxWidth: '92vw' }"
    >
      <NForm
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-placement="top"
      >
        <NFormItem label="名称" path="name">
          <NInput
            v-model:value="createForm.name"
            placeholder="用于标识此 Key 的用途"
          />
        </NFormItem>
        <NFormItem label="过期时间">
          <NSelect
            v-model:value="createForm.expires_days"
            :options="expiresOptions"
            placeholder="选择过期时间（留空则永不过期）"
            clearable
          />
        </NFormItem>
        <NFormItem label="描述">
          <NInput
            v-model:value="createForm.description"
            type="textarea"
            placeholder="可选，描述此 Key 的用途"
            :rows="2"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" @click="handleCreate">创建</NButton>
        </div>
      </template>
    </NModal>

    <!-- 展示创建的 Key -->
    <NModal
      v-model:show="showKeyModal"
      title="API Key 创建成功"
      preset="dialog"
      positive-text="我已保存"
      :closable="false"
      :mask-closable="false"
      :show-icon="false"
      @positive-click="showKeyModal = false"
    >
      <NAlert type="warning" :show-icon="false" class="mb-4">
        此 Key 仅展示一次，请立即复制保存。关闭后将无法再次查看完整 Key。
      </NAlert>
      <div
        class="flex items-center gap-2 p-3 rounded"
        style="background: hsl(var(--muted))"
      >
        <code class="flex-1 break-all text-sm">{{ createdKey }}</code>
        <NButton size="small" @click="copyKey">
          <IconifyIcon icon="lucide:copy" class="size-3.5" />
        </NButton>
      </div>
    </NModal>

    <!-- 编辑 -->
    <NModal
      v-model:show="showEditModal"
      title="编辑 API Key"
      preset="card"
      :style="{ width: '480px', maxWidth: '92vw' }"
    >
      <NForm
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-placement="top"
      >
        <NFormItem label="名称" path="name">
          <NInput v-model:value="editForm.name" />
        </NFormItem>
        <NFormItem label="状态">
          <NSwitch
            v-model:value="editForm.status"
            :checked-value="1"
            :unchecked-value="0"
          >
            <template #checked>启用</template>
            <template #unchecked>禁用</template>
          </NSwitch>
        </NFormItem>
        <NFormItem label="描述">
          <NInput
            v-model:value="editForm.description"
            type="textarea"
            :rows="2"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showEditModal = false">取消</NButton>
          <NButton type="primary" @click="handleUpdate">保存</NButton>
        </div>
      </template>
    </NModal>

    <!-- 使用记录 -->
    <NModal
      v-model:show="showLogsModal"
      :title="`使用记录 - ${selectedKeyName}`"
      preset="card"
      class="max-"
      :style="{ width: '900px', maxWidth: '95vw' }"
    >
      <NDataTable
        :columns="logColumns"
        :data="logs"
        :loading="logsLoading"
        size="small"
        striped
      />
      <div v-if="logTotal > logPageSize" class="flex justify-end mt-3">
        <NPagination
          :page="logPage"
          :page-size="logPageSize"
          :item-count="logTotal"
          @update:page="handleLogPageChange"
        />
      </div>
    </NModal>

    <!-- 删除确认 -->
    <NModal
      v-model:show="deleteModalShow"
      title="删除 API Key"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="handleDelete"
    >
      确定要删除 API Key
      <strong>{{ deleteTarget?.name }}</strong> 吗？此操作不可恢复。
    </NModal>
  </div>
</template>

<style scoped>
/* 统计卡片 */
.stat-card {
  padding: 1rem;
  text-align: center;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* API Key 卡片 */
.apikey-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.apikey-card:hover {
  box-shadow: 0 4px 12px hsl(var(--foreground) / 8%);
  transform: translateY(-1px);
}

.apikey-card--expired {
  border-color: hsl(var(--destructive) / 40%);
  opacity: 0.85;
}

.apikey-card--disabled {
  opacity: 0.7;
}

/* 头部 */
.apikey-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem 0.5rem;
}

.apikey-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

/* 状态标签 */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: 9999px;
}

.status-badge--active {
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
}

.status-badge--disabled {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted-foreground) / 12%);
}

.status-badge--expired {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 12%);
}

/* Key 区域 */
.apikey-key-section {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0 1rem;
  margin-bottom: 0.5rem;
}

.apikey-key-text {
  padding: 0.25rem 0.5rem;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-radius: calc(var(--radius) - 2px);
}

/* 信息行 */
.apikey-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.375rem 1rem;
  padding: 0 1rem;
  margin-bottom: 0.5rem;
}

.apikey-info-item {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* 描述 */
.apikey-desc {
  display: -webkit-box;
  padding: 0 1rem;
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

/* 底部操作 */
.apikey-card-footer {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  justify-content: flex-end;
  padding: 0.5rem 1rem;
  background: hsl(var(--accent) / 50%);
  border-top: 1px solid hsl(var(--border));
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 1rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
}

.empty-icon {
  margin-bottom: 0.75rem;
  color: hsl(var(--muted-foreground) / 50%);
}

.empty-title {
  margin-bottom: 0.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.empty-subtitle {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}
</style>
