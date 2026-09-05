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

import {
  enablePluginApi,
  getPluginsApi,
  installPluginApi,
} from '#/api/modules/plugin_framework';
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
  updateMarketSourceApi,
} from '#/api/modules/plugin_market';
import PageHeader from '#/components/page/PageHeader.vue';
import { useAppNotification } from '#/utils/notify';

const notification = useAppNotification();

const officialUrl =
  'https://raw.githubusercontent.com/linyuan0213/nexus-media-plugins/master/catalog.json';

const isRemoteIcon = (icon?: string): boolean =>
  !!icon && (icon.startsWith('http') || icon.startsWith('/'));

/** category 主分类（后端仅 5 类）→ 中文展示名 */
const CATEGORY_LABELS: Record<string, string> = {
  system: '系统',
  media: '媒体',
  download: '下载',
  site: '站点',
  tool: '工具',
};

/** 仅这些「常用」中文标签会进入分类筛选（数据中出现才显示，其余细标签不展示） */
const COMMON_TAGS = new Set([
  '系统',
  '媒体',
  '下载',
  '站点',
  '工具',
  '消息',
  '通知',
  '订阅',
  '自动化',
  '定时',
  '网络',
  '下载器',
  '种子',
  '刮削',
  '媒体库',
  '字幕',
  '元数据',
  '搜索',
  '同步',
  'AI',
  'RSS',
]);

function categoryLabel(raw?: string): string {
  if (!raw) return '';
  return CATEGORY_LABELS[raw] ?? raw;
}

/** 标签配色：使用主题 --tag-* 语义色板，浅底深字，按文本稳定分配 */
const TAG_COLOR_VARS = [
  '--tag-primary',
  '--tag-quality',
  '--tag-lang',
  '--tag-audio',
  '--tag-hdr',
  '--tag-edition',
] as const;

function hashText(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return h;
}

function tagStyle(
  text?: string,
): { color: string; backgroundColor: string } {
  const v = TAG_COLOR_VARS[hashText(text ?? '') % TAG_COLOR_VARS.length];
  return {
    color: `hsl(var(${v}))`,
    backgroundColor: `hsl(var(${v}) / 10%)`,
  };
}

function sourceStyle(
  isBuiltin: boolean,
): { color: string; backgroundColor: string } {
  const v = isBuiltin ? '--tag-primary' : '--tag-default';
  return {
    color: `hsl(var(${v}))`,
    backgroundColor: `hsl(var(${v}) / 10%)`,
  };
}

/** 卡片标签 chips：原样展示，去除与主分类同名重复项并限制数量 */
function tagChips(item: ViewItem): { key: string; text: string }[] {
  const info = item.info;
  const catRaw = info?.category ? String(info.category) : '';
  const catLabel = categoryLabel(catRaw);
  const seen = new Set<string>();
  const chips: { key: string; text: string }[] = [];
  for (const t of info?.tags ?? []) {
    const raw = String(t);
    if (raw === catRaw || raw === catLabel || seen.has(raw)) continue;
    seen.add(raw);
    chips.push({ key: `${item.key}:${raw}`, text: raw });
    if (chips.length >= 4) break;
  }
  return chips;
}

const stateOptions = [
  { key: 'all', label: '全部', icon: 'lucide:list-filter' },
  { key: 'uninstalled', label: '未安装', icon: 'lucide:plus-circle' },
  { key: 'updatable', label: '可更新', icon: 'lucide:refresh-cw' },
  { key: 'installed', label: '已安装', icon: 'lucide:check-circle' },
] as const;

const BUILTIN_KEY = '__builtin__';

interface LocalItem {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  category?: string;
  tags?: string[];
  icon?: string;
  color?: string;
  enabled: boolean;
  is_builtin: boolean;
  installed: boolean;
}

interface RemoteItem {
  id: string;
  source_id: string;
  source_name: string;
  info: MarketPluginDetail;
}

interface ViewItem {
  key: string;
  id: string;
  remote: boolean;
  source_id?: string;
  source_name?: string;
  info: any;
  is_builtin?: boolean;
}

const sources = ref<MarketSource[]>([]);
const remoteList = ref<RemoteItem[]>([]);
const localPool = ref<Record<string, LocalItem>>({});
const sourceFilter = ref('all');
const stateFilter = ref<'all' | 'uninstalled' | 'updatable' | 'installed'>(
  'all',
);
const categoryFilter = ref('all');
const searchQuery = ref('');
const loading = ref(false);
const syncing = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const sourceModal = ref(false);
const addSourceName = ref('');
const addSourceUrl = ref('');
const savingSource = ref(false);
const currentSourceId = ref('');
const addingSource = ref(false);

const auditModal = ref(false);
const auditTarget = ref<null | { sourceId: string; pluginId: string }>(null);
const auditLoading = ref(false);
const auditData = ref<any>(null);
const auditError = ref('');

const localList = computed<LocalItem[]>(() => Object.values(localPool.value));

const sourceOptions = computed(() => {
  const opts: { key: string; label: string; icon?: string }[] = [
    { key: 'all', label: '全部来源', icon: 'lucide:layout-grid' },
    { key: BUILTIN_KEY, label: '内置' },
  ];
  for (const s of sources.value) {
    opts.push({ key: s.source_id, label: s.name });
  }
  return opts;
});

const displayList = computed<ViewItem[]>(() => {
  const list: ViewItem[] = [];
  const seen = new Set<string>();
  for (const item of localList.value) {
    const remote = remoteList.value.find((r) => r.id === item.id);
    if (remote) continue; // 有远程源版本时以远程展示（便于更新）
    list.push({
      key: `l:${item.id}`,
      id: item.id,
      remote: false,
      info: item,
      is_builtin: item.is_builtin,
    });
    seen.add(item.id);
  }
  for (const r of remoteList.value) {
    if (seen.has(r.id)) continue;
    list.push({
      key: `r:${r.source_id}:${r.id}`,
      id: r.id,
      remote: true,
      source_id: r.source_id,
      source_name: r.source_name,
      info: r.info,
    });
    seen.add(r.id);
  }
  return list;
});

/** 分类筛选：主分类(5类)始终收集；「常用」标签需被多个插件共用(≥2)才展示，低频细标签忽略 */
const tagFacets = computed<string[]>(() => {
  const stat = new Map<string, { count: number; isCategory: boolean }>();
  const bump = (label: string, isCategory: boolean) => {
    const s = stat.get(label) ?? { count: 0, isCategory: false };
    s.count += 1;
    s.isCategory = s.isCategory || isCategory;
    stat.set(label, s);
  };
  for (const item of displayList.value) {
    const info = item.info;
    const rawCat = info?.category ? String(info.category) : '';
    const catLabel = rawCat ? categoryLabel(rawCat) : '';
    if (catLabel && catLabel !== rawCat) bump(catLabel, true);
    for (const t of info?.tags ?? []) {
      const raw = String(t);
      if (COMMON_TAGS.has(raw)) bump(raw, false);
    }
  }
  return [...stat.entries()]
    .filter(([, s]) => s.isCategory || s.count >= 2)
    .sort(
      (a, b) =>
        b[1].count - a[1].count || a[0].localeCompare(b[0], 'zh'),
    )
    .map(([label]) => label);
});

function itemMatchesTag(item: ViewItem, label: string): boolean {
  const info = item.info;
  return (
    (info?.category && categoryLabel(String(info.category)) === label) ||
    (info?.tags ?? []).includes(label)
  );
}

const filteredPlugins = computed(() => {
  let result = displayList.value;
  if (sourceFilter.value === BUILTIN_KEY) {
    result = result.filter((i) => i.is_builtin);
  } else if (sourceFilter.value !== 'all') {
    result = result.filter((i) => i.source_id === sourceFilter.value);
  }
  if (categoryFilter.value !== 'all') {
    const tag = categoryFilter.value;
    result = result.filter((i) => itemMatchesTag(i, tag));
  }
  if (stateFilter.value !== 'all') {
    const state = stateFilter.value;
    result = result.filter((i) => rankOf(i) === state);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((i) => {
      const info = i.info;
      const name = info?.name ?? i.id;
      const desc = info?.description ?? '';
      const tags = (info?.tags ?? []).join(' ');
      return (
        name.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        tags.toLowerCase().includes(q)
      );
    });
  }
  return result;
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

function stateOf(item: ViewItem): {
  installed: boolean;
  updatable: boolean;
  targetVersion?: string;
} {
  const local = localPool.value[item.id];
  if (!local) return { installed: false, updatable: false };
  const remoteNewer =
    item.remote &&
    versionCmp(local.version, (item.info as MarketPluginDetail)?.version ?? '') <
      0;
  return remoteNewer
    ? {
        installed: true,
        updatable: true,
        targetVersion: (item.info as MarketPluginDetail)?.version,
      }
    : { installed: true, updatable: false };
}

function rankOf(item: ViewItem): string {
  const st = stateOf(item);
  if (!st.installed) return 'uninstalled';
  return st.updatable ? 'updatable' : 'installed';
}

function sourceLabelOf(item: ViewItem): string {
  if (item.is_builtin) return '内置';
  if (item.remote) return item.source_name ?? '';
  return '第三方';
}

async function loadLocal() {
  try {
    const items = (await getPluginsApi()) as any[];
    const pool: Record<string, LocalItem> = {};
    for (const p of items ?? []) {
      pool[p.id] = {
        id: p.id,
        name: p.name ?? p.id,
        version: p.version ?? '',
        author: p.author,
        description: p.description,
        category: p.category,
        tags: p.tags,
        icon: p.icon,
        color: p.color,
        enabled: Boolean(p.enabled),
        is_builtin: Boolean(p.is_builtin),
        installed: p.installed !== false,
      };
    }
    localPool.value = pool;
  } catch {
    localPool.value = {};
  }
}

async function doSync(sourceId: string) {
  syncing.value = true;
  try {
    await syncMarketSourceApi(sourceId);
    const target = sources.value.find((s) => s.source_id === sourceId);
    if (target) {
      target.last_sync_at = new Date().toISOString();
      target.last_error = '';
    }
    return true;
  } catch (e: any) {
    notification.error(`同步失败：${sourceId}`, {
      description: e?.message ?? String(e),
    });
    return false;
  } finally {
    syncing.value = false;
  }
}

async function fetchCatalog(source: MarketSource) {
  const payload = (await getMarketCatalogPluginsApi(source.source_id)) as {
    items?: { id: string; path: string }[];
  };
  const ids = (payload?.items ?? []).map((i) => i.id);
  const entries: RemoteItem[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const info = await getMarketPluginDetailApi(source.source_id, id);
        entries.push({
          id,
          source_id: source.source_id,
          source_name: source.name,
          info,
        });
      } catch {
        /* 单条详情失败忽略 */
      }
    }),
  );
  return entries;
}

async function loadAllSources(forceSync = false) {
  const targets = sources.value.filter((s) => s.enabled);
  const list = targets.length ? targets : [...sources.value];
  if (!list.length) {
    remoteList.value = [];
    return;
  }
  loading.value = true;
  try {
    if (forceSync) {
      await Promise.all(list.map((s) => doSync(s.source_id)));
    }
    const merged = (
      await Promise.all(
        list.map((s) => fetchCatalog(s).catch(() => [] as RemoteItem[])),
      )
    ).flat();
    remoteList.value = merged;
  } finally {
    loading.value = false;
  }
}

async function fetchSources(preferId?: string) {
  try {
    const payload = (await getMarketSourcesApi()) as { items?: MarketSource[] };
    const items = payload?.items ?? [];
    sources.value = items;
    currentSourceId.value =
      preferId ??
      items.find((s) => s.enabled)?.source_id ??
      items[0]?.source_id ??
      '';
    await loadAllSources(true);
  } catch (e: any) {
    notification.error('获取市场源失败', {
      description: e?.message ?? String(e),
    });
  }
}

async function handleSyncAll() {
  await loadAllSources(true);
  notification.success('同步完成');
}

async function handleLocalInstall(item: ViewItem) {
  try {
    await enablePluginApi(item.id);
    notification.success(`安装成功：${item.info?.name ?? item.id}`);
    await loadLocal();
  } catch (e: any) {
    notification.error('安装失败', { description: e?.message ?? String(e) });
  }
}

async function handleInstallZip(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    await installPluginApi(file);
    notification.success('安装成功');
    await loadLocal();
  } catch (error: any) {
    notification.error('安装失败', { description: error?.message || '' });
  } finally {
    uploading.value = false;
    input.value = '';
  }
}

async function openInstall(item: ViewItem) {
  if (!item.source_id) return;
  auditTarget.value = { sourceId: item.source_id, pluginId: item.id };
  auditData.value = null;
  auditError.value = '';
  auditModal.value = true;
  auditLoading.value = true;
  try {
    auditData.value = await auditMarketPluginApi(item.source_id, item.id);
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
    const res = (await installMarketPluginApi(
      auditTarget.value.sourceId,
      auditTarget.value.pluginId,
      true,
    )) as { version?: string };
    notification.success(`安装成功：版本 ${res?.version ?? ''}`);
    await loadLocal();
  } catch (e: any) {
    notification.error('安装失败', { description: e?.message ?? String(e) });
  }
}

async function handleUpdate(item: ViewItem) {
  if (!item.source_id) return;
  try {
    const res = (await updateMarketPluginApi(item.source_id, item.id)) as {
      version?: string;
    };
    notification.success(`更新成功：已更新到 ${res?.version ?? ''}`);
    await loadLocal();
  } catch (e: any) {
    notification.error('更新失败', { description: e?.message ?? String(e) });
  }
}

async function quickAddOfficial() {
  const existing = sources.value.find((s) => s.url === officialUrl);
  if (existing) {
    if (existing.name !== '官方插件源') {
      try {
        await updateMarketSourceApi(existing.source_id, { name: '官方插件源' });
        existing.name = '官方插件源';
      } catch {
        /* 重命名失败不影响使用 */
      }
    }
    notification.info('官方源已添加，可直接使用');
    await fetchSources(existing.source_id);
    return;
  }
  try {
    const res = (await addMarketSourceApi({
      name: '官方插件源',
      url: officialUrl,
    })) as MarketSource;
    notification.success('已添加官方源，正在同步…');
    await fetchSources(res?.source_id);
  } catch (e: any) {
    notification.error('添加官方源失败', { description: e?.message ?? String(e) });
  }
}

async function openAddSource(prefillUrl = false) {
  addSourceName.value = '';
  addSourceUrl.value = prefillUrl ? officialUrl : '';
  addingSource.value = !prefillUrl;
  sourceModal.value = true;
}

async function confirmAddSource() {
  if (!addSourceName.value.trim() || !addSourceUrl.value.trim()) {
    notification.warning('请填写名称与 URL');
    return;
  }
  savingSource.value = true;
  try {
    const res = (await addMarketSourceApi({
      name: addSourceName.value.trim(),
      url: addSourceUrl.value.trim(),
    })) as MarketSource;
    sourceModal.value = false;
    notification.success('市场源已添加');
    await fetchSources(res?.source_id);
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
  await Promise.all([fetchSources(), loadLocal()]);
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="插件市场">
      <template #actions>
        <NButton quaternary size="small" @click="quickAddOfficial">
          <template #icon>
            <IconifyIcon icon="lucide:github" class="h-4 w-4" />
          </template>
          添加官方源
        </NButton>
        <NButton type="primary" size="small" @click="openAddSource(false)">
          <template #icon>
            <IconifyIcon icon="lucide:store" class="h-4 w-4" />
          </template>
          市场源管理
        </NButton>
        <NButton size="small" :loading="uploading" @click="fileInput?.click()">
          <template #icon>
            <IconifyIcon icon="lucide:upload" class="h-4 w-4" />
          </template>
          安装本地插件
        </NButton>
        <input
          ref="fileInput"
          type="file"
          accept=".zip"
          class="hidden"
          @change="handleInstallZip"
        />
      </template>
    </PageHeader>

    <!-- 搜索与筛选 -->
    <div class="market-filter-bar">
      <NInput
        v-model:value="searchQuery"
        placeholder="搜索插件名称、描述或标签..."
        class="market-search"
        clearable
      >
        <template #prefix>
          <IconifyIcon
            icon="lucide:search"
            class="h-4 w-4 text-muted-foreground"
          />
        </template>
      </NInput>

      <div class="market-filter-group">
        <button
          v-for="opt in stateOptions"
          :key="opt.key"
          class="market-cat-btn"
          :class="{ active: stateFilter === opt.key }"
          @click="stateFilter = opt.key"
        >
          <IconifyIcon :icon="opt.icon" class="h-3.5 w-3.5" />
          <span>{{ opt.label }}</span>
        </button>
      </div>

      <div class="market-filter-divider" />

      <div class="market-filter-group">
        <button
          v-for="opt in sourceOptions"
          :key="opt.key"
          class="market-cat-btn"
          :class="{ active: sourceFilter === opt.key }"
          @click="sourceFilter = sourceFilter === opt.key ? 'all' : opt.key"
        >
          <IconifyIcon
            v-if="opt.icon"
            :icon="opt.icon"
            class="h-3.5 w-3.5"
          />
          <span>{{ opt.label }}</span>
        </button>
        <NButton
          v-if="sources.length"
          quaternary
          size="tiny"
          circle
          title="同步全部来源"
          :loading="syncing || loading"
          @click="handleSyncAll"
        >
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="h-3.5 w-3.5" />
          </template>
        </NButton>
      </div>

      <div class="market-filter-divider" />

      <div class="market-filter-group">
        <button
          type="button"
          class="market-cat-btn"
          :class="{ active: categoryFilter === 'all' }"
          @click="categoryFilter = 'all'"
        >
          <IconifyIcon icon="lucide:layout-grid" class="h-3.5 w-3.5" />
          <span>全部分类</span>
        </button>
        <button
          v-for="tag in tagFacets"
          :key="tag"
          type="button"
          class="market-cat-btn"
          :class="{ active: categoryFilter === tag }"
          @click="categoryFilter = categoryFilter === tag ? 'all' : tag"
        >
          <span>{{ tag }}</span>
        </button>
      </div>
    </div>

    <NAlert
      v-if="sources.some((s) => s.last_error)"
      type="warning"
      :show-icon="true"
      class="market-alert"
    >
      部分市场源上次同步失败，可点击同步按钮或在市场源管理中查看详情
    </NAlert>

    <!-- 插件卡片网格 -->
    <NSpin :show="loading || syncing">
      <div
        v-if="filteredPlugins.length > 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <NCard
          v-for="item in filteredPlugins"
          :key="item.key"
          size="small"
          class="market-card"
        >
          <div class="market-card-body">
            <div class="flex items-start gap-3">
              <div
                class="market-icon"
                :style="{
                  backgroundColor: item.info?.color
                    ? `${item.info.color}18`
                    : 'hsl(var(--primary) / 8%)',
                  color: item.info?.color || 'hsl(var(--primary))',
                }"
              >
                <img
                  v-if="isRemoteIcon(item.info?.icon)"
                  :src="item.info?.icon"
                  class="h-6 w-6 object-contain"
                  @error="($event.target as HTMLElement).style.display = 'none'"
                />
                <IconifyIcon
                  v-else
                  :icon="item.info?.icon || 'lucide:puzzle'"
                  class="h-6 w-6"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="market-name truncate">{{
                    item.info?.name ?? item.id
                  }}</span>
                </div>
                <div class="market-version">
                  v{{ item.info?.version ?? '…' }}
                  <NTag
                    v-if="sourceLabelOf(item)"
                    size="tiny"
                    :bordered="false"
                    :style="sourceStyle(Boolean(item.is_builtin))"
                    class="ml-1"
                  >
                    {{ sourceLabelOf(item) }}
                  </NTag>
                </div>
              </div>
            </div>

            <div class="market-desc">
              {{ item.info?.description || '暂无描述' }}
            </div>

            <div class="market-tags">
              <NTag
                v-for="chip in tagChips(item)"
                :key="chip.key"
                size="tiny"
                :bordered="false"
                :style="tagStyle(chip.text)"
              >
                {{ chip.text }}
              </NTag>
              <NTag
                v-if="item.info?.category"
                size="tiny"
                :bordered="false"
                :style="tagStyle(categoryLabel(item.info?.category))"
              >
                {{ categoryLabel(item.info?.category) }}
              </NTag>
            </div>

            <div class="market-footer">
              <span class="market-author">
                {{ item.info?.author || item.info?.license || '未知作者' }}
              </span>
              <NButton
                v-if="!stateOf(item).installed && !item.remote"
                size="tiny"
                type="primary"
                @click="handleLocalInstall(item)"
              >
                <IconifyIcon icon="lucide:plus" class="mr-1 h-3 w-3" />
                安装
              </NButton>
              <NButton
                v-else-if="!stateOf(item).installed"
                size="tiny"
                type="primary"
                @click="openInstall(item)"
              >
                <IconifyIcon icon="lucide:download" class="mr-1 h-3 w-3" />
                安装
              </NButton>
              <NButton
                v-else-if="stateOf(item).updatable"
                size="tiny"
                type="warning"
                @click="handleUpdate(item)"
              >
                <IconifyIcon icon="lucide:refresh-cw" class="mr-1 h-3 w-3" />
                更新至 {{ stateOf(item).targetVersion }}
              </NButton>
              <NTag
                v-else
                size="tiny"
                :bordered="false"
                class="market-installed-tag"
              >
                已安装 v{{ localPool[item.id]?.version }}
              </NTag>
            </div>
          </div>
        </NCard>
      </div>

      <div v-else class="market-empty">
        <NEmpty description="暂无符合条件的插件">
          <template #icon>
            <IconifyIcon
              icon="lucide:puzzle"
              class="h-12 w-12 text-muted-foreground/40"
            />
          </template>
          <template #extra>
            <div class="mt-2">
              <NButton
                quaternary
                @click="
                  searchQuery = '';
                  categoryFilter = 'all';
                  stateFilter = 'all';
                  sourceFilter = 'all';
                "
              >
                清除筛选
              </NButton>
            </div>
          </template>
        </NEmpty>
      </div>
    </NSpin>

    <!-- 市场源管理 -->
    <NModal
      v-model:show="sourceModal"
      preset="card"
      title="市场源管理"
      style="width: 640px"
    >
      <div class="modal-section">
        <h4 class="modal-section-title">已配置的市场源</h4>
        <div v-if="sources.length" class="source-manager-list">
          <div
            v-for="src in sources"
            :key="src.source_id"
            class="source-manager-item"
          >
            <div class="source-manager-meta">
              <span class="source-manager-name">{{ src.name }}</span>
              <span class="source-manager-url">{{ src.url }}</span>
              <span v-if="src.last_error" class="source-manager-error">
                上次同步失败：{{ src.last_error }}
              </span>
            </div>
            <div class="source-manager-actions">
              <NButton
                size="tiny"
                :loading="false"
                @click="
                  async () => {
                    const ok = await doSync(src.source_id);
                    if (ok) await loadAllSources(false);
                    notification.success(`同步完成：${src.name}`);
                  }
                "
              >
                <template #icon>
                  <IconifyIcon icon="lucide:refresh-cw" class="h-3 w-3" />
                </template>
                同步
              </NButton>
              <NPopconfirm @positive-click="removeSource(src.source_id)">
                <template #trigger>
                  <NButton size="tiny" type="error" quaternary>移除</NButton>
                </template>
                移除该市场源？
              </NPopconfirm>
            </div>
          </div>
        </div>
        <div v-else class="source-manager-empty">
          暂无市场源，可添加官方源开始使用
        </div>
      </div>

      <div class="modal-section">
        <h4 class="modal-section-title">添加新源</h4>
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
      </div>
    </NModal>

    <!-- 安装预检 -->
    <NModal
      v-model:show="auditModal"
      preset="card"
      title="安装预检（SAST）"
      style="width: 640px"
    >
      <NSpin :show="auditLoading">
        <div v-if="auditData" class="audit-result">
          <NAlert
            :type="auditData?.report?.passed ? 'success' : 'error'"
            :title="auditData?.report?.passed ? '扫描通过' : '扫描发现高危问题'"
          >
            sha256：{{ auditData?.report?.sha256_ok ? '匹配' : '不匹配' }} ·
            文件数 {{ auditData?.report?.file_count }}
          </NAlert>
          <template v-if="(auditData?.report?.findings ?? []).length">
            <div
              v-for="f in auditData.report.findings"
              :key="`${f.rule}-${f.file ?? ''}`"
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
        <div v-if="auditData?.report?.passed" class="audit-actions">
          <NButton type="primary" block @click="confirmInstall">
            确认安装
          </NButton>
        </div>
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped>
.market-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.market-search {
  width: 100%;
}

.market-filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
}

.market-filter-divider {
  width: 1px;
  height: 1.5rem;
  background: hsl(var(--border));
}

.market-cat-btn {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background-color: hsl(var(--muted) / 20%);
  border: 1px solid transparent;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.market-cat-btn:hover {
  color: hsl(var(--foreground));
  background-color: hsl(var(--muted) / 35%);
}

.market-cat-btn.active {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 25%);
}

.market-alert {
  margin-bottom: 1rem;
}

.market-card {
  border: 1px solid hsl(var(--border) / 60%);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.market-card:hover {
  border-color: hsl(var(--border));
  box-shadow: 0 8px 24px hsl(var(--border) / 35%);
  transform: translateY(-3px);
}

.market-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.market-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  background: hsl(var(--primary) / 8%);
  border-radius: 0.75rem;
}

.market-name {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

.market-version {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.market-desc {
  display: -webkit-box;
  min-height: 2.5rem;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.market-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

:deep(.market-installed-tag) {
  height: 1.375rem;
  padding: 0 0.375rem;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 25%);
}

.market-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  margin-top: 0.25rem;
  border-top: 1px solid hsl(var(--border) / 40%);
}

.market-author {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.market-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
}

.modal-section + .modal-section {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid hsl(var(--border));
}

.modal-section-title {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.source-manager-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.source-manager-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) * 1px);
}

.source-manager-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.source-manager-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.source-manager-url {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.source-manager-error {
  font-size: 0.75rem;
  color: hsl(var(--warning));
}

.source-manager-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.source-manager-empty {
  padding: 1.5rem 0;
  text-align: center;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audit-result {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audit-finding {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.875rem;
  color: hsl(var(--card-foreground));
}

.audit-actions {
  margin-top: 1rem;
}

@media (min-width: 640px) {
  .market-search {
    width: 18rem;
    flex-shrink: 0;
  }
}

@media (max-width: 640px) {
  .source-manager-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .source-manager-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
