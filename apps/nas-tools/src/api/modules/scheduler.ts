/**
 * 定时任务 API
 * 对应后端: /api/scheduler/*
 */
import { requestClient } from '#/api/request';

export namespace SchedulerApi {
  export interface JobTrigger {
    type: string;
    seconds?: number;
    expression?: string;
    run_date?: string;
  }

  export interface JobStatistics {
    job_id: string;
    total_runs: number;
    success_count: number;
    failure_count: number;
    retry_count: number;
    last_run_time?: string;
    last_duration?: number;
    avg_duration: number;
    last_error?: string;
    consecutive_failures: number;
  }

  export interface JobItem {
    id: string;
    name: string;
    next_run_time?: string;
    trigger: JobTrigger;
    trigger_type: string;
    args: string[];
    kwargs: Record<string, any>;
    jobstore: string;
    paused: boolean;
    statistics: JobStatistics;
  }

  export interface JobLog {
    id: number;
    job_id: string;
    start_time: string;
    end_time?: string;
    status: string;
    message?: string;
  }
}

/** 获取任务列表 */
export async function getJobsApi() {
  return requestClient.post<SchedulerApi.JobItem[]>('/api/scheduler/jobs', {});
}

/** 立即执行任务 */
export async function runJobApi(id: string) {
  return requestClient.post('/api/scheduler/jobs/run', { id });
}

/** 暂停任务 */
export async function pauseJobApi(id: string) {
  return requestClient.post('/api/scheduler/jobs/pause', { id });
}

/** 恢复任务 */
export async function resumeJobApi(id: string) {
  return requestClient.post('/api/scheduler/jobs/resume', { id });
}

/** 获取任务日志 */
export async function getJobLogsApi(jobId?: string, limit: number = 50) {
  return requestClient.post<SchedulerApi.JobLog[]>('/api/scheduler/logs', { job_id: jobId, limit });
}
