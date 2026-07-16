/**
 * 系统设置 API
 * 对应后端: /api/system/*
 */
import { requestClient } from '#/api/request';

export namespace SystemApi {
  export interface SystemInfo {
    version: string;
    python_version: string;
    platform: string;
    uptime: string;
    uptime_seconds: number;
    start_time: null | string;
    memory_mb: number;
  }

  export interface SystemStatus {
    version: string;
    uptime: number;
    python_version: string;
  }

  export interface LogItem {
    time: string;
    level: string;
    source: string;
    text: string;
  }

  export interface MessageClient {
    id: number;
    name: string;
    type: string;
    enabled: number;
    interactive: number;
    config: Record<string, any>;
    switches: string[];
    templates?: Record<string, any>;
  }

  export interface ScraperConfig {
    scraper_nfo?: {
      movie?: { basic?: boolean; credits?: boolean; credits_chinese?: boolean };
      tv?: {
        basic?: boolean;
        credits?: boolean;
        credits_chinese?: boolean;
        episode_basic?: boolean;
        episode_credits?: boolean;
        season_basic?: boolean;
      };
    };
    scraper_pic?: {
      movie?: Record<string, boolean>;
      tv?: Record<string, boolean>;
    };
  }
}

/** 获取系统基本信息 */
export async function getSystemInfoApi() {
  return requestClient.post<SystemApi.SystemInfo>('/system/info', {});
}

/** 获取系统状态 */
export async function getSystemStatusApi() {
  return requestClient.post<SystemApi.SystemStatus>('/system/status', {});
}

/** 执行调度任务 */
export async function runSchedulerItemApi(item: string) {
  return requestClient.post('/system/scheduler/run', { item });
}

/** 网络连通性测试 */
export async function netTestApi(target?: string) {
  return requestClient.post<{ res: boolean; time: string }>(
    '/system/net_test',
    { target },
  );
}

/** 备份配置 */
export async function backupApi() {
  return requestClient.post('/system/backup', {});
}

/** 获取系统命令列表 */
export async function getSystemCommandsApi() {
  return requestClient.post<Array<{ id: string; name: string }>>(
    '/system/commands',
    {},
  );
}

/** 获取所有系统配置（扁平化，供基础设置页面使用） */
export async function getAllSystemConfigApi() {
  return requestClient.post<Record<string, any>>('/system/config/all', {});
}

/** 获取刮削配置 */
export async function getScraperConfigApi() {
  return requestClient.post<Record<string, any>>('/system/config/scraper', {});
}

/** 设置刮削配置 */
export async function setScraperConfigApi(data: Record<string, any>) {
  return requestClient.post('/system/config/scraper/save', data);
}

/** 获取系统日志 */
export async function getSystemLogsApi(
  level?: string,
  source?: string,
  limit: number = 200,
) {
  return requestClient.post<SystemApi.LogItem[]>('/system/logs', {
    level,
    source,
    limit,
  });
}

/** 重启系统 */
export async function restartSystemApi() {
  return requestClient.post('/system/restart');
}

// 进度请求节流：同 type 2000ms 内不重复发请求
const _progressLocks: Record<string, { promise: Promise<any>; time: number }> =
  {};

/** 获取任务进度（带同类型节流，2000ms 内不重复发请求） */
export async function getProgressApi(type: string) {
  const now = Date.now();
  const lock = _progressLocks[type];
  if (lock && now - lock.time < 2000) {
    return lock.promise;
  }
  const promise = requestClient.post<{
    code: number;
    data?: { enable?: boolean; exists?: boolean; text: string; value: number };
  }>('/system/refresh', { type });
  _progressLocks[type] = { promise, time: now };
  return promise;
}

/** 更新系统配置 */
export async function updateConfigApi(data: Record<string, any>) {
  return requestClient.post('/system/config/update', { data });
}

/** 设置系统配置项 */
export async function setSystemConfigApi(key: string, value: any) {
  return requestClient.post('/system/config', { key, value });
}

/** 查询 Agent 模型列表 */
export async function listAgentModelsApi(data: {
  api_key: string;
  api_url: string;
  provider_name: string;
}) {
  return requestClient.post<{ code: number; data?: string[] }>(
    '/system/agent/models',
    data,
  );
}

/** 获取消息客户端列表 */
export async function getMessageClientApi(cid?: number) {
  return requestClient.post<Record<string, SystemApi.MessageClient>>(
    '/system/message_clients',
    { cid },
  );
}

/** 获取消息通知配置模板 */
export async function getMessageClientConfigApi() {
  return requestClient.post<{
    channels: Record<
      string,
      {
        config: Record<string, any>;
        icon_url?: string;
        max_length?: number;
        name: string;
        search_type?: string;
      }
    >;
    switches: Record<string, { fuc_name: string; name: string }>;
  }>('/system/message_clients/config');
}

/** 获取消息通知默认模板 */
export async function getMessageClientDefaultTemplatesApi() {
  return requestClient.get<Record<string, { text: string; title: string }>>(
    '/system/message_clients/templates/defaults',
  );
}

/** 更新消息客户端 */
export async function updateMessageClientApi(data: {
  cid?: number;
  config?: string;
  enabled?: number;
  interactive?: number;
  name?: string;
  switches?: string;
  templates?: string;
  type?: string;
}) {
  return requestClient.post('/system/message_clients/update', data);
}

/** 删除消息客户端 */
export async function deleteMessageClientApi(cid: number) {
  return requestClient.post('/system/message_clients/delete', { cid });
}

/** 测试消息客户端 */
export async function testMessageClientApi(type: string, config: string) {
  return requestClient.post('/system/message_clients/test', {
    type,
    config,
  });
}

/** 发送自定义消息 */
export async function sendCustomMessageApi(data: {
  image?: string;
  message_clients: string[];
  text?: string;
  title: string;
}) {
  return requestClient.post('/system/messages/send', data);
}

/** 获取索引器配置 */
export async function getIndexersConfigApi() {
  return requestClient.post<{
    indexer_conf: Record<string, any>;
    indexer_config: Record<string, any>;
    indexer_sites: string[];
    indexers: { id: string; name: string; public: boolean }[];
    private_count: number;
    public_count: number;
    third_party_sites: {
      download_setting: null | number;
      enabled: boolean;
      id: number;
      public: boolean;
      site_name: string;
      source: string;
    }[];
  }>('/system/indexers');
}

/** 保存索引器配置 */
export async function saveIndexerConfigApi(data: Record<string, any>) {
  return requestClient.post(
    '/system/indexers/config',
    { data },
    { timeout: 120_000 },
  );
}

/** 测试索引器连接 */
export async function testIndexerConfigApi(data: Record<string, any>) {
  return requestClient.post(
    '/system/indexers/test',
    { data },
    { timeout: 120_000 },
  );
}

/** 获取媒体服务器配置 */
export async function getMediaServersConfigApi() {
  return requestClient.post<{
    default_server: null | string;
    mediaserver_conf: Record<string, any>;
    servers: Record<
      string,
      {
        config: Record<string, any>;
        enabled: number;
        id: number;
        is_default: number;
        name: string;
      }
    >;
  }>('/system/mediaservers');
}

/** 保存媒体服务器配置 */
export async function saveMediaServerConfigApi(data: Record<string, any>) {
  return requestClient.post('/system/mediaservers/config', { data });
}

/** 测试媒体服务器连接 */
export async function testMediaServerApi(data: Record<string, any>) {
  return requestClient.post('/system/mediaservers/test', { data });
}

/** 获取站点配置版本 */
export async function getSiteConfigVersionApi() {
  return requestClient.get<{
    local: string;
    needs_update: boolean;
    remote: string;
  }>('/system/site-config/version');
}

/** 手动更新站点配置 */
export async function updateSiteConfigApi(force?: boolean) {
  return requestClient.post<{
    message: string;
    success: boolean;
    version: string;
  }>('/system/site-config/update', { data: { force: !!force } });
}

/** 手动触发配置重载 */
export async function reloadConfigApi() {
  return requestClient.post<{
    code: number;
    data?: { steps: Record<string, boolean>; version: number };
  }>('/system/config/reload', {});
}
