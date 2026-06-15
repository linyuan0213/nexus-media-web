/**
 * 仪表盘聚合 API
 * 整合媒体库、站点、刷流、下载、调度、入库统计等数据
 */
import { requestClient } from '#/api/request';

export namespace DashboardApi {
  export interface TransferStatistics {
    Labels: string[];
    MovieNums: number[];
    TvNums: number[];
    AnimeNums: number[];
  }

  export interface LibraryHome {
    server_success: boolean;
    media_counts: Record<string, number>;
    activity: any[];
    library_spaces: {
      FreeSpace: string;
      TotalSpace: string;
      UsedPercent: number;
      UsedSpace: string;
    };
    downloaded: any[];
    server_type: string;
  }

  export interface SiteStatisticsItem {
    name: string;
    upload: number;
    download: number;
    ratio: number;
    seeding_size: number;
    seeding_count: number;
    bonus: number;
    username: string;
  }

  export interface IndexerStatistics {
    stats: Array<{
      avg: number;
      fail: number;
      name: string;
      success: number;
      total: number;
    }>;
    dataset: any[];
  }

  export interface BrushTask {
    id: string;
    name: string;
    state: string;
    site: string;
    downloader: string;
    size: string;
    dlcount: number;
    transfer: number;
  }

  export interface SchedulerJob {
    id: string;
    name: string;
    paused: boolean;
    next_run_time?: string;
    trigger_type: string;
  }
}

/** 获取媒体库首页聚合数据 */
export async function getDashboardLibraryApi() {
  return requestClient.post<DashboardApi.LibraryHome>(
    '/media/library/home',
    {},
  );
}

/** 获取入库统计（最近30天） */
export async function getDashboardTransferStatsApi(days = 30) {
  return requestClient.post<DashboardApi.TransferStatistics>(
    '/media/transfer/statistics',
    { days },
  );
}

/** 获取站点统计 */
export async function getDashboardSiteStatsApi() {
  return requestClient.post<DashboardApi.SiteStatisticsItem[]>(
    '/site/sites/statistics',
    {},
  );
}

/** 获取索引器/下载统计 */
export async function getDashboardIndexerStatsApi() {
  return requestClient.post<DashboardApi.IndexerStatistics>(
    '/download/indexers/statistics',
    {},
  );
}

/** 获取刷流任务列表 */
export async function getDashboardBrushTasksApi() {
  return requestClient.post<DashboardApi.BrushTask[]>('/brush/tasks', {});
}

/** 获取调度任务列表 */
export async function getDashboardSchedulerJobsApi() {
  return requestClient.post<DashboardApi.SchedulerJob[]>('/scheduler/jobs', {});
}

/** 获取系统状态 */
export async function getDashboardSystemStatusApi() {
  return requestClient.post<{
    python_version: string;
    uptime: number;
    version: string;
  }>('/system/status', {});
}
