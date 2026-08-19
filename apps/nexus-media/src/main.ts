import { initPreferences } from '@vben/preferences';
import { unmountGlobalLoading } from '@vben/utils';

import { overridesPreferences } from './preferences';

/**
 * 应用初始化完成之后再进行页面加载渲染
 */
async function initApplication() {
  // name用于指定项目唯一标识
  // 用于区分不同项目的偏好设置以及存储数据的key前缀以及其他一些需要隔离的数据
  const env = import.meta.env.PROD ? 'prod' : 'dev';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  // 偏好设置使用稳定命名空间（不带版本号）：升级后用户偏好不丢失
  const prefNamespace = `${import.meta.env.VITE_APP_NAMESPACE}-${env}`;
  // 业务存储（登录态/认证等）保持版本隔离：发版后重新登录为预期行为，
  // 同时避免旧版本持久化数据结构与新版本不兼容
  const storageNamespace = `${import.meta.env.VITE_APP_NAMESPACE}-${appVersion}-${env}`;

  // 一次性迁移：将历史版本的偏好设置复制到稳定命名空间
  migrateLegacyPreferences(
    import.meta.env.VITE_APP_NAMESPACE,
    env,
    prefNamespace,
  );

  // app偏好设置初始化
  await initPreferences({
    namespace: prefNamespace,
    overrides: overridesPreferences,
  });

  // 启动应用并挂载
  // vue应用主要逻辑及视图
  const { bootstrap } = await import('./bootstrap');
  await bootstrap(storageNamespace);

  // 移除并销毁loading
  unmountGlobalLoading();
}

/**
 * 迁移历史版本偏好设置：旧键形如 `nexus-media-{version}-{env}-preferences*`，
 * 新稳定键为 `nexus-media-{env}-preferences*`。对每个偏好后缀取版本号最大的旧键复制，
 * 仅在新稳定键不存在时写入。登录态（core-access/secure-meta 等）不迁移，保持版本隔离。
 */
function migrateLegacyPreferences(
  appNamespace: string,
  env: string,
  targetPrefix: string,
) {
  try {
    const stablePrefix = `${targetPrefix}-`;
    const versionRe = new RegExp(
      String.raw`^${appNamespace}-([\w.]+)-${env}-(preferences.*)$`,
    );
    const versioned: { key: string; suffix: string; version: string }[] = [];
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(stablePrefix)) {
        continue;
      }
      const match = key.match(versionRe);
      if (match) {
        const [, version, suffix] = match;
        if (version && suffix) {
          versioned.push({ key, version, suffix });
        }
      }
    }
    // 每个偏好后缀取版本号最大的旧键
    const best = new Map<string, string>();
    for (const item of versioned) {
      const current = best.get(item.suffix);
      if (
        !current ||
        item.version.localeCompare(current, undefined, { numeric: true }) > 0
      ) {
        best.set(item.suffix, item.key);
      }
    }
    for (const [suffix, key] of best) {
      const stableKey = `${stablePrefix}${suffix}`;
      if (localStorage.getItem(stableKey) == null) {
        const value = localStorage.getItem(key);
        if (value != null) {
          localStorage.setItem(stableKey, value);
        }
      }
    }
  } catch {
    // 迁移失败不影响启动
  }
}

initApplication();
