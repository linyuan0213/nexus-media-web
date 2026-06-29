<script lang="ts" setup>
import type { SiteForm, SiteItem } from '../types';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
} from 'naive-ui';

interface Props {
  show: boolean;
  site: null | SiteForm;
  filterGroups: any[];
  downloadSettings: any[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:site', value: SiteForm): void;
  (e: 'save'): void;
}>();

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
});

const activeTab = ref('basic');

const modalTitle = computed(() => (props.site?.id ? '编辑站点' : '新增站点'));

const rateLimitOptions = [
  { label: '不限流', value: '' },
  { label: '每秒 1 次', value: '1/s' },
  { label: '每秒 2 次', value: '2/s' },
  { label: '每分钟 5 次', value: '5/m' },
  { label: '每分钟 10 次（默认）', value: '10/m' },
  { label: '每分钟 20 次', value: '20/m' },
  { label: '每小时 50 次', value: '50/h' },
  { label: '每小时 100 次', value: '100/h' },
];

const featureSwitches = computed(() => [
  {
    key: 'rss_enable' as const,
    label: 'RSS订阅',
    desc: '自动获取种子列表',
    icon: 'lucide:rss',
  },
  {
    key: 'brush_enable' as const,
    label: '刷流任务',
    desc: '自动下载免费种子',
    icon: 'lucide:zap',
  },
  {
    key: 'statistic_enable' as const,
    label: '数据统计',
    desc: '上传下载做种统计',
    icon: 'lucide:bar-chart-3',
  },
  {
    key: 'parse' as const,
    label: '解析种子详情',
    desc: '获取种子详细信息',
    icon: 'lucide:file-search',
  },
  {
    key: 'unread_msg_notify' as const,
    label: '消息通知',
    desc: '未读消息提醒',
    icon: 'lucide:bell',
  },
  {
    key: 'chrome' as const,
    label: '浏览器仿真',
    desc: '模拟浏览器访问',
    icon: 'lucide:chrome',
  },
  {
    key: 'proxy' as const,
    label: '使用代理',
    desc: '通过代理访问站点',
    icon: 'lucide:globe',
  },
  {
    key: 'subtitle' as const,
    label: '下载字幕',
    desc: '自动获取字幕文件',
    icon: 'lucide:subtitles',
  },
  {
    key: 'tag' as const,
    label: '下载器标签',
    desc: '添加站点标签',
    icon: 'lucide:tag',
  },
]);

function updateField<K extends keyof SiteForm>(key: K, value: SiteForm[K]) {
  if (!props.site) return;
  emit('update:site', { ...props.site, [key]: value });
}

function handleSave() {
  emit('save');
}

function parseSiteToForm(item: SiteItem): SiteForm {
  const note = item.note || {};
  const isNoteStr = typeof item.note === 'string';
  const parsedNote = isNoteStr
    ? (() => {
        try {
          return JSON.parse(item.note as string);
        } catch {
          return {};
        }
      })()
    : note;

  return {
    id: item.id,
    name: item.name || '',
    pri: String(item.pri ?? '1'),
    signurl: item.signurl || '',
    cookie: item.cookie || '',
    api_key: item.api_key || '',
    bearer_token: item.bearer_token || '',
    rssurl: item.rssurl || '',
    public: !!item.public,
    rss_enable: !!item.rss_enable,
    brush_enable: !!item.brush_enable,
    statistic_enable: !!item.statistic_enable,
    parse: !!parsedNote?.parse,
    unread_msg_notify: !!parsedNote?.message,
    chrome: !!parsedNote?.chrome,
    proxy: !!parsedNote?.proxy,
    subtitle: !!parsedNote?.subtitle,
    tag: !!parsedNote?.tag,
    ua: parsedNote?.ua || '',
    headers: item.headers || parsedNote?.headers || '',
    rule: parsedNote?.rule || '',
    download_setting: parsedNote?.download_setting || '',
    rate_limit: parsedNote?.rate_limit || '10/m',
    rate_burst: String(parsedNote?.rate_burst || '10'),
  };
}

function buildNote(form: SiteForm): string {
  const note: Record<string, any> = {};
  if (form.rule) note.rule = form.rule;
  if (form.download_setting) note.download_setting = form.download_setting;
  note.parse = form.parse;
  if (form.ua) note.ua = form.ua;
  if (form.headers) note.headers = form.headers;
  note.chrome = form.chrome;
  note.proxy = form.proxy;
  note.message = form.unread_msg_notify;
  note.subtitle = form.subtitle;
  note.tag = form.tag;
  note.public = form.public;
  if (form.rate_limit) note.rate_limit = form.rate_limit;
  if (form.rate_burst) note.rate_burst = form.rate_burst;
  return JSON.stringify(note);
}

function buildSavePayload(form: SiteForm): any {
  const uses: string[] = [];
  const hasAuth = !!(
    form.cookie ||
    form.api_key ||
    form.bearer_token ||
    form.headers
  );
  if (form.rss_enable && form.rssurl) uses.push('D');
  if (form.brush_enable && form.rssurl && hasAuth) uses.push('S');
  if (form.statistic_enable && (form.rssurl || form.signurl) && hasAuth)
    uses.push('T');

  return {
    id: form.id,
    name: form.name,
    pri: form.pri,
    signurl: form.signurl,
    rssurl: form.rssurl,
    cookie: form.cookie,
    api_key: form.api_key,
    bearer_token: form.bearer_token,
    headers: form.headers,
    note: buildNote(form),
    include: uses.join(''),
    rss_enable: form.rss_enable,
    brush_enable: form.brush_enable,
    statistic_enable: form.statistic_enable,
  };
}

defineExpose({
  parseSiteToForm,
  buildSavePayload,
});
</script>

<template>
  <NModal
    v-model:show="visible"
    :title="modalTitle"
    preset="card"
    class="site-edit-modal"
    :style="{ width: '720px', maxWidth: '92vw' }"
    :bordered="false"
    :segmented="{ content: true }"
  >
    <NForm
      v-if="site"
      label-placement="left"
      label-width="110"
      size="small"
      class="site-edit-form"
    >
      <NTabs v-model:value="activeTab" type="line" class="edit-tabs">
        <NTabPane name="basic" tab="基础信息">
          <div class="tab-panel">
            <div class="form-grid-2">
              <NFormItem label="名称" required>
                <NInput
                  :value="site.name"
                  placeholder="自定义站点名称"
                  @update:value="(v) => updateField('name', v)"
                />
              </NFormItem>
              <NFormItem label="优先级" required>
                <NInput
                  :value="site.pri"
                  placeholder="1-50，越小优先级越高"
                  @update:value="(v) => updateField('pri', v)"
                />
              </NFormItem>
            </div>
            <NFormItem label="站点地址" required>
              <NInput
                :value="site.signurl"
                placeholder="https://example.com"
                @update:value="(v) => updateField('signurl', v)"
              />
            </NFormItem>
            <div class="form-grid-2">
              <NFormItem label="站点类型">
                <div class="inline-flex items-center gap-2">
                  <NSwitch
                    :value="site.public"
                    @update:value="(v) => updateField('public', v)"
                  />
                  <span class="type-hint">
                    {{ site.public ? 'BT站点（公开）' : 'PT站点（私有）' }}
                  </span>
                </div>
              </NFormItem>
              <NFormItem label="过滤规则">
                <NSelect
                  :value="site.rule"
                  :options="filterGroups"
                  clearable
                  @update:value="(v) => updateField('rule', v)"
                />
              </NFormItem>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="auth" tab="认证信息">
          <div class="tab-panel">
            <div class="form-grid-2">
              <NFormItem label="Cookie">
                <NInput
                  :value="site.cookie"
                  type="textarea"
                  :rows="2"
                  placeholder="站点Cookie"
                  @update:value="(v) => updateField('cookie', v)"
                />
              </NFormItem>
              <NFormItem label="API Key">
                <NInput
                  :value="site.api_key"
                  type="password"
                  show-password-on="click"
                  placeholder="站点API Key"
                  @update:value="(v) => updateField('api_key', v)"
                />
              </NFormItem>
            </div>
            <div class="form-grid-2">
              <NFormItem label="Bearer Token">
                <NInput
                  :value="site.bearer_token"
                  type="password"
                  show-password-on="click"
                  placeholder="站点Bearer Token"
                  @update:value="(v) => updateField('bearer_token', v)"
                />
              </NFormItem>
              <NFormItem label="User-Agent">
                <NInput
                  :value="site.ua"
                  placeholder="站点访问User-Agent，为空使用全局配置"
                  @update:value="(v) => updateField('ua', v)"
                />
              </NFormItem>
            </div>
            <NCollapse class="auth-advanced">
              <NCollapseItem title="高级请求头">
                <NFormItem label="自定义请求头 (JSON)">
                  <NInput
                    :value="site.headers"
                    type="textarea"
                    :rows="3"
                    placeholder='自定义请求头参数，格式 {"xxx": "xxx"}'
                    @update:value="(v) => updateField('headers', v)"
                  />
                </NFormItem>
              </NCollapseItem>
            </NCollapse>
          </div>
        </NTabPane>

        <NTabPane name="rss" tab="RSS设置">
          <div class="tab-panel">
            <NFormItem label="RSS订阅地址">
              <NInput
                :value="site.rssurl"
                placeholder="站点RSS订阅URL"
                @update:value="(v) => updateField('rssurl', v)"
              />
            </NFormItem>
            <NFormItem label="下载设置">
              <NSelect
                :value="site.download_setting"
                :options="downloadSettings"
                clearable
                @update:value="(v) => updateField('download_setting', v)"
              />
            </NFormItem>
          </div>
        </NTabPane>

        <NTabPane name="features" tab="功能开关">
          <div class="tab-panel">
            <div class="switch-grid">
              <div
                v-for="item in featureSwitches"
                :key="item.key"
                class="switch-card"
                :class="{ 'switch-card-on': site[item.key] }"
              >
                <div class="switch-card-main">
                  <div class="switch-card-icon">
                    <IconifyIcon :icon="item.icon" class="h-4 w-4" />
                  </div>
                  <div class="switch-card-info">
                    <span class="switch-card-label">{{ item.label }}</span>
                    <span class="switch-card-desc">{{ item.desc }}</span>
                  </div>
                </div>
                <NSwitch
                  :value="site[item.key]"
                  size="small"
                  @update:value="(v) => updateField(item.key, v)"
                />
              </div>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="rate" tab="限流配置">
          <div class="tab-panel">
            <div class="form-grid-2">
              <NFormItem label="速率限制">
                <NSelect
                  :value="site.rate_limit"
                  :options="rateLimitOptions"
                  @update:value="(v) => updateField('rate_limit', v)"
                />
              </NFormItem>
              <NFormItem label="突发容量">
                <NInput
                  :value="site.rate_burst"
                  placeholder="10"
                  @update:value="(v) => updateField('rate_burst', v)"
                />
              </NFormItem>
            </div>
            <div class="form-hint">
              <IconifyIcon icon="lucide:info" class="h-3 w-3" />
              <span
                >速率格式：次数/单位（s=秒, m=分钟, h=小时）。PT 站点建议设置为
                10/m 或更低，防止触发站点流控。</span
              >
            </div>
          </div>
        </NTabPane>
      </NTabs>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton size="small" @click="visible = false">取消</NButton>
        <NButton type="primary" size="small" @click="handleSave">
          保存
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.site-edit-modal :deep(.n-card-header) {
  padding: 1rem 1.25rem;
}

.site-edit-modal :deep(.n-card__content) {
  max-height: 70vh;
  padding: 0.5rem 1.25rem 0.75rem;
  overflow-y: auto;
}

.site-edit-form {
  padding-bottom: 0.5rem;
}

.edit-tabs :deep(.n-tabs-nav) {
  margin-bottom: 0.5rem;
}

.tab-panel {
  padding-top: 0.25rem;
}

.type-hint {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.inline-flex {
  display: inline-flex;
}

.items-center {
  align-items: center;
}

.gap-2 {
  gap: 0.5rem;
}

.form-hint {
  display: flex;
  gap: 0.375rem;
  align-items: flex-start;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.form-hint .iconify {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.auth-advanced {
  margin-top: 0.5rem;
}

.auth-advanced :deep(.n-collapse-item__header) {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;
}

.switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.switch-card:hover {
  background-color: hsl(var(--accent) / 20%);
  border-color: hsl(var(--primary) / 30%);
}

.switch-card-on {
  background-color: hsl(var(--primary) / 6%);
  border-color: hsl(var(--primary) / 40%);
}

.switch-card-on .switch-card-icon {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 15%);
}

.switch-card-main {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  min-width: 0;
}

.switch-card-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 30%);
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.switch-card-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.switch-card-label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.switch-card-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

@media (max-width: 640px) {
  .site-edit-modal :deep(.n-card__content) {
    padding: 0.5rem 0.625rem;
  }

  .form-grid-2,
  .switch-grid {
    grid-template-columns: 1fr;
  }

  .switch-card {
    padding: 0.5rem 0.625rem;
  }

  .switch-card-desc {
    display: none;
  }
}
</style>
