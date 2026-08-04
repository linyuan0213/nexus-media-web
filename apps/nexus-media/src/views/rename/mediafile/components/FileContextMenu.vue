<script lang="ts" setup>
import type { DropdownOption } from 'naive-ui';

import type { FileActionKey } from '../types';

import { NDropdown } from 'naive-ui';

interface Props {
  options: DropdownOption[];
  show?: boolean;
  x?: number;
  y?: number;
}

withDefaults(defineProps<Props>(), {
  show: false,
  x: 0,
  y: 0,
});

const emit = defineEmits<{
  close: [];
  select: [key: FileActionKey];
}>();
</script>

<template>
  <NDropdown
    :show="show"
    :x="x"
    :y="y"
    :options="options"
    trigger="manual"
    placement="bottom-start"
    @select="(key: FileActionKey) => emit('select', key)"
    @clickoutside="emit('close')"
  />
</template>
