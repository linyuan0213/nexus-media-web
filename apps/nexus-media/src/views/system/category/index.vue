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
  getCategoryConfigApi,
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

const VALUE_OPTIONS: Record<string, { label: string; value: string }[]> = {
  genre_ids: [
    { label: '动画', value: '16' },
    { label: '动作', value: '28' },
    { label: '冒险', value: '12' },
    { label: '喜剧', value: '35' },
    { label: '犯罪', value: '80' },
    { label: '纪录片', value: '99' },
    { label: '剧情', value: '18' },
    { label: '家庭', value: '10751' },
    { label: '奇幻', value: '14' },
    { label: '历史', value: '36' },
    { label: '恐怖', value: '27' },
    { label: '音乐', value: '10402' },
    { label: '悬疑', value: '9648' },
    { label: '爱情', value: '10749' },
    { label: '科幻', value: '878' },
    { label: '电视电影', value: '10770' },
    { label: '惊悚', value: '53' },
    { label: '战争', value: '10752' },
    { label: '西部', value: '37' },
    { label: '儿童', value: '10762' },
    { label: '真人秀', value: '10764' },
    { label: '脱口秀', value: '10767' },
  ],
  original_language: [
    { label: '中文', value: 'zh' },
    { label: '粤语', value: 'cn' },
    { label: '英语', value: 'en' },
    { label: '日语', value: 'ja' },
    { label: '韩语 / 朝鲜语', value: 'ko' },
    { label: '法语', value: 'fr' },
    { label: '德语', value: 'de' },
    { label: '西班牙语', value: 'es' },
    { label: '意大利语', value: 'it' },
    { label: '俄语', value: 'ru' },
    { label: '葡萄牙语', value: 'pt' },
    { label: '阿拉伯语', value: 'ar' },
    { label: '印地语', value: 'hi' },
    { label: '泰语', value: 'th' },
    { label: '越南语', value: 'vi' },
    { label: '藏语', value: 'bo' },
    { label: '壮语', value: 'za' },
    { label: '南非语', value: 'af' },
    { label: '阿塞拜疆语', value: 'az' },
    { label: '比利时语', value: 'be' },
    { label: '保加利亚语', value: 'bg' },
    { label: '加泰隆语', value: 'ca' },
    { label: '捷克语', value: 'cs' },
    { label: '威尔士语', value: 'cy' },
    { label: '丹麦语', value: 'da' },
    { label: '第维埃语', value: 'dv' },
    { label: '希腊语', value: 'el' },
    { label: '世界语', value: 'eo' },
    { label: '爱沙尼亚语', value: 'et' },
    { label: '巴士克语', value: 'eu' },
    { label: '法斯语', value: 'fa' },
    { label: '芬兰语', value: 'fi' },
    { label: '法罗语', value: 'fo' },
    { label: '加里西亚语', value: 'gl' },
    { label: '古吉拉特语', value: 'gu' },
    { label: '希伯来语', value: 'he' },
    { label: '克罗地亚语', value: 'hr' },
    { label: '匈牙利语', value: 'hu' },
    { label: '亚美尼亚语', value: 'hy' },
    { label: '印度尼西亚语', value: 'id' },
    { label: '冰岛语', value: 'is' },
    { label: '格鲁吉亚语', value: 'ka' },
    { label: '哈萨克语', value: 'kk' },
    { label: '卡纳拉语', value: 'kn' },
    { label: '孔卡尼语', value: 'kok' },
    { label: '吉尔吉斯语', value: 'ky' },
    { label: '立陶宛语', value: 'lt' },
    { label: '拉脱维亚语', value: 'lv' },
    { label: '毛利语', value: 'mi' },
    { label: '马其顿语', value: 'mk' },
    { label: '蒙古语', value: 'mn' },
    { label: '马拉地语', value: 'mr' },
    { label: '马来语', value: 'ms' },
    { label: '马耳他语', value: 'mt' },
    { label: '挪威语(伯克梅尔)', value: 'nb' },
    { label: '荷兰语', value: 'nl' },
    { label: '北梭托语', value: 'ns' },
    { label: '旁遮普语', value: 'pa' },
    { label: '波兰语', value: 'pl' },
    { label: '克丘亚语', value: 'qu' },
    { label: '罗马尼亚语', value: 'ro' },
    { label: '梵文', value: 'sa' },
    { label: '北萨摩斯语', value: 'se' },
    { label: '斯洛伐克语', value: 'sk' },
    { label: '斯洛文尼亚语', value: 'sl' },
    { label: '阿尔巴尼亚语', value: 'sq' },
    { label: '瑞典语', value: 'sv' },
    { label: '斯瓦希里语', value: 'sw' },
    { label: '叙利亚语', value: 'syr' },
    { label: '泰米尔语', value: 'ta' },
    { label: '泰卢固语', value: 'te' },
    { label: '塔加路语', value: 'tl' },
    { label: '茨瓦纳语', value: 'tn' },
    { label: '土耳其语', value: 'tr' },
    { label: '宗加语', value: 'ts' },
    { label: '鞑靼语', value: 'tt' },
    { label: '乌克兰语', value: 'uk' },
    { label: '乌都语', value: 'ur' },
    { label: '乌兹别克语', value: 'uz' },
    { label: '班图语', value: 'xh' },
    { label: '祖鲁语', value: 'zu' },
  ],
  origin_country: [
    { label: '中国', value: 'CN' },
    { label: '美国', value: 'US' },
    { label: '日本', value: 'JP' },
    { label: '韩国 / 南朝鲜', value: 'KR' },
    { label: '朝鲜 / 北朝鲜', value: 'KP' },
    { label: '英国(GB)', value: 'GB' },
    { label: '英国(UK, 兼容)', value: 'UK' },
    { label: '法国', value: 'FR' },
    { label: '德国', value: 'DE' },
    { label: '印度', value: 'IN' },
    { label: '泰国', value: 'TH' },
    { label: '俄罗斯', value: 'RU' },
    { label: '意大利', value: 'IT' },
    { label: '西班牙', value: 'ES' },
    { label: '加拿大', value: 'CA' },
    { label: '澳大利亚', value: 'AU' },
    { label: '巴西', value: 'BR' },
    { label: '墨西哥', value: 'MX' },
    { label: '中国台湾', value: 'TW' },
    { label: '中国香港', value: 'HK' },
    { label: '阿根廷', value: 'AR' },
    { label: '比利时', value: 'BE' },
    { label: '瑞士', value: 'CH' },
    { label: '智利', value: 'CL' },
    { label: '哥伦比亚', value: 'CO' },
    { label: '捷克', value: 'CZ' },
    { label: '丹麦', value: 'DK' },
    { label: '埃及', value: 'EG' },
    { label: '希腊', value: 'GR' },
    { label: '以色列', value: 'IL' },
    { label: '伊拉克', value: 'IQ' },
    { label: '伊朗', value: 'IR' },
    { label: '缅甸', value: 'MM' },
    { label: '澳门', value: 'MO' },
    { label: '马来西亚', value: 'MY' },
    { label: '荷兰', value: 'NL' },
    { label: '挪威', value: 'NO' },
    { label: '菲律宾', value: 'PH' },
    { label: '巴基斯坦', value: 'PK' },
    { label: '波兰', value: 'PL' },
    { label: '葡萄牙', value: 'PT' },
    { label: '沙特阿拉伯', value: 'SA' },
    { label: '新加坡', value: 'SG' },
    { label: '瑞典', value: 'SE' },
    { label: '土耳其', value: 'TR' },
    { label: '越南', value: 'VN' },
    { label: '新西兰', value: 'NZ' },
    { label: '老挝', value: 'LA' },
    { label: '蒙古', value: 'MN' },
  ],
  production_countries: [
    { label: '中国', value: 'CN' },
    { label: '美国', value: 'US' },
    { label: '日本', value: 'JP' },
    { label: '韩国 / 南朝鲜', value: 'KR' },
    { label: '朝鲜 / 北朝鲜', value: 'KP' },
    { label: '英国(GB)', value: 'GB' },
    { label: '英国(UK, 兼容)', value: 'UK' },
    { label: '法国', value: 'FR' },
    { label: '德国', value: 'DE' },
    { label: '印度', value: 'IN' },
    { label: '泰国', value: 'TH' },
    { label: '俄罗斯', value: 'RU' },
    { label: '意大利', value: 'IT' },
    { label: '西班牙', value: 'ES' },
    { label: '加拿大', value: 'CA' },
    { label: '澳大利亚', value: 'AU' },
    { label: '巴西', value: 'BR' },
    { label: '墨西哥', value: 'MX' },
    { label: '中国台湾', value: 'TW' },
    { label: '中国香港', value: 'HK' },
    { label: '阿根廷', value: 'AR' },
    { label: '比利时', value: 'BE' },
    { label: '瑞士', value: 'CH' },
    { label: '智利', value: 'CL' },
    { label: '哥伦比亚', value: 'CO' },
    { label: '捷克', value: 'CZ' },
    { label: '丹麦', value: 'DK' },
    { label: '埃及', value: 'EG' },
    { label: '希腊', value: 'GR' },
    { label: '以色列', value: 'IL' },
    { label: '伊拉克', value: 'IQ' },
    { label: '伊朗', value: 'IR' },
    { label: '缅甸', value: 'MM' },
    { label: '澳门', value: 'MO' },
    { label: '马来西亚', value: 'MY' },
    { label: '荷兰', value: 'NL' },
    { label: '挪威', value: 'NO' },
    { label: '菲律宾', value: 'PH' },
    { label: '巴基斯坦', value: 'PK' },
    { label: '波兰', value: 'PL' },
    { label: '葡萄牙', value: 'PT' },
    { label: '沙特阿拉伯', value: 'SA' },
    { label: '新加坡', value: 'SG' },
    { label: '瑞典', value: 'SE' },
    { label: '土耳其', value: 'TR' },
    { label: '越南', value: 'VN' },
    { label: '新西兰', value: 'NZ' },
    { label: '老挝', value: 'LA' },
    { label: '蒙古', value: 'MN' },
  ],
};

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const items = ref<CategoryConfigItem[]>([]);
const activeTab = ref('movie');

const filteredItems = computed(() => {
  return items.value
    .filter((i) => i.media_type === activeTab.value)
    .toSorted((a, b) => a.sort_order - b.sort_order);
});

async function fetch() {
  loading.value = true;
  try {
    const res = await getCategoryConfigApi();
    items.value = (res || []).map((i) => ({
      ...i,
      rules: i.rules || {},
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
    rules: {},
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
  const usedFields = Object.keys(item.rules);
  const nextField =
    FIELD_OPTIONS.find((f) => !usedFields.includes(f.value))?.value ||
    'genre_ids';
  item.rules = { ...item.rules, [nextField]: '' };
}

function updateRuleField(
  item: CategoryConfigItem,
  oldField: string,
  newField: string,
) {
  const next = { ...item.rules };
  delete next[oldField];
  next[newField] = '';
  item.rules = next;
}

function updateRuleValue(
  item: CategoryConfigItem,
  field: string,
  values: string[],
) {
  item.rules = { ...item.rules, [field]: values.join(',') };
}

function removeRule(item: CategoryConfigItem, field: string) {
  const next = { ...item.rules };
  delete next[field];
  item.rules = next;
}

function getRuleValues(_field: string, raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');
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
                  v-for="(_, field) in item.rules"
                  :key="field"
                  class="rule-line"
                >
                  <div class="rule-label">当</div>

                  <NSelect
                    :value="field"
                    :options="FIELD_OPTIONS"
                    size="small"
                    class="field-select"
                    @update:value="
                      (v: string) => updateRuleField(item, field, v)
                    "
                  />

                  <div class="rule-label">为以下任意值时</div>

                  <NSelect
                    :value="getRuleValues(field, item.rules[field] || '')"
                    :options="VALUE_OPTIONS[field] || []"
                    size="small"
                    multiple
                    filterable
                    tag
                    placeholder="请选择"
                    class="value-select"
                    @update:value="
                      (v: string[]) => updateRuleValue(item, field, v)
                    "
                  />

                  <NButton
                    size="tiny"
                    text
                    type="error"
                    class="remove-btn"
                    @click="removeRule(item, field)"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:x" class="h-3.5 w-3.5" />
                    </template>
                  </NButton>
                </div>

                <NButton
                  v-if="Object.keys(item.rules).length < FIELD_OPTIONS.length"
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
  .value-select {
    width: 100%;
    max-width: none;
  }
}
</style>
