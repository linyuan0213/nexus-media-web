<script lang="ts" setup>
import { computed } from 'vue';

import { NButton, NModal } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    item?: null | Record<string, any>;
    kind?: 'history' | 'subscription';
    show: boolean;
    title?: string;
  }>(),
  {
    item: null,
    kind: 'subscription',
    title: '确认删除',
  },
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'update:show', v: boolean): void;
}>();

const displayName = computed(
  () =>
    String(
      props.item?.name ||
        props.item?.title ||
        props.item?.NAME ||
        props.item?.TITLE ||
        '',
    ) || '该订阅',
);
const isHistory = computed(() => props.kind === 'history');
const description = computed(() =>
  isHistory.value
    ? `确定要删除「${displayName.value}」的订阅历史吗？`
    : `确定要删除订阅「${displayName.value}」吗？`,
);
</script>

<template>
  <NModal
    :show="props.show"
    preset="dialog"
    :title="props.title"
    type="warning"
    :bordered="false"
    @update:show="(v) => emit('update:show', v)"
  >
    <p>{{ description }}</p>
    <template #action>
      <NButton size="small" @click="emit('update:show', false)">取消</NButton>
      <NButton size="small" type="error" @click="emit('confirm')">
        删除
      </NButton>
    </template>
  </NModal>
</template>
