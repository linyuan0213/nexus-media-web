<script lang="ts" setup>
import type { FormInst, FormRules } from 'naive-ui';

import type {
  CustomRssSource,
  CustomRssTestResult,
} from '#/api/modules/subscription';

import { computed, reactive, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NAlert,
  NButton,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSwitch,
  useMessage,
} from 'naive-ui';

import {
  createCustomRssSourceApi,
  testCustomRssSourceApi,
  updateCustomRssSourceApi,
} from '#/api/modules/subscription';

const props = defineProps<{
  show: boolean;
  source: CustomRssSource | null;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const formRef = ref<FormInst | null>(null);
const saving = ref(false);
const testing = ref(false);
const testResult = ref<CustomRssTestResult | null>(null);
const form = reactive({
  name: '',
  url: '',
  enabled: true,
  proxy: false,
  cookie: '',
  headers: '',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入 RSS 名称', trigger: 'blur' }],
  url: [
    { required: true, message: '请输入 RSS 地址', trigger: 'blur' },
    {
      validator: (_rule, value: string) =>
        /^https?:\/\//.test(value) || new Error('请输入 HTTP/HTTPS 地址'),
      trigger: 'blur',
    },
  ],
};

const title = computed(() => (props.source ? '编辑 RSS 源' : '添加 RSS 源'));

function payload() {
  return {
    id: props.source?.id,
    name: form.name.trim(),
    url: form.url.trim(),
    enabled: form.enabled,
    proxy: form.proxy,
    cookie: form.cookie,
    headers: form.headers.trim(),
  };
}

watch(
  () => [props.show, props.source],
  () => {
    if (!props.show) return;
    form.name = props.source?.name || '';
    form.url = props.source?.url || '';
    form.enabled = props.source?.enabled ?? true;
    form.proxy = props.source?.proxy ?? false;
    form.cookie = props.source?.cookie || '';
    form.headers = props.source?.headers || '';
    testResult.value = null;
  },
  { immediate: true },
);

async function validate() {
  await formRef.value?.validate();
}

async function handleTest() {
  await validate();
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await testCustomRssSourceApi(payload());
  } catch (error: any) {
    message.error(
      error?.response?.data?.detail || error?.message || '测试失败',
    );
  } finally {
    testing.value = false;
  }
}

async function handleSave() {
  await validate();
  saving.value = true;
  try {
    if (props.source) {
      await updateCustomRssSourceApi(props.source.id, payload());
    } else {
      await createCustomRssSourceApi(payload());
    }
    message.success('RSS 源已保存，可在订阅的 RSS 站点中选择');
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
</script>

<template>
  <NModal
    :show="show"
    :title="title"
    preset="card"
    :style="{ width: '680px', maxWidth: 'calc(100vw - 32px)' }"
    @update:show="emit('update:show', $event)"
  >
    <NForm ref="formRef" :model="form" :rules="rules" label-placement="top">
      <NAlert type="info" :bordered="false" class="mb-4">
        保存后直接加入现有订阅的 RSS 站点，复用季集匹配、过滤规则和下载流程。
      </NAlert>
      <div class="form-grid">
        <NFormItem label="名称" path="name">
          <NInput v-model:value="form.name" placeholder="例如：动漫更新" />
        </NFormItem>
        <NFormItem label="启用状态">
          <div class="switch-row">
            <NSwitch v-model:value="form.enabled" />
            <span>{{ form.enabled ? '启用' : '停用' }}</span>
          </div>
        </NFormItem>
      </div>
      <NFormItem label="RSS 地址" path="url">
        <NInput
          v-model:value="form.url"
          placeholder="https://example.com/feed.xml"
        />
      </NFormItem>
      <NFormItem>
        <div class="switch-row">
          <NSwitch v-model:value="form.proxy" />
          <div>
            <div>使用系统代理</div>
            <div class="field-hint">访问受限网络中的 RSS 服务时开启</div>
          </div>
        </div>
      </NFormItem>
      <NCollapse class="advanced-settings">
        <NCollapseItem title="认证与高级设置" name="advanced">
          <NFormItem label="Cookie（可选）">
            <NInput
              v-model:value="form.cookie"
              type="password"
              show-password-on="click"
              placeholder="需要登录的 RSS 可填写 Cookie"
            />
          </NFormItem>
          <NFormItem label="自定义请求头（可选）">
            <NInput
              v-model:value="form.headers"
              type="textarea"
              :rows="3"
              placeholder='{"Authorization":"Bearer ..."}'
            />
            <template #feedback>
              请输入 JSON 对象；已保存密钥会脱敏显示。
            </template>
          </NFormItem>
        </NCollapseItem>
      </NCollapse>
    </NForm>

    <NAlert
      v-if="testResult"
      :type="testResult.missing_download_count > 0 ? 'warning' : 'success'"
      :bordered="false"
      class="mt-4"
    >
      识别为 {{ testResult.feed_type }}，获取
      {{ testResult.item_count }} 条报文，
      {{ testResult.download_count }} 条包含下载地址，耗时
      {{ testResult.elapsed_ms }} ms。
      <span v-if="testResult.missing_download_count > 0">
        缺少下载地址的报文会在订阅轮询时跳过。
      </span>
    </NAlert>

    <template #footer>
      <div class="modal-actions">
        <NButton :loading="testing" @click="handleTest">
          <template #icon><IconifyIcon icon="lucide:activity" /></template>
          测试连接
        </NButton>
        <NSpace>
          <NButton @click="emit('update:show', false)">取消</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            保存
          </NButton>
        </NSpace>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 16px;
}

.switch-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.field-hint {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.modal-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .modal-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}
</style>
