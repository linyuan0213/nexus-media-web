<script lang="ts" setup>
import { onMounted, ref } from 'vue';

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
  NSpace,
  NSpin,
  NSwitch,
  useMessage,
} from 'naive-ui';

import {
  getAllSystemConfigApi,
  getSiteConfigVersionApi,
  listAgentModelsApi,
  reloadConfigApi,
  updateConfigApi,
  updateSiteConfigApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

const message = useMessage();
const loading = ref(false);
const saving = ref<null | string>(null);
const loadingModels = ref(false);
const modelOptions = ref<string[]>([]);

// 配置数据
const config = ref<Record<string, any>>({});
const tmdbDomains = ref<string[]>(['api.themoviedb.org', 'api.tmdb.org']);

// Provider 预设 API URL
const providerUrlPresets: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  wenxin: 'https://qianfan.baidubce.com/v2',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: '', // Gemini 使用 SDK，不需要填 URL
  azure: '', // Azure URL 需要自定义
  ollama: 'http://localhost:11434/v1',
  custom: '',
};

async function fetchData() {
  loading.value = true;
  try {
    const res = await getAllSystemConfigApi();
    config.value = res || {};
  } finally {
    loading.value = false;
  }
}

async function saveSection(sectionKey: string, data: Record<string, any>) {
  saving.value = sectionKey;
  try {
    await updateConfigApi(data);
    message.success('保存成功');
  } catch {
    message.error('保存失败');
  } finally {
    saving.value = null;
  }
}

async function fetchModels() {
  const provider = currentProviderName();
  const apiUrl = getProviderConfig('api_url');
  const apiKey = getProviderConfig('api_key');
  if (!apiUrl || !apiKey) {
    message.warning('请先填写 API URL 和 API Key');
    return;
  }
  loadingModels.value = true;
  try {
    const res = await listAgentModelsApi({
      provider_name: provider,
      api_url: apiUrl,
      api_key: apiKey,
    });
    // requestClient 可能自动解包 data，需要兼容两种格式
    const models = Array.isArray(res) ? res : res?.data || [];
    if (models.length > 0) {
      modelOptions.value = models;
      if (!getProviderConfig('model')) {
        setProviderConfig('model', models[0]);
      }
      message.success(`获取到 ${models.length} 个模型`);
    } else {
      modelOptions.value = [];
      message.error('获取模型列表为空');
    }
  } catch {
    modelOptions.value = [];
    message.error('获取模型列表失败');
  } finally {
    loadingModels.value = false;
  }
}

function saveSystem() {
  const data: Record<string, any> = {};
  const fields = [
    'app.web_port',
    'app.ssl_cert',
    'app.ssl_key',
    'app.proxies',
    'app.domain',
    'app.user_agent',
    'app.enable_image_proxy',
  ];
  fields.forEach((f) => {
    const v = config.value[f];
    if (v !== undefined && v !== '') data[f] = v;
  });
  saveSection('system', data);
}

function saveLog() {
  const data: Record<string, any> = {};
  ['log.type', 'log.path', 'log.level', 'log.format'].forEach((f) => {
    const v = config.value[f];
    if (v !== undefined && v !== '') data[f] = v;
  });
  saveSection('log', data);
}

function saveMedia() {
  const data: Record<string, any> = {};
  const fields = [
    'app.rmt_tmdbkey',
    'app.tmdb_domain',
    'app.rmt_match_mode',
    'media.tmdb_language',
    'app.tmdb_image_url',
    'pt.download_order',
    'media.default_rmt_mode',
    'media.min_filesize',
    'media.media_default_path',
    'media.ignored_paths',
    'media.ignored_files',
    'media.movie_name_format',
    'media.tv_name_format',
    'media.filesize_cover',
    'media.nfo_poster',
    'media.sync_transfer_interval',
    'media.episode_mapping_enabled',
  ];
  fields.forEach((f) => {
    const v = config.value[f];
    if (v !== undefined && v !== '') data[f] = v;
  });
  saveSection('media', data);
}

function currentProviderName(): string {
  return config.value['agent.default_provider'] || 'openai';
}

function providerConfigKey(field: string): string {
  return `agent.providers.${currentProviderName()}.${field}`;
}

function getProviderConfig(field: string): string {
  return config.value[providerConfigKey(field)] || '';
}

function setProviderConfig(field: string, value: string) {
  config.value[providerConfigKey(field)] = value;
}

function saveAi() {
  const data: Record<string, any> = {};
  const fields = [
    'agent.enabled',
    'agent.default_provider',
    'agent.media_recognizer_enabled',
    'agent.batch_size',
  ];
  fields.forEach((f) => {
    const v = config.value[f];
    if (v !== undefined && v !== '') data[f] = v;
  });
  // 动态保存当前 provider 配置
  const provider = currentProviderName();
  ['api_url', 'api_key', 'model'].forEach((field) => {
    const v = config.value[`agent.providers.${provider}.${field}`];
    if (v !== undefined && v !== '')
      data[`agent.providers.${provider}.${field}`] = v;
  });
  saveSection('ai', data);
}

function saveService() {
  const data: Record<string, any> = {};
  const fields = [
    'pt.pt_check_interval',
    'pt.search_rss_interval',
    'media.mediasync_interval',
    'pt.ptrefresh_date_cron',
    'pt.search_auto',
    'pt.search_no_result_rss',
  ];
  fields.forEach((f) => {
    const v = config.value[f];
    if (v !== undefined && v !== '') data[f] = v;
  });
  saveSection('service', data);
}

function saveLaboratory() {
  const data: Record<string, any> = {};
  const fields = [
    'laboratory.search_keyword',
    'laboratory.search_tmdbweb',
    'laboratory.tmdb_cache_expire',
    'laboratory.use_douban_titles',
    'laboratory.search_multi_language',
    'laboratory.show_more_sites',
    'laboratory.ocr_server_host',
    'laboratory.chrome_server_host',
  ];
  fields.forEach((f) => {
    const v = config.value[f];
    if (v !== undefined && v !== '') data[f] = v;
  });
  saveSection('laboratory', data);
}

// 站点配置更新
const siteConfigVersion = ref({ local: '', remote: '', needs_update: false });
const updatingSiteConfig = ref(false);
const reloadingConfig = ref(false);

async function fetchSiteConfigVersion() {
  try {
    const res = await getSiteConfigVersionApi();
    siteConfigVersion.value = res || {
      local: '',
      remote: '',
      needs_update: false,
    };
  } catch {
    /* ignore */
  }
}

async function handleUpdateSiteConfig() {
  updatingSiteConfig.value = true;
  try {
    const res = await updateSiteConfigApi();
    message.success(res?.message || '更新完成');
    await fetchSiteConfigVersion();
  } catch (error: any) {
    message.error(error?.message || '更新失败');
  } finally {
    updatingSiteConfig.value = false;
  }
}

async function handleReloadConfig() {
  reloadingConfig.value = true;
  try {
    const data: any = await reloadConfigApi();
    if (data && Object.values(data.steps || {}).every(Boolean)) {
      message.success(`配置重载成功 (v${data.version})`);
    } else {
      const failed = Object.entries(data?.steps || {})
        .filter(([, ok]) => !ok)
        .map(([name]) => name);
      message.warning(`配置重载部分失败: ${failed.join(', ')}`);
    }
  } catch (error: any) {
    message.error(error?.message || '配置重载失败');
  } finally {
    reloadingConfig.value = false;
  }
}

onMounted(() => {
  fetchData();
  fetchSiteConfigVersion();
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="基础设置" />

    <NCard size="small" class="mb-4">
      <template #header>
        <div class="flex items-center gap-2">
          <IconifyIcon icon="lucide:globe" class="w-4 h-4" />
          <span class="font-semibold">站点配置</span>
        </div>
      </template>
      <div class="flex items-center justify-between">
        <div class="text-sm" style="color: hsl(var(--muted-foreground))">
          <span v-if="siteConfigVersion.local"
            >当前版本: {{ siteConfigVersion.local }}</span
          >
          <span
            v-if="
              siteConfigVersion.remote && siteConfigVersion.remote !== 'unknown'
            "
            >，远程版本: {{ siteConfigVersion.remote }}</span
          >
          <span
            v-if="siteConfigVersion.needs_update"
            class="ml-1"
            style="color: hsl(var(--warning))"
            >（有新版本）</span
          >
        </div>
        <NSpace>
          <NButton
            size="small"
            :loading="reloadingConfig"
            @click="handleReloadConfig"
          >
            <template #icon>
              <IconifyIcon icon="lucide:activity" class="w-4 h-4" />
            </template>
            重载配置
          </NButton>
          <NButton
            size="small"
            :loading="updatingSiteConfig"
            :type="siteConfigVersion.needs_update ? 'primary' : 'default'"
            @click="handleUpdateSiteConfig"
          >
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="w-4 h-4" />
            </template>
            {{ siteConfigVersion.needs_update ? '更新站点配置' : '检查更新' }}
          </NButton>
        </NSpace>
      </div>
    </NCard>

    <NSpin :show="loading">
      <NGrid :cols="1" :x-gap="16" :y-gap="16" responsive="screen">
        <!-- 系统 -->
        <NGridItem>
          <NCard id="basic_system" size="small">
            <template #header>
              <div class="flex items-center gap-2">
                <IconifyIcon icon="lucide:monitor" class="w-4 h-4" />
                <span class="font-semibold">系统</span>
              </div>
            </template>
            <NForm label-placement="left" :label-width="160">
              <NGrid cols="1 s:1 m:2 l:2" :x-gap="16" responsive="screen">
                <NGridItem span="1">
                  <NFormItem label="WEB服务端口">
                    <NInput
                      v-model:value="config['app.web_port']"
                      placeholder="3000"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="HTTPS证书文件路径">
                    <NInput
                      v-model:value="config['app.ssl_cert']"
                      placeholder="pem格式证书路径"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="HTTPS证书密钥文件路径">
                    <NInput
                      v-model:value="config['app.ssl_key']"
                      placeholder="密钥文件路径"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="代理服务器">
                    <NInput
                      v-model:value="config['app.proxies']"
                      placeholder="127.0.0.1:7890"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="外网访问地址">
                    <NInput
                      v-model:value="config['app.domain']"
                      placeholder="http://IP:PORT"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1 s:1 m:2 l:2">
                  <NFormItem label="User-Agent">
                    <NInput
                      v-model:value="config['app.user_agent']"
                      placeholder="Mozilla/5.0 ..."
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="启用图片代理">
                    <NSwitch
                      v-model:value="config['app.enable_image_proxy']"
                      :checked-value="1"
                      :unchecked-value="0"
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
                  :loading="saving === 'system'"
                  @click="saveSystem"
                >
                  保存
                </NButton>
              </div>
            </template>
          </NCard>
        </NGridItem>

        <!-- 日志 -->
        <NGridItem>
          <NCard id="basic_log" size="small">
            <template #header>
              <div class="flex items-center gap-2">
                <IconifyIcon icon="lucide:log-in" class="w-4 h-4" />
                <span class="font-semibold">日志</span>
              </div>
            </template>
            <NForm label-placement="left" :label-width="160">
              <NGrid cols="1 s:1 m:2 l:2" :x-gap="16" responsive="screen">
                <NGridItem span="1">
                  <NFormItem label="日志输出类型">
                    <NSelect
                      v-model:value="config['log.type']"
                      :options="[
                        { label: '控制台', value: 'console' },
                        { label: '文件', value: 'file' },
                      ]"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="日志文件路径">
                    <NInput
                      v-model:value="config['log.path']"
                      placeholder="data/logs"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="日志格式">
                    <NSelect
                      v-model:value="config['log.format']"
                      :options="[
                        { label: '可读文本', value: 'text' },
                        { label: 'JSON', value: 'json' },
                      ]"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="日志级别">
                    <NSelect
                      v-model:value="config['log.level']"
                      :options="[
                        { label: 'INFO', value: 'info' },
                        { label: 'DEBUG', value: 'debug' },
                        { label: 'ERROR', value: 'error' },
                      ]"
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
                  :loading="saving === 'log'"
                  @click="saveLog"
                >
                  保存
                </NButton>
              </div>
            </template>
          </NCard>
        </NGridItem>

        <!-- 媒体 -->
        <NGridItem>
          <NCard id="basic_media" size="small">
            <template #header>
              <div class="flex items-center gap-2">
                <IconifyIcon icon="lucide:database" class="w-4 h-4" />
                <span class="font-semibold">媒体</span>
              </div>
            </template>
            <NForm label-placement="left" :label-width="160">
              <NGrid cols="1 s:1 m:2 l:2" :x-gap="16" responsive="screen">
                <NGridItem span="1">
                  <NFormItem label="TMDB API Key">
                    <NInput
                      v-model:value="config['app.rmt_tmdbkey']"
                      placeholder="必填"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="TMDB API Url">
                    <NSelect
                      v-model:value="config['app.tmdb_domain']"
                      :options="
                        tmdbDomains.map((d) => ({ label: d, value: d }))
                      "
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="TMDB匹配模式">
                    <NSelect
                      v-model:value="config['app.rmt_match_mode']"
                      :options="[
                        { label: '正常模式', value: 'normal' },
                        { label: '严格模式', value: 'strict' },
                      ]"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="TMDB语言">
                    <NSelect
                      v-model:value="config['media.tmdb_language']"
                      :options="[
                        { label: '中文', value: 'zh' },
                        { label: 'English', value: 'en' },
                      ]"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="TMDB图片代理">
                    <NInput
                      v-model:value="config['app.tmdb_image_url']"
                      placeholder="https://image.tmdb.org"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="下载优先规则">
                    <NSelect
                      v-model:value="config['pt.download_order']"
                      :options="[
                        { label: '默认', value: '' },
                        { label: '站点优先', value: 'site' },
                        { label: '做种数优先', value: 'seeder' },
                      ]"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="默认文件转移方式">
                    <NSelect
                      v-model:value="config['media.default_rmt_mode']"
                      :options="[
                        { label: '硬链接', value: 'link' },
                        { label: '移动', value: 'move' },
                        { label: '复制', value: 'copy' },
                      ]"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="转移最小文件大小(MB)">
                    <NInput
                      v-model:value="config['media.min_filesize']"
                      placeholder="200"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="文件管理默认路径">
                    <NInput
                      v-model:value="config['media.media_default_path']"
                      placeholder="/"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="文件路径转移忽略词">
                    <NInput
                      v-model:value="config['media.ignored_paths']"
                      placeholder="支持正则，使用;分隔"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="文件名转移忽略词">
                    <NInput
                      v-model:value="config['media.ignored_files']"
                      placeholder="支持正则，使用;分隔"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1 s:1 m:2 l:2">
                  <NFormItem label="电影重命名格式">
                    <NInput
                      v-model:value="config['media.movie_name_format']"
                      placeholder="{title} ({year})/{title}-{part} ({year}) - {videoFormat}"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1 s:1 m:2 l:2">
                  <NFormItem label="电视剧重命名格式">
                    <NInput
                      v-model:value="config['media.tv_name_format']"
                      placeholder="{title} ({year})/Season {season}/{title}-{part} - {season_episode} - 第 {episode} 集"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="高质量文件覆盖">
                    <NSwitch
                      v-model:value="config['media.filesize_cover']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="刮削元数据及图片">
                    <NSwitch
                      v-model:value="config['media.nfo_poster']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="启用集数映射">
                    <NSwitch
                      v-model:value="config['media.episode_mapping_enabled']"
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
                  :loading="saving === 'media'"
                  @click="saveMedia"
                >
                  保存
                </NButton>
              </div>
            </template>
          </NCard>
        </NGridItem>

        <!-- Agent 设置 -->
        <NGridItem>
          <NCard id="basic_ai" size="small">
            <template #header>
              <div class="flex items-center gap-2">
                <IconifyIcon icon="lucide:cpu" class="w-4 h-4" />
                <span class="font-semibold">Agent 设置</span>
              </div>
            </template>
            <NForm label-placement="left" :label-width="180">
              <NGrid cols="1 s:1 m:2 l:3" :x-gap="16" responsive="screen">
                <NGridItem span="1">
                  <NFormItem label="启用 Agent">
                    <NSwitch v-model:value="config['agent.enabled']" />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="媒体识别增强">
                    <NSwitch
                      v-model:value="config['agent.media_recognizer_enabled']"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="默认 Provider">
                    <NSelect
                      v-model:value="config['agent.default_provider']"
                      :options="[
                        { label: 'DeepSeek', value: 'deepseek' },
                        { label: 'OpenAI', value: 'openai' },
                        { label: 'Moonshot / Kimi', value: 'moonshot' },
                        { label: '通义千问 (Alibaba)', value: 'qwen' },
                        { label: '文心一言 (Baidu)', value: 'wenxin' },
                        { label: '智谱 GLM', value: 'glm' },
                        { label: 'Claude / Anthropic', value: 'anthropic' },
                        { label: 'Gemini (Google)', value: 'gemini' },
                        { label: 'Azure OpenAI', value: 'azure' },
                        { label: 'Ollama (本地)', value: 'ollama' },
                        { label: '自定义', value: 'custom' },
                      ]"
                      placeholder="选择 Provider"
                      @update:value="
                        (v: string) => {
                          const preset = providerUrlPresets[v];
                          if (preset && !getProviderConfig('api_url')) {
                            setProviderConfig('api_url', preset);
                          }
                        }
                      "
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="API URL">
                    <NInput
                      :value="getProviderConfig('api_url')"
                      @update:value="(v) => setProviderConfig('api_url', v)"
                      :placeholder="
                        providerUrlPresets[currentProviderName()] ||
                        'https://api.example.com/v1'
                      "
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="API Key">
                    <NInput
                      :value="getProviderConfig('api_key')"
                      @update:value="(v) => setProviderConfig('api_key', v)"
                      placeholder="sk-xxx"
                      type="password"
                      show-password-on="click"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="Model">
                    <div class="flex gap-2">
                      <NSelect
                        :value="getProviderConfig('model')"
                        @update:value="(v) => setProviderConfig('model', v)"
                        :options="
                          modelOptions.map((m) => ({ label: m, value: m }))
                        "
                        :placeholder="
                          currentProviderName() === 'ollama'
                            ? 'llama3.2'
                            : 'deepseek-chat'
                        "
                        filterable
                        clearable
                        class="flex-1"
                      />
                      <NButton
                        size="small"
                        :loading="loadingModels"
                        @click="fetchModels"
                        title="刷新模型列表"
                      >
                        <template #icon>
                          <IconifyIcon
                            icon="lucide:refresh-cw"
                            class="w-4 h-4"
                          />
                        </template>
                      </NButton>
                    </div>
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="批量识别大小">
                    <NInput
                      v-model:value="config['agent.batch_size']"
                      placeholder="100"
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
                  :loading="saving === 'ai'"
                  @click="saveAi"
                >
                  保存
                </NButton>
              </div>
            </template>
          </NCard>
        </NGridItem>

        <!-- 服务 -->
        <NGridItem>
          <NCard id="basic_service" size="small">
            <template #header>
              <div class="flex items-center gap-2">
                <IconifyIcon icon="lucide:settings" class="w-4 h-4" />
                <span class="font-semibold">服务</span>
              </div>
            </template>
            <NForm label-placement="left" :label-width="160">
              <NGrid cols="1 s:1 m:2 l:2" :x-gap="16" responsive="screen">
                <NGridItem span="1">
                  <NFormItem label="订阅RSS周期(秒)">
                    <NInput
                      v-model:value="config['pt.pt_check_interval']"
                      placeholder="留空关闭RSS订阅"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="订阅搜索周期(小时)">
                    <NInput
                      v-model:value="config['pt.search_rss_interval']"
                      placeholder="留空关闭订阅定时搜索"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="媒体库同步周期(小时)">
                    <NInput
                      v-model:value="config['media.mediasync_interval']"
                      placeholder="留空关闭媒体库同步"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="目录同步监控间隔(秒)">
                    <NInput
                      v-model:value="config['media.sync_transfer_interval']"
                      placeholder="本地60，远程/网盘300+"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="站点数据刷新时间">
                    <NInput
                      v-model:value="config['pt.ptrefresh_date_cron']"
                      placeholder="留空关闭自动刷新"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="远程搜索自动择优下载">
                    <NSwitch
                      v-model:value="config['pt.search_auto']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="远程下载不完整自动订阅">
                    <NSwitch
                      v-model:value="config['pt.search_no_result_rss']"
                      :checked-value="1"
                      :unchecked-value="0"
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
                  :loading="saving === 'service'"
                  @click="saveService"
                >
                  保存
                </NButton>
              </div>
            </template>
          </NCard>
        </NGridItem>

        <!-- 实验室 -->
        <NGridItem>
          <NCard id="laboratory" size="small">
            <template #header>
              <div class="flex items-center gap-2">
                <IconifyIcon icon="lucide:flask-conical" class="w-4 h-4" />
                <span class="font-semibold">实验室</span>
              </div>
            </template>
            <NForm label-placement="left" :label-width="200">
              <NGrid cols="1 s:1 m:2 l:3" :x-gap="16" responsive="screen">
                <NGridItem span="1">
                  <NFormItem label="辅助识别">
                    <NSwitch
                      v-model:value="config['laboratory.search_keyword']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="WEB增强识别">
                    <NSwitch
                      v-model:value="config['laboratory.search_tmdbweb']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="TMDB缓存过期策略">
                    <NSwitch
                      v-model:value="config['laboratory.tmdb_cache_expire']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="默认搜索豆瓣资源">
                    <NSwitch
                      v-model:value="config['laboratory.use_douban_titles']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="多语言搜索">
                    <NSwitch
                      v-model:value="config['laboratory.search_multi_language']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="展示更多站点">
                    <NSwitch
                      v-model:value="config['laboratory.show_more_sites']"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="验证码识别服务器">
                    <NInput
                      v-model:value="config['laboratory.ocr_server_host']"
                      placeholder="http://127.0.0.1:9300"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem span="1">
                  <NFormItem label="网页自动化服务器">
                    <NInput
                      v-model:value="config['laboratory.chrome_server_host']"
                      placeholder="http://127.0.0.1:9850"
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
                  :loading="saving === 'laboratory'"
                  @click="saveLaboratory"
                >
                  保存
                </NButton>
              </div>
            </template>
          </NCard>
        </NGridItem>
      </NGrid>
    </NSpin>
  </div>
</template>
