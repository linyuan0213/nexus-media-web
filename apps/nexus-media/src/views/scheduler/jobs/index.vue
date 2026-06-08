<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

import {
  NButton,
  NInput,
  NSpin,
  useMessage,
} from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import {
  getJobsApi,
  pauseJobApi,
  resumeJobApi,
  runJobApi,
} from '#/api';
import type { SchedulerApi } from '#/api/modules/scheduler';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import JobCard from '#/components/scheduler/JobCard.vue';

const message = useMessage();

const jobs = ref<SchedulerApi.JobItem[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const runningId = ref('');

const filteredJobs = computed(() => {
  if (!searchQuery.value.trim()) return jobs.value;
  const q = searchQuery.value.toLowerCase();
  return jobs.value.filter(
    (j) =>
      j.name.toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q),
  );
});

const stats = computed(() => {
  const total = jobs.value.length;
  const running = jobs.value.filter((j) => !j.paused).length;
  const paused = jobs.value.filter((j) => j.paused).length;
  const totalRuns = jobs.value.reduce(
    (sum, j) => sum + (j.statistics?.total_runs || 0),
    0,
  );
  return { total, running, paused, totalRuns };
});

async function fetchData() {
  loading.value = true;
  try {
    const res = await getJobsApi();
    jobs.value = (res || []) as SchedulerApi.JobItem[];
  } catch (e: any) {
    message.error(e?.message || '获取任务列表失败');
  } finally {
    loading.value = false;
  }
}

async function handleRun(id: string) {
  runningId.value = id;
  try {
    await runJobApi(id);
    message.success('任务已触发执行');
  } catch (e: any) {
    message.error(e?.message || '执行失败');
  } finally {
    runningId.value = '';
  }
}

async function handlePause(id: string) {
  try {
    await pauseJobApi(id);
    message.success('任务已暂停');
    await fetchData();
  } catch (e: any) {
    message.error(e?.message || '暂停失败');
  }
}

async function handleResume(id: string) {
  try {
    await resumeJobApi(id);
    message.success('任务已恢复');
    await fetchData();
  } catch (e: any) {
    message.error(e?.message || '恢复失败');
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader title="调度任务">
      <template #actions>
        <NButton @click="fetchData">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
          </template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <!-- 统计概览 -->
    <div class="stats-overview">
      <div class="stat-box">
        <div class="stat-box-icon">
          <IconifyIcon icon="lucide:list" class="stat-icon" />
        </div>
        <div class="stat-box-value">{{ stats.total }}</div>
        <div class="stat-box-label">总任务</div>
      </div>
      <div class="stat-box stat-box--success">
        <div class="stat-box-icon">
          <IconifyIcon icon="lucide:activity" class="stat-icon" />
        </div>
        <div class="stat-box-value">{{ stats.running }}</div>
        <div class="stat-box-label">运行中</div>
      </div>
      <div class="stat-box stat-box--warning">
        <div class="stat-box-icon">
          <IconifyIcon icon="lucide:pause-circle" class="stat-icon" />
        </div>
        <div class="stat-box-value">{{ stats.paused }}</div>
        <div class="stat-box-label">已暂停</div>
      </div>
      <div class="stat-box stat-box--info">
        <div class="stat-box-icon">
          <IconifyIcon icon="lucide:repeat" class="stat-icon" />
        </div>
        <div class="stat-box-value">{{ stats.totalRuns }}</div>
        <div class="stat-box-label">总执行</div>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <NInput
        v-model:value="searchQuery"
        placeholder="搜索任务名称或 ID"
        clearable
      >
        <template #prefix>
          <IconifyIcon icon="lucide:search" class="h-4 w-4" />
        </template>
      </NInput>
    </div>

    <NSpin :show="loading">
      <!-- 任务卡片网格 -->
      <div
        v-if="filteredJobs.length > 0"
        class="job-grid"
      >
        <JobCard
          v-for="job in filteredJobs"
          :key="job.id"
          :job="job"
          :running-id="runningId"
          @run="handleRun"
          @pause="handlePause"
          @resume="handleResume"
        />
      </div>

      <EmptyState
        v-else-if="!loading"
        title="暂无调度任务"
        :subtitle="searchQuery ? '没有匹配的任务，请调整搜索条件' : '当前没有配置任何调度任务'"
      >
        <template #icon>
          <IconifyIcon icon="lucide:clock" class="h-12 w-12 opacity-50" />
        </template>
      </EmptyState>
    </NSpin>
  </div>
</template>

<style scoped>
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  background-color: hsl(var(--card));
  padding: 1rem;
  text-align: center;
  transition: all 0.2s ease;
}

.stat-box:hover {
  border-color: hsl(var(--primary) / 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.stat-box--success .stat-box-icon {
  background-color: hsl(var(--success) / 0.12);
  color: hsl(var(--success));
}

.stat-box--warning .stat-box-icon {
  background-color: hsl(var(--warning) / 0.12);
  color: hsl(var(--warning));
}

.stat-box--info .stat-box-icon {
  background-color: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.stat-box-icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  background-color: hsl(var(--accent));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.stat-icon {
  width: 1.125rem;
  height: 1.125rem;
}

.stat-box-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(var(--card-foreground));
  line-height: 1.2;
}

.stat-box-label {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.25rem;
}

.search-bar {
  margin-bottom: 1.25rem;
  max-width: 400px;
}

.job-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1rem;
}

@media (max-width: 640px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .search-bar {
    max-width: 100%;
  }

  .job-grid {
    grid-template-columns: 1fr;
  }
}
</style>
