<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
} from 'naive-ui';

import { listAgentEmbeddingModelsApi } from '#/api/modules/system';

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

function getFallbackProviders(): string[] {
  const raw = props.config['agent.fallback'];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string' && raw) return raw.split(',');
  return [];
}

function setFallbackProviders(values: null | string[]) {
  emit('updateConfig', 'agent.fallback', values ?? []);
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

// ---------------------------------------------------------------------------
// Embedding（知识库向量化）配置
// ---------------------------------------------------------------------------

const embeddingProviderOptions = [
  { value: '', label: '跟随对话 Provider' },
  { value: 'ollama', label: 'Ollama（本地，免费）' },
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'gemini', label: 'Gemini' },
];

const embeddingProvider = computed({
  get: () => props.config['agent.embedding.provider'] || '',
  set: (v: string) => emit('updateConfig', 'agent.embedding.provider', v || ''),
});

const embeddingModelOptions = ref<string[]>([]);
const loadingEmbeddingModels = ref(false);

async function fetchEmbeddingModels() {
  const provider =
    embeddingProvider.value || props.config['agent.default_provider'] || '';
  if (!provider) return;
  loadingEmbeddingModels.value = true;
  try {
    const res: any = await listAgentEmbeddingModelsApi({
      provider_name: provider,
      api_url:
        getEmbeddingConfig('api_url') || providerUrlPresets[provider] || '',
      api_key: getEmbeddingConfig('api_key') || '',
    });
    // requestClient 已解包：res 可能为数组或 {data}
    const models = Array.isArray(res) ? res : res?.data || [];
    embeddingModelOptions.value = models;
  } catch {
    embeddingModelOptions.value = [];
  } finally {
    loadingEmbeddingModels.value = false;
  }
}

watch(embeddingProvider, () => {
  fetchEmbeddingModels();
});

function getEmbeddingConfig(field: string): string {
  return props.config[`agent.embedding.${field}`] || '';
}

function setEmbeddingConfig(field: string, value: string) {
  emit('updateConfig', `agent.embedding.${field}`, value);
}

// ---------------------------------------------------------------------------
// 通知增强（Agent 重写模板通知，单流替换）
// ---------------------------------------------------------------------------

const notifyMsgTypeOptions = [
  { value: 'download_start', label: '下载开始' },
  { value: 'download_fail', label: '下载失败' },
  { value: 'rss_added', label: '订阅新增' },
  { value: 'rss_finished', label: '订阅完成' },
  { value: 'transfer_finished', label: '转移完成' },
  { value: 'transfer_fail', label: '转移失败' },
  { value: 'site_signin', label: '站点签到' },
  { value: 'site_message', label: '站点通知' },
  { value: 'auto_remove_torrents', label: '自动删种' },
  { value: 'brushtask_added', label: '刷流任务新增' },
  { value: 'brushtask_remove', label: '刷流任务删除' },
  { value: 'brushtask_pause', label: '刷流任务暂停' },
  { value: 'mediaserver_message', label: '媒体服务器' },
  { value: 'ptrefresh_date_message', label: '站点数据刷新' },
];

function getNotifyConfig(field: string): string {
  return props.config[`agent.notify.${field}`] || '';
}

function setNotifyConfig(field: string, value: string) {
  emit('updateConfig', `agent.notify.${field}`, value);
}

// ---------------------------------------------------------------------------
// 长程语义记忆（用户偏好，向量库存储）
// ---------------------------------------------------------------------------

function getLongTermConfig(field: string): string {
  return props.config[`agent.memory.long_term.${field}`] ?? '';
}

function setLongTermConfig(field: string, value: string) {
  emit('updateConfig', `agent.memory.long_term.${field}`, value);
}
onMounted(() => {
  fetchEmbeddingModels();
});
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
      <div>
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
        <div class="mt-1 text-xs" style="color: hsl(var(--muted-foreground))">
          AI Provider 选择、API 配置与模型设置
        </div>
      </div>
    </template>

    <NForm label-placement="top">
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
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
          class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
        >
          <div
            v-for="p in providers"
            :key="p.value"
            class="flex cursor-pointer items-center gap-2 rounded-lg border p-2 transition-all"
            :style="{
              background:
                currentProvider === p.value
                  ? 'hsl(var(--primary))'
                  : 'transparent',
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
                    ? 'hsl(var(--primary-foreground))'
                    : 'hsl(var(--muted-foreground))',
              }"
            />
            <span
              class="text-xs font-medium"
              :style="{
                color:
                  currentProvider === p.value
                    ? 'hsl(var(--primary-foreground))'
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

      <!-- 故障转移链 -->
      <NFormItem
        label="故障转移链（主 Provider 失败时依次切换，可多选）"
        label-placement="top"
        class="mt-2"
      >
        <NSelect
          :value="getFallbackProviders()"
          :options="providers"
          multiple
          filterable
          clearable
          placeholder="选择备用 Provider（留空则不启用故障转移）"
          @update:value="setFallbackProviders"
        />
      </NFormItem>

      <!-- Embedding（知识库向量化）配置 -->
      <div
        class="mb-3 mt-2 flex items-center gap-2 text-xs font-medium"
        style="color: hsl(var(--muted-foreground))"
      >
        <IconifyIcon icon="lucide:database" class="size-3.5" />
        <span>Embedding（知识库向量化，不配则知识库仅用关键词检索）</span>
      </div>
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="Embedding Provider">
            <NSelect
              :value="embeddingProvider"
              :options="embeddingProviderOptions"
              @update:value="(v) => (embeddingProvider = v || '')"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="Embedding Model">
            <div class="flex gap-2">
              <NSelect
                :value="getEmbeddingConfig('model')"
                :options="
                  embeddingModelOptions.map((m) => ({ label: m, value: m }))
                "
                filterable
                tag
                clearable
                placeholder="选择或输入 embedding 模型"
                class="flex-1"
                @update:value="(v) => setEmbeddingConfig('model', v)"
              />
              <NButton
                size="small"
                :loading="loadingEmbeddingModels"
                title="刷新模型列表"
                @click="fetchEmbeddingModels"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
                </template>
              </NButton>
            </div>
          </NFormItem>
        </NGridItem>
        <NGridItem v-if="embeddingProvider" span="1">
          <NFormItem label="Embedding API URL（可选，留空继承 Provider 配置）">
            <NInput
              :value="getEmbeddingConfig('api_url')"
              placeholder="http://localhost:11434"
              @update:value="(v) => setEmbeddingConfig('api_url', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem v-if="embeddingProvider" span="1">
          <NFormItem label="Embedding API Key（可选）">
            <NInput
              :value="getEmbeddingConfig('api_key')"
              placeholder="留空继承 Provider 配置"
              type="password"
              show-password-on="click"
              @update:value="(v) => setEmbeddingConfig('api_key', v)"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>

      <!-- 长程语义记忆 -->
      <div
        class="mb-3 mt-2 flex items-center gap-2 text-xs font-medium"
        style="color: hsl(var(--muted-foreground))"
      >
        <IconifyIcon icon="lucide:brain" class="size-3.5" />
        <span>长程语义记忆（记住用户偏好，对话自动注入）</span>
      </div>
      <NGrid cols="1 s:2 l:3" :x-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="启用长程记忆">
            <NSwitch
              :value="config['agent.memory.long_term.enabled']"
              @update:value="
                (v) => emit('updateConfig', 'agent.memory.long_term.enabled', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="注入条数 top_k">
            <NInputNumber
              :value="Number(getLongTermConfig('top_k') || 5)"
              :min="1"
              :max="10"
              @update:value="
                (v) => setLongTermConfig('top_k', String(v == null ? 5 : v))
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="抽取时机">
            <NSelect
              :value="getLongTermConfig('extraction') || 'on_session_end'"
              :options="[
                { value: 'on_session_end', label: '会话结束' },
                { value: 'on_turn_end', label: '每轮结束' },
                { value: 'off', label: '关闭抽取' },
              ]"
              @update:value="(v) => setLongTermConfig('extraction', v)"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>

      <!-- 通知增强（Agent 重写模板通知） -->
      <div
        class="mb-3 mt-2 flex items-center gap-2 text-xs font-medium"
        style="color: hsl(var(--muted-foreground))"
      >
        <IconifyIcon icon="lucide:bell-ring" class="size-3.5" />
        <span>通知增强（Agent 用 LLM 重写模板通知，单流替换不重复）</span>
      </div>
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="启用通知增强">
            <NSwitch
              :value="config['agent.notify.enabled']"
              @update:value="
                (v) => emit('updateConfig', 'agent.notify.enabled', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="2">
          <NFormItem label="增强的通知类型（其余保持模板）">
            <NSelect
              :value="getNotifyConfig('msg_types')"
              :options="notifyMsgTypeOptions"
              multiple
              filterable
              clearable
              @update:value="(v) => setNotifyConfig('msg_types', v ?? '')"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="生成温度">
            <NInputNumber
              :value="Number(getNotifyConfig('temperature') || 0.3)"
              :min="0"
              :max="1"
              :step="0.1"
              @update:value="
                (v) =>
                  setNotifyConfig('temperature', v == null ? '' : String(v))
              "
            />
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
