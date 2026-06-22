/**
 * 客户端服务端地址持久化与 URL 计算。
 *
 * 用户在配置窗口填写的是服务端 origin（如 http://localhost:3000），
 * 实际 API 请求基地址会自动拼接 /api，健康检查使用 /health。
 */

const BACKEND_URL_KEY = 'nexus-backend-url';

export function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getBackendUrl(): null | string {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(BACKEND_URL_KEY);
}

export function setBackendUrl(url: string): void {
  localStorage.setItem(BACKEND_URL_KEY, normalizeBackendUrl(url));
}

export function removeBackendUrl(): void {
  localStorage.removeItem(BACKEND_URL_KEY);
}

export function getApiBaseUrl(url?: string): null | string {
  const origin = url ? normalizeBackendUrl(url) : getBackendUrl();
  return origin ? `${origin}/api` : null;
}

export function getHealthUrl(url?: string): null | string {
  const origin = url ? normalizeBackendUrl(url) : getBackendUrl();
  return origin ? `${origin}/health` : null;
}
