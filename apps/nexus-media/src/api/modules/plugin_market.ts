/** 远程插件市场 API（后端前缀 /api/plugin/market） */

import { requestClient } from '#/api/request';

export interface MarketSource {
  source_id: string;
  name: string;
  url: string;
  enabled: boolean;
  auto_update: boolean;
  public_key: string;
  last_sync_at: string;
  last_error: string;
}

export interface CatalogPlugin {
  source_id: string;
  id: string;
  path: string;
  updated_at?: string;
}

export interface AuditFinding {
  severity: 'block' | 'warn';
  rule: string;
  file?: string;
  detail?: string;
}

export interface AuditReport {
  passed: boolean;
  sha256_ok: boolean;
  package_size: number;
  file_count: number;
  findings: AuditFinding[];
}

export interface MarketPluginDetail {
  id: string;
  name: string;
  version: string;
  description?: string;
  category?: string;
  tags?: string[];
  icon?: string;
  license?: string;
  min_app_version?: string;
  download_url?: string;
  sha256?: string;
  size?: number;
  backend?: { entry?: string; tools?: unknown[] };
}

/** 市场源列表 */
export async function getMarketSourcesApi() {
  return requestClient.get('/plugin/market/sources');
}

/** 添加市场源 */
export async function addMarketSourceApi(data: {
  name: string;
  url: string;
  public_key?: string;
}) {
  return requestClient.post('/plugin/market/sources', data);
}

/** 更新市场源 */
export async function updateMarketSourceApi(
  sourceId: string,
  data: Partial<
    Pick<
      MarketSource,
      'auto_update' | 'enabled' | 'name' | 'public_key' | 'url'
    >
  >,
) {
  return requestClient.put(`/plugin/market/sources/${sourceId}`, data);
}

/** 删除市场源 */
export async function deleteMarketSourceApi(sourceId: string) {
  return requestClient.delete(`/plugin/market/sources/${sourceId}`);
}

/** 立即同步目录索引 */
export async function syncMarketSourceApi(sourceId: string) {
  return requestClient.post(`/plugin/market/sources/${sourceId}/sync`);
}

/** 目录插件列表 */
export async function getMarketCatalogPluginsApi(
  sourceId: string,
  keyword?: string,
) {
  return requestClient.get('/plugin/market/plugins', {
    params: { source_id: sourceId, keyword: keyword ?? '' },
  });
}

/** 插件详情（懒加载） */
export async function getMarketPluginDetailApi(
  sourceId: string,
  pluginId: string,
) {
  return requestClient.get(`/plugin/market/plugins/${pluginId}`, {
    params: { source_id: sourceId },
  });
}

/** 安装前审计（SAST 预检） */
export async function auditMarketPluginApi(sourceId: string, pluginId: string) {
  return requestClient.get(`/plugin/market/plugins/${pluginId}/audit`, {
    params: { source_id: sourceId },
  });
}

/** 安装（enabled=false 表示隔离安装） */
export async function installMarketPluginApi(
  sourceId: string,
  pluginId: string,
  enabled = true,
) {
  return requestClient.post('/plugin/market/install', {
    source_id: sourceId,
    plugin_id: pluginId,
    enabled,
  });
}

/** 更新到最新 */
export async function updateMarketPluginApi(
  sourceId: string,
  pluginId: string,
) {
  return requestClient.post('/plugin/market/update', {
    source_id: sourceId,
    plugin_id: pluginId,
  });
}
