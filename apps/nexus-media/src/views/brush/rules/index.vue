<script lang="ts" setup>
import type { BrushApi } from '#/api/modules/brush';

import { computed, h, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NDivider,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSwitch,
  NTooltip,
} from 'naive-ui';

import {
  deleteBrushRuleApi,
  getBrushRulesApi,
  saveBrushRuleApi,
} from '#/api/modules/brush';
import RangeField from '#/components/brush/RangeField.vue';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useAppNotification } from '#/utils/notify';

const notification = useAppNotification();
const rules = ref<BrushApi.BrushRule[]>([]);
const loading = ref(false);
const modalShow = ref(false);
const editingRule = ref<BrushApi.BrushRule | null>(null);
const activeType = ref<'remove' | 'rss' | 'stop'>('rss');

function ruleActualType(rule: BrushApi.BrushRule): string {
  const raw = (rule as any).type || 'all';
  if (raw !== 'all') return raw;
  const rss = parseObj(rule.rss_rule);
  const remove = parseObj(rule.remove_rule);
  const stop = parseObj(rule.stop_rule);
  if (rss && Object.keys(rss).length > 0) return 'rss';
  if (remove && Object.keys(remove).length > 0) return 'remove';
  if (stop && Object.keys(stop).length > 0) return 'stop';
  return 'rss';
}

const filteredRules = computed(() =>
  rules.value.filter((r) => ruleActualType(r) === activeType.value),
);

const typeTabs: Array<{
  icon: string;
  key: 'remove' | 'rss' | 'stop';
  label: string;
}> = [
  { key: 'rss', label: '选种规则', icon: 'lucide:filter' },
  { key: 'remove', label: '删种规则', icon: 'lucide:trash-2' },
  { key: 'stop', label: '停种规则', icon: 'lucide:octagon-pause' },
];

const form = ref({
  id: undefined as number | undefined,
  name: '',
  type: 'rss',
  free: '',
  hr: '',
  exclude_subscribe: false,
  dlcount: '',
  include: '',
  exclude: '',
  upspeed: '',
  downspeed: '',
  torrent_size: '',
  peercount: '',
  pubdate: '',
  mode: 'or',
  seedtime: '',
  hr_seedtime: '',
  seedratio: '',
  seedsize: '',
  dltime: '',
  avg_upspeed: '',
  iatime: '',
  pending_time: '',
  freespace: '',
  freestatus: false,
  stopfree: false,
});

const freeOptions = [
  { label: '全部', value: '' },
  { label: '普通', value: 'NORMAL' },
  { label: '免费', value: 'FREE' },
  { label: '2X免费', value: '2XFREE' },
];

const hrOptions = [
  { label: '全部', value: '' },
  { label: '排除HR', value: 'HR' },
];

const modeOptions = [
  { label: '或', value: 'or' },
  { label: '与', value: 'and' },
];

const ignoreGtOptions = [
  { label: '忽略', value: '' },
  { label: '大于', value: 'gt' },
];

const ignoreLtOptions = [
  { label: '忽略', value: '' },
  { label: '小于', value: 'lt' },
];

const allGtLtBwOptions = [
  { label: '全部', value: '' },
  { label: '大于', value: 'gt' },
  { label: '小于', value: 'lt' },
  { label: '介于', value: 'bw' },
];

async function fetchRules() {
  loading.value = true;
  try {
    const res: any = await getBrushRulesApi();
    rules.value = Array.isArray(res) ? res : res?.data || [];
  } catch (error: any) {
    notification.error('加载失败', {
      description: error?.message || '',
    });
  } finally {
    loading.value = false;
  }
}

function parseObj(val: any): Record<string, any> {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

function openEdit(rule?: BrushApi.BrushRule) {
  editingRule.value = rule || null;
  if (rule) {
    const ruleType = ruleActualType(rule);
    if (ruleType === 'rss') {
      const rss = parseObj(rule.rss_rule);
      form.value = {
        id: rule.id,
        name: rule.name || '',
        type: ruleType,
        free: rss.free || '',
        hr: rss.hr || '',
        exclude_subscribe:
          rss.exclude_subscribe === 'Y' || rss.exclude_subscribe === true,
        dlcount: rss.dlcount || '',
        include: rss.include || '',
        exclude: rss.exclude || '',
        upspeed: rss.upspeed || '',
        downspeed: rss.downspeed || '',
        torrent_size: rss.size || '',
        peercount: rss.peercount || '',
        pubdate: rss.pubdate || '',
        mode: 'or',
        seedtime: '',
        hr_seedtime: '',
        seedratio: '',
        seedsize: '',
        dltime: '',
        avg_upspeed: '',
        iatime: '',
        pending_time: '',
        freespace: '',
        freestatus: false,
        stopfree: false,
      };
    } else if (ruleType === 'remove') {
      const remove = parseObj(rule.remove_rule);
      form.value = {
        id: rule.id,
        name: rule.name || '',
        type: ruleType,
        free: '',
        hr: '',
        exclude_subscribe: false,
        dlcount: '',
        include: '',
        exclude: '',
        upspeed: '',
        downspeed: '',
        torrent_size: '',
        peercount: '',
        pubdate: '',
        mode: remove.mode || 'or',
        seedtime: remove.time || '',
        hr_seedtime: remove.hr_seedtime || '',
        seedratio: remove.seedratio || '',
        seedsize: remove.seedsize || '',
        dltime: remove.dltime || '',
        avg_upspeed: remove.avg_upspeed || '',
        iatime: remove.iatime || '',
        pending_time: remove.pending_time || '',
        freespace: remove.freespace || '',
        freestatus: remove.freestatus === 'Y' || remove.freestatus === true,
        stopfree: false,
      };
    } else {
      const stop = parseObj(rule.stop_rule);
      form.value = {
        id: rule.id,
        name: rule.name || '',
        type: ruleType,
        free: '',
        hr: '',
        exclude_subscribe: false,
        dlcount: '',
        include: '',
        exclude: '',
        upspeed: '',
        downspeed: '',
        torrent_size: '',
        peercount: '',
        pubdate: '',
        mode: 'or',
        seedtime: '',
        hr_seedtime: '',
        seedratio: '',
        seedsize: '',
        dltime: '',
        avg_upspeed: '',
        iatime: '',
        pending_time: '',
        freespace: '',
        freestatus: false,
        stopfree: stop.stopfree === 'Y' || stop.stopfree === true,
      };
    }
  } else {
    form.value = {
      id: undefined,
      name: '',
      type: activeType.value,
      free: '',
      hr: '',
      exclude_subscribe: false,
      dlcount: '',
      include: '',
      exclude: '',
      upspeed: '',
      downspeed: '',
      torrent_size: '',
      peercount: '',
      pubdate: '',
      mode: 'or',
      seedtime: '',
      hr_seedtime: '',
      seedratio: '',
      seedsize: '',
      dltime: '',
      avg_upspeed: '',
      iatime: '',
      pending_time: '',
      freespace: '',
      freestatus: false,
      stopfree: false,
    };
  }
  modalShow.value = true;
}

function getRssRule() {
  const f = form.value;
  const rule: Record<string, any> = {};
  if (f.free) rule.free = f.free;
  if (f.hr) rule.hr = f.hr;
  if (f.exclude_subscribe) rule.exclude_subscribe = 'Y';
  if (f.dlcount) rule.dlcount = f.dlcount;
  if (f.include) rule.include = f.include;
  if (f.exclude) rule.exclude = f.exclude;
  if (f.upspeed) rule.upspeed = f.upspeed;
  if (f.downspeed) rule.downspeed = f.downspeed;
  if (f.torrent_size) rule.size = f.torrent_size;
  if (f.peercount) rule.peercount = f.peercount;
  if (f.pubdate) rule.pubdate = f.pubdate;
  return rule;
}

function getRemoveRule() {
  const f = form.value;
  const rule: Record<string, any> = {};
  if (f.mode) rule.mode = f.mode;
  if (f.seedtime) rule.time = f.seedtime;
  if (f.hr_seedtime) rule.hr_seedtime = f.hr_seedtime;
  if (f.seedratio) rule.seedratio = f.seedratio;
  if (f.seedsize) rule.seedsize = f.seedsize;
  if (f.dltime) rule.dltime = f.dltime;
  if (f.avg_upspeed) rule.avg_upspeed = f.avg_upspeed;
  if (f.iatime) rule.iatime = f.iatime;
  if (f.pending_time) rule.pending_time = f.pending_time;
  if (f.freespace) rule.freespace = f.freespace;
  if (f.freestatus) rule.freestatus = 'Y';
  return rule;
}

function getStopRule() {
  const f = form.value;
  const rule: Record<string, any> = {};
  if (f.stopfree) rule.stopfree = 'Y';
  return rule;
}

async function handleSave() {
  if (!form.value.name.trim()) {
    notification.error('请输入规则名称');
    return;
  }
  const f = form.value;

  const json_rule: Record<string, any> = (() => {
    switch (f.type) {
      case 'remove': {
        const r: Record<string, any> = {};
        if (f.mode) r.mode = f.mode;
        if (f.seedtime) r.time = f.seedtime;
        if (f.hr_seedtime) r.hr_seedtime = f.hr_seedtime;
        if (f.seedratio) r.seedratio = f.seedratio;
        if (f.seedsize) r.seedsize = f.seedsize;
        if (f.dltime) r.dltime = f.dltime;
        if (f.avg_upspeed) r.avg_upspeed = f.avg_upspeed;
        if (f.iatime) r.iatime = f.iatime;
        if (f.pending_time) r.pending_time = f.pending_time;
        if (f.freespace) r.freespace = f.freespace;
        if (f.freestatus) r.freestatus = 'Y';
        return r;
      }
      case 'rss': {
        const r: Record<string, any> = {};
        if (f.free) r.free = f.free;
        if (f.hr) r.hr = f.hr;
        if (f.exclude_subscribe) r.exclude_subscribe = 'Y';
        if (f.dlcount) r.dlcount = f.dlcount;
        if (f.include) r.include = f.include;
        if (f.exclude) r.exclude = f.exclude;
        if (f.upspeed) r.upspeed = f.upspeed;
        if (f.downspeed) r.downspeed = f.downspeed;
        if (f.torrent_size) r.size = f.torrent_size;
        if (f.peercount) r.peercount = f.peercount;
        if (f.pubdate) r.pubdate = f.pubdate;
        return r;
      }
      default: {
        const r: Record<string, any> = {};
        if (f.stopfree) r.stopfree = 'Y';
        return r;
      }
    }
  })();

  try {
    await saveBrushRuleApi({
      id: f.id,
      name: f.name,
      type: f.type,
      json_rule,
      rss_rule: getRssRule(),
      remove_rule: getRemoveRule(),
      stop_rule: getStopRule(),
    } as any);
    notification.success(form.value.id ? '规则已更新' : '规则已创建');
    modalShow.value = false;
    await fetchRules();
  } catch (error: any) {
    notification.error('保存失败', {
      description: error?.message || '',
    });
  }
}

async function doDelete(rule: BrushApi.BrushRule) {
  try {
    await deleteBrushRuleApi(rule.id);
    notification.success('规则已删除');
    await fetchRules();
  } catch (error: any) {
    notification.error('删除失败', {
      description: error?.message || '',
    });
  }
}

function buildRuleSummary(rule: BrushApi.BrushRule) {
  const ruleType = ruleActualType(rule);
  const rss = parseObj(rule.rss_rule);
  const remove = parseObj(rule.remove_rule);
  const stop = parseObj(rule.stop_rule);

  const typeLabel =
    ruleType === 'rss'
      ? '选种规则'
      : ruleType === 'remove'
        ? '删种规则'
        : '停种规则';
  const typeColor: 'error' | 'primary' | 'success' =
    ruleType === 'rss'
      ? 'primary'
      : ruleType === 'remove'
        ? 'error'
        : 'success';

  const rssItems: Array<{ icon: string; text: string }> = [];
  if (rss.free) rssItems.push({ icon: 'lucide:tag', text: rss.free });
  if (rss.hr) rssItems.push({ icon: 'lucide:shield-alert', text: '排除HR' });
  if (rss.include)
    rssItems.push({ icon: 'lucide:search', text: `包含: ${rss.include}` });
  if (rss.exclude)
    rssItems.push({ icon: 'lucide:ban', text: `排除: ${rss.exclude}` });
  if (rss.size > 0)
    rssItems.push({ icon: 'lucide:hard-drive', text: `大小 ${rss.size}GB` });
  if (rss.peercount)
    rssItems.push({ icon: 'lucide:users', text: `做种${rss.peercount}` });
  if (rss.pubdate)
    rssItems.push({ icon: 'lucide:clock', text: `发布${rss.pubdate}h` });

  const removeItems: Array<{ icon: string; text: string }> = [];
  if (remove.time)
    removeItems.push({ icon: 'lucide:timer', text: `做种${remove.time}h` });
  if (remove.hr_seedtime)
    removeItems.push({
      icon: 'lucide:shield-alert',
      text: `HR做种${remove.hr_seedtime}h`,
    });
  if (remove.seedratio)
    removeItems.push({
      icon: 'lucide:trending-up',
      text: `分享率${remove.seedratio}`,
    });
  if (remove.seedsize)
    removeItems.push({
      icon: 'lucide:upload',
      text: `上传${remove.seedsize}GB`,
    });
  if (remove.dltime)
    removeItems.push({
      icon: 'lucide:download',
      text: `下载耗时${remove.dltime}h`,
    });
  if (remove.avg_upspeed)
    removeItems.push({
      icon: 'lucide:gauge',
      text: `均速<${remove.avg_upspeed}KB/s`,
    });
  if (remove.iatime)
    removeItems.push({
      icon: 'lucide:clock-off',
      text: `未活动${remove.iatime}h`,
    });
  if (remove.pending_time)
    removeItems.push({
      icon: 'lucide:clock',
      text: `等待${remove.pending_time}h`,
    });
  if (remove.freespace)
    removeItems.push({
      icon: 'lucide:hard-drive',
      text: `磁盘<${remove.freespace}GB`,
    });
  if (remove.freestatus)
    removeItems.push({ icon: 'lucide:zap', text: 'Free到期删' });

  const stopItems: Array<{ icon: string; text: string }> = [];
  if (stop.stopfree)
    stopItems.push({ icon: 'lucide:pause-circle', text: 'Free到期停' });

  return {
    type: ruleType,
    typeLabel,
    typeColor,
    rssItems,
    removeItems,
    stopItems,
  };
}

function HelpIcon(props: { text: string }) {
  return h(
    NTooltip,
    { trigger: 'hover' },
    {
      trigger: () =>
        h(
          NIcon,
          { class: 'help-icon', size: 14 },
          { default: () => h(IconifyIcon, { icon: 'lucide:help-circle' }) },
        ),
      default: () => props.text,
    },
  );
}

function labelWithHelp(label: string, helpText: string) {
  return h('span', { class: 'form-label-help' }, [
    label,
    h(HelpIcon, { text: helpText }),
  ]);
}

onMounted(() => {
  fetchRules();
});
</script>

<template>
  <div class="rules-page">
    <PageHeader
      title="刷流规则"
      subtitle="管理选种、删种、停种三方规则模板，任务可独立引用"
    >
      <template #actions>
        <NButton text size="small" @click="fetchRules">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-3.5" />
          </template>
        </NButton>
      </template>
    </PageHeader>

    <!-- Type Tabs -->
    <nav class="type-tabs">
      <button
        v-for="tab in typeTabs"
        :key="tab.key"
        class="type-tab"
        :class="{ 'type-tab--active': activeType === tab.key }"
        @click="activeType = tab.key"
      >
        <IconifyIcon :icon="tab.icon" class="size-3.5" />
        {{ tab.label }}
      </button>
    </nav>

    <div class="section-bar">
      <span class="section-count">{{ filteredRules.length }} 条规则</span>
      <NButton
        size="small"
        secondary
        class="add-btn-section"
        @click="openEdit()"
      >
        <template #icon>
          <IconifyIcon icon="lucide:plus" class="size-3.5" />
        </template>
        添加{{ typeTabs.find((t) => t.key === activeType)?.label }}
      </NButton>
    </div>

    <div v-if="filteredRules.length > 0" class="rules-list">
      <article
        v-for="rule in filteredRules"
        :key="rule.id"
        class="rule-card"
        :class="`rule-card--${buildRuleSummary(rule).type}`"
      >
        <div class="card-accent"></div>
        <div class="card-content">
          <div class="card-top">
            <span
              class="type-chip"
              :class="`type-chip--${buildRuleSummary(rule).type}`"
            >
              <IconifyIcon
                :icon="
                  buildRuleSummary(rule).type === 'rss'
                    ? 'lucide:filter'
                    : buildRuleSummary(rule).type === 'remove'
                      ? 'lucide:trash-2'
                      : 'lucide:octagon-pause'
                "
                class="size-3"
              />
              {{ buildRuleSummary(rule).typeLabel }}
            </span>
            <div class="card-actions">
              <NButton
                text
                size="tiny"
                class="card-action-btn"
                @click="openEdit(rule)"
              >
                <IconifyIcon icon="lucide:pencil" class="size-3.5" />
              </NButton>
              <NPopconfirm @positive-click="doDelete(rule)">
                <template #trigger>
                  <NButton
                    text
                    size="tiny"
                    class="card-action-btn card-action-btn--danger"
                  >
                    <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                  </NButton>
                </template>
                确定删除「{{ rule.name }}」？已绑定的任务将变为无规则状态。
              </NPopconfirm>
            </div>
          </div>
          <h3 class="card-name">{{ rule.name }}</h3>
          <p class="card-date">{{ rule.lst_mod_date || '' }}</p>

          <div
            v-if="buildRuleSummary(rule).rssItems.length > 0"
            class="rule-items"
          >
            <span
              v-for="item in buildRuleSummary(rule).rssItems"
              :key="item.text"
              class="rule-chip rule-chip--rss"
            >
              <IconifyIcon :icon="item.icon" class="size-3" />
              {{ item.text }}
            </span>
          </div>
          <div
            v-if="buildRuleSummary(rule).removeItems.length > 0"
            class="rule-items"
          >
            <span
              v-for="item in buildRuleSummary(rule).removeItems"
              :key="item.text"
              class="rule-chip rule-chip--remove"
            >
              <IconifyIcon :icon="item.icon" class="size-3" />
              {{ item.text }}
            </span>
          </div>
          <div
            v-if="buildRuleSummary(rule).stopItems.length > 0"
            class="rule-items"
          >
            <span
              v-for="item in buildRuleSummary(rule).stopItems"
              :key="item.text"
              class="rule-chip rule-chip--stop"
            >
              <IconifyIcon :icon="item.icon" class="size-3" />
              {{ item.text }}
            </span>
          </div>
          <div
            v-if="
              buildRuleSummary(rule).rssItems.length === 0 &&
              buildRuleSummary(rule).removeItems.length === 0 &&
              buildRuleSummary(rule).stopItems.length === 0
            "
            class="card-empty"
          >
            <IconifyIcon icon="lucide:inbox" class="size-3.5" />
            无规则条件
          </div>
        </div>
      </article>
    </div>

    <EmptyState
      v-else-if="!loading"
      title="没有规则模板"
      subtitle="创建规则模板后，刷流任务可直接选择使用"
    />

    <!-- 编辑弹窗 -->
    <NModal
      v-model:show="modalShow"
      :title="editingRule ? '编辑规则' : '新增规则'"
      preset="card"
      :style="{ width: '780px', maxWidth: '92vw' }"
      :bordered="false"
      :segmented="{ content: true }"
      :mask-closable="false"
    >
      <NForm label-placement="top" size="small" class="brush-form">
        <NFormItem label="规则名称" required>
          <NInput v-model:value="form.name" placeholder="请输入规则名称" />
        </NFormItem>

        <template v-if="form.type === 'rss'">
          <NDivider>
            <div class="divider-content">
              <IconifyIcon icon="lucide:filter" class="h-3.5 w-3.5" />
              选种规则（与）
            </div>
          </NDivider>

          <div class="form-grid">
            <NFormItem path="free">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '促销',
                        '选全部即不过滤会下载到非促销的种子',
                      )
                  "
                />
              </template>
              <NSelect
                v-model:value="form.free"
                :options="freeOptions"
                clearable
              />
            </NFormItem>
            <NFormItem label="Hit&Run" path="hr">
              <NSelect v-model:value="form.hr" :options="hrOptions" clearable />
            </NFormItem>
            <NFormItem path="exclude_subscribe">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '排除订阅',
                        '开启后任务不会下载在订阅中的剧集',
                      )
                  "
                />
              </template>
              <NSwitch v-model:value="form.exclude_subscribe" />
            </NFormItem>
            <NFormItem path="dlcount">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '同时下载任务数',
                        '下载器中正在下载的任务数超过此值时不再添加下载',
                      )
                  "
                />
              </template>
              <NInput v-model:value="form.dlcount" placeholder="留空不限制" />
            </NFormItem>
            <NFormItem path="include">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '包含',
                        '种子名称或副标题中包括对应关键字或者匹配正则式时才会下载',
                      )
                  "
                />
              </template>
              <NInput
                v-model:value="form.include"
                placeholder="关键字或正则表达式"
              />
            </NFormItem>
            <NFormItem path="exclude">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '排除',
                        '种子名称或副标题中包括对应关键字或者匹配正则式时不会下载',
                      )
                  "
                />
              </template>
              <NInput
                v-model:value="form.exclude"
                placeholder="关键字或正则表达式"
              />
            </NFormItem>
            <NFormItem path="upspeed">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '上传限速(KB/S)',
                        '限制添加下载后的上传速度',
                      )
                  "
                />
              </template>
              <NInput v-model:value="form.upspeed" placeholder="留空不限制" />
            </NFormItem>
            <NFormItem path="downspeed">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '下载限速(KB/S)',
                        '限制添加下载后的下载速度',
                      )
                  "
                />
              </template>
              <NInput v-model:value="form.downspeed" placeholder="留空不限制" />
            </NFormItem>
            <NFormItem path="torrent_size">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '种子大小(GB)',
                        '设置大小范围的种子才会下载',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.torrent_size"
                :options="allGtLtBwOptions"
                placeholder="如: 1,10"
              />
            </NFormItem>
            <NFormItem path="peercount">
              <template #label>
                <component
                  :is="
                    () => labelWithHelp('做种人数限制', '种子当前做种人数限制')
                  "
                />
              </template>
              <RangeField
                v-model="form.peercount"
                :options="allGtLtBwOptions"
                placeholder="如: 20"
              />
            </NFormItem>
            <NFormItem path="pubdate">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '发布时间(小时)',
                        '种子的发布时间在选定范围内时才会下载',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.pubdate"
                :options="allGtLtBwOptions"
                placeholder="如: 24"
              />
            </NFormItem>
          </div>
        </template>

        <template v-if="form.type === 'remove'">
          <NDivider>
            <div class="divider-content">
              <IconifyIcon icon="lucide:trash-2" class="h-3.5 w-3.5" />
              删种规则（{{ form.mode === 'and' ? '与' : '或' }}）
            </div>
          </NDivider>

          <div class="form-grid">
            <NFormItem path="mode">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '删种模式',
                        '或模式满足其中一个删除，与模式全部满足删除',
                      )
                  "
                />
              </template>
              <NSelect v-model:value="form.mode" :options="modeOptions" />
            </NFormItem>
            <NFormItem path="seedtime">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '做种时间(小时)',
                        '做种超过设定时间时会删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.seedtime"
                :options="ignoreGtOptions"
                placeholder="如: 1"
              />
            </NFormItem>
            <NFormItem path="hr_seedtime">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        'H&R做种时间(小时)',
                        'H&R 做种超过设定时间时会删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.hr_seedtime"
                :options="ignoreGtOptions"
                placeholder="如: 72"
              />
            </NFormItem>
            <NFormItem path="seedratio">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '分享率',
                        '分享率超过设定值时会删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.seedratio"
                :options="ignoreGtOptions"
                placeholder="如: 1"
              />
            </NFormItem>
            <NFormItem path="seedsize">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '上传量(GB)',
                        '上传量超过设定值时会删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.seedsize"
                :options="ignoreGtOptions"
                placeholder="如: 10"
              />
            </NFormItem>
            <NFormItem path="dltime">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '下载耗时(小时)',
                        '下载耗时超过设定值仍然未下载完成时会删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.dltime"
                :options="ignoreGtOptions"
                placeholder="如: 20"
              />
            </NFormItem>
            <NFormItem path="avg_upspeed">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '平均上传速度(KB/S)',
                        '检查周期内平均上传速度低于设定值时删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.avg_upspeed"
                :options="ignoreLtOptions"
                placeholder="如: 700"
              />
            </NFormItem>
            <NFormItem path="iatime">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '未活动时间(小时)',
                        '超过设定时间未活动时会删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.iatime"
                :options="ignoreGtOptions"
                placeholder="如: 1"
              />
            </NFormItem>
            <NFormItem path="pending_time">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '下载等待时间(小时)',
                        '超过设定时间未下载时会删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.pending_time"
                :options="ignoreGtOptions"
                placeholder="如: 1"
              />
            </NFormItem>
            <NFormItem path="freespace">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        '磁盘剩余空间(GB)',
                        '检查周期内磁盘剩余空间低于设定值时删除下载任务',
                      )
                  "
                />
              </template>
              <RangeField
                v-model="form.freespace"
                :options="ignoreLtOptions"
                placeholder="留空不限制"
              />
            </NFormItem>
            <NFormItem path="freestatus">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        'Free到期',
                        '开启后Free到期后会自动删除种子',
                      )
                  "
                />
              </template>
              <NSwitch v-model:value="form.freestatus" />
            </NFormItem>
          </div>
        </template>

        <template v-if="form.type === 'stop'">
          <NDivider>
            <div class="divider-content">
              <IconifyIcon icon="lucide:octagon" class="h-3.5 w-3.5" />
              停种规则（或）
            </div>
          </NDivider>

          <div class="form-grid">
            <NFormItem path="stopfree">
              <template #label>
                <component
                  :is="
                    () =>
                      labelWithHelp(
                        'Free到期',
                        '开启后free到期后会自动暂停种子',
                      )
                  "
                />
              </template>
              <NSwitch v-model:value="form.stopfree" />
            </NFormItem>
          </div>
        </template>

        <div class="form-footer">
          <NSpace>
            <NButton type="primary" @click="handleSave">
              <template #icon>
                <IconifyIcon icon="lucide:check" class="h-4 w-4" />
              </template>
              {{ editingRule ? '保存' : '创建' }}
            </NButton>
            <NButton @click="modalShow = false">
              <template #icon>
                <IconifyIcon icon="lucide:x" class="h-4 w-4" />
              </template>
              取消
            </NButton>
          </NSpace>
        </div>
      </NForm>
    </NModal>
  </div>
</template>

<style scoped>
/* ========== Page Layout ========== */
.rules-page {
  max-width: 1200px;
  padding: 1.5rem;
  margin: 0 auto;
}

/* ========== Type Tabs ========== */
.type-tabs {
  display: flex;
  gap: 0.375rem;
  padding: 0.25rem;
  margin-bottom: 1rem;
  background: hsl(var(--muted) / 30%);
  border-radius: 0.625rem;
}

.type-tab {
  display: flex;
  flex: 1;
  gap: 0.375rem;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  transition: all 0.15s;
}

.type-tab:hover {
  color: hsl(var(--card-foreground));
  background: hsl(var(--accent));
}

.type-tab--active {
  color: hsl(var(--card-foreground));
  background: hsl(var(--card));
  box-shadow: 0 1px 3px hsl(var(--border) / 50%);
}

/* ========== Section Bar ========== */
.section-bar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.section-count {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.add-btn-section {
  font-size: 0.8125rem;
}

.add-btn {
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  transition: all 0.15s;
}

.add-rss:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 5%);
  border-color: hsl(var(--primary) / 30%);
}

.add-remove:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 5%);
  border-color: hsl(var(--destructive) / 30%);
}

.add-stop:hover {
  color: hsl(var(--success));
  background: hsl(var(--success) / 5%);
  border-color: hsl(var(--success) / 30%);
}

/* ========== Card List ========== */
.rules-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.875rem;
}

.rule-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  transition:
    box-shadow 0.15s,
    border-color 0.15s;
}

.rule-card:hover {
  border-color: hsl(var(--border));
  box-shadow: 0 4px 16px -4px hsl(var(--border) / 40%);
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
}

.rule-card--rss .card-accent {
  background: hsl(var(--primary));
}

.rule-card--remove .card-accent {
  background: hsl(var(--destructive));
}

.rule-card--stop .card-accent {
  background: hsl(var(--success));
}

.card-content {
  padding: 1rem 1.25rem 1.125rem;
}

.card-top {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

/* ========== Type Chip ========== */
.type-chip {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-radius: 0.25rem;
}

.type-chip--rss {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
}

.type-chip--remove {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
}

.type-chip--stop {
  color: hsl(var(--success));
  background: hsl(var(--success) / 8%);
}

/* ========== Card Actions ========== */
.card-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.rule-card:hover .card-actions {
  opacity: 1;
}

.card-action-btn {
  color: hsl(var(--muted-foreground));
}

.card-action-btn:hover {
  color: hsl(var(--card-foreground));
}

.card-action-btn--danger:hover {
  color: hsl(var(--destructive));
}

/* ========== Card Name & Date ========== */
.card-name {
  margin-top: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  overflow-wrap: break-word;
}

.card-date {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* ========== Rule Chips ========== */
.rule-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.625rem;
}

.rule-chip {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
  transition: transform 0.1s;
}

.rule-chip:hover {
  transform: translateY(-1px);
}

.rule-chip--rss {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 6%);
}

.rule-chip--remove {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 6%);
}

.rule-chip--stop {
  color: hsl(var(--success));
  background: hsl(var(--success) / 6%);
}

/* ========== Card Empty ========== */
.card-empty {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

/* ========== Form Modal ========== */
.brush-form {
  padding: 0.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem 1rem;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  margin-top: 1.5rem;
  border-top: 1px solid hsl(var(--border));
}

.divider-content {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

:deep(.form-label-help) {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}

:deep(.help-icon) {
  color: hsl(var(--muted-foreground));
  cursor: help;
  opacity: 0.6;
  transition: opacity 0.2s;
}

:deep(.help-icon:hover) {
  color: hsl(var(--primary));
  opacity: 1;
}

/* ========== Mobile ========== */
@media (max-width: 768px) {
  .rules-page {
    padding: 0.75rem;
  }

  .rules-list {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    width: 100%;
  }
}
</style>
