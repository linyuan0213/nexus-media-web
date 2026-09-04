<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NInput,
  NModal,
  NPopconfirm,
  NSpin,
  NTag,
} from 'naive-ui';

import { getPluginsApi } from '#/api/modules/plugin_framework';
import {
  addMarketSourceApi,
  auditMarketPluginApi,
  deleteMarketSourceApi,
  getMarketCatalogPluginsApi,
  getMarketPluginDetailApi,
  getMarketSourcesApi,
  installMarketPluginApi,
  type MarketPluginDetail,
  type MarketSource,
  syncMarketSourceApi,
  updateMarketPluginApi,
} from '#/api/modules/plugin_market';
import PageHeader from '#/components/page/PageHeader.vue';
import { useAppNotification } from '#/utils/notify';

const notification = useAppNotification();

const sources = ref<MarketSource[]>([]);
const activeSource = ref<MarketSource | null>(null);
const plugins = ref<{ id: string; path: string }[]>([]);
const details = ref<Record<string, MarketPluginDetail>>({});
const installedMap = ref<
  Record<string, { version: string; installed: boolean }>
>({});
const keyword = ref('');
const syncing = ref(false);
const loadingList = ref(false);
const loadingDetails = ref(false);

const sourceModal = ref(false);
const addSourceName = ref('');
const addSourceUrl = ref('');
const savingSource = ref(false);

const auditModal = ref(false);
const auditTarget = ref<null | { sourceId: string; pluginId: string }>(null);
const auditLoading = ref(false);
const auditData = ref<any>(null);
const auditError = ref('');

const officialUrl =
  'https://raw.githubusercontent.com/linyuan0213/nexus-media-plugins/master/catalog.json';

const filteredPlugins = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return plugins.value;
  return plugins.value.filter((p) => {
    const d = details.value[p.id];
    const name = d?.name ?? p.id;
    const desc = d?.description ?? '';
    return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  });
});

const sortedPlugins = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  const list = q ? filteredPlugins.value : plugins.value;
  return [...list].sort(
    (a, b) =>
      Number(Boolean(installedMap.value[a.id])) -
      Number(Boolean(installedMap.value[b.id])),
  );
});

function versionCmp(a: string, b: string): number {
  const pa = (a || '').replace(/^v/i, '').split('.').map(Number);
  const pb = (b || '').replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function pluginState(p: { id: string }) {
  const local = installedMap.value[p.id];
  const detail = details.value[p.id];
  if (!local)
    return {
      text: '安装',
      type: 'primary',
      disabled: false,
      loading: false,
    } as const;
  const newer = detail && versionCmp(local.version, detail.version) < 0;
  if (newer)
    return {
      text: `更新 ${local.version}→${detail?.version}`,
      type: 'warning',
      disabled: false,
      loading: false,
    } as const;
  return {
    text: `已安装 v${local.version}`,
    type: 'default',
    disabled: true,
    loading: false,
  } as const;
}

async function fetchSources(preferId?: string) {
  try {
    const res = await getMarketSourcesApi();
    const items = (res?.data?.items ?? res?.data ?? []) as MarketSource[];
    sources.value = items;
    const pick =
      items.find((s) => s.source_id === preferId) ??
      items.find((s) => s.enabled) ??
      items[0] ??
      null;
    await selectSource(pick, true);
  } catch (e: any) {
    notification.error('获取市场源失败', {
      description: e?.message ?? String(e),
    });
  }
}

async function selectSource(source: MarketSource | null, forceSync = false) {
  activeSource.value = source;
  plugins.value = [];
  details.value = {};
  if (!source) return;
  if (forceSync || !source.last_sync_at) {
    await handleSync(source.source_id);
  } else {
    await loadPlugins(source.source_id);
  }
}

async function handleSync(sourceId: string) {
  syncing.value = true;
  try {
    await syncMarketSourceApi(sourceId);
    notification.success('同步完成');
    await loadPlugins(sourceId);
    const target = sources.value.find((s) => s.source_id === sourceId);
    if (target) {
      target.last_sync_at = new Date().toISOString();
      target.last_error = '';
    }
  } catch (e: any) {
    notification.error('同步失败', { description: e?.message ?? String(e) });
  } finally {
    syncing.value = false;
  }
}

async function loadPlugins(sourceId: string) {
  loadingList.value = true;
  try {
    const res = await getMarketCatalogPluginsApi(sourceId);
    const items = (res?.data?.items ?? []) as { id: string; path: string }[];
    plugins.value = items;
    await loadDetails(sourceId, items);
  } finally {
    loadingList.value = false;
  }
}

async function loadDetails(sourceId: string, entries: { id: string }[]) {
  loadingDetails.value = true;
  try {
    const loaded: Record<string, MarketPluginDetail> = {};
    await Promise.all(
      entries.map(async (e) => {
        try {
          loaded[e.id] = await getMarketPluginDetailApi(sourceId, e.id);
        } catch {
          /* 单条详情失败忽略 */
        }
      }),
    );
    details.value = loaded;
  } finally {
    loadingDetails.value = false;
  }
}

async function refreshInstalled() {
  try {
    const res = await getPluginsApi();
    const items = (res?.data ?? []) as any[];
    installedMap.value = Object.fromEntries(
      items.map((p: any) => [
        p.id,
        { version: p.version ?? '', installed: true },
      ]),
    );
  } catch {
    installedMap.value = {};
  }
}

async function openInstall(p: { id: string }) {
  const sourceId = activeSource.value?.source_id;
  if (!sourceId) return;
  auditTarget.value = { sourceId, pluginId: p.id };
  auditData.value = null;
  auditError.value = '';
  auditModal.value = true;
  auditLoading.value = true;
  try {
    auditData.value = await auditMarketPluginApi(sourceId, p.id);
  } catch (e: any) {
    auditError.value = e?.message ?? String(e);
  } finally {
    auditLoading.value = false;
  }
}

async function confirmInstall() {
  if (!auditTarget.value) return;
  auditModal.value = false;
  try {
    const res = await installMarketPluginApi(
      auditTarget.value.sourceId,
      auditTarget.value.pluginId,
      true,
    );
    notification.success(`安装成功：版本 ${res?.data?.version ?? ''}`);
    await refreshInstalled();
  } catch (e: any) {
    notification.error('安装失败', { description: e?.message ?? String(e) });
  }
}

async function handleUpdate(pluginId: string) {
  const sourceId = activeSource.value?.source_id;
  if (!sourceId) return;
  try {
    const res = await updateMarketPluginApi(sourceId, pluginId);
    notification.success(`更新成功：已更新到 ${res?.data?.version ?? ''}`);
    await refreshInstalled();
  } catch (e: any) {
    notification.error('更新失败', { description: e?.message ?? String(e) });
  }
}

async function openAddSource(prefillUrl = false) {
  addSourceName.value = '';
  addSourceUrl.value = prefillUrl ? officialUrl : '';
  sourceModal.value = true;
}

async function confirmAddSource() {
  if (!addSourceName.value.trim() || !addSourceUrl.value.trim()) {
    notification.warning('请填写名称与 URL');
    return;
  }
  savingSource.value = true;
  try {
    const res = await addMarketSourceApi({
      name: addSourceName.value.trim(),
      url: addSourceUrl.value.trim(),
    });
    sourceModal.value = false;
    notification.success('市场源已添加');
    await fetchSources(res?.data?.source_id);
  } catch (e: any) {
    notification.error('添加失败', { description: e?.message ?? String(e) });
  } finally {
    savingSource.value = false;
  }
}

async function removeSource(sourceId: string) {
  try {
    await deleteMarketSourceApi(sourceId);
    notification.success('已移除市场源');
    await fetchSources();
  } catch (e: any) {
    notification.error('移除失败', { description: e?.message ?? String(e) });
  }
}

onMounted(async () => {
  await Promise.all([fetchSources(), refreshInstalled()]);
});
</script>

<template>
  <div class="market-page">
    <PageHeader title="插件市场" subtitle="从远程源发现、安装与更新插件">
      <template #actions>
        <NButton quaternary @click="openAddSource(true)">
          <template #icon><IconifyIcon icon="lucide:github" /></template>
          添加官方源
        </NButton>
        <NButton type="primary" @click="openAddSource(false)">
          <template #icon><IconifyIcon icon="lucide:plus" /></template>
          管理源
        </NButton>
      </template>
    </PageHeader>

    <NCard class="source-bar" :bordered="false">
      <div class="source-list">
        <NButton
          v-for="src in sources"
          :key="src.source_id"
          class="source-chip"
          :type="
            activeSource?.source_id === src.source_id ? 'primary' : 'default'
          "
          :disabled="!src.enabled"
          @click="selectSource(src)"
        >
          <template #icon><IconifyIcon icon="lucide:store" /></template>
          {{ src.name }}
        </NButton>
        <div v-if="!sources.length" class="source-empty">
          <NEmpty description="还没有市场源，点右上角添加">
            <template #extra>
              <NButton size="small" type="primary" @click="openAddSource(true)">
                添加官方源
              </NButton>
            </template>
          </NEmpty>
        </div>
      </div>
      <div v-if="activeSource" class="source-actions">
        <NButton
          size="small"
          :loading="syncing"
          @click="handleSync(activeSource.source_id)"
        >
          <template #icon><IconifyIcon icon="lucide:refresh-cw" /></template>
          同步
        </NButton>
        <NPopconfirm @positive-click="removeSource(activeSource.source_id)">
          <template #trigger>
            <NButton size="small" type="error" quaternary>
              <template #icon><IconifyIcon icon="lucide:trash-2" /></template>
            </NButton>
          </template>
          移除该市场源？
        </NPopconfirm>
        <NSpin :show="syncing" size="small" />
      </div>
      <div v-if="activeSource?.last_error" class="source-error">
        <NAlert type="warning" :show-icon="true"
          >
上次同步失败：{{ activeSource.last_error }}
</NAlert
        >
      </div>
    </NCard>

    <NCard class="search-bar" :bordered="false">
      <NInput
        v-model:value="keyword"
        clearable
        placeholder="搜索插件名称 / 描述…"
      >
        <template #prefix><IconifyIcon icon="lucide:search" /></template>
      </NInput>
    </NCard>

    <NSpin :show="loadingList || loadingDetails">
      <div v-if="sortedPlugins.length" class="plugin-grid">
        <NCard
          v-for="p in sortedPlugins"
          :key="p.id"
          class="plugin-card"
          :bordered="true"
        >
          <div class="plugin-head">
            <div class="plugin-name-wrap">
              <span class="plugin-name">{{ details[p.id]?.name ?? p.id }}</span>
              <NTag
                v-if="details[p.id]?.category"
                size="small"
                :bordered="false"
              >
                {{ details[p.id]?.category }}
              </NTag>
            </div>
            <span class="plugin-version"
              >v{{ details[p.id]?.version ?? '…' }}</span
            >
          </div>
          <p class="plugin-desc">{{ details[p.id]?.description ?? '…' }}</p>
          <div class="plugin-tags">
            <NTag
              v-for="tag in (details[p.id]?.tags ?? []).slice(0, 3)"
              :key="tag"
              size="small"
              type="info"
              :bordered="false"
            >
              {{ tag }}
            </NTag>
          </div>
          <div class="plugin-foot">
            <span class="plugin-meta">{{
              details[p.id]?.license ?? '未知许可'
            }}</span>
            <NButton
              v-if="!installedMap[p.id]"
              size="small"
              type="primary"
              @click="openInstall(p)"
            >
              安装
            </NButton>
            <NButton
              v-else-if="pluginState(p).text.startsWith('更新')"
              size="small"
              type="warning"
              @click="handleUpdate(p.id)"
            >
              {{ pluginState(p).text }}
            </NButton>
            <NTag v-else size="small" type="success" :bordered="false"
              >
已安装
</NTag
            >
          </div>
        </NCard>
      </div>
      <div v-else-if="!loadingList && activeSource" class="empty-state">
        <NEmpty description="该源暂无可安装插件" />
      </div>
      <div v-else-if="!activeSource" class="empty-state">
        <NEmpty description="请先添加并同步一个市场源" />
      </div>
    </NSpin>

    <NModal
      v-model:show="sourceModal"
      preset="card"
      title="添加市场源"
      style="width: 520px"
    >
      <div class="modal-form">
        <NInput
          v-model:value="addSourceName"
          placeholder="源名称（如：官方插件源）"
        />
        <NInput v-model:value="addSourceUrl" placeholder="catalog.json URL" />
        <NButton
          type="primary"
          block
          :loading="savingSource"
          @click="confirmAddSource"
        >
          添加
        </NButton>
      </div>
    </NModal>

    <NModal
      v-model:show="auditModal"
      preset="card"
      title="安装预检（SAST）"
      style="width: 640px"
    >
      <NSpin :show="auditLoading">
        <div v-if="auditData" class="audit-result">
          <NAlert
            :type="auditData?.data?.report?.passed ? 'success' : 'error'"
            :title="
              auditData?.data?.report?.passed ? '扫描通过' : '扫描发现高危问题'
            "
          >
            <template #default>
              sha256:{{
                auditData?.data?.report?.sha256_ok ? '匹配' : '不匹配'
              }}
              · 文件数 {{ auditData?.data?.report?.file_count }}
            </template>
          </NAlert>
          <template v-if="(auditData?.data?.report?.findings ?? []).length">
            <div
              v-for="f in auditData.data.report.findings"
              :key="f.rule"
              class="audit-finding"
            >
              <NTag
                size="small"
                :type="f.severity === 'block' ? 'error' : 'warning'"
              >
                {{ f.rule }}
              </NTag>
              <span>{{ f.file || f.detail }}</span>
            </div>
          </template>
        </div>
        <NAlert v-if="auditError" type="error" :title="auditError" />
        <div v-if="auditData?.data?.report?.passed" class="audit-actions">
          <NButton type="primary" block @click="confirmInstall"
            >
确认安装
</NButton
          >
        </div>
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped>
.market-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.source-bar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.source-list {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-empty {
  width: 100%;
  padding: 0.25rem 0;
}

.source-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.source-error {
  width: 100%;
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.75rem;
  padding: 0.25rem 0;
}

.plugin-card {
  display: flex;
  flex-direction: column;
}

.plugin-head {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.plugin-name-wrap {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
}

.plugin-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  white-space: nowrap;
}

.plugin-version {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.plugin-desc {
  display: -webkit-box;
  min-height: 2.4em;
  margin: 0.5rem 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 0.85rem;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.plugin-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.plugin-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.plugin-meta {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.empty-state {
  padding: 3rem 0;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audit-result {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.audit-finding {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.85rem;
}

.audit-actions {
  margin-top: 0.75rem;
}

@media (max-width: 640px) {
  .source-actions {
    width: 100%;
  }
}
</style>
