<script setup lang="ts">
import { ref, onMounted } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  useMessage,
} from 'naive-ui';

import {
  getUserInfoApi,
  updateUserApi,
} from '#/api';

const message = useMessage();
const userStore = useUserStore();

const loading = ref(false);
const userInfo = ref<{
  id: number;
  username: string;
  nickname: string;
  email?: string;
  avatar?: string;
}>({
  id: 0,
  username: '',
  nickname: '',
  email: '',
  avatar: '',
});

async function fetchUserInfo() {
  try {
    const res: any = await getUserInfoApi();
    const data = res?.data ?? res ?? {};
    userInfo.value = {
      id: data.user_id || 0,
      username: data.username || '',
      nickname: data.nickname || '',
      email: data.email || '',
      avatar: data.avatar || '',
    };
  } catch {
    // ignore
  }
}

async function handleSave() {
  if (!userInfo.value.id) return;
  loading.value = true;
  try {
    await updateUserApi({
      id: userInfo.value.id,
      nickname: userInfo.value.nickname,
      email: userInfo.value.email,
      avatar: userInfo.value.avatar,
    } as any);

    // 刷新 store 中的用户信息
    const res: any = await getUserInfoApi();
    const data = res?.data ?? res ?? {};
    userStore.setUserInfo(data);

    message.success('保存成功');
  } catch (e: any) {
    message.error(e?.message || '保存失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchUserInfo();
});
</script>

<template>
  <div class="profile-base">
    <NForm label-placement="top" class="profile-form">
      <NFormItem label="用户名">
        <NInput v-model:value="userInfo.username" disabled />
      </NFormItem>

      <NFormItem label="昵称">
        <NInput
          v-model:value="userInfo.nickname"
          placeholder="请输入昵称"
        >
          <template #prefix>
            <IconifyIcon icon="lucide:smile" class="size-4" style="color: hsl(var(--muted-foreground))" />
          </template>
        </NInput>
      </NFormItem>

      <NFormItem label="邮箱">
        <NInput
          v-model:value="userInfo.email"
          placeholder="请输入邮箱"
        >
          <template #prefix>
            <IconifyIcon icon="lucide:mail" class="size-4" style="color: hsl(var(--muted-foreground))" />
          </template>
        </NInput>
      </NFormItem>

      <div class="profile-form-actions">
        <NButton type="primary" :loading="loading" @click="handleSave">
          <template #icon>
            <IconifyIcon icon="lucide:check" class="size-4" />
          </template>
          保存修改
        </NButton>
      </div>
    </NForm>
  </div>
</template>

<style scoped>
.profile-base {
  max-width: 480px;
}

.profile-form-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: 0.5rem;
}
</style>
