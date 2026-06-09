<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NTag } from 'naive-ui';

import { getUserInfoApi } from '#/api';

const userInfo = ref<{
  is_superadmin?: boolean;
  roles?: string[];
  username?: string;
}>({});

async function fetchUserInfo() {
  try {
    const res: any = await getUserInfoApi();
    const data = res?.data ?? res ?? {};
    userInfo.value = {
      username: data.username,
      roles: data.roles || [],
      is_superadmin: data.is_superadmin,
    };
  } catch {
    // ignore
  }
}

onMounted(() => {
  fetchUserInfo();
});
</script>

<template>
  <div class="profile-security">
    <div class="security-item">
      <div class="security-item-left">
        <div class="security-item-icon">
          <IconifyIcon icon="lucide:user" class="size-4" />
        </div>
        <div class="security-item-info">
          <div class="security-item-title">账户密码</div>
          <div class="security-item-desc">建议定期更换密码以保障账户安全</div>
        </div>
      </div>
      <NTag type="success" size="small">已设置</NTag>
    </div>

    <div class="security-item">
      <div class="security-item-left">
        <div class="security-item-icon">
          <IconifyIcon icon="lucide:shield" class="size-4" />
        </div>
        <div class="security-item-info">
          <div class="security-item-title">角色权限</div>
          <div class="security-item-desc">
            {{ userInfo.roles?.join(', ') || '普通用户' }}
          </div>
        </div>
      </div>
      <NTag :type="userInfo.is_superadmin ? 'warning' : 'default'" size="small">
        {{ userInfo.is_superadmin ? '超级管理员' : '普通用户' }}
      </NTag>
    </div>
  </div>
</template>

<style scoped>
.profile-security {
  max-width: 480px;
}

.security-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  margin-bottom: 0.75rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
}

.security-item-left {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.security-item-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: calc(var(--radius) - 2px);
}

.security-item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.security-item-desc {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}
</style>
