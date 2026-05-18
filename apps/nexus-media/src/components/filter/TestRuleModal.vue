<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  useNotification,
} from 'naive-ui';

import { testFilterRuleApi } from '#/api/modules/filter';

const props = defineProps<{
  show: boolean;
  groupName?: string;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const notification = useNotification();
const loading = ref(false);
const form = ref({
  title: '',
  subtitle: '',
  size: '',
});
const result = ref<{
  flag: boolean;
  text: string;
  order: number;
} | null>(null);

watch(
  () => props.show,
  (val) => {
    if (val) {
      form.value = { title: '', subtitle: '', size: '' };
      result.value = null;
    }
  },
);

async function handleTest() {
  if (!form.value.title.trim()) return;
  loading.value = true;
  try {
    const res: any = await testFilterRuleApi({
      title: form.value.title.trim(),
      subtitle: form.value.subtitle.trim() || undefined,
      size: form.value.size.trim() || undefined,
      rulegroup: props.groupName,
    });
    result.value = res?.data || res;
  } catch (err: any) {
    notification.error({ content: '测试失败', description: err?.message || '' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    title="测试过滤规则"
    preset="card"
    class="w-[520px]"
    :bordered="false"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="left" label-width="80">
      <NFormItem label="规则组">
        <NInput :value="groupName || '默认'" readonly />
      </NFormItem>
      <NFormItem label="标题" required>
        <NInput v-model:value="form.title" placeholder="资源标题" />
      </NFormItem>
      <NFormItem label="副标题">
        <NInput v-model:value="form.subtitle" placeholder="副标题（可选）" />
      </NFormItem>
      <NFormItem label="大小">
        <NInput v-model:value="form.size" placeholder="如: 15.2GB" />
      </NFormItem>
    </NForm>

    <div
      v-if="result"
      class="mt-4 p-3 rounded-lg"
      :style="{
        background: result.flag
          ? 'hsl(var(--success) / 0.1)'
          : 'hsl(var(--destructive) / 0.1)',
      }"
    >
      <div class="flex items-center gap-2">
        <span
          class="inline-block w-2 h-2 rounded-full"
          :style="{
            background: result.flag
              ? 'hsl(var(--success))'
              : 'hsl(var(--destructive))',
          }"
        />
        <span
          class="font-medium text-sm"
          :style="{
            color: result.flag
              ? 'hsl(var(--success))'
              : 'hsl(var(--destructive))',
          }"
        >
          {{ result.flag ? '匹配通过' : '未匹配' }}
        </span>
      </div>
      <div
        v-if="result.text"
        class="mt-1 text-sm"
        style="color: hsl(var(--muted-foreground))"
      >
        {{ result.text }}
      </div>
      <div
        v-if="result.order != null"
        class="mt-1 text-sm"
        style="color: hsl(var(--muted-foreground))"
      >
        优先级: {{ result.order }}
      </div>
    </div>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">关闭</NButton>
        <NButton type="primary" :loading="loading" @click="handleTest">测试</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
