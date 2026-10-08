/**
 * 未读同步工具
 * 同页 window 事件 + 跨标签 BroadcastChannel，未读数变化时广播刷新铃铛。
 */

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  try {
    if (!channel && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('nexus-unread-sync');
    }
    return channel;
  } catch {
    return null;
  }
}

/** 广播未读变化（同页事件 + 跨标签） */
export function dispatchUnreadSync() {
  window.dispatchEvent(new Event('nexus-unread-sync'));
  getChannel()?.postMessage({ type: 'unread-sync' });
}

/** 监听未读同步，返回取消函数 */
export function listenUnreadSync(callback: () => void): () => void {
  const onWindow = () => callback();
  window.addEventListener('nexus-unread-sync', onWindow);
  const ch = getChannel();
  const onChannel = (e: MessageEvent) => {
    if (e.data?.type === 'unread-sync') callback();
  };
  if (ch) ch.addEventListener('message', onChannel);
  return () => {
    window.removeEventListener('nexus-unread-sync', onWindow);
    if (ch) ch.removeEventListener('message', onChannel);
  };
}

/** 请求消息中心定位到第一条未读（点击系统通知后定位用） */
export function dispatchScrollFirstUnread() {
  window.dispatchEvent(new Event('nexus-scroll-first-unread'));
}

/** 监听"定位第一条未读"请求，返回取消函数 */
export function listenScrollFirstUnread(callback: () => void): () => void {
  const onWindow = () => callback();
  window.addEventListener('nexus-scroll-first-unread', onWindow);
  return () => {
    window.removeEventListener('nexus-scroll-first-unread', onWindow);
  };
}
