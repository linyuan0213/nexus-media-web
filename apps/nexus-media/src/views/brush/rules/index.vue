<script lang="ts" setup>
import type { BrushApi } from '#/api/modules/brush';

import { h, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
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
  NTag,
  NTooltip,
  useNotification,
} from 'naive-ui';

import {
  deleteBrushRuleApi,
  getBrushRulesApi,
  saveBrushRuleApi,
} from '#/api/modules/brush';
import RangeField from '#/components/brush/RangeField.vue';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

const notification = useNotification();
const rules = ref<BrushApi.BrushRule[]>([]);
const loading = ref(false);
const modalShow = ref(false);
const editingRule = ref<BrushApi.BrushRule | null>(null);

const form = ref({
  id: undefined as number | undefined,
  name: '',
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
    notification.error({
      content: '加载失败',
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
    const rss = parseObj(rule.rss_rule);
    const remove = parseObj(rule.remove_rule);
    const stop = parseObj(rule.stop_rule);
    form.value = {
      id: rule.id,
      name: rule.name || '',
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
      mode: remove.mode || 'or',
      seedtime: remove.time || '',
      hr_seedtime: remove.hr_time || '',
      seedratio: remove.ratio || '',
      seedsize: remove.uploadsize || '',
      dltime: remove.dltime || '',
      avg_upspeed: remove.avg_upspeed || '',
      iatime: remove.iatime || '',
      pending_time: remove.pending_time || '',
      freespace: remove.freespace || '',
      freestatus: remove.freestatus === 'Y' || remove.freestatus === true,
      stopfree: stop.stopfree === 'Y' || stop.stopfree === true,
    };
  } else {
    form.value = {
      id: undefined,
      name: '',
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
  if (f.hr_seedtime) rule.hr_time = f.hr_seedtime;
  if (f.seedratio) rule.ratio = f.seedratio;
  if (f.seedsize) rule.uploadsize = f.seedsize;
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
    notification.error({ content: '请输入规则名称' });
    return;
  }
  try {
    await saveBrushRuleApi({
      id: form.value.id,
      name: form.value.name,
      rss_rule: getRssRule(),
      remove_rule: getRemoveRule(),
      stop_rule: getStopRule(),
    });
    notification.success({
      content: form.value.id ? '规则已更新' : '规则已创建',
    });
    modalShow.value = false;
    await fetchRules();
  } catch (error: any) {
    notification.error({
      content: '保存失败',
      description: error?.message || '',
    });
  }
}

async function doDelete(rule: BrushApi.BrushRule) {
  try {
    await deleteBrushRuleApi(rule.id);
    notification.success({ content: '规则已删除' });
    await fetchRules();
  } catch (error: any) {
    notification.error({
      content: '删除失败',
      description: error?.message || '',
    });
  }
}

function buildRuleSummary(rule: BrushApi.BrushRule) {
  const rss = parseObj(rule.rss_rule);
  const remove = parseObj(rule.remove_rule);
  const stop = parseObj(rule.stop_rule);

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
  if (remove.ratio)
    removeItems.push({
      icon: 'lucide:trending-up',
      text: `分享率${remove.ratio}`,
    });
  if (remove.uploadsize)
    removeItems.push({
      icon: 'lucide:upload',
      text: `上传${remove.uploadsize}GB`,
    });
  if (remove.freestatus)
    removeItems.push({ icon: 'lucide:zap', text: 'Free到期删' });

  const stopItems: Array<{ icon: string; text: string }> = [];
  if (stop.stopfree)
    stopItems.push({ icon: 'lucide:pause-circle', text: 'Free到期停' });

  return { rssItems, removeItems, stopItems };
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
  <div class="p-4">
    <PageHeader title="刷流规则">
      <template #actions>
        <NSpace>
          <NButton type="primary" size="small" @click="openEdit()">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="h-4 w-4" />
            </template>
            新增规则
          </NButton>
          <NButton size="small" @click="fetchRules">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
            </template>
            刷新
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <div v-if="rules.length > 0" class="rule-grid">
      <NCard
        v-for="rule in rules"
        :key="rule.id"
        size="small"
        class="rule-card"
        hoverable
      >
        <div class="rule-header">
          <div class="rule-icon">
            <IconifyIcon icon="lucide:filter" class="h-5 w-5" />
          </div>
          <div class="rule-title-wrap">
            <div class="rule-name">{{ rule.name }}</div>
            <div class="rule-date">{{ rule.lst_mod_date || '' }}</div>
          </div>
          <NSpace class="rule-actions" size="small">
            <NButton size="tiny" quaternary circle @click="openEdit(rule)">
              <template #icon>
                <IconifyIcon icon="lucide:pencil" class="h-3.5 w-3.5" />
              </template>
            </NButton>
            <NPopconfirm @positive-click="doDelete(rule)">
              <template #trigger>
                <NButton size="tiny" quaternary circle type="error">
                  <template #icon>
                    <IconifyIcon icon="lucide:trash-2" class="h-3.5 w-3.5" />
                  </template>
                </NButton>
              </template>
              确定删除规则「{{
                rule.name
              }}」吗？已绑定此规则的任务将变为无规则状态。
            </NPopconfirm>
          </NSpace>
        </div>

        <div class="rule-body">
          <template
            v-for="(section, idx) in [buildRuleSummary(rule)]"
            :key="idx"
          >
            <div v-if="section.rssItems.length > 0" class="rule-section">
              <div class="rule-section-title">
                <IconifyIcon icon="lucide:filter" class="h-3 w-3" />
                选种规则
              </div>
              <div class="rule-tags">
                <NTag
                  v-for="(item, i) in section.rssItems"
                  :key="i"
                  size="tiny"
                  round
                  type="primary"
                >
                  <template #icon>
                    <IconifyIcon :icon="item.icon" class="h-3 w-3" />
                  </template>
                  {{ item.text }}
                </NTag>
              </div>
            </div>

            <div v-if="section.removeItems.length > 0" class="rule-section">
              <div class="rule-section-title">
                <IconifyIcon icon="lucide:trash-2" class="h-3 w-3" />
                删种规则
              </div>
              <div class="rule-tags">
                <NTag
                  v-for="(item, i) in section.removeItems"
                  :key="i"
                  size="tiny"
                  round
                  type="error"
                >
                  <template #icon>
                    <IconifyIcon :icon="item.icon" class="h-3 w-3" />
                  </template>
                  {{ item.text }}
                </NTag>
              </div>
            </div>

            <div v-if="section.stopItems.length > 0" class="rule-section">
              <div class="rule-section-title">
                <IconifyIcon icon="lucide:octagon" class="h-3 w-3" />
                停种规则
              </div>
              <div class="rule-tags">
                <NTag
                  v-for="(item, i) in section.stopItems"
                  :key="i"
                  size="tiny"
                  round
                  type="success"
                >
                  <template #icon>
                    <IconifyIcon :icon="item.icon" class="h-3 w-3" />
                  </template>
                  {{ item.text }}
                </NTag>
              </div>
            </div>

            <div
              v-if="
                section.rssItems.length === 0 &&
                section.removeItems.length === 0 &&
                section.stopItems.length === 0
              "
              class="rule-empty"
            >
              <IconifyIcon icon="lucide:inbox" class="h-4 w-4" />
              无规则条件
            </div>
          </template>
        </div>
      </NCard>
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
                    labelWithHelp('促销', '选全部即不过滤会下载到非促销的种子')
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
                    labelWithHelp('上传限速(KB/S)', '限制添加下载后的上传速度')
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
                    labelWithHelp('下载限速(KB/S)', '限制添加下载后的下载速度')
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
                    labelWithHelp('种子大小(GB)', '设置大小范围的种子才会下载')
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
                    labelWithHelp('分享率', '分享率超过设定值时会删除下载任务')
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
                    labelWithHelp('Free到期', '开启后Free到期后会自动删除种子')
                "
              />
            </template>
            <NSwitch v-model:value="form.freestatus" />
          </NFormItem>
        </div>

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
                    labelWithHelp('Free到期', '开启后free到期后会自动暂停种子')
                "
              />
            </template>
            <NSwitch v-model:value="form.stopfree" />
          </NFormItem>
        </div>

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
.rule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.rule-card {
  transition: all 0.2s ease;
}

.rule-card:hover {
  border-color: hsl(var(--primary) / 30%);
  box-shadow: 0 4px 12px rgb(0 0 0 / 6%);
}

.rule-card :deep(.n-card__content) {
  padding: 1rem;
}

.rule-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
}

.rule-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 10%);
  border-radius: 0.5rem;
}

.rule-title-wrap {
  flex: 1;
  min-width: 0;
}

.rule-name {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
  overflow-wrap: break-word;
}

.rule-date {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.rule-actions {
  flex-shrink: 0;
}

.rule-body {
  margin-top: 0.75rem;
}

.rule-section {
  margin-bottom: 0.5rem;
}

.rule-section:last-child {
  margin-bottom: 0;
}

.rule-section-title {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.rule-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.rule-empty {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

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

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .rule-grid {
    grid-template-columns: 1fr;
  }
}
</style>
