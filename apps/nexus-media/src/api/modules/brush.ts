/**
 * 刷流任务 API
 * 对应后端: /api/brush/*
 */
import { requestClient } from '#/api/request';

export namespace BrushApi {
  export interface BrushTask {
    id: number;
    name: string;
    site?: string;
    site_id?: number;
    site_name?: string;
    site_url?: string;
    interval?: string;
    label?: string;
    savepath?: string;
    state?: string;
    downloader?: string;
    downloader_name?: string;
    transfer?: boolean;
    sendmessage?: boolean;
    free?: string;
    rss_rule?: Record<string, any>;
    remove_rule?: Record<string, any>;
    stop_rule?: Record<string, any>;
    rule_id?: number | null;
    seed_size?: number;
    time_range?: string;
    total_size?: number;
    rss_url?: string;
    rss_url_show?: string;
    download_count?: number;
    remove_count?: number;
    download_size?: string;
    upload_size?: string;
    lst_mod_date?: string;
    cookie?: string;
    ua?: string;
    headers?: string;
  }

  export interface BrushTorrent {
    id?: number;
    site?: string;
    title?: string;
    enclosure?: string;
    size?: string;
    seeders?: number;
    peers?: number;
    pubdate?: string;
    download_id?: string;
    downloader?: string;
    download_time?: string;
    remove_time?: string;
    active?: boolean;
  }

  export interface BrushRule {
    id: number;
    name: string;
    rss_rule?: Record<string, any>;
    remove_rule?: Record<string, any>;
    stop_rule?: Record<string, any>;
    lst_mod_date?: string;
  }
}

/** 获取刷流任务列表 */
export async function getBrushTasksApi() {
  return requestClient.post<BrushApi.BrushTask[]>('/api/brush/tasks', {});
}

/** 添加刷流任务 */
export async function addBrushTaskApi(data: Partial<BrushApi.BrushTask>) {
  return requestClient.post('/api/brush/tasks/add', data);
}

/** 更新刷流任务 */
export async function updateBrushTaskApi(data: Partial<BrushApi.BrushTask>) {
  return requestClient.post('/api/brush/tasks/update', data);
}

/** 删除刷流任务 */
export async function deleteBrushTaskApi(id: number | string) {
  return requestClient.post('/api/brush/tasks/delete', { id });
}

/** 启动/停止刷流任务 */
export async function toggleBrushTaskApi(id: number | string, enabled: boolean) {
  return requestClient.post('/api/brush/tasks/state', {
    state: enabled ? 'Y' : 'S',
    ids: [id],
  });
}

/** 立即运行刷流任务 */
export async function runBrushTaskApi(id: number | string) {
  return requestClient.post('/api/brush/tasks/run', { id });
}

/** 获取刷流任务详情 */
export async function getBrushTaskDetailApi(id: number | string) {
  return requestClient.post<{ task: BrushApi.BrushTask }>('/api/brush/tasks/detail', { id });
}

/** 获取刷流任务种子列表 */
export async function getBrushTaskTorrentsApi(id: number | string) {
  return requestClient.post<{ list: BrushApi.BrushTorrent[] }>('/api/brush/tasks/torrents', { id });
}

// ---------- 规则模板 API ----------

/** 获取刷流规则列表 */
export async function getBrushRulesApi() {
  return requestClient.post<BrushApi.BrushRule[]>('/api/brush/rules', {});
}

/** 获取刷流规则详情 */
export async function getBrushRuleDetailApi(id: number | string) {
  return requestClient.post<BrushApi.BrushRule>('/api/brush/rules/detail', { id });
}

/** 保存刷流规则 */
export async function saveBrushRuleApi(data: Partial<BrushApi.BrushRule>) {
  return requestClient.post('/api/brush/rules/save', data);
}

/** 删除刷流规则 */
export async function deleteBrushRuleApi(id: number | string) {
  return requestClient.post('/api/brush/rules/delete', { id });
}
