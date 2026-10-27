<script lang="ts" setup>
import type { MediaServerInstance, MediaServerSchema } from './types';

import { computed, reactive, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import {
  NButton,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSwitch,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  saveMediaServerConfigApi,
  testMediaServerApi,
} from '#/api/modules/system';

const props = defineProps<{
  show: boolean;
  instance: MediaServerInstance | null;
  schemas: Record<string, MediaServerSchema>;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const { smaller } = useBreakpoints(breakpointsTailwind);
const isMobile = smaller('md');
const saving = ref(false);
const testing = ref(false);
const form = reactive({
  name: '',
  type: 'emby',
  enabled: 1,
  is_default: 0,
  config: {} as Record<string, any>,
});

const visibleSchemas = computed(() => {
  if (!props.instance?.id) return props.schemas;
  const current = props.schemas[form.type];
  return current ? { [form.type]: current } : {};
});
const fields = computed(() =>
  Object.entries(props.schemas[form.type]?.config || {}).filter(
    ([key]) => !['enabled', 'is_default'].includes(key),
  ),
);

function icon(type: string) {
  return `/static/img/mediaserver/${type}.png`;
}

function initConfig(type: string) {
  const config: Record<string, any> = {};
  Object.entries(props.schemas[type]?.config || {}).forEach(([key, field]) => {
    config[key] = field.default ?? '';
  });
  return config;
}

watch(
  () => [props.show, props.instance],
  () => {
    if (!props.show) return;
    form.name = props.instance?.name || '';
    form.type = props.instance?.type || 'emby';
    form.enabled = props.instance?.enabled ?? 1;
    form.is_default = props.instance?.is_default ?? 0;
    form.config = props.instance
      ? { ...props.instance.config }
      : initConfig(form.type);
  },
  { immediate: true },
);

function selectType(type: string) {
  if (props.instance?.id) return;
  form.type = type;
  form.config = initConfig(type);
}

function payload() {
  return {
    ...form.config,
    id: props.instance?.id,
    name: form.name.trim(),
    type: form.type,
    enabled: form.enabled,
    is_default: form.is_default,
  };
}

function isSecret(key: string) {
  return /api_?key|token|secret|password/i.test(key);
}

async function save() {
  if (!form.name.trim()) {
    message.warning('请输入实例名称');
    return;
  }
  saving.value = true;
  try {
    await saveMediaServerConfigApi(payload());
    message.success('媒体服务器实例已保存');
    emit('saved');
    emit('update:show', false);
  } catch (error: any) {
    message.error(
      error?.response?.data?.detail || error?.message || '保存失败',
    );
  } finally {
    saving.value = false;
  }
}

async function test() {
  testing.value = true;
  try {
    await testMediaServerApi(payload());
    message.success('连接测试成功');
  } catch (error: any) {
    message.error(
      error?.response?.data?.detail || error?.message || '连接测试失败',
    );
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    :title="instance ? '编辑媒体服务器' : '新增媒体服务器'"
    preset="card"
    :style="{ width: '640px', maxWidth: '92vw' }"
    @update:show="emit('update:show', $event)"
  >
    <NForm :label-placement="isMobile ? 'top' : 'left'" :label-width="100">
      <NGrid :cols="isMobile ? 1 : 2" :x-gap="16">
        <NGridItem>
          <NFormItem label="名称" required>
            <NInput
              v-model:value="form.name"
              placeholder="别名，例如：普通 Emby"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem>
          <NFormItem label="状态" required>
            <NSelect
              v-model:value="form.enabled"
              :options="[
                { label: '启用', value: 1 },
                { label: '停用', value: 0 },
              ]"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>

      <NFormItem label="类型" required>
        <div class="type-grid">
          <div
            v-for="(schema, key) in visibleSchemas"
            :key="key"
            class="type-card"
            :class="{
              selected: form.type === key,
              readonly: Boolean(instance?.id),
            }"
            @click="selectType(key)"
          >
            <img :src="icon(key)" class="type-icon" :alt="schema.name" />
            <span>{{ schema.name }}</span>
          </div>
        </div>
      </NFormItem>

      <div class="config-panel">
        <div
          v-for="[key, field] in fields"
          :key="`${form.type}:${key}`"
          class="config-field"
        >
          <NFormItem>
            <template #label>
              <span class="field-label">{{ field.title || key }}</span>
              <NTooltip v-if="field.tooltip">
                <template #trigger>
                  <IconifyIcon icon="lucide:circle-help" class="field-help" />
                </template>
                <div class="help-content">{{ field.tooltip }}</div>
              </NTooltip>
            </template>
            <NSelect
              v-if="field.type === 'select'"
              v-model:value="form.config[key]"
              :options="
                Object.entries(field.options || {}).map(([value, label]) => ({
                  value,
                  label: label as string,
                }))
              "
            />
            <NSwitch
              v-else-if="field.type === 'switch'"
              v-model:value="form.config[key]"
              :checked-value="1"
              :unchecked-value="0"
            />
            <NInput
              v-else
              v-model:value="form.config[key]"
              :type="isSecret(key) ? 'password' : 'text'"
              :show-password-on="isSecret(key) ? 'click' : undefined"
              :placeholder="field.placeholder || field.default"
            />
          </NFormItem>
        </div>
      </div>
    </NForm>

    <template #footer>
      <div class="modal-actions">
        <NButton :loading="testing" @click="test">测试连接</NButton>
        <NSpace>
          <NButton @click="emit('update:show', false)">取消</NButton>
          <NButton type="primary" :loading="saving" @click="save">保存</NButton>
        </NSpace>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.type-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 12px;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition: border-color 0.2s ease;
}

.type-card:hover {
  border-color: hsl(var(--primary) / 50%);
}

.type-card.selected {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 15%);
}

.type-card.readonly {
  cursor: default;
}

.type-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 8px;
}

.config-panel {
  padding: 12px 16px;
  background: hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
}

.config-field:not(:last-child) {
  margin-bottom: 4px;
}

.field-label {
  margin-right: 4px;
}

.field-help {
  display: inline-block;
  width: 14px;
  height: 14px;
  color: hsl(var(--muted-foreground));
  cursor: help;
}

.help-content {
  max-width: 280px;
  font-size: 12px;
  white-space: normal;
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@media (min-width: 768px) {
  .type-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
