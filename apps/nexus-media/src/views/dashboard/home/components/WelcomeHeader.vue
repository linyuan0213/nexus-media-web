<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

interface Props {
  version?: string;
  uptime?: number;
}

const props = withDefaults(defineProps<Props>(), {
  version: '',
  uptime: 0,
});

const userStore = useUserStore();

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早安';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const userName = computed(
  () => userStore.userInfo?.realName || userStore.userInfo?.nickname || 'Admin',
);

const currentDate = computed(() => {
  const now = new Date();
  return now.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
});

const uptimeText = computed(() => {
  const s = props.uptime || 0;
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${mins}分钟`;
  return `${mins}分钟`;
});
</script>

<template>
  <div
    class="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
    style="border-color: hsl(var(--border)); background: hsl(var(--card))"
  >
    <!-- 左侧：头像 + 问候 -->
    <div class="flex items-center gap-4">
      <div
        class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full"
        style="background: hsl(var(--primary) / 15%)"
      >
        <img
          v-if="userStore.userInfo?.avatar"
          :src="userStore.userInfo.avatar"
          class="h-full w-full object-cover"
          alt="avatar"
        />
        <IconifyIcon
          v-else
          icon="lucide:user"
          class="size-7"
          style="color: hsl(var(--primary))"
        />
      </div>
      <div>
        <h2 class="text-lg font-semibold" style="color: hsl(var(--card-foreground))">
          {{ greeting }}, {{ userName }}
        </h2>
        <p class="mt-0.5 text-sm" style="color: hsl(var(--muted-foreground))">
          {{ version ? `Nexus Media ${version}` : 'Nexus Media' }}
        </p>
      </div>
    </div>

    <!-- 右侧：日期 + 运行时长 -->
    <div class="flex items-center gap-6 sm:gap-8">
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:calendar"
          class="size-4"
          style="color: hsl(var(--muted-foreground))"
        />
        <span class="text-sm" style="color: hsl(var(--muted-foreground))">{{ currentDate }}</span>
      </div>
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:zap"
          class="size-4"
          style="color: hsl(var(--success))"
        />
        <span class="text-sm" style="color: hsl(var(--muted-foreground))">
          已运行 {{ uptimeText }}
        </span>
      </div>
    </div>
  </div>
</template>
