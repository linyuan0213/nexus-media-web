/**
 * OS 通知 + 提示音工具
 * 惰性请求权限、多消息聚合、点击跳转、声音开关（localStorage 持久化）。
 */
import { ref } from 'vue';

export interface NotifySettings {
  /** 是否启用 OS 系统通知 */
  osEnabled: boolean;
  /** 新消息是否播放提示音 */
  soundEnabled: boolean;
  /** 铃铛是否显示未读数量红色角标 */
  badgeEnabled: boolean;
}

const SETTINGS_KEY = 'nexus-notify-settings';

function loadSettings(): NotifySettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '');
    return {
      osEnabled: raw?.osEnabled !== false,
      soundEnabled: raw?.soundEnabled === true,
      badgeEnabled: raw?.badgeEnabled !== false,
    };
  } catch {
    return { osEnabled: true, soundEnabled: false, badgeEnabled: true };
  }
}

/** 通知设置（响应式，供 UI 开关绑定） */
export const notifySettings = ref<NotifySettings>(loadSettings());

export function updateNotifySettings(patch: Partial<NotifySettings>) {
  notifySettings.value = { ...notifySettings.value, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(notifySettings.value));
}

/** 惰性请求通知权限：仅首次真正要弹通知时才向用户请求 */
let permissionAsked = false;

export async function ensureNotifyPermission(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return false;
    }
    const permission = Notification.permission;
    if (permission === 'granted') return true;
    if (permission === 'denied' || permissionAsked) return false;
    permissionAsked = true;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** 新消息提示音（WebAudio 双音短促提示） */
let audioCtx: AudioContext | null = null;

export function playNotifySound() {
  if (!notifySettings.value.soundEnabled) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const now = audioCtx.currentTime;
    for (const freq of [880, 1174.66]) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch {
    // 音频不可用忽略
  }
}

/** 聚合队列：短窗口内多条消息合并为一条 OS 通知 */
interface QueuedNotify {
  title: string;
  body: string;
  onClick?: () => void;
}

let notifyQueue: QueuedNotify[] = [];
let queueTimer: null | ReturnType<typeof setTimeout> = null;

/**
 * 排队弹 OS 通知（自动聚合 + 提示音 + 点击跳转）。
 * 页面前台时仅播放提示音，不弹系统通知；去重由调用方负责。
 */
export function queueOsNotify(
  title: string,
  body: string,
  onClick?: () => void,
) {
  playNotifySound();
  if (!notifySettings.value.osEnabled) return;
  notifyQueue.push({ title, body, onClick });
  if (queueTimer) clearTimeout(queueTimer);
  queueTimer = setTimeout(flushNotifyQueue, 1500);
}

async function flushNotifyQueue() {
  const batch = notifyQueue;
  notifyQueue = [];
  queueTimer = null;
  if (batch.length === 0) return;
  if (!document.hidden && document.hasFocus()) return; // 前台不弹系统通知
  if (!(await ensureNotifyPermission())) return;
  let title = 'Nexus Media';
  let body: string;
  let onClick: (() => void) | undefined;
  if (batch.length === 1) {
    const first = batch[0];
    title = first?.title || title;
    body = first?.body || '';
    onClick = first?.onClick;
  } else {
    title = `你收到 ${batch.length} 条新消息`;
    const titles = batch.map((n) => n.title).filter(Boolean);
    body = titles.slice(0, 3).join('、') + (titles.length > 3 ? '…' : '');
  }
  try {
    const notification = new Notification(title, {
      body,
      icon: '/static/img/logo.png',
      tag: 'nexus-message',
    });
    notification.addEventListener('click', () => {
      window.focus();
      onClick?.();
      notification.close();
    });
  } catch {
    // 浏览器通知失败不阻断
  }
}
