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
    start_time: string | null;
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
    switchs: string[];
    templates?: Record<string, any>;
  }

  export interface ScraperConfig {
    scraper_nfo?: {
      movie?: { basic?: boolean; credits?: boolean; credits_chinese?: boolean };
      tv?: { basic?: boolean; credits?: boolean; credits_chinese?: boolean; season_basic?: boolean; episode_basic?: boolean; episode_credits?: boolean };
    };
    scraper_pic?: {
      movie?: Record<string, boolean>;
      tv?: Record<string, boolean>;
    };
  }
}

/** 获取系统基本信息 */
export async function getSystemInfoApi() {
  return requestClient.post<SystemApi.SystemInfo>('/api/system/info', {});
}

/** 获取系统状态 */
export async function getSystemStatusApi() {
  return requestClient.post<SystemApi.SystemStatus>('/api/system/status', {});
}

/** 执行调度任务 */
export async function runSchedulerItemApi(item: string) {
  return requestClient.post('/api/system/scheduler/run', { item });
}

/** 网络连通性测试 */
export async function netTestApi(target?: string) {
  return requestClient.post<{ res: boolean; time: string }>('/api/system/net_test', { target });
}

/** 备份配置 */
export async function backupApi() {
  return requestClient.post('/api/system/backup', {});
}

/** 获取系统命令列表 */
export async function getSystemCommandsApi() {
  return requestClient.post<Array<{ id: string; name: string }>>('/api/system/commands', {});
}

/** 获取所有系统配置（扁平化，供基础设置页面使用） */
export async function getAllSystemConfigApi() {
  return requestClient.post<Record<string, any>>('/api/system/config/all', {});
}

/** 获取系统日志 */
export async function getSystemLogsApi(level?: string, source?: string, limit: number = 200) {
  return requestClient.post<SystemApi.LogItem[]>('/api/system/logs', { level, source, limit });
}

/** 重启系统 */
export async function restartSystemApi() {
  return requestClient.post('/api/system/restart');
}

/** 获取任务进度 */
export async function getProgressApi(type: string) {
  return requestClient.post<{ code: number; data?: { value: number; text: string } }>('/api/system/refresh', { type });
}

/** 更新系统配置 */
export async function updateConfigApi(data: Record<string, any>) {
  return requestClient.post('/api/system/config/update', { data });
}

/** 设置系统配置项 */
export async function setSystemConfigApi(key: string, value: any) {
  return requestClient.post('/api/system/config', { key, value });
}

/** 查询 Agent 模型列表 */
export async function listAgentModelsApi(data: {
  provider_name: string;
  api_url: string;
  api_key: string;
}) {
  return requestClient.post<{ code: number; data?: string[] }>('/api/system/agent/models', data);
}

/** 获取消息客户端列表 */
export async function getMessageClientApi(cid?: number) {
  return requestClient.post<Record<string, SystemApi.MessageClient>>('/api/system/message_clients', { cid });
}

/** 获取消息通知配置模板 */
export async function getMessageClientConfigApi() {
  return requestClient.post<{
    channels: Record<string, {
      name: string;
      img_url?: string;
      color?: string;
      search_type?: string;
      max_length?: number;
      config: Record<string, any>;
    }>;
    switchs: Record<string, { name: string; fuc_name: string }>;
  }>('/api/system/message_clients/config');
}

/** 获取消息通知默认模板 */
export async function getMessageClientDefaultTemplatesApi() {
  return requestClient.get<Record<string, { title: string; text: string }>>(
    '/api/system/message_clients/templates/defaults',
  );
}

/** 更新消息客户端 */
export async function updateMessageClientApi(data: {
  cid?: number;
  name?: string;
  type?: string;
  config?: string;
  switchs?: string;
  interactive?: number;
  enabled?: number;
  templates?: string;
}) {
  return requestClient.post('/api/system/message_clients/update', data);
}

/** 删除消息客户端 */
export async function deleteMessageClientApi(cid: number) {
  return requestClient.post('/api/system/message_clients/delete', { cid });
}

/** 测试消息客户端 */
export async function testMessageClientApi(type: string, config: string) {
  return requestClient.post('/api/system/message_clients/test', { type, config });
}

/** 发送自定义消息 */
export async function sendCustomMessageApi(data: {
  title: string;
  text?: string;
  image?: string;
  message_clients: string[];
}) {
  return requestClient.post('/api/system/messages/send', data);
}

/** 获取索引器配置 */
export async function getIndexersConfigApi() {
  return requestClient.post<{
    indexers: { id: string; name: string; public: boolean }[];
    private_count: number;
    public_count: number;
    indexer_conf: Record<string, any>;
    indexer_sites: string[];
    search_indexer: string;
    indexer_config: Record<string, any>;
  }>('/api/system/indexers');
}

/** 保存索引器配置 */
export async function saveIndexerConfigApi(data: Record<string, any>) {
  return requestClient.post('/api/system/indexers/config', { data });
}

/** 测试索引器连接 */
export async function testIndexerConfigApi(data: Record<string, any>) {
  return requestClient.post('/api/system/indexers/test', { data });
}

/** 获取媒体服务器配置 */
export async function getMediaServersConfigApi() {
  return requestClient.post<{
    servers: Record<string, { id: number; name: string; enabled: number; is_default: number; config: Record<string, any> }>;
    default_server: string | null;
    mediaserver_conf: Record<string, any>;
  }>('/api/system/mediaservers');
}

/** 保存媒体服务器配置 */
export async function saveMediaServerConfigApi(data: Record<string, any>) {
  return requestClient.post('/api/system/mediaservers/config', { data });
}

/** 测试媒体服务器连接 */
export async function testMediaServerApi(data: Record<string, any>) {
  return requestClient.post('/api/system/mediaservers/test', { data });
}


