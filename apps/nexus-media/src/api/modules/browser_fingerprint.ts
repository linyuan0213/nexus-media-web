/**
 * 浏览器指纹 API
 * 对应后端: /api/browser/fingerprint（requestClient baseURL 已含 /api，路径不带 /api）
 */
import { requestClient } from '#/api/request';
import {
  type BrowserFingerprint,
  collectBrowserFingerprint,
  isAutomatedBrowser,
} from '#/utils/browser-fingerprint';

export namespace BrowserFingerprintApi {
  export interface SubmitResult {
    fp_profile_id: null | string;
  }

  // localStorage 节流键：指纹哈希 + 最近同步时间（v2：强制真实浏览器重新同步一次）
  const LAST_HASH_KEY = 'nexus-media:last-fp-hash:v2';
  const LAST_TS_KEY = 'nexus-media:last-fp-ts:v2';
  // 同指纹 1 小时内不重复同步
  const THROTTLE_MS = 60 * 60 * 1000;

  function hashStr(input: string): string {
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
      h = (h * 33) ^ (input.codePointAt(i) ?? 0);
    }
    return (h >>> 0).toString(36);
  }

  /**
   * 采集当前浏览器真实指纹并提交注入 nexus-chrome。
   * 返回该用户的 fp_profile_id；失败返回 null。
   */
  export async function submit(): Promise<null | string> {
    if (isAutomatedBrowser()) return null;
    const fingerprint: BrowserFingerprint = await collectBrowserFingerprint();
    try {
      const res = await requestClient.post<SubmitResult>(
        '/browser/fingerprint',
        fingerprint,
      );
      return res?.fp_profile_id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 节流同步：指纹未变化（同浏览器/环境）且近期同步过则跳过，
   * 避免每次刷新页面都重复同步。浏览器/系统环境变化时自动重新同步。
   * 自动化/无头浏览器（webdriver / HeadlessChrome 等）直接跳过，避免污染站点指纹画像。
   */
  export async function submitIfChanged(): Promise<null | string> {
    if (isAutomatedBrowser()) return null;
    let fingerprint: BrowserFingerprint;
    try {
      fingerprint = await collectBrowserFingerprint();
    } catch {
      return null;
    }
    const hash = hashStr(JSON.stringify(fingerprint));
    const lastHash = localStorage.getItem(LAST_HASH_KEY);
    const lastTs = Number(localStorage.getItem(LAST_TS_KEY) || 0);
    if (lastHash === hash && Date.now() - lastTs < THROTTLE_MS) {
      return null;
    }
    try {
      const res = await requestClient.post<SubmitResult>(
        '/browser/fingerprint',
        fingerprint,
      );
      localStorage.setItem(LAST_HASH_KEY, hash);
      localStorage.setItem(LAST_TS_KEY, String(Date.now()));
      return res?.fp_profile_id ?? null;
    } catch {
      return null;
    }
  }
}
