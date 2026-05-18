<script setup lang="ts">
import { ref } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  useMessage,
} from 'naive-ui';

import { resetPasswordApi } from '#/api';

const message = useMessage();
const userStore = useUserStore();

const loading = ref(false);
const form = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

async function handleSubmit() {
  const userId = userStore.userInfo?.user_id;
  if (!userId) {
    message.error('未获取到用户信息');
    return;
  }

  if (!form.value.oldPassword) {
    message.error('请输入旧密码');
    return;
  }

  if (!form.value.newPassword) {
    message.error('请输入新密码');
    return;
  }

  if (form.value.newPassword !== form.value.confirmPassword) {
    message.error('两次输入的密码不一致');
    return;
  }

  loading.value = true;
  try {
    await resetPasswordApi(userId, form.value.newPassword, form.value.oldPassword);
    message.success('密码修改成功');
    form.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
  } catch (e: any) {
    message.error(e?.message || '密码修改失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="profile-password">
    <NForm label-placement="top" class="profile-form">
      <NFormItem label="旧密码">
        <NInput
          v-model:value="form.oldPassword"
          type="password"
          placeholder="请输入旧密码"
        >
          <template #prefix>
            <IconifyIcon icon="lucide:key-round" class="size-4" style="color: hsl(var(--muted-foreground))" />
          </template>
        </NInput>
      </NFormItem>

      <NFormItem label="新密码">
        <NInput
          v-model:value="form.newPassword"
          type="password"
          placeholder="请输入新密码"
        >
          <template #prefix>
            <IconifyIcon icon="lucide:lock" class="size-4" style="color: hsl(var(--muted-foreground))" />
          </template>
        </NInput>
      </NFormItem>

      <NFormItem label="确认密码">
        <NInput
          v-model:value="form.confirmPassword"
          type="password"
          placeholder="请再次输入新密码"
        >
          <template #prefix>
            <IconifyIcon icon="lucide:check-circle" class="size-4" style="color: hsl(var(--muted-foreground))" />
          </template>
        </NInput>
      </NFormItem>

      <div class="profile-form-actions">
        <NButton type="primary" :loading="loading" @click="handleSubmit">
          <template #icon>
            <IconifyIcon icon="lucide:check" class="size-4" />
          </template>
          修改密码
        </NButton>
      </div>
    </NForm>
  </div>
</template>

<style scoped>
.profile-password {
  max-width: 480px;
}

.profile-form-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: 0.5rem;
}
</style>
