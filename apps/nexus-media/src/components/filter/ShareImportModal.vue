<script setup lang="ts">
import { ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NInput, NModal, NSpace, useNotification } from 'naive-ui';

import { importFilterGroupApi } from '#/api/modules/filter';

const props = defineProps<{
  shareContent?: string;
  show: boolean;
}>();

const emit = defineEmits<{
  success: [];
  'update:show': [value: boolean];
}>();

const notification = useNotification();
const importText = ref('');
const loading = ref(false);
const localShareContent = ref('');

watch(
  () => props.show,
  (val) => {
    if (val) {
      importText.value = '';
      localShareContent.value = props.shareContent || '';
    }
  },
);

async function handleImport() {
  if (!importText.value.trim()) return;
  loading.value = true;
  try {
    await importFilterGroupApi(importText.value.trim());
    notification.success({ content: '导入成功' });
    emit('update:show', false);
    emit('success');
  } catch (error: any) {
    notification.error({
      content: '导入失败',
      description: error?.message || '',
    });
  } finally {
    loading.value = false;
  }
}

function handleCopy() {
  if (!localShareContent.value) return;
  navigator.clipboard
    .writeText(localShareContent.value)
    .then(() => {
      notification.success({ content: '已复制到剪贴板' });
    })
    .catch(() => {
      notification.error({ content: '复制失败' });
    });
}
</script>

<template>
  <NModal
    :show="show"
    :title="shareContent ? '分享规则组' : '导入规则组'"
    preset="card"
    :style="{ width: '600px', maxWidth: '92vw' }"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <div v-if="shareContent">
      <NInput
        v-model:value="localShareContent"
        type="textarea"
        :rows="8"
        readonly
      />
      <div class="mt-3 flex justify-end">
        <NButton type="primary" @click="handleCopy">
          <template #icon>
            <IconifyIcon icon="lucide:copy" class="size-4" />
          </template>
          复制内容
        </NButton>
      </div>
    </div>
    <div v-else>
      <NInput
        v-model:value="importText"
        type="textarea"
        :rows="8"
        placeholder="请粘贴规则组 JSON 内容"
      />
      <div class="mt-3 flex justify-end">
        <NSpace>
          <NButton @click="emit('update:show', false)">取消</NButton>
          <NButton type="primary" :loading="loading" @click="handleImport">
            导入
          </NButton>
        </NSpace>
      </div>
    </div>
  </NModal>
</template>
