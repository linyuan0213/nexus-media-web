<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
} from 'naive-ui';

import { addFilterRuleApi } from '#/api/modules/filter';
import type { FilterApi } from '#/api/modules/filter';

const props = defineProps<{
  show: boolean;
  groupId: number;
  editingRule: FilterApi.FilterRuleItem | null;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  success: [];
}>();

const loading = ref(false);
const form = ref({
  rule_id: undefined as number | undefined,
  rule_name: '',
  rule_pri: '1',
  rule_include: '',
  rule_exclude: '',
  rule_sizelimit: '',
  rule_free: '',
});

watch(
  () => props.show,
  (val) => {
    if (val) {
      if (props.editingRule) {
        form.value = {
          rule_id: props.editingRule.id,
          rule_name: props.editingRule.name || '',
          rule_pri: String(props.editingRule.pri || 1),
          rule_include: (props.editingRule.include || []).join('\n'),
          rule_exclude: (props.editingRule.exclude || []).join('\n'),
          rule_sizelimit: props.editingRule.size || '',
          rule_free: props.editingRule.free_text || '',
        };
      } else {
        form.value = {
          rule_id: undefined,
          rule_name: '',
          rule_pri: '1',
          rule_include: '',
          rule_exclude: '',
          rule_sizelimit: '',
          rule_free: '',
        };
      }
    }
  },
);

async function handleSubmit() {
  if (!form.value.rule_name.trim()) return;
  loading.value = true;
  try {
    await addFilterRuleApi({
      rule_id: form.value.rule_id,
      group_id: props.groupId,
      rule_name: form.value.rule_name.trim(),
      rule_pri: form.value.rule_pri,
      rule_include: form.value.rule_include.trim() || undefined,
      rule_exclude: form.value.rule_exclude.trim() || undefined,
      rule_sizelimit: form.value.rule_sizelimit.trim() || undefined,
      rule_free: form.value.rule_free.trim() || undefined,
    });
    emit('update:show', false);
    emit('success');
  } catch (err: any) {
    // handled by caller
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    :title="editingRule ? '编辑规则' : '新增规则'"
    preset="card"
    class="w-[560px]"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="left" label-width="90">
      <NFormItem label="名称" required>
        <NInput v-model:value="form.rule_name" placeholder="规则名称" />
      </NFormItem>
      <NFormItem label="优先级">
        <NInput v-model:value="form.rule_pri" placeholder="数字越小优先级越高" />
      </NFormItem>
      <NFormItem label="包含">
        <NInput v-model:value="form.rule_include" type="textarea" :rows="2" placeholder="每行一个关键词，支持正则" />
      </NFormItem>
      <NFormItem label="排除">
        <NInput v-model:value="form.rule_exclude" type="textarea" :rows="2" placeholder="每行一个关键词，支持正则" />
      </NFormItem>
      <div class="grid grid-cols-2 gap-3">
        <NFormItem label="大小限制">
          <NInput v-model:value="form.rule_sizelimit" placeholder="如: >10GB <100GB" />
        </NFormItem>
        <NFormItem label="Free标记">
          <NInput v-model:value="form.rule_free" placeholder="如: FREE" />
        </NFormItem>
      </div>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" :loading="loading" @click="handleSubmit">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
