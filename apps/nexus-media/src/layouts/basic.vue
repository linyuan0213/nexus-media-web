<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

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
  getMessageHistory,
  getMessageUnreadCount,
  markMessageRead,
} from '#/api/modules/agent';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import { isTauri, openBackendConfig } from '#/utils/tauri';
import LoginForm from '#/views/_core/authentication/login.vue';

const notifications = ref<NotificationItem[]>([]);
const unreadCount = ref(0);
let notifyTimer: null | ReturnType<typeof setInterval> = null;

const showDot = computed(() => unreadCount.value > 0);

/** 从后端加载最近通知 + 未读数（30s 轮询，覆盖后台新消息） */
async function loadNotifications() {
  try {
    const [hist, unread] = await Promise.all([
      getMessageHistory(20),
      getMessageUnreadCount(),
    ]);
    const items = [...(hist?.messages || [])].toReversed().slice(-15);
    notifications.value = items.map((m: any) => ({
      id: m.id ?? m.cursor,
      avatar: m.image || '',
      date: m.time || '',
      isRead: !!m.read,
      message: m.content || '',
      title: m.title || '通知',
      link: '/message-center',
      query: m.id ? { notify: String(m.id) } : undefined,
    }));
    unreadCount.value = unread?.unread ?? 0;
  } catch {
    // 静默失败，下次轮询重试
  }
}

function refreshUnread() {
  getMessageUnreadCount()
    .then((r) => {
      unreadCount.value = r?.unread ?? 0;
    })
    .catch(() => {});
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
  const item = notifications.value.find((n) => n.id === id);
  if (item) {
    item.isRead = true;
    markMessageRead([Number(id)]).catch(() => {});
    refreshUnread();
  }
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

function handleMakeAll() {
  notifications.value.forEach((item) => (item.isRead = true));
  markMessageRead().catch(() => {});
  refreshUnread();
}

onMounted(() => {
  loadNotifications();
  notifyTimer = setInterval(loadNotifications, 30_000);
});

onBeforeUnmount(() => {
  if (notifyTimer) clearInterval(notifyTimer);
});

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
        :notifications="notifications"
        @clear="handleNoticeClear"
        @click="handleNoticeClick"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
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
