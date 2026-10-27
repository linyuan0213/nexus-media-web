<script lang="ts" setup>
import { NModal } from 'naive-ui';

defineProps<{
  show: boolean;
  loading: boolean;
  sourceName: string;
}>();

const emit = defineEmits<{
  confirm: [];
  'update:show': [value: boolean];
}>();
</script>

<template>
  <NModal
    :show="show"
    preset="dialog"
    type="warning"
    title="删除 RSS 源"
    positive-text="删除"
    negative-text="取消"
    :loading="loading"
    @positive-click="emit('confirm')"
    @update:show="emit('update:show', $event)"
  >
    确定删除“{{ sourceName }}”吗？已有订阅会保留，但不再从该源获取报文。
  </NModal>
</template>
