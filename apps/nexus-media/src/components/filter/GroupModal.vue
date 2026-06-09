<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSwitch,
} from 'naive-ui';

import { addFilterGroupApi } from '#/api/modules/filter';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  success: [];
  'update:show': [value: boolean];
}>();

const loading = ref(false);
const form = ref({
  name: '',
  default: false,
});

watch(
  () => props.show,
  (val) => {
    if (val) {
      form.value = { name: '', default: false };
    }
  },
);

async function handleSubmit() {
  if (!form.value.name.trim()) return;
  loading.value = true;
  try {
    await addFilterGroupApi({
      name: form.value.name.trim(),
      default: form.value.default ? 'Y' : 'N',
    });
    emit('update:show', false);
    emit('success');
  } catch {
    // handled by caller
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    title="新增规则组"
    preset="card"
    :style="{ width: '480px', maxWidth: '92vw' }"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="left" label-width="80">
      <NFormItem label="名称" required>
        <NInput v-model:value="form.name" placeholder="请输入规则组名称" />
      </NFormItem>
      <NFormItem label="设为默认">
        <NSwitch v-model:value="form.default" />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">
          保存
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>
