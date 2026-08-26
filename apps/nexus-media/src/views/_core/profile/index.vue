<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Profile } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { message } from '#/adapter/naive';
import { getUserInfoApi, uploadAvatarApi } from '#/api';

import ProfileBase from './base-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileSecuritySetting from './security-setting.vue';

const userStore = useUserStore();
const route = useRoute();

const tabsValue = ref<string>('basic');

const tabs = ref([
  {
    label: '基本设置',
    value: 'basic',
  },
  {
    label: '安全设置',
    value: 'security',
  },
  {
    label: '修改密码',
    value: 'password',
  },
]);

onMounted(() => {
  // 守卫检测到仍为初始默认密码时跳转至此，强制切到改密页
  if (route.query.force === '1') {
    tabsValue.value = 'password';
    message.warning('当前仍在使用初始默认密码，请立即修改');
  } else if (route.query.tab === 'password') {
    tabsValue.value = 'password';
  }
});

async function handleAvatarUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  const userId = userStore.userInfo?.user_id;
  if (!file || !userId) return;

  if (!file.type.startsWith('image/')) {
    message.error('请上传图片文件');
    return;
  }

  try {
    const res: any = await uploadAvatarApi(userId, file);
    const url = res?.data?.url ?? res?.url ?? '';
    if (url) {
      // 更新 store 中的头像
      userStore.setUserInfo({
        ...userStore.userInfo,
        avatar: url,
      } as any);
      // 刷新后端用户信息
      const infoRes: any = await getUserInfoApi();
      const data = infoRes?.data ?? infoRes ?? {};
      userStore.setUserInfo(data);
      message.success('头像更新成功');
    }
  } catch (error: any) {
    message.error(error?.message || '上传失败');
  } finally {
    target.value = '';
  }
}
</script>
<template>
  <Profile
    v-model:model-value="tabsValue"
    title="个人中心"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #avatar-upload>
      <label class="cursor-pointer">
        <IconifyIcon icon="lucide:camera" class="size-3.5" />
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleAvatarUpload"
        />
      </label>
    </template>

    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfileSecuritySetting v-if="tabsValue === 'security'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
    </template>
  </Profile>
</template>
