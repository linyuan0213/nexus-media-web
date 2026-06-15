/**
 * 插件中心 API
 * 对应后端: /api/plugin/*
 */
import { requestClient } from '#/api/request';

export namespace PluginApi {
  export interface PluginItem {
    id: string;
    name: string;
    version: string;
    description?: string;
    installed: boolean;
    enabled: boolean;
    author?: string;
    // 模板字段
    icon?: string;
    color?: string;
    state?: boolean | number;
    desc?: string;
    config?: Record<string, any>;
    fields?: Record<string, any>[];
    prefix?: string;
    page?: string;
  }

  export interface PluginConfig {
    [key: string]: any;
  }
}

/** 获取已安装插件 */
export async function getInstalledPluginsApi() {
  return requestClient.post<PluginApi.PluginItem[]>('/plugin/plugins', {});
}

/** 获取插件市场列表 */
export async function getMarketPluginsApi() {
  return requestClient.post<PluginApi.PluginItem[]>('/plugin/plugins', {});
}

/** 安装插件 */
export async function installPluginApi(id: string) {
  return requestClient.post('/plugin/plugins/install', { id });
}

/** 卸载插件 */
export async function uninstallPluginApi(id: string) {
  return requestClient.post('/plugin/plugins/uninstall', { id });
}

/** 启用/禁用插件 */
export async function togglePluginApi(id: string, enabled: boolean) {
  return requestClient.post('/plugin/plugins/state', { id, enabled });
}

/** 获取插件配置 */
export async function getPluginConfigApi(id: string) {
  return requestClient.post<PluginApi.PluginConfig>('/plugin/plugins/state', {
    id,
  });
}

/** 保存插件配置 */
export async function savePluginConfigApi(
  id: string,
  config: PluginApi.PluginConfig,
) {
  return requestClient.post('/plugin/plugins/config', { id, config });
}
