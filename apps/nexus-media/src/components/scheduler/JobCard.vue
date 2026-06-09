<script setup lang="ts">
import type { SchedulerApi } from '#/api/modules/scheduler';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NSpace, NTag } from 'naive-ui';

interface Props {
  job: SchedulerApi.JobItem;
  runningId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  runningId: '',
});

const emit = defineEmits<{
  pause: [id: string];
  resume: [id: string];
  run: [id: string];
}>();

const statusType = computed(() => {
  if (props.job.paused) return 'warning';
  return 'success';
});

const statusText = computed(() => {
  if (props.job.paused) return '已暂停';
  return '运行中';
});

/** Format date to yyyy-MM-dd HH:mm:ss */
function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const triggerDisplay = computed(() => {
  const t = props.job.trigger;
  if (!t) return '-';
  if (t.type === 'cron' && t.expression) {
    return t.expression;
  }
  if (t.type === 'interval' && t.seconds) {
    const secs = t.seconds;
    if (secs >= 3600) return `每 ${(secs / 3600).toFixed(1)} 小时`;
    if (secs >= 60) return `每 ${(secs / 60).toFixed(0)} 分钟`;
    return `每 ${secs} 秒`;
  }
  if (t.type === 'date' && t.run_date) {
    return formatDateTime(t.run_date);
  }
  return t.type || '-';
});

const formattedNextRun = computed(() =>
  formatDateTime(props.job.next_run_time),
);

const successRate = computed(() => {
  const stats = props.job.statistics;
  if (!stats || stats.total_runs === 0) return null;
  return Math.round((stats.success_count / stats.total_runs) * 100);
});

const isRunning = computed(() => props.runningId === props.job.id);
</script>

<template>
  <div class="job-card">
    <!-- Header -->
    <div class="job-card-header">
      <div class="job-header-left">
        <div class="job-icon">
          <IconifyIcon icon="lucide:clock" class="job-icon-svg" />
        </div>
        <div class="job-info">
          <div class="job-name">{{ job.name }}</div>
          <div class="job-id">{{ job.id }}</div>
        </div>
      </div>
      <NTag :type="statusType" size="small" round>
        <template #icon>
          <span class="status-dot" :class="`status-dot--${statusType}`"></span>
        </template>
        {{ statusText }}
      </NTag>
    </div>

    <!-- Body -->
    <div class="job-card-body">
      <!-- Trigger & Next run -->
      <div class="job-meta-row">
        <div class="job-meta-item job-meta-item--wide">
          <div class="meta-label">
            <IconifyIcon icon="lucide:zap" class="meta-icon" />
            触发器
          </div>
          <div class="meta-value" :title="triggerDisplay">
            {{ triggerDisplay }}
          </div>
        </div>
        <div class="job-meta-item job-meta-item--wide">
          <div class="meta-label">
            <IconifyIcon icon="lucide:calendar-clock" class="meta-icon" />
            下次执行
          </div>
          <div class="meta-value" :title="formattedNextRun">
            {{ formattedNextRun }}
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div v-if="job.statistics?.total_runs" class="job-stats-bar">
        <div class="stat-item">
          <span class="stat-num">{{ job.statistics.total_runs }}</span>
          <span class="stat-label">总执行</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num stat-num--success">{{
            job.statistics.success_count
          }}</span>
          <span class="stat-label">成功</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-num stat-num--error">{{
            job.statistics.failure_count
          }}</span>
          <span class="stat-label">失败</span>
        </div>
        <div class="stat-divider"></div>
        <div v-if="successRate !== null" class="stat-item">
          <span
            class="stat-num"
            :class="
              successRate >= 90
                ? 'stat-num--success'
                : successRate >= 70
                  ? 'stat-num--warning'
                  : 'stat-num--error'
            "
          >
            {{ successRate }}%
          </span>
          <span class="stat-label">成功率</span>
        </div>
        <div v-if="job.statistics.avg_duration" class="stat-divider"></div>
        <div v-if="job.statistics.avg_duration" class="stat-item">
          <span class="stat-num"
            >{{ job.statistics.avg_duration.toFixed(1) }}s</span
          >
          <span class="stat-label">平均耗时</span>
        </div>
      </div>

      <!-- Last error -->
      <div v-if="job.statistics?.last_error" class="job-last-error">
        <IconifyIcon icon="lucide:alert-triangle" class="error-icon" />
        <span class="error-text">{{ job.statistics.last_error }}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="job-card-footer">
      <NSpace size="small">
        <NButton
          size="small"
          type="primary"
          :loading="isRunning"
          @click="emit('run', job.id)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:play" class="h-3.5 w-3.5" />
          </template>
          立即执行
        </NButton>
        <NButton
          v-if="!job.paused"
          size="small"
          quaternary
          @click="emit('pause', job.id)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:pause" class="h-3.5 w-3.5" />
          </template>
          暂停
        </NButton>
        <NButton
          v-else
          size="small"
          quaternary
          type="info"
          @click="emit('resume', job.id)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:play-circle" class="h-3.5 w-3.5" />
          </template>
          恢复
        </NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.job-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.job-card:hover {
  border-color: hsl(var(--primary) / 30%);
  box-shadow: 0 4px 16px rgb(0 0 0 / 6%);
  transform: translateY(-1px);
}

.job-card-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
}

.job-header-left {
  display: flex;
  flex: 1;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}

.job-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  background-color: hsl(var(--accent));
  border-radius: 0.5rem;
}

.job-icon-svg {
  width: 1.125rem;
  height: 1.125rem;
  color: hsl(var(--primary));
}

.job-info {
  min-width: 0;
}

.job-name {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.3;
  color: hsl(var(--card-foreground));
}

.job-id {
  margin-top: 0.125rem;
  font-family: monospace;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.status-dot {
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  margin-right: 0.25rem;
  border-radius: 50%;
}

.status-dot--success {
  background-color: hsl(var(--success));
}

.status-dot--warning {
  background-color: hsl(var(--warning));
}

.job-card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
}

.job-meta-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.job-meta-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.job-meta-item--wide {
  justify-content: space-between;
}

.meta-label {
  display: flex;
  flex-shrink: 0;
  gap: 0.25rem;
  align-items: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.meta-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.meta-value {
  flex: 1;
  min-width: 0;
  margin-left: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  text-align: right;
  word-break: break-all;
}

.job-stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.625rem 0.75rem;
  background-color: hsl(var(--accent) / 40%);
  border-radius: 0.5rem;
}

.stat-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  min-width: 3rem;
}

.stat-divider {
  width: 1px;
  height: 1.5rem;
  background-color: hsl(var(--border));
}

.stat-num {
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.2;
  color: hsl(var(--card-foreground));
}

.stat-num--success {
  color: hsl(var(--success));
}

.stat-num--error {
  color: hsl(var(--destructive));
}

.stat-num--warning {
  color: hsl(var(--warning));
}

.stat-label {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.job-last-error {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.5rem 0.625rem;
  background-color: hsl(var(--destructive) / 8%);
  border-radius: 0.375rem;
}

.error-icon {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  margin-top: 0.125rem;
  color: hsl(var(--destructive));
}

.error-text {
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--destructive));
  word-break: break-all;
}

.job-card-footer {
  display: flex;
  justify-content: flex-end;
  padding: 0.625rem 1rem;
  background-color: hsl(var(--accent) / 20%);
  border-top: 1px solid hsl(var(--border));
}

@media (max-width: 640px) {
  .job-card-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .job-stats-bar {
    gap: 0.375rem;
  }

  .stat-divider {
    display: none;
  }
}
</style>
