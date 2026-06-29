<script lang="ts" setup>
import type { SiteItem } from '../types';

import { computed } from 'vue';

import { NModal } from 'naive-ui';

interface Props {
  show: boolean;
  target: null | SiteItem;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'confirm'): void;
}>();

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

function handlePositiveClick() {
  emit('confirm');
}
</script>

<template>
  <NModal
    v-model:show="visible"
    title="确认删除"
    preset="dialog"
    positive-text="确认"
    negative-text="取消"
    type="warning"
    @positive-click="handlePositiveClick"
  >
    <p>确定要删除站点「{{ target?.name }}」吗？</p>
  </NModal>
</template>
