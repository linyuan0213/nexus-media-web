/**
 * Web Push 订阅工具
 * 注册 /sw.js 推送 Service Worker，向后端订阅/取消浏览器推送。
 * 仅在前台/后台均需要系统级通知（移动端通知栏）时使用。
 */
import { requestClient } from '#/api/request';

const VAPID_KEY_URL = '/agent/push/vapid-public-key';
const SUBSCRIBE_URL = '/agent/push/subscribe';
const UNSUBSCRIBE_URL = '/agent/push/unsubscribe';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replaceAll('-', '+')
    .replaceAll('_', '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.codePointAt(i) ?? 0;
  }
  return output;
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** 当前是否已订阅（本地记录 + 后端状态） */
export async function isPushSubscribed(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/** 订阅推送：注册 SW + 请求权限 + 用 VAPID 公钥订阅 + 落库后端 */
export async function enableWebPush(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    const keyRes = await requestClient.get<{ public_key: string }>(
      VAPID_KEY_URL,
    );
    const publicKey = keyRes?.public_key;
    if (!publicKey) return false;
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));
    const json = sub.toJSON();
    await requestClient.post(SUBSCRIBE_URL, {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });
    return true;
  } catch {
    return false;
  }
}

/** 取消订阅：退订浏览器 + 通知后端删除 */
export async function disableWebPush(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await requestClient.post(UNSUBSCRIBE_URL, { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}
