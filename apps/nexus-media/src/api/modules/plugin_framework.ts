/** 插件框架 v2 API */

import { requestClient } from '#/api/request';

/** 列出所有已安装插件 */
export async function getPluginsApi() {
  return requestClient.get('/plugin-framework/plugins');
}

/** 获取插件完整 manifest */
export async function getPluginManifestApi(pluginId: string) {
  return requestClient.get(`/plugin-framework/plugins/${pluginId}/manifest`);
}

/** 获取插件配置和字段定义 */
export async function getPluginConfigApi(pluginId: string) {
  return requestClient.get(`/plugin-framework/plugins/${pluginId}/config`);
}

/** 保存插件配置 */
export async function savePluginConfigApi(
  pluginId: string,
  config: Record<string, any>,
) {
  return requestClient.put(`/plugin-framework/plugins/${pluginId}/config`, {
    plugin_id: pluginId,
    config,
  });
}

/** 安装插件（上传 zip） */
export async function installPluginApi(file: File) {
  return requestClient.upload('/plugin-framework/plugins/install', {
    file,
  });
}

/** 卸载插件 */
export async function uninstallPluginApi(pluginId: string) {
  return requestClient.delete(`/plugin-framework/plugins/${pluginId}`);
}

/** 启用插件 */
export async function enablePluginApi(pluginId: string) {
  return requestClient.post(`/plugin-framework/plugins/${pluginId}/enable`, {});
}

/** 禁用插件 */
export async function disablePluginApi(pluginId: string) {
  return requestClient.post(
    `/plugin-framework/plugins/${pluginId}/disable`,
    {},
  );
}

/** 获取插件日志 */
export async function getPluginLogsApi(
  pluginId: string,
  page = 1,
  pageSize = 20,
) {
  return requestClient.get(
    `/plugin-framework/plugins/${pluginId}/logs?page=${page}&page_size=${pageSize}`,
  );
}

/** 清空插件日志 */
export async function clearPluginLogsApi(pluginId: string) {
  return requestClient.delete(`/plugin-framework/plugins/${pluginId}/logs`);
}

/** 立即运行插件 */
export async function runPluginApi(pluginId: string) {
  return requestClient.post(`/plugin-framework/plugins/${pluginId}/run`, {});
}

/** 热重载插件 */
export async function reloadPluginApi(pluginId: string) {
  return requestClient.post(`/plugin-framework/plugins/${pluginId}/reload`, {});
}

/** 获取插件 README */
export async function getPluginReadmeApi(pluginId: string) {
  return requestClient.get(`/plugin-framework/plugins/${pluginId}/readme`);
}

/** 获取插件数据文件 */
export async function getPluginDataApi(pluginId: string, filename: string) {
  return requestClient.get(
    `/plugin-framework/plugins/${pluginId}/data/${filename}`,
  );
}

/** 删除插件数据文件中的某条记录 */
export async function deletePluginDataApi(
  pluginId: string,
  filename: string,
  itemId: string,
) {
  return requestClient.delete(
    `/plugin-framework/plugins/${pluginId}/data/${filename}/${itemId}`,
  );
}

/** 列出所有 Hook 事件 */
export async function getHookEventsApi() {
  return requestClient.get('/plugin-framework/hooks/events');
}
