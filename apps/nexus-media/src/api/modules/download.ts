/**
 * 下载管理 API
 * 对应后端: /api/download/*
 */
import { requestClient } from '#/api/request';

export namespace DownloadApi {
  export interface DownloadTask {
    id: string;
    name: string;
    progress: number;
    status: 'completed' | 'downloading' | 'error' | 'paused';
    speed?: string;
    size?: string;
    downloader?: string;
  }

  export interface DownloaderConfig {
    id?: string;
    name: string;
    type: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    enabled?: number;
    transfer?: number;
    only_nexus_media?: number;
    match_path?: number;
    rmt_mode?: string;
    config?: string;
    download_dir?: string;
  }

  export interface DownloadSetting {
    id?: string;
    name: string;
    category?: string;
    tags?: string;
    is_paused?: boolean;
    upload_limit?: number;
    download_limit?: number;
    ratio_limit?: number;
    seeding_time_limit?: number;
    downloader?: string;
  }

  export interface DownloadDirItem {
    type: string;
    category: string;
    save_path: string;
    container_path: string;
    label: string;
  }

  export interface TorrentRemoveTask {
    id: number | string;
    name: string;
    downloader: string;
    downloader_name: string;
    downloader_type: string;
    only_nexus_media: number;
    samedata: number;
    action: number;
    config: {
      filter_status: string[];
      ratio: number;
      savepath_key: string;
      seeding_time: number;
      size: number[];
      tags: string[];
      tracker_key: string;
      upload_avs: number;
    };
    interval: number;
    enabled: number;
  }

  export interface RemoveTorrentCandidate {
    id: string;
    name: string;
    site: string;
    size: number;
  }

  export interface DownloadHistoryItem {
    id: string;
    title: string;
    type: 'MOV' | 'TV';
    media_type: string;
    year: string;
    vote: string;
    image: string;
    overview: string;
    enclosure?: string;
    date: string;
    site: string;
  }
}

/** 获取下载任务列表 */
export async function getDownloadTasksApi() {
  return requestClient.post<DownloadApi.DownloadTask[]>(
    '/download/tasks',
    {},
    { timeout: 30_000 },
  );
}

/** 获取下载历史 */
export async function getDownloadHistoryApi(page?: number, _pageSize?: number) {
  return requestClient.post<DownloadApi.DownloadHistoryItem[]>(
    '/media/library/downloaded',
    {
      page,
    },
  );
}

/** 暂停任务 */
export async function pauseTaskApi(id: string) {
  return requestClient.post('/download/tasks/stop', { id });
}

/** 恢复任务 */
export async function resumeTaskApi(id: string) {
  return requestClient.post('/download/tasks/start', { id });
}

/** 删除任务 */
export async function deleteTaskApi(id: string, deleteFiles: boolean = false) {
  return requestClient.post('/download/tasks/remove', {
    id,
    delete_files: deleteFiles,
  });
}

/** 获取下载器配置列表 */
export async function getDownloadersApi(did?: string) {
  return requestClient.post<Record<string, DownloadApi.DownloaderConfig>>(
    '/download/downloaders',
    { did },
  );
}

/** 获取支持的下载器类型配置 */
export async function getDownloaderTypesApi() {
  return requestClient.post<
    Record<
      string,
      {
        config: Record<string, any>;
        icon_url?: string;
        monitor_enable?: boolean;
        name: string;
        speedlimit_enable?: boolean;
      }
    >
  >('/download/downloaders/types', {});
}

/** 保存下载器配置 */
export async function saveDownloaderApi(data: DownloadApi.DownloaderConfig) {
  return requestClient.post('/download/downloaders/update', data);
}

/** 删除下载器配置 */
export async function deleteDownloaderApi(id: string) {
  return requestClient.post('/download/downloaders/delete', { did: id });
}

/** 测试下载器配置 */
export async function testDownloaderApi(type: string, config: string) {
  return requestClient.post('/download/downloaders/test', { type, config });
}

/** 检查下载器 */
export async function checkDownloaderApi(
  did: string,
  flag: string,
  checked: boolean,
) {
  return requestClient.post('/download/downloaders/check', {
    did,
    flag,
    checked,
  });
}

/** 设置默认下载器 */
export async function setDefaultDownloaderApi(did: string) {
  return requestClient.post('/download/downloaders/default', { did });
}

/** 设置默认下载设置 */
export async function setDefaultDownloadSettingApi(sid: string) {
  return requestClient.post('/download/settings/default', { sid });
}

/** 下载搜索结果 */
export async function downloadSearchResultApi(
  id: string,
  dir?: string,
  setting?: string,
) {
  return requestClient.post(
    '/download/tasks/add',
    { id, dir, setting },
    { timeout: 60_000 },
  );
}

/** 获取下载设置列表 */
export async function getDownloadSettingsApi(sid?: string) {
  return requestClient.post<DownloadApi.DownloadSetting[]>(
    '/download/settings',
    { sid },
  );
}

/** 保存下载设置 */
export async function saveDownloadSettingApi(
  data: DownloadApi.DownloadSetting,
) {
  return requestClient.post('/download/settings/update', data);
}

/** 删除下载设置 */
export async function deleteDownloadSettingApi(sid: string) {
  return requestClient.post('/download/settings/delete', { sid });
}

/** 获取下载目录 */
export async function getDownloadDirsApi(sid?: string, site?: string) {
  return requestClient.post<string[]>('/download/downloaders/dirs', {
    sid,
    site,
  });
}

/** 获取索引器列表 */
export async function getIndexersApi() {
  return requestClient.post<{ id: string; name: string }[]>(
    '/download/indexers',
    {},
  );
}

/** 获取索引器统计 */
export async function getIndexerStatisticsApi() {
  return requestClient.post<{ dataset: any[]; stats: any[] }>(
    '/download/indexers/statistics',
    {},
  );
}

/** 解析下载链接（处理 m-team/yemapt 等特殊站点） */
export async function resolveDownloadUrlApi(params: {
  enclosure?: string;
  page_url?: string;
}) {
  return requestClient.post<{ url: string }>(
    '/download/tasks/resolve_url',
    params,
  );
}

/** 添加种子下载任务 */
export async function addTorrentApi(params: {
  description?: string;
  dl_dir?: string;
  dl_setting?: string;
  download_volume_factor?: number;
  files?: string[];
  page_url?: string;
  site?: string;
  size?: number;
  title?: string;
  upload_volume_factor?: number;
  urls?: string[];
}) {
  return requestClient.post('/download/tasks/add_torrent', params, {
    timeout: 60_000,
  });
}

/** 获取删种任务列表 */
export async function getTorrentRemoveTasksApi(tid?: number | string) {
  return requestClient.post<Record<string, DownloadApi.TorrentRemoveTask>>(
    '/download/torrent-remove-tasks',
    { tid },
  );
}

/** 保存删种任务 */
export async function saveTorrentRemoveTaskApi(data: Record<string, any>) {
  return requestClient.post('/download/torrent-remove-tasks/save', {
    data,
  });
}

/** 删除删种任务 */
export async function deleteTorrentRemoveTaskApi(tid: number | string) {
  return requestClient.post('/download/torrent-remove-tasks/delete', {
    tid,
  });
}

/** 获取满足删种条件的种子 */
export async function getRemoveTorrentsApi(tid: number | string) {
  return requestClient.post<DownloadApi.RemoveTorrentCandidate[]>(
    '/download/torrent-remove-tasks/candidates',
    { tid },
  );
}

/** 立即执行删种任务 */
export async function autoRemoveTorrentsApi(tid: number | string) {
  return requestClient.post('/download/torrent-remove-tasks/run', { tid });
}

/** 清理转移缓存 */
export async function clearTransferBlacklistApi() {
  return requestClient.post('/download/tools/blacklist/clear', {});
}

/** 查询硬链接 */
export async function findHardlinksApi(data: {
  dir?: string;
  files: string[];
}) {
  return requestClient.post<Record<string, string[]>>(
    '/download/tools/hardlinks',
    data,
  );
}

export interface DownloadEvent {
  event: string;
  data: Record<string, any>;
}

/** 订阅下载事件 SSE */
export async function subscribeDownloadEventsApi(
  callbacks: {
    onEnd?: () => void;
    onEvent: (event: DownloadEvent) => void;
  },
  signal?: AbortSignal,
) {
  return requestClient.requestSSE('/download/events', undefined, {
    method: 'GET',
    signal,
    onMessage: (content: string) => {
      const blocks = content.split('\n\n');
      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        const lines = trimmed.split('\n');
        let eventType = '';
        let eventData = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
          }
        }
        if (eventType && eventData) {
          try {
            const data = JSON.parse(eventData);
            callbacks.onEvent({ event: eventType, data });
          } catch {
            // ignore parse errors
          }
        }
      }
    },
    onEnd: callbacks.onEnd,
  });
}
