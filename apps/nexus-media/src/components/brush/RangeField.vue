<script setup lang="ts">
import { computed } from 'vue';

import { NInput, NSelect } from 'naive-ui';

interface OperatorOption {
  label: string;
  value: string;
  type?: string;
}

const props = defineProps<{
  modelValue?: string;
  options: OperatorOption[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function parseValue(raw?: string): { operator: string; value: string } {
  if (!raw) return { operator: '', value: '' };
  const idx = raw.indexOf('#');
  if (idx === -1) return { operator: '', value: raw };
  let val = raw.slice(idx + 1);
  // 兼容旧数据：自动去掉前导的 < 或 >
  val = val.replace(/^[\u003C\u003E]/, '');
  return { operator: raw.slice(0, idx), value: val };
}

function buildValue(operator: string, value: string): string {
  if (!operator) return '';
  if (!value) return `${operator}#`;
  return `${operator}#${value}`;
}

const parsed = computed(() => parseValue(props.modelValue));
const operator = computed(() => parsed.value.operator);
const inputValue = computed(() => parsed.value.value);

function handleOperatorChange(val: string) {
  emit('update:modelValue', buildValue(val, inputValue.value));
}

function handleValueChange(val: string) {
  emit('update:modelValue', buildValue(operator.value, val));
}
</script>

<template>
  <div class="range-field">
    <NSelect
      :value="operator"
      :options="options as any"
      @update:value="handleOperatorChange"
      class="range-operator"
      size="small"
    />
    <NInput
      :value="inputValue"
      @update:value="handleValueChange"
      :disabled="!operator"
      :placeholder="placeholder"
      class="range-value"
      size="small"
    />
  </div>
</template>

<style scoped>
.range-field {
  display: flex;
  width: 100%;
}

.range-operator {
  flex-shrink: 0;
  width: 5.5rem;
}

.range-operator :deep(.n-base-selection) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.range-value {
  flex: 1;
}

.range-value :deep(.n-input__wrapper) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.range-value :deep(.n-input__state-border) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
</style>
