<script setup lang="ts">
import type { SchedulerApi } from '#/api/modules/scheduler';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NInput, NSpin, NTooltip, useMessage } from 'naive-ui';

import { getJobsApi, pauseJobApi, resumeJobApi, runJobApi } from '#/api';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

const message = useMessage();

const jobs = ref<SchedulerApi.JobItem[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const runningId = ref('');

const filteredJobs = computed(() => {
  if (!searchQuery.value.trim()) return jobs.value;
  const q = searchQuery.value.toLowerCase();
  return jobs.value.filter(
    (j) => j.name.toLowerCase().includes(q) || j.id.toLowerCase().includes(q),
  );
});

const stats = computed(() => {
  const total = jobs.value.length;
  const running = jobs.value.filter((j) => !j.paused).length;
  const totalRuns = jobs.value.reduce(
    (sum, j) => sum + (j.statistics?.total_runs || 0),
    0,
  );
  return { total, running, paused: total - running, totalRuns };
});

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function triggerDisplay(job: SchedulerApi.JobItem): string {
  const t = job.trigger;
  if (!t) return '-';
  if (t.type === 'cron' && t.expression) return t.expression;
  if (t.type === 'interval' && t.seconds) {
    const secs = t.seconds;
    if (secs >= 3600) return `每 ${(secs / 3600).toFixed(1)} 小时`;
    if (secs >= 60) return `每 ${(secs / 60).toFixed(0)} 分钟`;
    return `每 ${secs} 秒`;
  }
  if (t.type === 'date' && t.run_date) return formatDateTime(t.run_date);
  return t.type || '-';
}

function successRate(job: SchedulerApi.JobItem): null | number {
  const s = job.statistics;
  if (!s || !s.total_runs) return null;
  return Math.round(((s.success_count || 0) / s.total_runs) * 100);
}

function rateColor(rate: number): string {
  if (rate >= 90) return 'hsl(var(--success))';
  if (rate >= 70) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await getJobsApi();
    jobs.value = (res || []) as SchedulerApi.JobItem[];
  } catch (error: any) {
    message.error(error?.message || '获取任务列表失败');
  } finally {
    loading.value = false;
  }
}

async function handleRun(id: string) {
  runningId.value = id;
  try {
    await runJobApi(id);
    message.success('任务已触发执行');
  } catch (error: any) {
    message.error(error?.message || '执行失败');
  } finally {
    runningId.value = '';
  }
}

async function handlePause(id: string) {
  try {
    await pauseJobApi(id);
    message.success('任务已暂停');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '暂停失败');
  }
}

async function handleResume(id: string) {
  try {
    await resumeJobApi(id);
    message.success('任务已恢复');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '恢复失败');
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4 sm:p-5">
    <PageHeader title="调度任务" subtitle="定时任务的调度与执行状态">
      <template #actions>
        <NButton @click="fetchData">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <!-- 概览 + 搜索 -->
    <div class="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
      <div
        class="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm flex-1"
        style="color: hsl(var(--muted-foreground))"
      >
        <span class="inline-flex items-center gap-1.5">
          <IconifyIcon
            icon="lucide:list-checks"
            class="size-4"
            style="color: hsl(var(--primary))"
          />
          <strong class="font-semibold" style="color: hsl(var(--foreground))">{{
            stats.total
          }}</strong>
          个任务
        </span>
        <span
          class="hidden sm:inline size-1 rounded-full"
          style="background: hsl(var(--border))"
        ></span>
        <span class="inline-flex items-center gap-1.5">
          <span class="size-1.5 rounded-full bg-success"></span>
          <strong class="font-semibold" style="color: hsl(var(--success))">{{
            stats.running
          }}</strong>
          运行中
        </span>
        <span v-if="stats.paused > 0" class="inline-flex items-center gap-1.5">
          <span class="size-1.5 rounded-full bg-warning"></span>
          <strong class="font-semibold" style="color: hsl(var(--warning))">{{
            stats.paused
          }}</strong>
          已暂停
        </span>
        <span
          class="hidden sm:inline size-1 rounded-full"
          style="background: hsl(var(--border))"
        ></span>
        <span>累计执行 {{ stats.totalRuns }} 次</span>
      </div>
      <NInput
        v-model:value="searchQuery"
        placeholder="搜索任务名称或 ID"
        clearable
        size="small"
        class="w-full sm:w-64"
      >
        <template #prefix>
          <IconifyIcon icon="lucide:search" class="size-4" />
        </template>
      </NInput>
    </div>

    <NSpin :show="loading" class="mt-4">
      <div
        v-if="filteredJobs.length > 0"
        class="rounded-lg border overflow-hidden"
        style="background: hsl(var(--card)); border-color: hsl(var(--border))"
      >
        <!-- 表头 -->
        <div class="job-row job-head">
          <span>任务</span>
          <span>触发器</span>
          <span>下次执行</span>
          <span>成功率</span>
          <span></span>
        </div>

        <div v-for="job in filteredJobs" :key="job.id" class="job-row group">
          <!-- 状态 + 名称 -->
          <div class="job-main">
            <span
              class="size-2 rounded-full flex-shrink-0"
              :class="job.paused ? 'bg-warning' : 'bg-success'"
              :title="job.paused ? '已暂停' : '运行中'"
            ></span>
            <div class="min-w-0">
              <div
                class="text-sm font-semibold truncate"
                style="color: hsl(var(--foreground))"
              >
                {{ job.name }}
              </div>
              <div
                class="text-xs font-mono truncate"
                style="color: hsl(var(--muted-foreground))"
              >
                {{ job.id }}
              </div>
            </div>
          </div>

          <!-- 触发器 -->
          <div class="job-cell-trigger">
            <span
              class="text-xs px-1.5 py-0.5 rounded font-mono inline-block max-w-full truncate"
              style="
                color: hsl(var(--muted-foreground));
                background: hsl(var(--accent));
              "
              :title="triggerDisplay(job)"
            >
              {{ triggerDisplay(job) }}
            </span>
          </div>

          <!-- 下次执行 -->
          <div
            class="job-cell-next text-xs font-mono"
            style="color: hsl(var(--muted-foreground))"
          >
            {{ formatDateTime(job.next_run_time) }}
          </div>

          <!-- 成功率 -->
          <div class="job-cell-stats text-xs">
            <template v-if="successRate(job) !== null">
              <strong
                class="font-semibold"
                :style="{ color: rateColor(successRate(job) as number) }"
                >{{ successRate(job) }}%</strong
              >
              <span style="color: hsl(var(--muted-foreground))">
                / {{ job.statistics.total_runs }} 次
              </span>
            </template>
            <span v-else style="color: hsl(var(--muted-foreground))">-</span>
          </div>

          <!-- 操作 -->
          <div class="job-actions">
            <NTooltip v-if="job.statistics?.last_error">
              <template #trigger>
                <span
                  class="inline-flex items-center flex-shrink-0 cursor-help"
                  style="color: hsl(var(--destructive))"
                >
                  <IconifyIcon icon="lucide:alert-triangle" class="size-3.5" />
                </span>
              </template>
              <div class="max-w-xs whitespace-pre-wrap">
                {{ job.statistics.last_error }}
              </div>
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  size="small"
                  quaternary
                  circle
                  type="primary"
                  aria-label="立即执行"
                  :loading="runningId === job.id"
                  @click="handleRun(job.id)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:play" class="size-3.5" />
                  </template>
                </NButton>
              </template>
              立即执行
            </NTooltip>
            <NTooltip v-if="!job.paused">
              <template #trigger>
                <NButton
                  size="small"
                  quaternary
                  circle
                  aria-label="暂停"
                  @click="handlePause(job.id)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:pause" class="size-3.5" />
                  </template>
                </NButton>
              </template>
              暂停
            </NTooltip>
            <NTooltip v-else>
              <template #trigger>
                <NButton
                  size="small"
                  quaternary
                  circle
                  type="info"
                  aria-label="恢复"
                  @click="handleResume(job.id)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:play-circle" class="size-3.5" />
                  </template>
                </NButton>
              </template>
              恢复
            </NTooltip>
          </div>
        </div>
      </div>

      <EmptyState
        v-else-if="!loading"
        title="暂无调度任务"
        :subtitle="
          searchQuery
            ? '没有匹配的任务，请调整搜索条件'
            : '当前没有配置任何调度任务'
        "
      >
        <template #icon>
          <IconifyIcon icon="lucide:clock" class="h-12 w-12 opacity-50" />
        </template>
      </EmptyState>
    </NSpin>
  </div>
</template>

<style scoped>
.job-row {
  display: grid;
  grid-template-columns:
    minmax(0, 1.5fr) minmax(110px, 0.7fr) minmax(150px, 0.9fr)
    minmax(90px, 0.5fr) auto;
  gap: 0.25rem 1rem;
  align-items: center;
  padding: 0.625rem 1.25rem;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  transition: background-color 0.15s ease;
}

.job-row:last-child {
  border-bottom: 0;
}

.job-row:not(.job-head):hover,
.job-row:not(.job-head):focus-within {
  background-color: hsl(var(--accent) / 40%);
}

.job-head {
  padding: 0.5rem 1.25rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 25%);
}

.job-main {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}

.job-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.job-row:hover .job-actions,
.job-row:focus-within .job-actions {
  opacity: 1;
}

@media (max-width: 900px) {
  .job-head {
    display: none;
  }

  .job-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.375rem;
  }

  .job-cell-trigger,
  .job-cell-next,
  .job-cell-stats {
    grid-column: 1 / -1;
  }

  .job-cell-next {
    grid-row: auto;
  }

  .job-actions {
    grid-row: 1;
    grid-column: 2;
    opacity: 1;
  }
}
</style>
