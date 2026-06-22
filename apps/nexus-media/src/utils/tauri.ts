/**
 * Tauri 桌面客户端辅助函数。
 *
 * 当前 frontend 也作为纯 Web 应用运行，不能静态依赖 `@tauri-apps/api`，
 * 否则 Web 构建会失败。所有 Tauri 调用都通过运行时守卫 + 动态 import 实现。
 */

const BACKEND_CONFIG_PATH = '/setup/backend-url';

export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined
  );
}

function jumpToBackendConfig() {
  const isHash = import.meta.env.VITE_ROUTER_HISTORY === 'hash';
  window.location.href = isHash
    ? `/#${BACKEND_CONFIG_PATH}`
    : BACKEND_CONFIG_PATH;
}

export async function openBackendConfig(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    const { invoke } = await import(/* @vite-ignore */ '@tauri-apps/api/core');
    await invoke('show_config_window');
  } catch {
    // Rust 命令未实现或执行失败时，直接在当前窗口跳转配置页。
    jumpToBackendConfig();
  }
}
