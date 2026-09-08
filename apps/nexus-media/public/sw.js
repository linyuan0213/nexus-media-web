// / <reference lib="webworker" />
/**
 * Nexus Media Web Push Service Worker
 * 浏览器后台/移动端推送：接收后端 Web Push，弹系统通知；点击聚焦并跳转消息中心。
 * 不缓存任何内容（离线由 SPA 自身处理），仅承担 push 事件分发。
 */

const ICON = '/static/img/logo/logo-mark.png';

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Nexus Media', body: event.data.text() };
  }
  const title = data.title || 'Nexus Media';
  const options = {
    body: data.body || '',
    icon: ICON,
    badge: ICON,
    tag: data.tag || 'nexus-message',
    data: { url: data.url || '/message-center' },
    requireInteraction: false,
  };
  // 展示系统通知（iOS/桌面均走 SW，页面是否在前台都会弹）
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/message-center';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(target);
            return;
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
