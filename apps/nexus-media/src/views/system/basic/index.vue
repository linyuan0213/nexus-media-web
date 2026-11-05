<script lang="ts" setup>
import type { SectionKey } from './settings';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

import { NSpin, NTag, useMessage } from 'naive-ui';

import {
  getSiteConfigVersionApi,
  listAgentModelsApi,
  reloadConfigApi,
  updateSiteConfigApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

import AgentSection from './components/AgentSection.vue';
import LaboratorySection from './components/LaboratorySection.vue';
import LogSection from './components/LogSection.vue';
import MediaSection from './components/MediaSection.vue';
import RenameSection from './components/RenameSection.vue';
import ServiceSection from './components/ServiceSection.vue';
import SettingsNavigation from './components/SettingsNavigation.vue';
import SettingsSection from './components/SettingsSection.vue';
import SiteConfigCard from './components/SiteConfigCard.vue';
import SystemSection from './components/SystemSection.vue';
import { SECTIONS } from './settings';
import { useBasicSettings } from './useBasicSettings';

const message = useMessage();
const route = useRoute();
const router = useRouter();

const {
  config,
  dirtySections,
  fetchData,
  hasSectionErrors,
  loading,
  resetSection,
  resolveAgentProvider,
  saveAi,
  saveLaboratory,
  saveLog,
  saveMedia,
  saveRename,
  saveService,
  saveSystem,
  savedSection,
  saving,
  updateConfig,
} = useBasicSettings();

const loadingModels = ref(false);
const modelOptions = ref<string[]>([]);
const activeSection = ref<SectionKey>(resolveSection(route.query.tab));

const siteConfigVersion = ref({
  local: '',
  remote: '',
  needs_update: false,
});
const updatingSiteConfig = ref(false);
const reloadingConfig = ref(false);

const activeDefinition = computed(
  () =>
    SECTIONS.find((item) => item.key === activeSection.value) ?? SECTIONS[0]!,
);

function resolveSection(value: unknown): SectionKey {
  const key = String(value || '');
  return SECTIONS.some((item) => item.key === key)
    ? (key as SectionKey)
    : 'system';
}

function isDirty(section: SectionKey) {
  return dirtySections.value.includes(section);
}

function selectSection(section: SectionKey) {
  if (section === activeSection.value) return;
  activeSection.value = section;
  router.replace({ query: { ...route.query, tab: section } });
}

async function fetchModels() {
  const provider = resolveAgentProvider();
  const apiUrl = config.value[`agent.providers.${provider}.api_url`] || '';
  const apiKey = config.value[`agent.providers.${provider}.api_key`] || '';
  if (!apiUrl || (provider !== 'ollama' && !apiKey)) {
    message.warning('请先填写 API URL 和 API Key');
    return;
  }
  loadingModels.value = true;
  modelOptions.value = [];
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

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (dirtySections.value.length === 0) return;
  event.preventDefault();
  event.returnValue = '';
}

onBeforeRouteLeave(() => {
  if (dirtySections.value.length === 0) return true;
  return window.confirm('有未保存的更改，离开后这些修改会丢失。确定离开吗？');
});

watch(
  () => route.query.tab,
  (value) => {
    const next = resolveSection(value);
    if (next !== activeSection.value) activeSection.value = next;
  },
);

onMounted(() => {
  fetchData();
  fetchSiteConfigVersion();
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<template>
  <div class="settings-page p-4 lg:p-6">
    <PageHeader
      title="基础设置"
      subtitle="集中管理运行环境、媒体识别与自动化任务"
    >
      <template #actions>
        <NTag v-if="dirtySections.length" type="warning" :bordered="false">
          {{ dirtySections.length }} 个分区未保存
        </NTag>
      </template>
    </PageHeader>

    <SiteConfigCard
      class="mb-5"
      :local="siteConfigVersion.local"
      :remote="siteConfigVersion.remote"
      :needs-update="siteConfigVersion.needs_update"
      :reloading="reloadingConfig"
      :updating="updatingSiteConfig"
      @reload="handleReloadConfig"
      @update="handleUpdateSiteConfig"
    />

    <NSpin :show="loading">
      <div class="settings-layout">
        <aside class="settings-sidebar">
          <div class="settings-sidebar-inner">
            <SettingsNavigation
              :active="activeSection"
              :dirty-sections="dirtySections"
              :sections="SECTIONS"
              @select="selectSection"
            />
            <p class="settings-shortcut">
              <span class="shortcut-dot" aria-hidden="true"></span>
              圆点表示该分区有未保存修改
            </p>
          </div>
        </aside>

        <main class="settings-main">
          <SettingsSection
            v-if="activeSection === 'system'"
            dom-id="basic_system"
            :title="activeDefinition.title"
            :description="activeDefinition.description"
            icon="lucide:server-cog"
            :dirty="isDirty('system')"
            :saved="savedSection === 'system'"
            :saving="saving === 'system'"
            :invalid="hasSectionErrors('system')"
            @reset="resetSection('system')"
            @save="saveSystem"
          >
            <SystemSection :config="config" @update-config="updateConfig" />
          </SettingsSection>

          <SettingsSection
            v-if="activeSection === 'media'"
            dom-id="basic_media"
            title="媒体与识别"
            description="配置元数据来源、识别策略以及媒体整理的基础规则。"
            icon="lucide:library-big"
            :dirty="isDirty('media')"
            :saved="savedSection === 'media'"
            :saving="saving === 'media'"
            :invalid="hasSectionErrors('media')"
            @reset="resetSection('media')"
            @save="saveMedia"
          >
            <MediaSection :config="config" @update-config="updateConfig" />
          </SettingsSection>

          <SettingsSection
            v-if="activeSection === 'rename'"
            dom-id="basic_rename"
            title="整理与重命名"
            description="通过变量和固定文本构建电影、电视剧的统一命名格式。"
            icon="lucide:folder-pen"
            :dirty="isDirty('rename')"
            :saved="savedSection === 'rename'"
            :saving="saving === 'rename'"
            :invalid="hasSectionErrors('rename')"
            @reset="resetSection('rename')"
            @save="saveRename"
          >
            <RenameSection
              :config="config"
              :saving="saving === 'rename'"
              @save="saveRename"
              @update-config="updateConfig"
            />
          </SettingsSection>

          <SettingsSection
            v-if="activeSection === 'service'"
            dom-id="basic_service"
            title="自动化服务"
            description="安排订阅、同步与站点任务，并控制后台队列的处理节奏。"
            icon="lucide:workflow"
            :dirty="isDirty('service')"
            :saved="savedSection === 'service'"
            :saving="saving === 'service'"
            :invalid="hasSectionErrors('service')"
            @reset="resetSection('service')"
            @save="saveService"
          >
            <ServiceSection :config="config" @update-config="updateConfig" />
          </SettingsSection>

          <SettingsSection
            v-if="activeSection === 'agent'"
            dom-id="basic_agent"
            title="AI Agent"
            description="配置对话模型、知识库、长程记忆与智能通知增强。"
            icon="lucide:bot"
            :dirty="isDirty('agent')"
            :saved="savedSection === 'agent'"
            :saving="saving === 'agent'"
            :invalid="hasSectionErrors('agent')"
            @reset="resetSection('agent')"
            @save="saveAi"
          >
            <AgentSection
              :config="config"
              :loading-models="loadingModels"
              :model-options="modelOptions"
              @fetch-models="fetchModels"
              @save="saveAi"
              @update-config="updateConfig"
            />
          </SettingsSection>

          <SettingsSection
            v-if="activeSection === 'log'"
            dom-id="basic_log"
            title="日志与诊断"
            description="控制日志输出、详细程度以及文件轮转和保留策略。"
            icon="lucide:scroll-text"
            :dirty="isDirty('log')"
            :saved="savedSection === 'log'"
            :saving="saving === 'log'"
            :invalid="hasSectionErrors('log')"
            @reset="resetSection('log')"
            @save="saveLog"
          >
            <LogSection :config="config" @update-config="updateConfig" />
          </SettingsSection>

          <SettingsSection
            v-if="activeSection === 'laboratory'"
            dom-id="basic_laboratory"
            title="实验室"
            description="启用辅助识别能力和外部自动化服务，功能可能持续调整。"
            icon="lucide:flask-conical"
            :dirty="isDirty('laboratory')"
            :saved="savedSection === 'laboratory'"
            :saving="saving === 'laboratory'"
            :invalid="hasSectionErrors('laboratory')"
            @reset="resetSection('laboratory')"
            @save="saveLaboratory"
          >
            <LaboratorySection :config="config" @update-config="updateConfig" />
          </SettingsSection>

          <p v-if="hasSectionErrors(activeSection)" class="settings-hint">
            部分数字字段超出允许范围，保存时会提示具体字段。
          </p>
        </main>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 1440px;
  margin-inline: auto;
}

.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.settings-sidebar-inner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.settings-shortcut {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0 0.75rem;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.shortcut-dot {
  flex: 0 0 auto;
  width: 0.4375rem;
  height: 0.4375rem;
  background: hsl(var(--warning));
  border-radius: 50%;
}

.settings-main {
  min-width: 0;
}

.settings-hint {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.settings-main :deep(.n-form-item-feedback) {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

@media (min-width: 1024px) {
  .settings-layout {
    grid-template-columns: 13rem minmax(0, 1fr);
    gap: 1.5rem;
  }

  .settings-sidebar-inner {
    position: sticky;
    top: 1rem;
  }
}

@media (max-width: 1023px) {
  .settings-shortcut {
    display: none;
  }
}
</style>
