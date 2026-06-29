<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NSelect,
  NSwitch,
} from 'naive-ui';

interface Props {
  config: Record<string, any>;
  loadingModels?: boolean;
  modelOptions?: string[];
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loadingModels: false,
  modelOptions: () => [],
  saving: false,
});

const emit = defineEmits<{
  fetchModels: [];
  save: [];
  updateConfig: [key: string, value: any];
}>();

const providers = [
  { value: 'deepseek', label: 'DeepSeek', icon: 'lucide:sparkles' },
  { value: 'openai', label: 'OpenAI', icon: 'lucide:brain' },
  { value: 'moonshot', label: 'Moonshot / Kimi', icon: 'lucide:moon' },
  { value: 'qwen', label: '通义千问', icon: 'lucide:message-square' },
  { value: 'wenxin', label: '文心一言', icon: 'lucide:bot' },
  { value: 'glm', label: '智谱 GLM', icon: 'lucide:cpu' },
  { value: 'anthropic', label: 'Claude', icon: 'lucide:triangle' },
  { value: 'gemini', label: 'Gemini', icon: 'lucide:hexagon' },
  { value: 'azure', label: 'Azure OpenAI', icon: 'lucide:cloud' },
  { value: 'ollama', label: 'Ollama', icon: 'lucide:box' },
  { value: 'custom', label: '自定义', icon: 'lucide:settings' },
];

const providerUrlPresets: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  wenxin: 'https://qianfan.baidubce.com/v2',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  anthropic: 'https://api.anthropic.com/v1',
  ollama: 'http://localhost:11434/v1',
};

const currentProvider = computed({
  get: () => props.config['agent.default_provider'] || 'openai',
  set: (v: string) => {
    emit('updateConfig', 'agent.default_provider', v);
    const preset = providerUrlPresets[v];
    if (preset && !getProviderConfig('api_url')) {
      emit('updateConfig', `agent.providers.${v}.api_url`, preset);
    }
  },
});

function providerConfigKey(field: string): string {
  return `agent.providers.${currentProvider.value}.${field}`;
}

function getProviderConfig(field: string): string {
  return props.config[providerConfigKey(field)] || '';
}

function setProviderConfig(field: string, value: string) {
  emit('updateConfig', providerConfigKey(field), value);
}

function placeholder(field: string) {
  if (field === 'api_url') {
    return (
      providerUrlPresets[currentProvider.value] || 'https://api.example.com/v1'
    );
  }
  if (field === 'model') {
    return currentProvider.value === 'ollama' ? 'llama3.2' : 'deepseek-chat';
  }
  return '';
}
</script>

<template>
  <NCard
    id="basic_ai"
    size="small"
    class="mb-6 overflow-hidden"
    style="
      background: hsl(var(--card));
      border-color: hsl(var(--border));
      border-left-color: hsl(var(--primary));
      border-left-width: 4px;
    "
  >
    <template #header>
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:cpu"
          class="size-4"
          style="color: hsl(var(--primary))"
        />
        <span class="font-semibold" style="color: hsl(var(--card-foreground))"
          >Agent 设置</span
        >
      </div>
    </template>

    <NForm label-placement="top">
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="启用 Agent">
            <NSwitch
              :value="config['agent.enabled']"
              @update:value="(v) => emit('updateConfig', 'agent.enabled', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="媒体识别增强">
            <NSwitch
              :value="config['agent.media_recognizer_enabled']"
              @update:value="
                (v) => emit('updateConfig', 'agent.media_recognizer_enabled', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="批量识别大小">
            <NInput
              :value="config['agent.batch_size']"
              placeholder="100"
              @update:value="(v) => emit('updateConfig', 'agent.batch_size', v)"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>

      <!-- Provider 选择卡片 -->
      <NFormItem label="默认 Provider">
        <div
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          <div
            v-for="p in providers"
            :key="p.value"
            class="flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-all"
            :class="
              currentProvider === p.value
                ? 'border-primary bg-accent ring-1 ring-primary'
                : 'hover:border-primary/50 hover:bg-accent/50'
            "
            :style="{
              borderColor:
                currentProvider === p.value
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--border))',
            }"
            @click="currentProvider = p.value"
          >
            <IconifyIcon
              :icon="p.icon"
              class="size-4"
              :style="{
                color:
                  currentProvider === p.value
                    ? 'hsl(var(--primary))'
                    : 'hsl(var(--muted-foreground))',
              }"
            />
            <span
              class="text-sm font-medium"
              :style="{
                color:
                  currentProvider === p.value
                    ? 'hsl(var(--foreground))'
                    : 'hsl(var(--muted-foreground))',
              }"
              >{{ p.label }}</span
            >
          </div>
        </div>
      </NFormItem>

      <NGrid cols="1 s:1 m:2 l:3" :x-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="API URL">
            <NInput
              :value="getProviderConfig('api_url')"
              :placeholder="placeholder('api_url')"
              @update:value="(v) => setProviderConfig('api_url', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="API Key">
            <NInput
              :value="getProviderConfig('api_key')"
              placeholder="sk-xxx"
              type="password"
              show-password-on="click"
              @update:value="(v) => setProviderConfig('api_key', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="Model">
            <div class="flex gap-2">
              <NSelect
                :value="getProviderConfig('model')"
                :options="modelOptions.map((m) => ({ label: m, value: m }))"
                :placeholder="placeholder('model')"
                filterable
                clearable
                class="flex-1"
                @update:value="(v) => setProviderConfig('model', v)"
              />
              <NButton
                size="small"
                :loading="loadingModels"
                title="刷新模型列表"
                @click="emit('fetchModels')"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
                </template>
              </NButton>
            </div>
          </NFormItem>
        </NGridItem>
      </NGrid>
    </NForm>

    <template #footer>
      <div class="flex justify-end">
        <NButton
          type="primary"
          size="small"
          :loading="saving"
          @click="emit('save')"
        >
          保存
        </NButton>
      </div>
    </template>
  </NCard>
</template>
