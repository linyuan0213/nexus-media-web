<script lang="ts" setup>
import type { SiteItem } from '../types';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCheckbox,
  NModal,
  NProgress,
  NScrollbar,
  NTag,
} from 'naive-ui';

import { testSiteBatchApi } from '#/api/modules/site';

type RowStatus = 'fail' | 'pending' | 'success' | 'testing';

interface TestRow {
  id: number;
  msg: string;
  name: string;
  status: RowStatus;
  times: number;
}

interface Props {
  show: boolean;
  sites: SiteItem[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const phase = ref<'run' | 'select'>('select');
const selectedIds = ref<Set<number>>(new Set());
const rows = ref<TestRow[]>([]);
const running = ref(false);

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const total = computed(() => rows.value.length);
const doneCount = computed(
  () =>
    rows.value.filter((r) => r.status === 'success' || r.status === 'fail')
      .length,
);
const successCount = computed(
  () => rows.value.filter((r) => r.status === 'success').length,
);
const failCount = computed(
  () => rows.value.filter((r) => r.status === 'fail').length,
);
const percentage = computed(() =>
  total.value === 0 ? 0 : Math.round((doneCount.value / total.value) * 100),
);
const hasFailed = computed(() => failCount.value > 0);

const allSelected = computed(
  () => props.sites.length > 0 && selectedIds.value.size === props.sites.length,
);
const indeterminate = computed(
  () => selectedIds.value.size > 0 && !allSelected.value,
);

watch(
  () => props.show,
  (v) => {
    if (v) {
      // 打开时进入选择阶段，默认全选
      phase.value = 'select';
      running.value = false;
      rows.value = [];
      selectedIds.value = new Set(props.sites.map((s) => s.id));
    }
  },
);

function toggleSite(id: number) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function toggleAll() {
  selectedIds.value = allSelected.value
    ? new Set()
    : new Set(props.sites.map((s) => s.id));
}

function startTest() {
  const selected = props.sites.filter((s) => selectedIds.value.has(s.id));
  if (selected.length === 0) return;
  rows.value = selected.map((s) => ({
    id: s.id,
    name: s.name,
    status: 'pending' as RowStatus,
    times: 0,
    msg: '',
  }));
  phase.value = 'run';
  runTests(rows.value);
}

function backToSelect() {
  if (running.value) return;
  phase.value = 'select';
}

async function runTests(targetRows: TestRow[]) {
  if (running.value || targetRows.length === 0) return;
  running.value = true;
  for (const r of targetRows) {
    r.status = 'testing';
    r.times = 0;
    r.msg = '';
  }
  try {
    // 单次批量请求，后端并发测试并一次性返回全部结果
    const res = await testSiteBatchApi(targetRows.map((r) => r.id));
    const map = new Map(
      (Array.isArray(res) ? res : []).map((r) => [String(r.id), r]),
    );
    for (const row of targetRows) {
      const r = map.get(String(row.id));
      if (r && r.flag) {
        row.status = 'success';
        row.times = r.times || 0;
        row.msg = r.msg || '连接成功';
      } else {
        row.status = 'fail';
        row.times = r?.times || 0;
        row.msg = r?.msg || '连接失败';
      }
    }
  } catch (error: any) {
    for (const row of targetRows) {
      row.status = 'fail';
      row.msg = error?.message || '请求失败';
    }
  } finally {
    running.value = false;
  }
}

function retryAll() {
  runTests(rows.value);
}

function retryFailed() {
  runTests(rows.value.filter((r) => r.status === 'fail'));
}

function handleClose() {
  if (running.value) return;
  visible.value = false;
}

const statusMeta: Record<
  RowStatus,
  {
    icon: string;
    label: string;
    type: 'default' | 'error' | 'success' | 'warning';
  }
> = {
  pending: { icon: 'lucide:clock', label: '等待中', type: 'default' },
  testing: { icon: 'lucide:loader', label: '测试中', type: 'warning' },
  success: { icon: 'lucide:check', label: '正常', type: 'success' },
  fail: { icon: 'lucide:x', label: '失败', type: 'error' },
};
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    title="批量测试站点连接"
    style="width: 560px; max-width: 92vw"
    :mask-closable="false"
    :closable="!running"
  >
    <!-- 选择阶段 -->
    <div v-if="phase === 'select'" class="batch-test">
      <div class="batch-test-select-header">
        <NCheckbox
          :checked="allSelected"
          :indeterminate="indeterminate"
          @update:checked="toggleAll"
        >
          全选
        </NCheckbox>
        <span class="batch-test-select-count">
          已选 {{ selectedIds.size }} / {{ sites.length }}
        </span>
      </div>
      <NScrollbar class="batch-test-list">
        <label
          v-for="site in sites"
          :key="site.id"
          class="batch-test-select-row"
        >
          <NCheckbox
            :checked="selectedIds.has(site.id)"
            @update:checked="() => toggleSite(site.id)"
          />
          <span class="batch-test-name">{{ site.name }}</span>
        </label>
        <div v-if="sites.length === 0" class="batch-test-empty">
          当前没有可测试的站点
        </div>
      </NScrollbar>
    </div>

    <!-- 测试/结果阶段 -->
    <div v-else class="batch-test">
      <div class="batch-test-summary">
        <NProgress
          type="line"
          :percentage="percentage"
          :processing="running"
          :status="hasFailed && !running ? 'error' : 'success'"
        />
        <div class="batch-test-stats">
          <span>共 {{ total }} 个</span>
          <NTag type="success" size="small" :bordered="false">
            成功 {{ successCount }}
          </NTag>
          <NTag type="error" size="small" :bordered="false">
            失败 {{ failCount }}
          </NTag>
          <span v-if="running" class="batch-test-running">测试中...</span>
        </div>
      </div>

      <NScrollbar class="batch-test-list">
        <div v-for="row in rows" :key="row.id" class="batch-test-row">
          <div class="batch-test-row-main">
            <IconifyIcon
              :icon="statusMeta[row.status].icon"
              class="batch-test-icon"
              :class="{ 'is-spin': row.status === 'testing' }"
            />
            <span class="batch-test-name">{{ row.name }}</span>
          </div>
          <div class="batch-test-row-side">
            <span v-if="row.status === 'success'" class="batch-test-latency">
              {{ row.times.toFixed(2) }} s
            </span>
            <span
              v-else-if="row.status === 'fail'"
              class="batch-test-error"
              :title="row.msg"
            >
              {{ row.msg }}
            </span>
            <NTag
              :type="statusMeta[row.status].type"
              size="small"
              :bordered="false"
            >
              {{ statusMeta[row.status].label }}
            </NTag>
          </div>
        </div>
      </NScrollbar>
    </div>

    <template #footer>
      <div class="batch-test-footer">
        <template v-if="phase === 'select'">
          <NButton size="small" @click="handleClose">取消</NButton>
          <NButton
            size="small"
            type="primary"
            :disabled="selectedIds.size === 0"
            @click="startTest"
          >
            <template #icon>
              <IconifyIcon icon="lucide:play" />
            </template>
            开始测试（{{ selectedIds.size }}）
          </NButton>
        </template>
        <template v-else>
          <NButton size="small" :disabled="running" @click="backToSelect">
            <template #icon>
              <IconifyIcon icon="lucide:arrow-left" />
            </template>
            重新选择
          </NButton>
          <NButton
            size="small"
            :disabled="running || !hasFailed"
            @click="retryFailed"
          >
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" />
            </template>
            仅重试失败
          </NButton>
          <NButton size="small" :loading="running" @click="retryAll">
            <template #icon>
              <IconifyIcon icon="lucide:play" />
            </template>
            重新测试
          </NButton>
          <NButton
            size="small"
            type="primary"
            :disabled="running"
            @click="handleClose"
          >
            关闭
          </NButton>
        </template>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.batch-test {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.batch-test-select-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid hsl(var(--border));
}

.batch-test-select-count {
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
}

.batch-test-select-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0.25rem;
  cursor: pointer;
  border-bottom: 1px solid hsl(var(--border));
}

.batch-test-empty {
  padding: 1.5rem 0;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.batch-test-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.batch-test-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
}

.batch-test-running {
  color: hsl(var(--warning, 38 92% 50%));
}

.batch-test-list {
  max-height: 46vh;
}

.batch-test-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.25rem;
  border-bottom: 1px solid hsl(var(--border));
}

.batch-test-row-main {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.batch-test-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: hsl(var(--muted-foreground));
}

.is-spin {
  animation: batch-spin 0.9s linear infinite;
}

@keyframes batch-spin {
  to {
    transform: rotate(360deg);
  }
}

.batch-test-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-test-row-side {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
  align-items: center;
  max-width: 55%;
}

.batch-test-latency {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.batch-test-error {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8rem;
  color: hsl(var(--destructive));
  white-space: nowrap;
}

.batch-test-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
