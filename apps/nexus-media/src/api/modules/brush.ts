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
    rss_rule_id?: null | number;
    remove_rule_id?: null | number;
    stop_rule_id?: null | number;
    seed_size?: number;
    time_range?: string;
    active_weekdays?: string;
    download_switch?: string;
    remove_switch?: string;
    stop_switch?: string;
    daily_delete_limit?: string;
    max_seeding?: string;
    hr_limit?: string;
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

  export interface BrushEvent {
    ID: number;
    TASK_ID: number;
    TASK_NAME: string;
    TORRENT_NAME: string;
    DOWNLOAD_ID: string;
    ACTION: 'delete' | 'stop';
    REASON: string;
    DOWNLOADER_NAME: string;
    SITE_NAME: string;
    CREATED_AT: string;
  }

  export interface BrushEventList {
    total: number;
    rows: BrushEvent[];
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
    type?: string;
    json_rule?: Record<string, any>;
    rss_rule?: Record<string, any>;
    remove_rule?: Record<string, any>;
    stop_rule?: Record<string, any>;
    lst_mod_date?: string;
  }
}

/** 获取刷流任务列表 */
export async function getBrushTasksApi() {
  return requestClient.post<BrushApi.BrushTask[]>('/brush/tasks', {});
}

/** 添加刷流任务 */
export async function addBrushTaskApi(data: Partial<BrushApi.BrushTask>) {
  return requestClient.post('/brush/tasks/add', data);
}

/** 更新刷流任务 */
export async function updateBrushTaskApi(data: Partial<BrushApi.BrushTask>) {
  return requestClient.post('/brush/tasks/update', data);
}

/** 删除刷流任务 */
export async function deleteBrushTaskApi(id: number | string) {
  return requestClient.post('/brush/tasks/delete', { id });
}

/** 启动/停止刷流任务 */
export async function toggleBrushTaskApi(
  id: number | string,
  enabled: boolean,
) {
  return requestClient.post('/brush/tasks/state', {
    state: enabled ? 'Y' : 'S',
    ids: [id],
  });
}

/** 立即运行刷流任务 */
export async function runBrushTaskApi(id: number | string) {
  return requestClient.post('/brush/tasks/run', { id });
}

/** 获取刷流任务详情 */
export async function getBrushTaskDetailApi(id: number | string) {
  return requestClient.post<{ task: BrushApi.BrushTask }>(
    '/brush/tasks/detail',
    { id },
  );
}

/** 获取刷流任务种子列表 */
export async function getBrushTaskTorrentsApi(id: number | string) {
  return requestClient.post<{ list: BrushApi.BrushTorrent[] }>(
    '/brush/tasks/torrents',
    { id },
  );
}

// ---------- 规则模板 API ----------

/** 获取刷流规则列表 */
export async function getBrushRulesApi() {
  return requestClient.post<BrushApi.BrushRule[]>('/brush/rules', {});
}

/** 获取刷流规则详情 */
export async function getBrushRuleDetailApi(id: number | string) {
  return requestClient.post<BrushApi.BrushRule>('/brush/rules/detail', {
    id,
  });
}

/** 保存刷流规则 */
export async function saveBrushRuleApi(data: Partial<BrushApi.BrushRule>) {
  return requestClient.post('/brush/rules/save', data);
}

/** 删除刷流规则 */
export async function deleteBrushRuleApi(id: number | string) {
  return requestClient.post('/brush/rules/delete', { id });
}

/** 获取刷流事件日志 */
export async function getBrushEventsApi(params: {
  action?: string;
  page?: number;
  page_size?: number;
  task_id?: number;
}) {
  return requestClient.post<BrushApi.BrushEventList>('/brush/events', params);
}
