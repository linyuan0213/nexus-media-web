<script lang="ts" setup>
import type { NotificationItem } from './types';

import {
  Bell,
  CircleCheckBig,
  CircleX,
  IconifyIcon,
  MailCheck,
} from '@vben/icons';
import { $t } from '@vben/locales';

import {
  VbenButton,
  VbenIconButton,
  VbenPopover,
  VbenScrollbar,
} from '@vben-core/shadcn-ui';

import { useToggle } from '@vueuse/core';

defineOptions({ name: 'NotificationPopup' });

withDefaults(
  defineProps<{
    /** 显示圆点 */
    dot?: boolean;
    /** 未读数量徽标（右上角红色，>0 时显示数字） */
    badgeCount?: number;
    /** 是否显示未读角标（关闭后隐藏红色数字/圆点） */
    badgeEnabled?: boolean;
    /** 消息列表 */
    notifications?: NotificationItem[];
    /** 是否启用 OS 系统通知 */
    osEnabled?: boolean;
    /** 新消息提示音 */
    soundEnabled?: boolean;
  }>(),
  {
    dot: false,
    badgeCount: 0,
    badgeEnabled: true,
    notifications: () => [],
    osEnabled: true,
    soundEnabled: false,
  },
);

const emit = defineEmits<{
  clear: [];
  makeAll: [];
  onClick: [NotificationItem];
  read: [NotificationItem];
  remove: [NotificationItem];
  updateBadgeEnabled: [value: boolean];
  updateOsEnabled: [value: boolean];
  updateSoundEnabled: [value: boolean];
  viewAll: [];
}>();

const [open, toggle] = useToggle();

const close = () => {
  open.value = false;
};

defineExpose({ toggle });

const handleViewAll = () => {
  emit('viewAll');
  close();
};

const handleMakeAll = () => {
  emit('makeAll');
};

const handleClear = () => {
  emit('clear');
};
</script>
<template>
  <VbenPopover v-model:open="open" content-class="relative right-2 w-90 p-0">
    <template #trigger>
      <div class="mr-2 flex-center h-full" @click.stop="toggle()">
        <VbenIconButton class="bell-button relative text-foreground">
          <span
            v-if="badgeEnabled && badgeCount > 0"
            class="absolute -top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white"
          >
            {{ badgeCount > 99 ? '99+' : badgeCount }}
          </span>
          <span
            v-else-if="badgeEnabled && dot"
            class="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-destructive"
          ></span>
          <Bell class="size-4" />
        </VbenIconButton>
      </div>
    </template>

    <div class="relative">
      <div class="flex items-center justify-between p-4 py-3">
        <div class="text-foreground">{{ $t('ui.widgets.notifications') }}</div>
        <div class="flex items-center gap-1">
          <VbenIconButton
            :tooltip="badgeEnabled ? '未读角标已开启' : '未读角标已关闭'"
            @click="emit('updateBadgeEnabled', !badgeEnabled)"
          >
            <IconifyIcon
              :icon="badgeEnabled ? 'lucide:badge' : 'lucide:badge-x'"
              class="size-4"
            />
          </VbenIconButton>
          <VbenIconButton
            :tooltip="osEnabled ? '系统通知已开启' : '系统通知已关闭'"
            @click="emit('updateOsEnabled', !osEnabled)"
          >
            <IconifyIcon
              :icon="osEnabled ? 'lucide:bell' : 'lucide:bell-off'"
              class="size-4"
            />
          </VbenIconButton>
          <VbenIconButton
            :tooltip="soundEnabled ? '提示音已开启' : '提示音已关闭'"
            @click="emit('updateSoundEnabled', !soundEnabled)"
          >
            <IconifyIcon
              :icon="soundEnabled ? 'lucide:volume-2' : 'lucide:volume-x'"
              class="size-4"
            />
          </VbenIconButton>
          <VbenIconButton
            :disabled="notifications.length <= 0"
            :tooltip="$t('ui.widgets.markAllAsRead')"
            @click="handleMakeAll"
          >
            <MailCheck class="size-4" />
          </VbenIconButton>
        </div>
      </div>
      <VbenScrollbar v-if="notifications.length > 0">
        <ul class="flex! max-h-90 w-full flex-col">
          <template v-for="item in notifications" :key="item.id ?? item.title">
            <li
              class="relative flex w-full cursor-pointer items-start gap-5 border-t border-border p-3 hover:bg-accent"
              @click="emit('onClick', item)"
            >
              <slot name="content" :item="item">
                <span
                  v-if="!item.isRead"
                  class="absolute top-2 right-2 size-2 rounded-sm bg-primary"
                ></span>

                <span
                  v-if="item.avatar"
                  class="relative flex size-10 shrink-0 overflow-hidden rounded-full"
                >
                  <img
                    :src="item.avatar"
                    class="aspect-square size-full object-cover"
                  />
                </span>
                <div class="flex flex-col gap-1 leading-none">
                  <p class="font-semibold">{{ item.title }}</p>
                  <p class="my-1 line-clamp-2 text-xs text-muted-foreground">
                    {{ item.message }}
                  </p>
                  <p class="line-clamp-2 text-xs text-muted-foreground">
                    {{ item.date }}
                  </p>
                </div>
                <div
                  class="absolute top-1/2 right-3 flex -translate-y-1/2 flex-row gap-1"
                >
                  <slot name="action" :item="item">
                    <slot name="action-prepend" :item="item"></slot>
                    <VbenIconButton
                      v-if="!item.isRead"
                      size="xs"
                      variant="ghost"
                      class="h-6 px-2"
                      :tooltip="$t('common.confirm')"
                      @click.stop="emit('read', item)"
                    >
                      <CircleCheckBig class="size-4" />
                    </VbenIconButton>
                    <VbenIconButton
                      v-if="item.isRead"
                      size="xs"
                      variant="ghost"
                      class="h-6 px-2 text-destructive"
                      :tooltip="$t('common.delete')"
                      @click.stop="emit('remove', item)"
                    >
                      <CircleX class="size-4" />
                    </VbenIconButton>
                    <slot name="action-append" :item="item"></slot>
                  </slot>
                </div>
              </slot>
            </li>
          </template>
        </ul>
      </VbenScrollbar>

      <template v-else>
        <div class="flex-center min-h-37.5 w-full text-muted-foreground">
          {{ $t('common.noData') }}
        </div>
      </template>

      <div
        class="flex items-center justify-between border-t border-border px-4 py-3"
      >
        <VbenButton
          :disabled="notifications.length <= 0"
          size="sm"
          variant="ghost"
          @click="handleClear"
        >
          {{ $t('ui.widgets.clearNotifications') }}
        </VbenButton>
        <VbenButton size="sm" @click="handleViewAll">
          {{ $t('ui.widgets.viewAll') }}
        </VbenButton>
      </div>
    </div>
  </VbenPopover>
</template>

<style scoped>
:deep(.bell-button) {
  &:hover {
    svg {
      animation: bell-ring 1s both;
    }
  }
}

@keyframes bell-ring {
  0%,
  100% {
    transform-origin: top;
  }

  15% {
    transform: rotateZ(10deg);
  }

  30% {
    transform: rotateZ(-10deg);
  }

  45% {
    transform: rotateZ(5deg);
  }

  60% {
    transform: rotateZ(-5deg);
  }

  75% {
    transform: rotateZ(2deg);
  }
}
</style>
