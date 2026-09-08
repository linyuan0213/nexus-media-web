<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import {
  getMessageUnreadCount,
  getMessageUnreadList,
  markMessageRead,
  streamMessages,
} from '#/api/modules/agent';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { useAppNotification } from '#/utils/notify';
import {
  canOsNotify,
  ensureNotifyPermission,
  notifyPermissionState,
  notifySettings,
  playNotifySound,
  queueOsNotify,
  requestNotifyPermissionOnGesture,
  updateNotifySettings,
} from '#/utils/os-notify';
import { isTauri, openBackendConfig } from '#/utils/tauri';
import { dispatchUnreadSync, listenUnreadSync } from '#/utils/unread-sync';
import { disableWebPush, enableWebPush } from '#/utils/web-push';
import LoginForm from '#/views/_core/authentication/login.vue';

const notifications = ref<NotificationItem[]>([]);
const notification = useAppNotification();
const unreadCount = ref(0);
let notifyTimer: null | ReturnType<typeof setInterval> = null;

const showDot = computed(() => unreadCount.value > 0);

// OS 通知去重集合（与消息中心共用 localStorage，防重放/重复弹）
const NOTIFIED_KEY = 'nexus-agent-notified-ids';
const notifiedIds: Set<number> = (() => {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]').map(Number),
    );
  } catch {
    return new Set();
  }
})();

function saveNotifiedIds() {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notifiedIds]));
}

/** 跳转消息中心（OS 通知点击回调） */
function openMessageCenter() {
  router.push({ path: '/message-center' });
}

/** 开启/关闭系统通知（合并：页面 OS 通知 + Web Push 手机/后台推送） */
let osToggling = false;

async function onToggleOsEnabled(v: boolean) {
  updateNotifySettings({ osEnabled: v });
  if (osToggling) return;
  osToggling = true;
  try {
    if (v) {
      // 把存量未读全部记入已推送去重集：开启系统通知不重推旧消息，只推之后新到的
      for (const item of notifications.value) {
        const id = item.id ?? item.query?.notify;
        if (id != null) notifiedIds.add(Number(id));
      }
      saveNotifiedIds();
      // 借点击手势请求权限并订阅 Web Push（后台/手机也可达）
      requestNotifyPermissionOnGesture();
      const ok = await enableWebPush();
      const state = notifyPermissionState();
      if (!ok || state !== 'granted') {
        const hint =
          state === 'denied'
            ? '浏览器通知权限被拒绝：请在地址栏左侧站点设置中改为“允许”'
            : state === 'default'
              ? '请在弹窗中允许通知权限'
              : '当前环境不支持通知（需 HTTPS 访问）';
        notification.warning(`推送未开启：${hint}`);
      }
    } else {
      await disableWebPush();
    }
  } finally {
    osToggling = false;
  }
}

/** 更新未读数：变化时广播跨标签同步 */
function setUnreadCount(next: number) {
  if (next !== unreadCount.value) {
    unreadCount.value = next;
    dispatchUnreadSync();
  }
}

/** 从后端加载未读通知 + 未读数（15s 轮询兜底，SSE 为主） */
async function loadNotifications() {
  try {
    const res = await getMessageUnreadList(100);
    const items = res?.messages || [];
    // 新未读消息 → OS 通知栏：有授权才弹并记录去重（前台也弹，去重防重复）
    const osReady = canOsNotify();
    for (const m of items) {
      const id = m.id ?? m.cursor;
      if (!id || notifiedIds.has(id)) continue;
      if (osReady) {
        notifiedIds.add(id);
        saveNotifiedIds();
        queueOsNotify(m.title || '新消息', m.content || '', openMessageCenter);
      }
    }
    notifications.value = items.map((m: any) => ({
      id: m.id ?? m.cursor,
      avatar: m.image || '',
      date: m.time || '',
      isRead: false,
      message: m.content || '',
      title: m.title || '通知',
      link: '/message-center',
      query: m.id ? { notify: String(m.id) } : undefined,
    }));
    setUnreadCount(res?.unread ?? 0);
  } catch {
    // 静默失败，下次轮询重试
  }
}

async function refreshUnread() {
  try {
    const res = await getMessageUnreadCount();
    setUnreadCount(res?.unread ?? 0);
  } catch {
    // 忽略
  }
}

// 未读刷新防抖：SSE 事件/广播同步可能高频触发，合并为低频请求，避免打爆后端限流（429）
let refreshUnreadTimer: null | number = null;
let loadNotificationsTimer: null | number = null;

function scheduleRefreshUnread() {
  if (refreshUnreadTimer) return;
  refreshUnreadTimer = window.setTimeout(() => {
    refreshUnreadTimer = null;
    refreshUnread();
  }, 2000);
}

function scheduleLoadNotifications() {
  if (loadNotificationsTimer) return;
  loadNotificationsTimer = window.setTimeout(() => {
    loadNotificationsTimer = null;
    loadNotifications();
  }, 3000);
}

// 布局 SSE 消息流：新消息实时刷新铃铛/下拉 + 提示音（消息中心页暂停，由其自身流接管）
const LAYOUT_CURSOR_KEY = 'nexus-layout-stream-cursor';
let layoutStreamAbort: AbortController | null = null;
let layoutStreamCursor = 0;
let layoutStreamBackoff = 3000;
let layoutReconnectTimer: null | number = null;

function loadLayoutCursor() {
  try {
    return Number(localStorage.getItem(LAYOUT_CURSOR_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function stopLayoutStream() {
  layoutStreamAbort?.abort();
  layoutStreamAbort = null;
  if (layoutReconnectTimer) clearTimeout(layoutReconnectTimer);
  layoutReconnectTimer = null;
}

function startLayoutStream() {
  if (layoutStreamAbort) return;
  layoutStreamAbort = new AbortController();
  streamMessages(
    layoutStreamCursor,
    {
      onEvent: (item) => {
        layoutStreamBackoff = 3000;
        layoutStreamCursor = Math.max(layoutStreamCursor, item.cursor || 0);
        localStorage.setItem(LAYOUT_CURSOR_KEY, String(layoutStreamCursor));
        if (item.read === true || item.kind === 'list') return;
        playNotifySound();
        scheduleLoadNotifications();
      },
      onEnd: () => {
        layoutStreamAbort = null;
        layoutReconnectTimer = window.setTimeout(
          startLayoutStream,
          layoutStreamBackoff + Math.random() * 1000,
        );
        layoutStreamBackoff = Math.min(layoutStreamBackoff * 2, 30_000);
      },
    },
    layoutStreamAbort.signal,
  );
}

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();

const menus = computed(() => {
  const list = [
    {
      handler: () => {
        router.push({ name: 'Profile' });
      },
      icon: 'lucide:user',
      text: $t('page.auth.profile'),
    },
  ];

  if (isTauri()) {
    list.push({
      handler: openBackendConfig,
      icon: 'lucide:settings',
      text: '服务端地址',
    });
  }

  return list;
});

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

function handleNoticeClear() {
  notifications.value = [];
  markMessageRead().catch(() => {});
  refreshUnread();
}

function markRead(id: number | string) {
  // 铃铛只显示未读：点击后立即移除
  notifications.value = notifications.value.filter((item) => item.id !== id);
  markMessageRead([Number(id)]).catch(() => {});
  refreshUnread();
}

function remove(id: number | string) {
  notifications.value = notifications.value.filter((item) => item.id !== id);
  markMessageRead([Number(id)]).catch(() => {});
  refreshUnread();
}

/** 点击通知 → 跳转消息中心并标记该条已读 */
function handleNoticeClick(item: NotificationItem) {
  if (item.id != null) markRead(item.id);
  if (item.link) {
    router.push({ path: item.link, query: item.query });
  }
}

/** 查看所有消息 → 跳转消息中心（顺带惰性请求通知权限） */
function handleViewAll() {
  ensureNotifyPermission();
  router.push({ path: '/message-center' });
}

function handleMakeAll() {
  notifications.value = [];
  markMessageRead().catch(() => {});
  refreshUnread();
}

onMounted(() => {
  layoutStreamCursor = loadLayoutCursor();
  loadNotifications();
  notifyTimer = setInterval(loadNotifications, 15_000);
  unlistenUnread = listenUnreadSync(scheduleRefreshUnread);
});

onBeforeUnmount(() => {
  if (notifyTimer) clearInterval(notifyTimer);
  unlistenUnread?.();
  stopLayoutStream();
});

// 消息中心页由消息中心自身流接管，暂停布局流避免双连接
const route = useRoute();
watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/message-center')) {
      stopLayoutStream();
    } else {
      startLayoutStream();
    }
  },
  { immediate: true },
);

let unlistenUnread: (() => void) | null = null;

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
  }),
  async ({ enable, content }) => {
    if (enable) {
      await updateWatermark({
        content: content || `${userStore.userInfo?.username}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName || userStore.userInfo?.username"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :badge-count="unreadCount"
        :badge-enabled="notifySettings.badgeEnabled"
        :notifications="notifications"
        :os-enabled="notifySettings.osEnabled"
        :sound-enabled="notifySettings.soundEnabled"
        @clear="handleNoticeClear"
        @click="handleNoticeClick"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
        @view-all="handleViewAll"
        @update-badge-enabled="(v) => updateNotifySettings({ badgeEnabled: v })"
        @update-os-enabled="onToggleOsEnabled"
        @update-sound-enabled="(v) => updateNotifySettings({ soundEnabled: v })"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
