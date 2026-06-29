<script lang="ts" setup>
import type { ResourceItem } from '../types';

import { watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NModal,
  NSelect,
  NSpace,
  NSpin,
} from 'naive-ui';

interface Props {
  visible: boolean;
  loading: boolean;
  resource: null | ResourceItem;
  settings: Array<{ label: string; value: string }>;
  dirs: Array<{ label: string; value: string }>;
  modelSetting: string;
  modelDir: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  confirm: [];
  settingChange: [value: null | string];
  'update:modelDir': [value: string];
  'update:modelSetting': [value: string];
  'update:visible': [value: boolean];
}>();

function updateVisible(value: boolean) {
  emit('update:visible', value);
}

function updateSetting(value: null | string) {
  emit('update:modelSetting', value || '');
  emit('settingChange', value);
}

function updateDir(value: null | string) {
  emit('update:modelDir', value || '');
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      emit('update:modelSetting', '');
      emit('update:modelDir', '');
    }
  },
);
</script>

<template>
  <NModal
    :show="visible"
    :title="`下载 - ${resource?.title || ''}`"
    preset="card"
    :style="{ width: '480px', maxWidth: '92vw' }"
    :bordered="false"
    :segmented="{ content: true }"
    :mask-closable="false"
    @update:show="updateVisible"
  >
    <NSpin :show="loading">
      <NForm label-placement="top" size="small">
        <NFormItem label="下载设置">
          <NSelect
            :value="modelSetting"
            :options="settings"
            placeholder="请选择下载设置"
            clearable
            @update:value="updateSetting"
          />
        </NFormItem>
        <NFormItem label="保存目录">
          <NSelect
            :value="modelDir"
            :options="dirs"
            placeholder="请选择保存目录"
            clearable
            @update:value="updateDir"
          />
        </NFormItem>
      </NForm>
    </NSpin>

    <template #footer>
      <NSpace justify="end">
        <NButton size="small" @click="updateVisible(false)"> 取消 </NButton>
        <NButton
          size="small"
          type="primary"
          :loading="loading"
          :disabled="!resource?.enclosure && !resource?.page_url"
          @click="emit('confirm')"
        >
          确认下载
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>
