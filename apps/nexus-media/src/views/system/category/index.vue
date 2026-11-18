<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  useMessage,
} from 'naive-ui';

import {
  type CategoryConfigItem,
  type CategoryRule,
  getCategoryConfigApi,
  getCategoryTabsApi,
  getCategoryTaxonomyApi,
  getMediaLibraryConfigApi,
  updateCategoryConfigApi,
  updateMediaLibraryLayoutApi,
} from '#/api/modules/media';
import PageHeader from '#/components/page/PageHeader.vue';

interface TabDef {
  key: string;
  label: string;
  icon: string;
}

interface PluginTab {
  namespace: string;
  fields: string[];
  fieldLabels: Record<string, string>;
  categories: Array<{ name: string; label: string; rules: unknown }>;
}

const DEFAULT_TABS: TabDef[] = [
  { key: 'movie', label: '电影', icon: 'lucide:film' },
  { key: 'tv', label: '电视剧', icon: 'lucide:tv' },
  { key: 'anime', label: '动漫', icon: 'lucide:sparkles' },
];

const FIELD_LABELS: Record<string, string> = {
  genre: '类型',
  genre_ids: '类型',
  original_language: '语言',
  origin_country: '国家/地区',
  production_countries: '制片国家',
  country: '国家/地区',
  tag: '标签',
  content_profile: '内容画像',
  provider: '来源',
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: '等于',
  neq: '不等于',
  in: '属于',
  not_in: '不属于',
  contains: '包含',
  contains_any: '包含任意',
  startswith_any: '前缀匹配',
  regex: '正则匹配',
  exists: '存在',
};

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const taxonomy = ref<any>(null);
const tabs = ref<TabDef[]>(DEFAULT_TABS);
const pluginTabs = ref<Record<string, PluginTab>>({});
const activeTab = ref('movie');
const items = ref<CategoryConfigItem[]>([]);
const selected = ref<CategoryConfigItem | null>(null);
const layouts = ref({
  movie: 'category' as 'category' | 'flat',
  tv: 'category' as 'category' | 'flat',
  anime: 'flat' as 'category' | 'flat',
});

const activePluginTab = computed(() => pluginTabs.value[activeTab.value]);

const filteredItems = computed(() =>
  items.value
    .filter((item) => item.media_type === activeTab.value)
    .toSorted((a, b) => a.sort_order - b.sort_order),
);

const fieldOptions = computed(() => {
  const pluginFields = (activePluginTab.value?.fields || []).map((key) => ({
    label:
      activePluginTab.value?.fieldLabels?.[key] ||
      FIELD_LABELS[key.split('.').pop() || ''] ||
      key.split('.').pop() ||
      key,
    value: key,
  }));
  const taxonomyFields = (taxonomy.value?.fields || []).map((item: any) => ({
    label: item.label || FIELD_LABELS[item.key] || item.key,
    value: item.key,
  }));
  if (taxonomyFields.length > 0) return [...pluginFields, ...taxonomyFields];
  return [
    ...pluginFields,
    { label: '类型', value: 'genre' },
    { label: '语言', value: 'original_language' },
    { label: '国家/地区', value: 'country' },
    { label: '标签', value: 'tag' },
    { label: '内容画像', value: 'content_profile' },
    { label: '来源', value: 'provider' },
  ];
});

const operatorOptions = computed(() => {
  const values = taxonomy.value?.operators || [
    'eq',
    'neq',
    'in',
    'not_in',
    'contains',
    'contains_any',
    'startswith_any',
    'regex',
    'exists',
  ];
  return values.map((value: string) => ({
    label: OPERATOR_LABELS[value] || value,
    value,
  }));
});

const sourceOptions = computed(() =>
  (taxonomy.value?.sources || ['*', 'tmdb', 'douban', 'bangumi']).map(
    (value: string) => ({
      label: value === '*' ? '所有来源' : value,
      value,
    }),
  ),
);

const selectedRules = computed(() => ruleList(selected.value?.rules));

function ruleList(
  rules: CategoryConfigItem['rules'] | undefined,
): CategoryRule[] {
  if (Array.isArray(rules)) return rules as CategoryRule[];
  return Object.entries(rules || {}).map(([field, value]) => {
    const normalizedField =
      field === 'genres' || field === 'genre_ids'
        ? 'genre'
        : field === 'origin_country' || field === 'production_countries'
          ? 'country'
          : field;
    return {
      field: normalizedField,
      operator:
        normalizedField === 'original_language' || normalizedField === 'country'
          ? 'in'
          : 'contains_any',
      value: String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };
  });
}

function mapValue(field: string, value: string): string {
  const raw = String(value);
  const lower = raw.toLowerCase();
  const genres = taxonomy.value?.genres || {};
  if (field === 'genre') {
    for (const [key, item] of Object.entries(genres) as [string, any][]) {
      const ids = [...(item.tmdb?.movie || []), ...(item.tmdb?.tv || [])].map(
        String,
      );
      if (ids.includes(raw)) return key;
    }
  }
  const source =
    field === 'original_language'
      ? taxonomy.value?.languages
      : field === 'country'
        ? taxonomy.value?.countries
        : null;
  if (source) {
    for (const [key, item] of Object.entries(source) as [string, any][]) {
      const aliases = [key, ...(item.aliases || [])].map((v) =>
        String(v).toLowerCase(),
      );
      if (aliases.includes(lower)) return key;
    }
  }
  return raw;
}

function normalizeRules(list: CategoryConfigItem[]) {
  for (const item of list) {
    item.rules = ruleList(item.rules).map((rule) => ({
      ...rule,
      value: Array.isArray(rule.value)
        ? rule.value.map((value) => mapValue(rule.field, String(value)))
        : mapValue(rule.field, String(rule.value)),
    }));
  }
}

function valueOptions(field: string) {
  const source =
    field === 'genre'
      ? taxonomy.value?.genres
      : field === 'original_language'
        ? taxonomy.value?.languages
        : field === 'country'
          ? taxonomy.value?.countries
          : null;
  if (!source) return [];
  return Object.entries(source).map(([value, item]: [string, any]) => ({
    label: item?.labels?.zh || item?.labels?.en || value,
    value,
  }));
}

function valueLabel(field: string, value: string): string {
  return (
    valueOptions(field).find((item) => item.value === value)?.label || value
  );
}

function fieldLabel(field: string): string {
  return (
    activePluginTab.value?.fieldLabels?.[field] ||
    FIELD_LABELS[field] ||
    FIELD_LABELS[field.split('.').pop() || ''] ||
    field.split('.').pop() ||
    field
  );
}

function ruleSummary(): string {
  const rules = selectedRules.value;
  if (rules.length === 0) return '未设置条件，此分类不会自动命中。';
  const clauses = rules.map((rule) => {
    const field = fieldLabel(rule.field);
    const operator = OPERATOR_LABELS[rule.operator] || rule.operator;
    if (rule.operator === 'exists') return `${field} 存在`;
    const values = Array.isArray(rule.value) ? rule.value : [rule.value];
    const text = values
      .filter((value) => value !== '')
      .map((value) => valueLabel(rule.field, String(value)))
      .join('、');
    return `${field} ${operator} ${text || '未填写'}`;
  });
  return `当 ${clauses.join('，且 ')} 时命中。`;
}

function selectFirst() {
  selected.value = filteredItems.value[0] || null;
}

async function fetch() {
  loading.value = true;
  try {
    const [config, tax, tabPayload, libraryConfig] = await Promise.all([
      getCategoryConfigApi(),
      getCategoryTaxonomyApi(),
      getCategoryTabsApi(),
      getMediaLibraryConfigApi(),
    ]);
    taxonomy.value = tax;
    layouts.value = {
      movie: libraryConfig.movie_layout || 'category',
      tv: libraryConfig.tv_layout || 'category',
      anime: libraryConfig.anime_layout || 'flat',
    };
    tabs.value = (tabPayload || []).map((tab: any) => ({
      key: tab.key,
      label: tab.label,
      icon:
        DEFAULT_TABS.find((item) => item.key === tab.key)?.icon ||
        'lucide:layers',
    }));
    pluginTabs.value = Object.fromEntries(
      (tabPayload || [])
        .filter((tab: any) => tab.namespace)
        .map((tab: any) => [
          tab.key,
          {
            namespace: tab.namespace,
            fields: tab.fields || [],
            fieldLabels: tab.field_labels || {},
            categories: tab.categories || [],
          },
        ]),
    );
    items.value = (config || []).map((item) => ({
      ...item,
      rules: ruleList(item.rules),
    }));
    for (const tab of tabPayload || []) {
      if (
        !tab.namespace ||
        items.value.some((item) => item.media_type === tab.key)
      )
        continue;
      (tab.categories || []).forEach((category: any, index: number) => {
        items.value.push({
          media_type: tab.key,
          name: category.label || category.name,
          sort_order: index + 1,
          is_default: false,
          enabled: category.enabled !== false,
          rules: ruleList(category.rules),
        });
      });
    }
    normalizeRules(items.value);
    if (!tabs.value.some((tab) => tab.key === activeTab.value))
      activeTab.value = 'movie';
    selectFirst();
  } catch {
    message.error('加载分类配置失败');
  } finally {
    loading.value = false;
  }
}

function addCategory() {
  const maxOrder = Math.max(
    0,
    ...filteredItems.value.map((item) => item.sort_order),
  );
  const item: CategoryConfigItem = {
    media_type: activeTab.value,
    name: '新分类',
    sort_order: maxOrder + 1,
    is_default: false,
    enabled: true,
    rules: [],
  };
  items.value.push(item);
  selected.value = item;
}

function removeCategory() {
  if (!selected.value) return;
  const index = items.value.indexOf(selected.value);
  if (index >= 0) items.value.splice(index, 1);
  selectFirst();
}

function moveCategory(offset: number) {
  if (!selected.value) return;
  const list = filteredItems.value;
  const index = list.indexOf(selected.value);
  const target = index + offset;
  if (target < 0 || target >= list.length) return;
  const other = list[target];
  if (!other) return;
  const currentOrder = selected.value.sort_order;
  selected.value.sort_order = other.sort_order;
  other.sort_order = currentOrder;
}

function addRule() {
  if (!selected.value) return;
  selected.value.rules = [
    ...selectedRules.value,
    {
      field: activePluginTab.value
        ? activePluginTab.value.fields[0] || 'genre'
        : 'genre',
      operator: 'contains_any',
      value: [],
    },
  ];
}

function updateRule(index: number, patch: Partial<CategoryRule>) {
  if (!selected.value) return;
  const rules = [...selectedRules.value];
  rules[index] = { ...rules[index], ...patch } as CategoryRule;
  selected.value.rules = rules;
}

function removeRule(index: number) {
  if (!selected.value) return;
  selected.value.rules = selectedRules.value.filter(
    (_, current) => current !== index,
  );
}

function updateRuleValue(index: number, value: string | string[]) {
  updateRule(index, { value });
}

async function save() {
  saving.value = true;
  try {
    const grouped = new Map<string, CategoryConfigItem[]>();
    for (const item of items.value) {
      const list = grouped.get(item.media_type) || [];
      list.push(item);
      grouped.set(item.media_type, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order);
      list.forEach((item, index) => {
        item.sort_order = index + 1;
      });
    }
    await Promise.all([
      updateCategoryConfigApi(items.value),
      updateMediaLibraryLayoutApi({
        movie_layout: layouts.value.movie,
        tv_layout: layouts.value.tv,
        anime_layout: layouts.value.anime,
      }),
    ]);
    message.success('分类与目录结构已保存');
    await fetch();
  } catch {
    message.error('保存分类配置失败');
  } finally {
    saving.value = false;
  }
}

watch(activeTab, selectFirst);
watch(
  filteredItems,
  (list) => {
    if (selected.value && list.includes(selected.value)) return;
    selected.value = list[0] || null;
  },
  { deep: false },
);

onMounted(fetch);
</script>

<template>
  <div class="category-page">
    <PageHeader
      title="分类配置"
      subtitle="按顺序匹配分类规则；未命中任何规则的媒体归入默认分类。"
    >
      <template #actions>
        <NSpace>
          <NButton size="small" :loading="loading" @click="fetch">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            刷新
          </NButton>
          <NButton type="primary" size="small" :loading="saving" @click="save">
            <template #icon>
              <IconifyIcon icon="lucide:save" class="h-4 w-4" />
            </template>
            保存
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <div class="layout-panel">
      <div class="layout-intro">
        <div class="layout-title">目录结构</div>
        <div class="layout-desc">
          电影、电视剧默认分类子目录，动漫默认平铺；分类为空时回退平铺。
        </div>
      </div>
      <div class="layout-actions">
        <div
          v-for="item in [
            { key: 'movie', label: '电影', icon: 'lucide:film' },
            { key: 'tv', label: '电视剧', icon: 'lucide:tv' },
            { key: 'anime', label: '动漫', icon: 'lucide:sparkles' },
          ]"
          :key="item.key"
          class="layout-group"
        >
          <div class="layout-label">
            <IconifyIcon :icon="item.icon" class="h-3.5 w-3.5" />
            {{ item.label }}
          </div>
          <div class="layout-segment">
            <button
              type="button"
              class="layout-segment-item"
              :class="[
                layouts[item.key as keyof typeof layouts] === 'flat'
                  ? 'is-active'
                  : '',
              ]"
              @click="layouts[item.key as keyof typeof layouts] = 'flat'"
            >
              平铺
            </button>
            <button
              type="button"
              class="layout-segment-item"
              :class="[
                layouts[item.key as keyof typeof layouts] === 'category'
                  ? 'is-active'
                  : '',
              ]"
              @click="layouts[item.key as keyof typeof layouts] = 'category'"
            >
              分类子目录
            </button>
          </div>
        </div>
      </div>
    </div>

    <NSpin :show="loading">
      <div class="media-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="media-tab"
          :class="[activeTab === tab.key ? 'is-active' : '']"
          @click="activeTab = tab.key"
        >
          <IconifyIcon :icon="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </button>
      </div>

      <div class="category-shell">
        <aside class="category-rail">
          <div class="rail-head">
            <span>分类列表</span>
            <NTag size="small" round>{{ filteredItems.length }}</NTag>
          </div>
          <div class="rail-list">
            <button
              v-for="item in filteredItems"
              :key="`${item.media_type}-${item.sort_order}`"
              type="button"
              class="rail-item"
              :class="[selected === item ? 'is-active' : '']"
              @click="selected = item"
            >
              <span class="rail-order">{{ item.sort_order }}</span>
              <span class="rail-name">{{ item.name || '未命名分类' }}</span>
              <NTag v-if="item.is_default" size="tiny" round type="success">
                默认
              </NTag>
              <NTag v-if="item.enabled === false" size="tiny" round>停用</NTag>
            </button>
            <NEmpty
              v-if="filteredItems.length === 0"
              description="暂无分类"
              class="rail-empty"
            />
          </div>
          <NButton dashed block size="small" @click="addCategory">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="h-3.5 w-3.5" />
            </template>
            新增分类
          </NButton>
        </aside>

        <section v-if="selected" class="category-panel">
          <div class="panel-head">
            <div class="panel-title">
              <NInput
                v-model:value="selected.name"
                placeholder="分类名称"
                class="name-input"
              />
              <label class="toggle-field">
                <span>默认分类</span>
                <NSwitch v-model:value="selected.is_default" size="small" />
              </label>
              <label class="toggle-field">
                <span>启用</span>
                <NSwitch v-model:value="selected.enabled" size="small" />
              </label>
            </div>
            <div class="panel-actions">
              <NButton
                size="tiny"
                quaternary
                :disabled="filteredItems[0] === selected"
                @click="moveCategory(-1)"
              >
                上移
              </NButton>
              <NButton
                size="tiny"
                quaternary
                :disabled="filteredItems.at(-1) === selected"
                @click="moveCategory(1)"
              >
                下移
              </NButton>
              <NButton
                size="tiny"
                quaternary
                type="error"
                @click="removeCategory"
              >
                删除
              </NButton>
            </div>
          </div>

          <div v-if="selected.is_default" class="default-state">
            <IconifyIcon icon="lucide:inbox" class="h-5 w-5" />
            <div>
              <div class="default-title">默认兜底分类</div>
              <div class="default-desc">
                未命中其他规则的媒体会自动归入此分类。
              </div>
            </div>
          </div>

          <template v-else>
            <div class="rule-head">
              <div>
                <div class="section-title">匹配条件</div>
                <div class="section-desc">
                  多个条件同时成立时才命中；按列表顺序取第一个命中的分类。
                </div>
              </div>
              <NButton size="small" dashed @click="addRule">
                <template #icon>
                  <IconifyIcon icon="lucide:plus" class="h-3.5 w-3.5" />
                </template>
                添加条件
              </NButton>
            </div>

            <div class="rule-list">
              <div
                v-for="(rule, index) in selectedRules"
                :key="index"
                class="rule-card"
              >
                <div class="rule-grid">
                  <NSelect
                    :value="rule.field"
                    :options="fieldOptions"
                    size="small"
                    placeholder="字段"
                    @update:value="
                      (value: string) =>
                        updateRule(index, { field: value, value: [] })
                    "
                  />
                  <NSelect
                    :value="rule.operator"
                    :options="operatorOptions"
                    size="small"
                    placeholder="操作符"
                    @update:value="
                      (value: string) => updateRule(index, { operator: value })
                    "
                  />
                  <NSelect
                    :value="rule.source || '*'"
                    :options="sourceOptions"
                    size="small"
                    placeholder="来源"
                    @update:value="
                      (value: string) =>
                        updateRule(index, {
                          source: value === '*' ? null : value,
                        })
                    "
                  />
                  <NInput
                    v-if="rule.operator === 'regex'"
                    :value="String(rule.value || '')"
                    size="small"
                    placeholder="正则表达式"
                    @update:value="
                      (value: string) => updateRuleValue(index, value)
                    "
                  />
                  <NSelect
                    v-else-if="rule.operator !== 'exists'"
                    :value="
                      Array.isArray(rule.value)
                        ? rule.value
                        : [String(rule.value || '')]
                    "
                    :options="valueOptions(rule.field)"
                    size="small"
                    multiple
                    filterable
                    tag
                    placeholder="选择或输入值"
                    @update:value="
                      (value: string[]) => updateRuleValue(index, value)
                    "
                  />
                  <div v-else class="exists-placeholder">无需填写值</div>
                  <NButton
                    size="tiny"
                    quaternary
                    type="error"
                    class="rule-remove"
                    @click="removeRule(index)"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:x" class="h-3.5 w-3.5" />
                    </template>
                  </NButton>
                </div>
              </div>
              <div v-if="selectedRules.length === 0" class="rule-empty">
                还没有匹配条件。
              </div>
            </div>

            <div class="rule-preview">
              <IconifyIcon icon="lucide:info" class="h-4 w-4" />
              <span>{{ ruleSummary() }}</span>
            </div>
          </template>
        </section>
        <section v-else class="category-panel empty-panel">
          <NEmpty description="选择一个分类开始配置">
            <template #extra>
              <NButton size="small" @click="addCategory">新增分类</NButton>
            </template>
          </NEmpty>
        </section>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.category-page {
  padding: 1rem;
}

.media-tabs {
  display: flex;
  gap: 0.35rem;
  padding: 0.3rem;
  margin-bottom: 0.85rem;
  overflow-x: auto;
  background: hsl(var(--accent) / 45%);
  border-radius: 0.65rem;
}

.media-tab {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.42rem 0.85rem;
  font: inherit;
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 0.45rem;
}

.media-tab.is-active {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  box-shadow: 0 1px 2px hsl(var(--foreground) / 8%);
}

.category-shell {
  display: grid;
  grid-template-columns: minmax(12rem, 15rem) minmax(0, 1fr);
  gap: 0.85rem;
  align-items: start;
}

.category-rail,
.category-panel {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.8rem;
}

.category-rail {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.6rem;
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.35rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.rail-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.rail-item {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  width: 100%;
  padding: 0.5rem;
  font: inherit;
  font-size: 0.82rem;
  color: hsl(var(--muted-foreground));
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 0.5rem;
}

.rail-item:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent) / 55%);
}

.rail-item.is-active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  box-shadow: inset 2px 0 0 hsl(var(--primary));
}

.rail-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  font-size: 0.68rem;
  color: hsl(var(--muted-foreground));
}

.rail-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-empty {
  padding: 1rem 0;
}

.category-panel {
  min-height: 0;
  padding: 1rem;
}

.panel-head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid hsl(var(--border));
}

.panel-title {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
}

.toggle-field {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.28rem 0.5rem;
  font-size: 0.76rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 0.45rem;
}

.name-input {
  width: min(18rem, 55vw);
}

.panel-actions {
  display: flex;
  gap: 0.15rem;
}

.default-state {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  padding: 1.25rem;
  margin-top: 1rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent) / 35%);
  border: 1px dashed hsl(var(--border));
  border-radius: 0.6rem;
}

.default-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.default-desc {
  margin-top: 0.2rem;
  font-size: 0.78rem;
}

.rule-head {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin: 1rem 0 0.75rem;
}

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
}

.section-desc {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.rule-card {
  padding: 0.55rem;
  background: hsl(var(--accent) / 25%);
  border: 1px solid hsl(var(--border));
  border-radius: 0.6rem;
}

.rule-grid {
  display: grid;
  grid-template-columns:
    minmax(7rem, 0.8fr) minmax(7rem, 0.8fr) minmax(6rem, 0.7fr)
    minmax(12rem, 1.8fr) auto;
  gap: 0.45rem;
  align-items: center;
}

.exists-placeholder {
  padding: 0 0.5rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.rule-remove {
  justify-self: end;
}

.rule-empty {
  padding: 1rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
  border: 1px dashed hsl(var(--border));
  border-radius: 0.55rem;
}

.rule-preview {
  display: flex;
  gap: 0.45rem;
  align-items: flex-start;
  padding: 0.65rem 0.75rem;
  margin-top: 0.85rem;
  font-size: 0.78rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--primary) / 6%);
  border: 1px solid hsl(var(--primary) / 20%);
  border-radius: 0.55rem;
}

.empty-panel {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 820px) {
  .category-page {
    padding: 0.7rem;
  }

  .category-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .category-rail {
    position: static;
  }

  .rail-list {
    flex-direction: row;
    overflow-x: auto;
  }

  .rail-item {
    flex: 0 0 auto;
    width: auto;
  }

  .rail-empty {
    width: 100%;
  }

  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .name-input {
    width: 100%;
  }

  .rule-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  }

  .rule-grid > :nth-child(3) {
    grid-column: 1 / 3;
  }

  .rule-grid > :nth-child(4) {
    grid-column: 1 / 4;
  }

  .rule-grid > :nth-child(5) {
    grid-row: 1;
    grid-column: 3;
  }
}

.layout-panel {
  display: grid;
  grid-template-columns: minmax(12rem, 0.7fr) minmax(0, 1.6fr);
  gap: 1rem;
  padding: 0.9rem 1rem;
  margin-bottom: 1rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
}

.layout-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.layout-desc {
  max-width: 34ch;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.layout-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: flex-end;
  justify-content: flex-end;
}

.layout-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.layout-label {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.layout-segment {
  display: inline-flex;
  gap: 0.1rem;
  padding: 0.2rem;
  background: hsl(var(--accent) / 45%);
  border-radius: 0.5rem;
}

.layout-segment-item {
  padding: 0.32rem 0.6rem;
  font: inherit;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 0.35rem;
}

.layout-segment-item.is-active {
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  box-shadow: 0 1px 2px hsl(var(--foreground) / 8%);
}

@media (max-width: 900px) {
  .layout-panel {
    grid-template-columns: minmax(0, 1fr);
  }

  .layout-actions {
    justify-content: flex-start;
  }
}
</style>
