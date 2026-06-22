<script setup lang="ts">
import { ref } from 'vue';

import { getHealthUrl, setBackendUrl } from '#/utils/backend-url';

const url = ref('');
const loading = ref(false);
const errorMsg = ref('');

async function handleSave() {
  errorMsg.value = '';
  loading.value = true;

  const healthUrl = getHealthUrl(url.value);
  if (!healthUrl) {
    errorMsg.value = '请输入服务端地址';
    loading.value = false;
    return;
  }

  try {
    const res = await fetch(healthUrl, { method: 'GET' });
    if (!res.ok) {
      throw new Error('health check failed');
    }
  } catch {
    errorMsg.value = '无法连接到该地址，请检查地址是否正确';
    loading.value = false;
    return;
  }

  setBackendUrl(url.value);
  window.location.reload();
}
</script>

<template>
  <div
    class="flex h-screen w-screen flex-col items-center justify-center bg-background p-6 text-foreground"
  >
    <div class="w-full max-w-sm">
      <h1 class="mb-2 text-xl font-bold">设置服务端地址</h1>
      <p class="mb-6 text-sm text-muted-foreground">
        用于连接 Nexus Media 后端，例如 http://localhost:3000
      </p>
      <input
        v-model="url"
        class="mb-2 w-full rounded border border-border bg-card p-2 outline-none focus:border-primary"
        placeholder="http://localhost:3000"
        type="url"
      />
      <p v-if="errorMsg" class="mb-2 text-sm text-destructive">
        {{ errorMsg }}
      </p>
      <button
        class="w-full rounded bg-primary p-2 text-primary-foreground disabled:opacity-50"
        :disabled="loading"
        @click="handleSave"
      >
        {{ loading ? '验证中...' : '保存并进入' }}
      </button>
    </div>
  </div>
</template>
