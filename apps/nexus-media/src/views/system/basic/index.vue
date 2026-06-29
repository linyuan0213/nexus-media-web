<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { NSpin, NTabPane, NTabs, useMessage } from 'naive-ui';

import {
  getAllSystemConfigApi,
  getSiteConfigVersionApi,
  listAgentModelsApi,
  reloadConfigApi,
  updateConfigApi,
  updateSiteConfigApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

import AgentSection from './components/AgentSection.vue';
import LaboratorySection from './components/LaboratorySection.vue';
import LogSection from './components/LogSection.vue';
import MediaSection from './components/MediaSection.vue';
import ServiceSection from './components/ServiceSection.vue';
import SiteConfigCard from './components/SiteConfigCard.vue';
import SystemSection from './components/SystemSection.vue';

const message = useMessage();

const loading = ref(false);
const saving = ref<null | string>(null);
const loadingModels = ref(false);
const modelOptions = ref<string[]>([]);
const activeTab = ref('system');

const config = ref<Record<string, any>>({});

const siteConfigVersion = ref({
  local: '',
  remote: '',
  needs_update: false,
});
const updatingSiteConfig = ref(false);
const reloadingConfig = ref(false);

function updateConfig(key: string, value: any) {
  config.value = { ...config.value, [key]: value };
}

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

function buildPayload(fields: string[]) {
  const data: Record<string, any> = {};
  fields.forEach((f) => {
    const v = config.value[f];
    if (v !== undefined && v !== '') data[f] = v;
  });
  return data;
}

function saveSystem() {
  saveSection(
    'system',
    buildPayload([
      'app.web_port',
      'app.ssl_cert',
      'app.ssl_key',
      'app.proxies',
      'app.domain',
      'app.user_agent',
      'app.enable_image_proxy',
    ]),
  );
}

function saveLog() {
  saveSection(
    'log',
    buildPayload(['log.type', 'log.path', 'log.level', 'log.format']),
  );
}

function saveMedia() {
  saveSection(
    'media',
    buildPayload([
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
    ]),
  );
}

function currentProviderName(): string {
  return config.value['agent.default_provider'] || 'openai';
}

function saveAi() {
  const data = buildPayload([
    'agent.enabled',
    'agent.default_provider',
    'agent.media_recognizer_enabled',
    'agent.batch_size',
  ]);
  const provider = currentProviderName();
  ['api_url', 'api_key', 'model'].forEach((field) => {
    const v = config.value[`agent.providers.${provider}.${field}`];
    if (v !== undefined && v !== '')
      data[`agent.providers.${provider}.${field}`] = v;
  });
  saveSection('ai', data);
}

function saveService() {
  saveSection(
    'service',
    buildPayload([
      'pt.pt_check_interval',
      'pt.search_rss_interval',
      'media.mediasync_interval',
      'pt.ptrefresh_date_cron',
      'pt.search_auto',
      'pt.search_no_result_rss',
    ]),
  );
}

function saveLaboratory() {
  saveSection(
    'laboratory',
    buildPayload([
      'laboratory.search_keyword',
      'laboratory.search_tmdbweb',
      'laboratory.tmdb_cache_expire',
      'laboratory.use_douban_titles',
      'laboratory.search_multi_language',
      'laboratory.show_more_sites',
      'laboratory.ocr_server_host',
      'laboratory.chrome_server_host',
    ]),
  );
}

async function fetchModels() {
  const provider = currentProviderName();
  const apiUrl = config.value[`agent.providers.${provider}.api_url`] || '';
  const apiKey = config.value[`agent.providers.${provider}.api_key`] || '';
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
    const models = Array.isArray(res) ? res : (res as any)?.data || [];
    modelOptions.value = models;
    if (models.length > 0) {
      if (!config.value[`agent.providers.${provider}.model`]) {
        config.value[`agent.providers.${provider}.model`] = models[0];
      }
      message.success(`获取到 ${models.length} 个模型`);
    } else {
      message.error('获取模型列表为空');
    }
  } catch {
    modelOptions.value = [];
    message.error('获取模型列表失败');
  } finally {
    loadingModels.value = false;
  }
}

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
    message.success((res as any)?.message || '更新完成');
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
  <div class="p-4 lg:p-6">
    <PageHeader title="基础设置" />

    <SiteConfigCard
      class="mb-6"
      :local="siteConfigVersion.local"
      :remote="siteConfigVersion.remote"
      :needs-update="siteConfigVersion.needs_update"
      :reloading="reloadingConfig"
      :updating="updatingSiteConfig"
      @reload="handleReloadConfig"
      @update="handleUpdateSiteConfig"
    />

    <NSpin :show="loading">
      <NTabs
        v-model:value="activeTab"
        type="line"
        animated
        class="settings-tabs"
      >
        <NTabPane name="system" tab="系统">
          <SystemSection
            :config="config"
            :saving="saving === 'system'"
            @save="saveSystem"
            @update-config="updateConfig"
          />
        </NTabPane>

        <NTabPane name="log" tab="日志">
          <LogSection
            :config="config"
            :saving="saving === 'log'"
            @save="saveLog"
            @update-config="updateConfig"
          />
        </NTabPane>

        <NTabPane name="media" tab="媒体">
          <MediaSection
            :config="config"
            :saving="saving === 'media'"
            @save="saveMedia"
            @update-config="updateConfig"
          />
        </NTabPane>

        <NTabPane name="agent" tab="Agent">
          <AgentSection
            :config="config"
            :saving="saving === 'ai'"
            :loading-models="loadingModels"
            :model-options="modelOptions"
            @save="saveAi"
            @fetch-models="fetchModels"
            @update-config="updateConfig"
          />
        </NTabPane>

        <NTabPane name="service" tab="服务">
          <ServiceSection
            :config="config"
            :saving="saving === 'service'"
            @save="saveService"
            @update-config="updateConfig"
          />
        </NTabPane>

        <NTabPane name="laboratory" tab="实验室">
          <LaboratorySection
            :config="config"
            :saving="saving === 'laboratory'"
            @save="saveLaboratory"
            @update-config="updateConfig"
          />
        </NTabPane>
      </NTabs>
    </NSpin>
  </div>
</template>
