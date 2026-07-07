<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
  NTooltip,
} from 'naive-ui';

import { getDownloadersSimpleApi } from '#/api/modules/download';
import {
  getPluginConfigApi,
  savePluginConfigApi,
} from '#/api/modules/plugin_framework';
import { getSitesApi } from '#/api/modules/site';
import { useAppNotification } from '#/utils/notify';

const props = defineProps<{
  plugin: any;
  show: boolean;
}>();

const emit = defineEmits(['update:show', 'saved']);

const notification = useAppNotification();
const loading = ref(false);
const saving = ref(false);
const config = ref<Record<string, any>>({});
const fields = ref<any[]>([]);
const siteOptions = ref<{ label: string; value: string }[]>([]);
const downloaderOptions = ref<{ label: string; value: string }[]>([]);

const visible = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v),
});

async function loadConfig() {
  if (!props.plugin?.id) return;
  loading.value = true;
  try {
    const [res, sitesRes, dlRes] = await Promise.all([
      getPluginConfigApi(props.plugin.id),
      getSitesApi({ basic: true, source: 'builtin' }),
      getDownloadersSimpleApi().catch(() => []),
    ]);
    config.value = res?.config || {};
    fields.value = res?.fields || [];
    siteOptions.value = (sitesRes || [])
      .filter((s: any) => !s.public)
      .map((s: any) => ({
        label: s.name,
        value: String(s.id),
        source: s.source,
      }));
    downloaderOptions.value = ((dlRes as any) || []).map((d: any) => ({
      label: d.name,
      value: String(d.id),
    }));
    // multi_select 字段兼容旧数据（逗号分隔的字符串转数组）
    for (const field of fields.value) {
      if (field.type === 'multi_select') {
        const val = config.value[field.key];
        if (typeof val === 'string' && val) {
          config.value[field.key] = val.split(',').filter(Boolean);
        } else if (!Array.isArray(val)) {
          config.value[field.key] = [];
        }
      }
    }
  } catch (error: any) {
    notification.error('加载配置失败', { description: error?.message || '' });
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!props.plugin?.id) return;
  saving.value = true;
  try {
    await savePluginConfigApi(props.plugin.id, config.value);
    notification.success('保存成功');
    emit('saved');
    visible.value = false;
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  } finally {
    saving.value = false;
  }
}

function resolveOptions(field: any) {
  if (field.source === 'sites') {
    let opts = siteOptions.value;
    if (field.source_filter === 'builtin') {
      opts = opts.filter((s: any) => s.source === 'builtin');
    }
    return opts;
  }
  if (field.source === 'downloaders') {
    return downloaderOptions.value;
  }
  return field.options || [];
}

watch(
  () => props.show,
  (v) => {
    if (v) loadConfig();
  },
);
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="`${plugin?.name || '插件'} 配置`"
    preset="card"
    class="w-full max-w-lg"
  >
    <NSpin :show="loading">
      <NForm label-placement="left" :label-width="120">
        <template v-for="field in fields" :key="field.key">
          <NFormItem>
            <template #label>
              <NTooltip v-if="field.help" trigger="hover">
                <template #trigger>
                  <span
                    class="cursor-help border-b border-dashed border-muted-foreground/50"
                    >{{ field.label }}</span
                  >
                </template>
                <div class="max-w-xs whitespace-normal text-xs">
                  {{ field.help }}
                </div>
              </NTooltip>
              <span v-else>{{ field.label }}</span>
            </template>

            <!-- switch -->
            <NSwitch
              v-if="field.type === 'switch'"
              v-model:value="config[field.key]"
            />

            <!-- input -->
            <NInput
              v-else-if="field.type === 'input'"
              v-model:value="config[field.key]"
              :placeholder="field.placeholder"
            />

            <!-- password -->
            <NInput
              v-else-if="field.type === 'password'"
              v-model:value="config[field.key]"
              type="password"
              :placeholder="field.placeholder"
            />

            <!-- textarea -->
            <NInput
              v-else-if="field.type === 'textarea'"
              v-model:value="config[field.key]"
              type="textarea"
              :rows="4"
              :placeholder="field.placeholder"
            />

            <!-- number -->
            <NInputNumber
              v-else-if="field.type === 'number'"
              v-model:value="config[field.key]"
            />

            <!-- select -->
            <NSelect
              v-else-if="
                field.type === 'select' || field.type === 'multi_select'
              "
              v-model:value="config[field.key]"
              :options="resolveOptions(field)"
              :multiple="field.type === 'multi_select'"
            />

            <!-- cron -->
            <NInput
              v-else-if="field.type === 'cron'"
              v-model:value="config[field.key]"
              placeholder="0 8 * * *"
            >
              <template #suffix>
                <span class="text-xs text-muted-foreground">Cron</span>
              </template>
            </NInput>
          </NFormItem>
        </template>
      </NForm>
    </NSpin>

    <template #footer>
      <div class="flex justify-end gap-2">
        <NButton @click="visible = false">取消</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">
          保存
        </NButton>
      </div>
    </template>
  </NModal>
</template>
