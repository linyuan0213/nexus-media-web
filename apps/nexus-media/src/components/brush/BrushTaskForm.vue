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
  brushtask_sendmessage: boolean;
  brushtask_transfer: boolean;
  brushtask_rule_id: number | undefined;
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
    brushtask_sendmessage: false,
    brushtask_transfer: false,
    brushtask_rule_id: undefined,
  };
}

const form = ref<BrushTaskFormData>(defaultForm());

const isEdit = computed(() => !!props.task?.id);

const brushRules = ref<Array<{ label: string; value: number }>>([]);
const ruleLoading = ref(false);

async function loadBrushRules() {
  ruleLoading.value = true;
  try {
    const res: any = await getBrushRulesApi();
    const list = Array.isArray(res) ? res : res?.data || [];
    brushRules.value = list.map((r: BrushApi.BrushRule) => ({
      label: r.name,
      value: r.id,
    }));
  } catch {
    brushRules.value = [];
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
    brushtask_sendmessage: !!task.sendmessage,
    brushtask_transfer: !!task.transfer,
    brushtask_rule_id: task.rule_id || undefined,
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
    trigger: 'change',
  },
  brushtask_site: { required: true, message: '请选择站点', trigger: 'change' },
  brushtask_interval: {
    required: true,
    message: '请输入执行周期',
    trigger: 'blur',
  },
  brushtask_downloader: {
    required: true,
    message: '请选择下载器',
    trigger: 'change',
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
        <NFormItem path="brushtask_rule_id" required>
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '规则模板',
                    '选择已保存的刷流规则模板，选种/删种/停种规则从模板读取',
                  )
              "
            />
          </template>
          <NSelect
            v-model:value="form.brushtask_rule_id"
            :options="brushRules"
            placeholder="请选择规则模板"
            clearable
            :loading="ruleLoading"
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
        <NFormItem path="brushtask_time_range">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '开启时间段',
                    '为该刷新任务设置独立的刷流时间段格式为HH:MM-HH:MM，支持多个时间段按逗号分隔，为空不开启',
                  )
              "
            />
          </template>
          <NInput
            v-model:value="form.brushtask_time_range"
            placeholder="如: 08:00-22:00"
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

    <!-- 开关 -->
    <div class="form-section form-section-inline">
      <div class="form-grid-inline">
        <NFormItem path="brushtask_sendmessage">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp('消息推送', '开启后会将当前任务的情况进行推送')
              "
            />
          </template>
          <NSwitch v-model:value="form.brushtask_sendmessage" />
        </NFormItem>
        <NFormItem path="brushtask_transfer">
          <template #label>
            <component
              :is="
                () =>
                  labelWithHelp(
                    '转移到媒体库',
                    '开启后刷流的下载也会进行转移并识别重命名到媒体库',
                  )
              "
            />
          </template>
          <NSwitch v-model:value="form.brushtask_transfer" />
        </NFormItem>
      </div>
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

.form-col-span-3 {
  grid-column: span 3;
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

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
