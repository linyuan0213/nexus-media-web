/**
 * PluginLoader - 插件前端加载器
 * 负责动态加载插件 UMD 包、注册组件、注入路由和插槽
 */
import type { RouteRecordRaw } from 'vue-router';

import { h, reactive, type Component } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { router } from '#/router';
import { requestClient } from '#/api/request';

const PLUGIN_API_BASE = '/api/plugin-framework';

/** 已加载的插件组件缓存 */
const loadedComponents = new Map<string, Component>();

/** 已加载的插件脚本标记 */
const loadedScripts = new Set<string>();

/** 插槽注册表: slotTarget -> { pluginId, componentName, name, icon, color }[] */
const slotRegistry = reactive<
  Record<string, Array<{ pluginId: string; componentName: string; name: string; icon: string; color?: string }>>
>({});

/** 插件路由注册表 */
const pluginRoutes = new Map<string, RouteRecordRaw[]>();

export interface PluginManifestFrontend {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  frontend: {
    routes: Array<{
      path: string;
      component: string;
      title: string;
      icon: string;
      menu: boolean;
    }>;
    slots: Array<{
      target: string;
      position: string;
      component: string;
    }>;
  };
}

/**
 * 插件组件加载失败的占位页面
 */
const PluginErrorComponent = (props: { pluginId?: string; componentName?: string }) =>
  h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 1rem',
      color: 'hsl(var(--muted-foreground))',
    },
  }, [
    h('div', { style: { fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 } }, '插件组件加载失败'),
    h('div', { style: { fontSize: '0.875rem' } },
      `插件 ${props.pluginId || ''} 的组件 ${props.componentName || ''} 加载失败，请检查插件是否已正确安装或 UMD 包是否存在。`
    ),
  ]);

/**
 * 加载插件 UMD 脚本
 */
function loadScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * 从全局 window 对象获取插件暴露的组件
 */
function getPluginComponent(pluginId: string, componentName: string): Component | null {
  const globalKey = `__PLUGIN_${pluginId}__`;
  const pluginModule = (window as any)[globalKey];
  if (!pluginModule) return null;
  const comp = pluginModule[componentName] || pluginModule.default;
  return comp || null;
}

/**
 * 获取插件组件（优先缓存）
 */
export function getComponent(pluginId: string, componentName: string): Component | null {
  const cacheKey = `${pluginId}::${componentName}`;
  if (loadedComponents.has(cacheKey)) {
    return loadedComponents.get(cacheKey)!;
  }
  const comp = getPluginComponent(pluginId, componentName);
  if (comp) {
    loadedComponents.set(cacheKey, comp);
  }
  return comp;
}

/**
 * 注册插件路由
 */
function registerPluginRoutes(plugin: PluginManifestFrontend) {
  const routes: RouteRecordRaw[] = [];
  const basePath = `/plugin/${plugin.id}`;

  for (const route of plugin.frontend.routes) {
    const fullPath = route.path.startsWith('/') ? route.path : `${basePath}/${route.path}`;
    const routeName = `Plugin_${plugin.id}_${route.path.replace(/\//g, '_')}`;

    const routeDef: RouteRecordRaw = {
      name: routeName,
      path: fullPath,
      component: () => loadPluginComponent(plugin.id, route.component),
      meta: {
        icon: route.icon || 'lucide:puzzle',
        title: route.title || plugin.name,
        hideInMenu: !route.menu,
      },
    };
    routes.push(routeDef);
  }

  if (routes.length > 0) {
    // 确保 Plugin 父路由存在
    let pluginParent = router.getRoutes().find((r) => r.name === 'Plugin');
    if (!pluginParent) {
      router.addRoute('Root', {
        name: 'Plugin',
        path: '/plugin',
        component: () => import('#/views/plugin/installed/index.vue'),
        meta: {
          icon: 'lucide:puzzle',
          title: '插件',
        },
        children: [],
      });
    }
    for (const r of routes) {
      router.addRoute('Plugin', r);
    }
    pluginRoutes.set(plugin.id, routes);
    console.log(`[PluginLoader] 插件 ${plugin.id} 路由已注册:`, routes.map((r) => r.path));
    // 菜单由后端 RBAC 统一管理，前端不再手动注入 accessMenus
  }
}

/**
 * 动态加载插件组件（用于路由懒加载）
 */
async function loadPluginComponent(pluginId: string, componentName: string): Promise<Component> {
  const comp = getComponent(pluginId, componentName);
  if (comp) return comp;

  try {
    // 确保 Vue 全局可用（UMD 依赖 window.Vue）
    if (!(window as any).Vue) {
      const vueModule = await import('vue');
      (window as any).Vue = vueModule;
    }

    // 尝试加载 UMD 包
    const umdUrl = `${PLUGIN_API_BASE}/plugins/${pluginId}/assets/frontend/index.umd.js`;
    await loadScript(umdUrl);

    const loaded = getComponent(pluginId, componentName);
    if (loaded) return loaded;
  } catch (e) {
    console.error(`[PluginLoader] 加载插件组件失败 ${pluginId}/${componentName}:`, e);
  }

  // 返回占位组件，避免 Vue Router 报 missing component
  return () => h(PluginErrorComponent, { pluginId, componentName });
}

/**
 * 注册插件插槽
 */
function registerPluginSlots(plugin: PluginManifestFrontend) {
  for (const slot of plugin.frontend.slots || []) {
    if (!slot.target || !slot.component) continue;
    const list = slotRegistry[slot.target] || [];
    if (!list.find((s) => s.pluginId === plugin.id)) {
      list.push({
        pluginId: plugin.id,
        componentName: slot.component,
        name: plugin.name,
        // @ts-ignore
        icon: plugin.icon || 'lucide:puzzle',
        // @ts-ignore
        color: plugin.color,
      });
      slotRegistry[slot.target] = list;
    }
  }
}

/**
 * 加载单个插件的前端资源
 */
export async function loadPluginFrontend(plugin: PluginManifestFrontend): Promise<void> {
  if (!plugin.enabled) return;

  try {
    // 如果有前端组件，先加载 UMD
    const hasComponents =
      plugin.frontend.routes?.length > 0 || plugin.frontend.slots?.length > 0;

    if (hasComponents) {
      // 确保 Vue 全局可用（供插件 UMD 使用，避免 tree-shaking 删除暴露代码）
      if (!(window as any).Vue) {
        const vueModule = await import('vue');
        (window as any).Vue = vueModule;
        console.log('[PluginLoader] window.Vue 已动态注入');
      }
      // 暴露 IconifyIcon 组件供插件 UMD 使用
      if (!(window as any).IconifyIcon) {
        (window as any).IconifyIcon = IconifyIcon;
        console.log('[PluginLoader] window.IconifyIcon 已动态注入');
      }

      const umdUrl = `${PLUGIN_API_BASE}/plugins/${plugin.id}/assets/frontend/index.umd.js`;
      await loadScript(umdUrl);

      // 验证 UMD 是否正确注册
      const globalKey = `__PLUGIN_${plugin.id}__`;
      const module = (window as any)[globalKey];
      if (!module) {
        console.error(`[PluginLoader] UMD 加载后全局变量未注册: ${globalKey}`);
        return;
      }
      console.log(`[PluginLoader] 插件 ${plugin.id} UMD 加载成功，暴露的组件:`, Object.keys(module));
    }

    // 注册路由
    if (plugin.frontend.routes?.length > 0) {
      registerPluginRoutes(plugin);
    }

    // 注册插槽
    if (plugin.frontend.slots?.length > 0) {
      registerPluginSlots(plugin);
      console.log(`[PluginLoader] 插件 ${plugin.id} 插槽已注册:`, plugin.frontend.slots.map(s => s.target));
    }
  } catch (e) {
    console.error(`[PluginLoader] 加载插件前端失败 ${plugin.id}:`, e);
  }
}

let _pluginsLoaded = false;

/**
 * 加载所有已启用插件的前端资源
 */
export async function loadAllPluginFrontends(): Promise<void> {
  if (_pluginsLoaded) return;
  try {
    const plugins: PluginManifestFrontend[] = await requestClient.get(`${PLUGIN_API_BASE}/plugins`);
    for (const plugin of plugins) {
      if (plugin.enabled) {
        await loadPluginFrontend(plugin);
      }
    }
    _pluginsLoaded = true;
  } catch (e) {
    console.error('[PluginLoader] 获取插件列表失败:', e);
  }
}

/**
 * 获取指定插槽的组件列表
 */
export interface SlotComponent {
  pluginId: string;
  component: Component | null;
  name: string;
  icon: string;
  color?: string;
}

export function getSlotComponents(target: string): SlotComponent[] {
  const list = slotRegistry[target] || [];
  return list.map((item) => ({
    pluginId: item.pluginId,
    component: getComponent(item.pluginId, item.componentName),
    name: item.name,
    icon: item.icon,
    color: item.color,
  }));
}

/**
 * 卸载插件前端资源
 */
export function unloadPluginFrontend(pluginId: string): void {
  // 移除路由
  const routes = pluginRoutes.get(pluginId);
  if (routes) {
    for (const r of routes) {
      router.removeRoute(r.name as string);
    }
    pluginRoutes.delete(pluginId);
  }

  // 移除插槽
  for (const target of Object.keys(slotRegistry)) {
    const list = slotRegistry[target];
    if (!list) continue;
    const filtered = list.filter((s) => s.pluginId !== pluginId);
    if (filtered.length !== list.length) {
      slotRegistry[target] = filtered;
    }
  }

  // 清除组件缓存
  for (const key of loadedComponents.keys()) {
    if (key.startsWith(`${pluginId}::`)) {
      loadedComponents.delete(key);
    }
  }

  // 移除全局模块
  const globalKey = `__PLUGIN_${pluginId}__`;
  delete (window as any)[globalKey];
}

export default {
  loadPluginFrontend,
  loadAllPluginFrontends,
  unloadPluginFrontend,
  getComponent,
  getSlotComponents,
};
