<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  type CategoryConfigItem,
  type CategoryRule,
  getCategoryConfigApi,
  getCategoryTaxonomyApi,
  updateCategoryConfigApi,
} from '#/api/modules/media';
import PageHeader from '#/components/page/PageHeader.vue';

interface TabDef {
  key: string;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: 'movie', label: '电影', icon: 'lucide:film' },
  { key: 'tv', label: '电视剧', icon: 'lucide:tv' },
  { key: 'anime', label: '动漫', icon: 'lucide:sparkles' },
];

const FIELD_OPTIONS = [
  { label: '内容类型', value: 'genre_ids' },
  { label: '语种', value: 'original_language' },
  { label: '国家/地区', value: 'origin_country' },
  { label: '制片国家', value: 'production_countries' },
];

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const taxonomy = ref<any>(null);
const items = ref<CategoryConfigItem[]>([]);
const activeTab = ref('movie');

const fieldOptions = computed(() => {
  if (taxonomy.value?.fields?.length) {
    return taxonomy.value.fields.map((item: any) => ({
      label: item.label,
      value: item.key,
    }));
  }
  return FIELD_OPTIONS;
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
  return values.map((value: string) => ({ label: value, value }));
});

const sourceOptions = computed(() => {
  const values = taxonomy.value?.sources || ['*', 'tmdb', 'douban', 'bangumi'];
  return values.map((value: string) => ({
    label: value === '*' ? '所有来源' : value,
    value,
  }));
});

function ruleList(rules: CategoryConfigItem['rules']): CategoryRule[] {
  if (Array.isArray(rules)) return rules as CategoryRule[];
  return Object.entries(rules || {}).map(([field, value]) => {
    const normalizedField =
      field === 'genres' || field === 'genre_ids'
        ? 'genre'
        : field === 'origin_country' || field === 'production_countries'
          ? 'country'
          : field;
    const operator =
      normalizedField === 'tag'
        ? 'contains_any'
        : normalizedField === 'country'
          ? 'in'
          : normalizedField === 'original_language'
            ? 'in'
            : 'contains_any';
    return {
      field: normalizedField,
      operator,
      value: String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };
  });
}

function valueOptions(field: string) {
  if (!taxonomy.value) return [];
  const source =
    field === 'genre'
      ? taxonomy.value.genres
      : field === 'original_language'
        ? taxonomy.value.languages
        : field === 'country'
          ? taxonomy.value.countries
          : null;
  if (!source) return [];
  return Object.entries(source).map(([value, item]: [string, any]) => ({
    label: item?.labels?.zh || item?.labels?.en || value,
    value,
  }));
}

const filteredItems = computed(() => {
  return items.value
    .filter((i) => i.media_type === activeTab.value)
    .toSorted((a, b) => a.sort_order - b.sort_order);
});

async function fetch() {
  loading.value = true;
  try {
    const [res, tax] = await Promise.all([
      getCategoryConfigApi(),
      getCategoryTaxonomyApi(),
    ]);
    taxonomy.value = tax;
    items.value = (res || []).map((i) => ({
      ...i,
      rules: ruleList(i.rules),
    }));
  } catch {
    message.error('加载分类配置失败');
  } finally {
    loading.value = false;
  }
}

function addCategory() {
  const tabItems = items.value.filter((i) => i.media_type === activeTab.value);
  const maxOrder = Math.max(0, ...tabItems.map((i) => i.sort_order));
  items.value.push({
    media_type: activeTab.value,
    name: '',
    sort_order: maxOrder + 1,
    is_default: false,
    rules: [],
  });
}

function removeCategory(indexInTab: number) {
  const list = filteredItems.value;
  const target = list[indexInTab];
  if (!target) return;
  const globalIndex = items.value.findIndex(
    (i) =>
      i.media_type === target.media_type && i.sort_order === target.sort_order,
  );
  if (globalIndex !== -1) {
    items.value.splice(globalIndex, 1);
  }
}

function moveUp(indexInTab: number) {
  const list = filteredItems.value;
  if (indexInTab <= 0) return;
  const curr = list[indexInTab];
  const prev = list[indexInTab - 1];
  if (!curr || !prev) return;
  const tmp = curr.sort_order;
  curr.sort_order = prev.sort_order;
  prev.sort_order = tmp;
}

function moveDown(indexInTab: number) {
  const list = filteredItems.value;
  if (indexInTab >= list.length - 1) return;
  const curr = list[indexInTab];
  const next = list[indexInTab + 1];
  if (!curr || !next) return;
  const tmp = curr.sort_order;
  curr.sort_order = next.sort_order;
  next.sort_order = tmp;
}

function addRule(item: CategoryConfigItem) {
  const rules = ruleList(item.rules);
  rules.push({ field: 'genre', operator: 'contains_any', value: [] });
  item.rules = rules;
}

function updateRuleField(
  item: CategoryConfigItem,
  index: number,
  field: string,
) {
  const rules = ruleList(item.rules);
  const current = rules[index];
  if (!current) return;
  rules[index] = { ...current, field, value: [] };
  item.rules = rules;
}

function updateRuleOperator(
  item: CategoryConfigItem,
  index: number,
  operator: string,
) {
  const rules = ruleList(item.rules);
  const current = rules[index];
  if (!current) return;
  rules[index] = { ...current, operator };
  item.rules = rules;
}

function updateRuleValue(
  item: CategoryConfigItem,
  index: number,
  value: string | string[],
) {
  const rules = ruleList(item.rules);
  const current = rules[index];
  if (!current) return;
  rules[index] = { ...current, value };
  item.rules = rules;
}

function updateRuleSource(
  item: CategoryConfigItem,
  index: number,
  source: null | string,
) {
  const rules = ruleList(item.rules);
  const current = rules[index];
  if (!current) return;
  rules[index] = { ...current, source: source === '*' ? null : source };
  item.rules = rules;
}

function removeRule(item: CategoryConfigItem, index: number) {
  const rules = ruleList(item.rules);
  rules.splice(index, 1);
  item.rules = rules;
}

async function save() {
  saving.value = true;
  try {
    const byType: Record<string, CategoryConfigItem[]> = {};
    items.value.forEach((i) => {
      const mt = i.media_type;
      byType[mt] = byType[mt] || [];
      byType[mt].push(i);
    });
    Object.values(byType).forEach((list) => {
      list.sort((a, b) => a.sort_order - b.sort_order);
      list.forEach((i, idx) => {
        i.sort_order = idx + 1;
      });
    });
    await updateCategoryConfigApi(items.value);
    message.success('保存成功');
    await fetch();
  } catch {
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(fetch);
</script>

<template>
  <div class="p-4">
    <PageHeader
      title="分类配置"
      subtitle="配置电影、电视剧、动漫的二级分类策略"
    >
      <template #actions>
        <NSpace>
          <NButton size="small" @click="fetch">
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

    <!-- 说明提示 -->
    <div
      class="mb-4 flex items-start gap-2 rounded-lg hint-bar px-3 py-2 text-xs"
    >
      <IconifyIcon icon="lucide:info" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        系统按顺序匹配分类规则，首个匹配的分类将生效；未匹配任何规则的媒体归入「默认」分类。点击
        <b>上移/下移</b>
        调整优先级。
      </span>
    </div>

    <NSpin :show="loading">
      <NTabs v-model:value="activeTab" type="line">
        <NTabPane
          v-for="tab in TABS"
          :key="tab.key"
          :name="tab.key"
          :tab="tab.label"
        >
          <!-- 头部 -->
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <IconifyIcon :icon="tab.icon" class="h-4 w-4 tab-icon" />
              <span class="text-sm font-medium">{{ tab.label }}分类</span>
              <NTag size="small" round>{{ filteredItems.length }}</NTag>
            </div>
            <NButton size="small" type="primary" @click="addCategory">
              <template #icon>
                <IconifyIcon icon="lucide:plus" class="h-3.5 w-3.5" />
              </template>
              新增分类
            </NButton>
          </div>

          <!-- 分类卡片列表 -->
          <div v-if="filteredItems.length > 0" class="category-list">
            <div
              v-for="(item, idx) in filteredItems"
              :key="`${item.media_type}-${item.sort_order}`"
              class="category-item"
            >
              <!-- 分类标题栏 -->
              <div class="category-header">
                <div class="flex items-center gap-2">
                  <span class="sort-badge">{{ idx + 1 }}</span>
                  <NInput
                    v-model:value="item.name"
                    placeholder="分类名称"
                    size="small"
                    class="name-input"
                  />
                  <NSwitch
                    v-model:value="item.is_default"
                    :checked-value="true"
                    :unchecked-value="false"
                  >
                    <template #checked>默认</template>
                    <template #unchecked>默认</template>
                  </NSwitch>
                </div>

                <div class="flex items-center gap-1">
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        size="tiny"
                        quaternary
                        :disabled="idx === 0"
                        @click="moveUp(idx)"
                      >
                        <template #icon>
                          <IconifyIcon
                            icon="lucide:arrow-up"
                            class="h-3.5 w-3.5"
                          />
                        </template>
                      </NButton>
                    </template>
                    上移
                  </NTooltip>
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        size="tiny"
                        quaternary
                        :disabled="idx === filteredItems.length - 1"
                        @click="moveDown(idx)"
                      >
                        <template #icon>
                          <IconifyIcon
                            icon="lucide:arrow-down"
                            class="h-3.5 w-3.5"
                          />
                        </template>
                      </NButton>
                    </template>
                    下移
                  </NTooltip>
                  <NButton
                    size="tiny"
                    quaternary
                    type="error"
                    @click="removeCategory(idx)"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:trash-2" class="h-3.5 w-3.5" />
                    </template>
                  </NButton>
                </div>
              </div>

              <!-- 默认分类提示 -->
              <div v-if="item.is_default" class="default-tip">
                不匹配任何规则的媒体将自动归入此类，无需配置匹配规则
              </div>

              <!-- 规则区域 -->
              <div v-else class="rule-area">
                <div
                  v-for="(rule, index) in ruleList(item.rules)"
                  :key="index"
                  class="rule-line"
                >
                  <NSelect
                    :value="rule.field"
                    :options="fieldOptions"
                    size="small"
                    class="field-select"
                    @update:value="
                      (v: string) => updateRuleField(item, index, v)
                    "
                  />
                  <NSelect
                    :value="rule.operator"
                    :options="operatorOptions"
                    size="small"
                    class="operator-select"
                    @update:value="
                      (v: string) => updateRuleOperator(item, index, v)
                    "
                  />
                  <NSelect
                    :value="rule.value"
                    :options="valueOptions(rule.field)"
                    size="small"
                    multiple
                    filterable
                    tag
                    placeholder="值"
                    class="value-select"
                    @update:value="
                      (v: string[]) => updateRuleValue(item, index, v)
                    "
                  />
                  <NSelect
                    :value="rule.source || '*'"
                    :options="sourceOptions"
                    size="small"
                    class="source-select"
                    @update:value="
                      (v: string) => updateRuleSource(item, index, v)
                    "
                  />
                  <NButton
                    size="tiny"
                    text
                    type="error"
                    class="remove-btn"
                    @click="removeRule(item, index)"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:x" class="h-3.5 w-3.5" />
                    </template>
                  </NButton>
                </div>

                <NButton
                  size="small"
                  dashed
                  class="add-rule-btn"
                  @click="addRule(item)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:plus" class="h-3.5 w-3.5" />
                  </template>
                  添加匹配条件
                </NButton>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <NEmpty v-else :description="`暂无${tab.label}分类`" class="py-8">
            <template #icon>
              <IconifyIcon
                icon="lucide:folder-open"
                class="h-10 w-10 empty-icon"
              />
            </template>
            <template #extra>
              <NButton size="small" @click="addCategory">
                <template #icon>
                  <IconifyIcon icon="lucide:plus" class="h-3.5 w-3.5" />
                </template>
                添加分类
              </NButton>
            </template>
          </NEmpty>
        </NTabPane>
      </NTabs>
    </NSpin>
  </div>
</template>

<style scoped>
.hint-bar {
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
}

.tab-icon {
  color: hsl(var(--muted-foreground));
}

.empty-icon {
  color: hsl(var(--muted-foreground) / 50%);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.category-item {
  overflow: hidden;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.875rem;
  background-color: hsl(var(--accent) / 30%);
  border-bottom: 1px solid hsl(var(--border));
}

.sort-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.375rem;
  height: 1.375rem;
  padding: 0 0.35rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: hsl(var(--primary-foreground));
  background-color: hsl(var(--primary));
  border-radius: 9999px;
}

.name-input {
  width: 12rem;
}

.default-tip {
  padding: 0.75rem 0.875rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
}

.rule-area {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
}

.rule-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
}

.rule-label {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.field-select {
  width: 7.5rem;
}

.operator-select,
.source-select {
  width: 8rem;
}

.value-select {
  flex: 1;
  min-width: 14rem;
  max-width: 24rem;
}

.remove-btn {
  margin-left: 0.25rem;
}

.add-rule-btn {
  align-self: flex-start;
  margin-top: 0.25rem;
}

@media (max-width: 640px) {
  .category-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .name-input {
    width: 8rem;
  }

  .rule-line {
    flex-direction: column;
    gap: 0.375rem;
    align-items: flex-start;
  }

  .field-select,
  .operator-select,
  .source-select,
  .value-select {
    width: 100%;
    max-width: none;
  }
}
</style>
