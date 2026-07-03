<script setup lang="ts">
import type { BrushApi } from '#/api/modules/brush';

import { computed, h, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NSelect,
  NSpace,
  NSwitch,
  NTooltip,
} from 'naive-ui';

import { getBrushRulesApi } from '#/api/modules/brush';

interface BrushTaskFormData {
  brushtask_id?: number;
  brushtask_name: string;
  brushtask_site: string;
  brushtask_interval: string;
  brushtask_downloader: string;
  brushtask_totalsize: string;
  brushtask_state: string;
  brushtask_rssurl: string;
  brushtask_label: string;
  brushtask_savepath: string;
  brushtask_time_range: string;
  brushtask_active_weekdays: string;
  brushtask_download_switch: string;
  brushtask_remove_switch: string;
  brushtask_stop_switch: string;
  brushtask_daily_delete_limit: string;
  brushtask_max_seeding: string;
  brushtask_hr_limit: string;
  brushtask_sendmessage: boolean;
  brushtask_transfer: boolean;
  brushtask_rss_rule_id: number | undefined;
  brushtask_remove_rule_id: number | undefined;
  brushtask_stop_rule_id: number | undefined;
  brushtask_rss_rule_enabled: boolean;
  brushtask_remove_rule_enabled: boolean;
  brushtask_stop_rule_enabled: boolean;
}

const props = defineProps<{
  downloaders: Array<{ label: string; value: string }>;
  sites: Array<{ label: string; value: string }>;
  task?: BrushApi.BrushTask | null;
}>();

const emit = defineEmits<{
  (e: 'submit', data: BrushTaskFormData): void;
  (e: 'cancel'): void;
}>();

const formRef = ref<any>(null);

const weekdayOptions = [
  { label: '周一', value: '1' },
  { label: '周二', value: '2' },
  { label: '周三', value: '3' },
  { label: '周四', value: '4' },
  { label: '周五', value: '5' },
  { label: '周六', value: '6' },
  { label: '周日', value: '7' },
];

function defaultForm(): BrushTaskFormData {
  return {
    brushtask_name: '',
    brushtask_site: '',
    brushtask_interval: '10',
    brushtask_downloader: '',
    brushtask_totalsize: '',
    brushtask_state: 'Y',
    brushtask_rssurl: '',
    brushtask_label: '',
    brushtask_savepath: '',
    brushtask_time_range: '',
    brushtask_active_weekdays: '',
    brushtask_download_switch: 'Y',
    brushtask_remove_switch: 'Y',
    brushtask_stop_switch: 'Y',
    brushtask_daily_delete_limit: '',
    brushtask_max_seeding: '',
    brushtask_hr_limit: '',
    brushtask_sendmessage: false,
    brushtask_transfer: false,
    brushtask_rss_rule_id: undefined,
    brushtask_remove_rule_id: undefined,
    brushtask_stop_rule_id: undefined,
    brushtask_rss_rule_enabled: false,
    brushtask_remove_rule_enabled: false,
    brushtask_stop_rule_enabled: false,
  };
}

const form = ref<BrushTaskFormData>(defaultForm());

const isEdit = computed(() => !!props.task?.id);

const activeWeekdaysArray = computed({
  get: () => {
    const val = form.value.brushtask_active_weekdays;
    if (!val) return [];
    return val.split(',').filter(Boolean);
  },
  set: (selected: (number | string)[]) => {
    form.value.brushtask_active_weekdays = selected.join(',');
  },
});

const downloadSwitchEnabled = computed({
  get: () => form.value.brushtask_download_switch === 'Y',
  set: (v: boolean) => (form.value.brushtask_download_switch = v ? 'Y' : 'N'),
});

const removeSwitchEnabled = computed({
  get: () => form.value.brushtask_remove_switch === 'Y',
  set: (v: boolean) => (form.value.brushtask_remove_switch = v ? 'Y' : 'N'),
});

const stopSwitchEnabled = computed({
  get: () => form.value.brushtask_stop_switch === 'Y',
  set: (v: boolean) => (form.value.brushtask_stop_switch = v ? 'Y' : 'N'),
});

function toggleWeekday(day: string) {
  const arr = activeWeekdaysArray.value as string[];
  const idx = arr.indexOf(day);
  activeWeekdaysArray.value =
    idx === -1 ? [...arr, day] : arr.filter((v) => v !== day);
}

const brushRules = ref<Array<{ label: string; value: number }>>([]);
const rssRules = ref<Array<{ label: string; value: number }>>([]);
const removeRules = ref<Array<{ label: string; value: number }>>([]);
const stopRules = ref<Array<{ label: string; value: number }>>([]);
const ruleLoading = ref(false);

function mapRules(list: BrushApi.BrushRule[]) {
  return list.map((r: BrushApi.BrushRule) => ({ label: r.name, value: r.id }));
}

async function loadBrushRules() {
  ruleLoading.value = true;
  try {
    const res: any = await getBrushRulesApi();
    const list: BrushApi.BrushRule[] = Array.isArray(res)
      ? res
      : res?.data || [];
    brushRules.value = mapRules(list);
    rssRules.value = mapRules(
      list.filter((r: any) => r.type === 'rss' || !r.type),
    );
    removeRules.value = mapRules(
      list.filter((r: any) => r.type === 'remove' || !r.type),
    );
    stopRules.value = mapRules(
      list.filter((r: any) => r.type === 'stop' || !r.type),
    );
  } catch {
    brushRules.value =
      rssRules.value =
      removeRules.value =
      stopRules.value =
        [];
  } finally {
    ruleLoading.value = false;
  }
}

function loadTask(task: BrushApi.BrushTask) {
  form.value = {
    ...defaultForm(),
    brushtask_id: task.id,
    brushtask_name: task.name || '',
    brushtask_site: String(task.site_id || task.site || ''),
    brushtask_interval: task.interval || '10',
    brushtask_downloader: task.downloader || '',
    brushtask_totalsize: task.seed_size == null ? '' : String(task.seed_size),
    brushtask_state: task.state || 'Y',
    brushtask_rssurl: task.rss_url_show || task.rss_url || '',
    brushtask_label: task.label || '',
    brushtask_savepath: task.savepath || '',
    brushtask_time_range: task.time_range || '',
    brushtask_active_weekdays: task.active_weekdays || '',
    brushtask_download_switch: task.download_switch || 'Y',
    brushtask_remove_switch: task.remove_switch || 'Y',
    brushtask_stop_switch: task.stop_switch || 'Y',
    brushtask_daily_delete_limit: task.daily_delete_limit || '',
    brushtask_max_seeding: task.max_seeding || '',
    brushtask_hr_limit: task.hr_limit || '',
    brushtask_sendmessage: !!task.sendmessage,
    brushtask_transfer: !!task.transfer,
    brushtask_rss_rule_id: task.rss_rule_id || undefined,
    brushtask_remove_rule_id: task.remove_rule_id || undefined,
    brushtask_stop_rule_id: task.stop_rule_id || undefined,
    brushtask_rss_rule_enabled: false,
    brushtask_remove_rule_enabled: false,
    brushtask_stop_rule_enabled: false,
  };
}

watch(
  () => props.task,
  async (task) => {
    await loadBrushRules();
    if (task) {
      loadTask(task);
    } else {
      form.value = defaultForm();
    }
  },
  { immediate: true },
);

const rules = {
  brushtask_name: {
    required: true,
    message: '请输入任务名称',
    trigger: 'blur',
  },
  brushtask_rule_id: {
    required: true,
    message: '请选择规则模板',
    trigger: ['blur', 'change'],
    validator(_rule: any, value: any) {
      if (value === undefined || value === null) {
        return new Error('请选择规则模板');
      }
      return true;
    },
  },
  brushtask_site: {
    required: true,
    message: '请选择站点',
    trigger: ['blur', 'change'],
    validator(_rule: any, value: any) {
      if (!value) {
        return new Error('请选择站点');
      }
      return true;
    },
  },
  brushtask_interval: {
    required: true,
    message: '请输入执行周期',
    trigger: 'blur',
  },
  brushtask_downloader: {
    required: true,
    message: '请选择下载器',
    trigger: ['blur', 'change'],
    validator(_rule: any, value: any) {
      if (!value) {
        return new Error('请选择下载器');
      }
      return true;
    },
  },
};

function handleSubmit() {
  formRef.value?.validate((errors: any) => {
    if (!errors) {
      emit('submit', { ...form.value });
    }
  });
}

function handleCancel() {
  emit('cancel');
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
</script>

<template>
  <NForm
    ref="formRef"
    :model="form"
    :rules="rules"
    label-placement="top"
    size="small"
    class="brush-form"
  >
    <!-- 阶段控制 -->
    <div class="form-section">
      <div class="form-section-title">
        <IconifyIcon icon="lucide:sliders-horizontal" class="h-4 w-4" />
        阶段控制
      </div>
      <ul class="phase-list">
        <li class="phase-list-item">
          <IconifyIcon icon="lucide:download" class="phase-list-icon" />
          <div class="phase-list-body">
            <span class="phase-list-title">新增下载</span>
            <span class="phase-list-desc">从站点RSS解析种子并添加到下载器</span>
          </div>
          <NSwitch v-model:value="downloadSwitchEnabled" />
        </li>
        <li class="phase-list-item">
          <IconifyIcon icon="lucide:pause-circle" class="phase-list-icon" />
          <div class="phase-list-body">
            <span class="phase-list-title">自动停种</span>
            <span class="phase-list-desc">达到停种条件时自动暂停种子任务</span>
          </div>
          <NSwitch v-model:value="stopSwitchEnabled" />
        </li>
        <li class="phase-list-item">
          <IconifyIcon icon="lucide:trash-2" class="phase-list-icon" />
          <div class="phase-list-body">
            <span class="phase-list-title">自动删种</span>
            <span class="phase-list-desc"
              >达到删种条件时自动删除种子及文件</span
            >
          </div>
          <NSwitch v-model:value="removeSwitchEnabled" />
        </li>
      </ul>
    </div>

    <!-- 基本信息 -->
    <div class="form-section">
      <div class="form-section-title">
        <IconifyIcon icon="lucide:settings-2" class="h-4 w-4" />
        基本信息
      </div>
      <div class="form-grid">
        <NFormItem label="任务名称" path="brushtask_name" required>
          <NInput
            v-model:value="form.brushtask_name"
            placeholder="请输入任务名称"
          />
        </NFormItem>
        <NFormItem label="站点" path="brushtask_site" required>
          <NSelect
            v-model:value="form.brushtask_site"
            :options="sites"
            placeholder="请选择站点"
            clearable
          />
        </NFormItem>
        <NFormItem label="执行周期" path="brushtask_interval" required>
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '执行周期',
                    '检查站点RSS更新的周期，为了减小站点压力，建议不小于5分钟，支持两种配置方式：1、间隔时间（分钟），如 10；2、5位cron表达式,如：*/30 * * * *（对应：分 时 日 月 星期）',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_interval"
            placeholder="10 或 */10 * * * *"
          />
        </NFormItem>
        <NFormItem label="下载器" path="brushtask_downloader" required>
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '下载器',
                    '选择刷流任务使用的下载器，在设置-下载器中添加，如需识别转移到媒体库，所选下载器也需启用监控功能',
                  )
              "
            />
          </template>
          <NSelect
            v-model:value="form.brushtask_downloader"
            :options="downloaders"
            placeholder="请选择下载器"
            clearable
          />
        </NFormItem>
        <NFormItem path="brushtask_totalsize">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '保种体积(GB)',
                    '当前刷流任务下载做种超过设定的体积大小时不再新增下载',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_totalsize"
            placeholder="留空不限制"
          />
        </NFormItem>
        <NFormItem path="brushtask_daily_delete_limit">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '每日删种上限',
                    '每天最多删除种子个数，保护账号，留空不限制',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_daily_delete_limit"
            placeholder="留空不限制"
          />
        </NFormItem>
        <NFormItem path="brushtask_max_seeding">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '最大做种数',
                    '下载器中做种总数达到上限后停止新增下载，留空不限制',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_max_seeding"
            placeholder="留空不限制"
          />
        </NFormItem>
        <NFormItem path="brushtask_hr_limit">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    'H&R数量上限',
                    '全站H&R做种数达到上限后停止新增下载，留空不限制',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_hr_limit"
            placeholder="留空不限制"
          />
        </NFormItem>
        <NFormItem path="brushtask_label">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '标签',
                    '用户在下载器中标记该任务的种子，多个标签使用,分隔',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_label"
            placeholder="多个标签使用,分隔"
          />
        </NFormItem>
        <NFormItem path="brushtask_savepath">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '保存目录',
                    '为该刷新任务设置独立的保存目录，将会覆盖下载器中的目录设置，如果下载器为Qbittorrent还需要在Nexus Media下载器设置中关闭种子自动管理功能',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_savepath"
            placeholder="留空使用下载器设置"
          />
        </NFormItem>
      </div>
    </div>

    <!-- 时间调度 -->
    <div class="form-section">
      <div class="form-section-title">
        <IconifyIcon icon="lucide:clock" class="h-4 w-4" />
        时间调度
      </div>
      <div class="form-grid">
        <NFormItem path="brushtask_time_range">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '开启时间段',
                    '格式 HH:MM-HH:MM，多个时间段逗号分隔，为空不限制',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_time_range"
            placeholder="如: 08:00-22:00"
          />
        </NFormItem>
        <NFormItem path="brushtask_active_weekdays" class="form-col-span-2">
          <template #label>
            <component
              :is="() => labelWithHelp('活跃星期', '不选表示每天都运行')"
            />
          </template>
          <div class="weekday-group">
            <NButton
              v-for="item in weekdayOptions"
              :key="item.value"
              :type="
                activeWeekdaysArray.includes(item.value) ? 'primary' : 'default'
              "
              size="small"
              @click="toggleWeekday(item.value)"
            >
              {{ item.label }}
            </NButton>
          </div>
        </NFormItem>
      </div>
    </div>

    <!-- 规则模板 -->
    <div class="form-section">
      <div class="form-section-title">
        <IconifyIcon icon="lucide:layers" class="h-4 w-4" />
        规则模板
      </div>
      <div class="form-grid form-grid--rules">
        <NFormItem>
          <template #label>
            <span class="rule-label"
              ><span class="rule-dot dot-rss"></span> 选种规则</span
            >
          </template>
          <NSelect
            v-model:value="form.brushtask_rss_rule_id"
            :options="rssRules"
            placeholder="不选则不处理"
            clearable
            :loading="ruleLoading"
          />
        </NFormItem>
        <NFormItem>
          <template #label>
            <span class="rule-label"
              ><span class="rule-dot dot-remove"></span> 删种规则</span
            >
          </template>
          <NSelect
            v-model:value="form.brushtask_remove_rule_id"
            :options="removeRules"
            placeholder="不选则不处理"
            clearable
            :loading="ruleLoading"
          />
        </NFormItem>
        <NFormItem>
          <template #label>
            <span class="rule-label"
              ><span class="rule-dot dot-stop"></span> 停种规则</span
            >
          </template>
          <NSelect
            v-model:value="form.brushtask_stop_rule_id"
            :options="stopRules"
            placeholder="不选则不处理"
            clearable
            :loading="ruleLoading"
          />
        </NFormItem>
      </div>
    </div>

    <!-- RSS配置 -->
    <div class="form-section">
      <div class="form-section-title">
        <IconifyIcon icon="lucide:rss" class="h-4 w-4" />
        RSS配置
      </div>
      <div class="form-grid">
        <NFormItem path="brushtask_rssurl" class="form-col-span-3">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    'RSS地址',
                    '刷流优先使用此处填入的站点RSS，若为空则使用站点配置RSS地址',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_rssurl"
            placeholder="站点RSS订阅URL，若为空则使用站点配置RSS地址"
          />
        </NFormItem>
      </div>
    </div>

    <!-- 其他选项 -->
    <div class="form-section form-section-inline">
      <div class="form-section-title">
        <IconifyIcon icon="lucide:toggle-right" class="h-4 w-4" />
        其他选项
      </div>
      <ul class="phase-list">
        <li class="phase-list-item">
          <IconifyIcon icon="lucide:bell" class="phase-list-icon" />
          <div class="phase-list-body">
            <span class="phase-list-title">消息推送</span>
            <span class="phase-list-desc"
              >开启后将当前任务的情况进行推送通知</span
            >
          </div>
          <NSwitch v-model:value="form.brushtask_sendmessage" />
        </li>
        <li class="phase-list-item">
          <IconifyIcon icon="lucide:folder-sync" class="phase-list-icon" />
          <div class="phase-list-body">
            <span class="phase-list-title">转移到媒体库</span>
            <span class="phase-list-desc"
              >开启后自动识别重命名并整理到媒体库目录</span
            >
          </div>
          <NSwitch v-model:value="form.brushtask_transfer" />
        </li>
      </ul>
    </div>

    <!-- 底部按钮 -->
    <div class="form-footer">
      <NSpace>
        <NButton type="primary" @click="handleSubmit">
          <template #icon>
            <IconifyIcon icon="lucide:check" class="h-4 w-4" />
          </template>
          {{ isEdit ? '保存' : '创建' }}
        </NButton>
        <NButton @click="handleCancel">
          <template #icon>
            <IconifyIcon icon="lucide:x" class="h-4 w-4" />
          </template>
          取消
        </NButton>
      </NSpace>
    </div>
  </NForm>
</template>

<style scoped>
.brush-form {
  padding: 0.5rem;
}

/* ===== 阶段控制 ===== */

.form-section {
  margin-bottom: 0.75rem;
}

.form-section-title {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem 1rem;
}

.phase-list {
  padding: 0;
  margin: 0;
  overflow: hidden;
  list-style: none;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.phase-list-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.625rem 0.875rem;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.phase-list-item:last-child {
  border-bottom: none;
}

.phase-list-icon {
  flex-shrink: 0;
  font-size: 1.125rem;
  color: hsl(var(--muted-foreground));
}

.phase-list-body {
  flex: 1;
  min-width: 0;
}

.phase-list-title {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.phase-list-desc {
  display: block;
  margin-top: 1px;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.form-col-span-3 {
  grid-column: span 3;
}

.form-col-span-2 {
  grid-column: span 2;
}

.form-section-inline {
  padding: 0.5rem 0;
}

.form-grid-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
}

.form-grid-inline :deep(.n-form-item) {
  margin-bottom: 0;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
  margin-top: 1.5rem;
  border-top: 1px solid hsl(var(--border));
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

/* ===== 规则选择三列 ===== */
.rule-label {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.rule-dot {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.dot-rss {
  background: hsl(var(--primary));
}

.dot-remove {
  background: hsl(var(--destructive));
}

.dot-stop {
  background: hsl(var(--success));
}

.weekday-group {
  display: inline-flex;
}

.weekday-group :deep(.n-button) {
  border-radius: 0;
}

.weekday-group :deep(.n-button:first-child) {
  border-radius: 3px 0 0 3px;
}

.weekday-group :deep(.n-button:last-child) {
  border-radius: 0 3px 3px 0;
}

.weekday-group :deep(.n-button:not(:first-child)) {
  margin-left: -1px;
}

.weekday-group :deep(.n-button--default-type) {
  color: hsl(var(--muted-foreground));
  border-color: hsl(var(--border));
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-col-span-3 {
    grid-column: span 1;
  }
}
</style>
