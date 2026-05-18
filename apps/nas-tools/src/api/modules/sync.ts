/**
 * 目录同步 API
 * 对应后端: /api/sync/*
 */
import { requestClient } from '#/api/request';

export namespace SyncApi {
  export interface SyncTask {
    id: number;
    name: string;
    source: string;
    target: string;
    mode: string;
    status: number;
    interval: number;
    // 模板字段（与原始模板兼容）
    from?: string;
    to?: string;
    unknown?: string;
    enabled?: boolean | number;
    syncmod_name?: string;
    syncmod?: string;
    compatibility?: boolean | number;
    renamer?: boolean | number;
    rename?: boolean | number;
    operation?: string;
    src_backend?: string;
    dst_backend?: string;
  }
}

/** 同步方式选项 */
export const SYNC_MODES = [
  { label: '复制', value: 'copy' },
  { label: '硬链接', value: 'link' },
  { label: '软链接', value: 'softlink' },
  { label: '移动', value: 'move' },
];

/** 获取同步任务列表 */
export async function getSyncTasksApi() {
  return requestClient.post<Record<string, SyncApi.SyncTask>>('/api/sync/paths', {});
}

/** 保存同步任务 */
export async function saveSyncTaskApi(data: Partial<SyncApi.SyncTask>) {
  return requestClient.post('/api/sync/paths/save', data);
}

/** 删除同步任务 */
export async function deleteSyncTaskApi(id: number | string) {
  return requestClient.post('/api/sync/paths/delete', { id });
}

/** 立即执行同步 */
export async function runSyncTaskApi(sid: number | string) {
  return requestClient.post('/api/sync/run', { sid });
}

/** 更新媒体库目录（add/sub） */
export async function updateDirectoryApi(data: {
  oper: 'add' | 'sub' | 'set';
  key: string;
  value: string;
  replace_value?: string;
}) {
  return requestClient.post('/api/sync/directories/update', data);
}

/** 删除识别历史记录（及文件） */
export async function deleteTransferHistoryApi(data: {
  logids: number[];
  flag?: 'del_source' | 'del_dest' | 'del_all' | '';
}) {
  return requestClient.post('/api/sync/history/delete', data);
}

/** 重新识别 */
export async function reIdentifyTransferHistoryApi(data: {
  ids: number[];
  flag?: string;
}) {
  return requestClient.post('/api/sync/reidentify', data);
}

/** 手动识别/转移 */
export async function manualTransferApi(data: {
  logid?: number;
  unknown_id?: number;
  syncmod?: string;
  tmdb?: number;
  type?: string;
  season?: number;
  episode_format?: string;
  episode_details?: string;
  episode_part?: string;
  episode_offset?: string;
  min_filesize?: number;
}) {
  return requestClient.post('/api/sync/rename', data);
}

/** 自定义识别/转移（指定输入路径） */
export async function manualTransferUdfApi(data: {
  inpath: string;
  outpath?: string;
  syncmod?: string;
  tmdb?: number;
  type?: string;
  season?: number;
  episode_format?: string;
  episode_details?: string;
  episode_part?: string;
  episode_offset?: string;
  min_filesize?: number;
}) {
  return requestClient.post('/api/sync/rename/udf', data);
}

/** 重命名文件 */
export async function renameFileApi(data: { path: string; name: string }) {
  return requestClient.post('/api/sync/rename/file', data);
}

/** 删除文件 */
export async function deleteFilesApi(data: { files: string[] }) {
  return requestClient.post('/api/sync/files/delete', data);
}
