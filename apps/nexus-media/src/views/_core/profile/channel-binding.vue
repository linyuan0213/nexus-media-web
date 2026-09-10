<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NEmpty, NPopconfirm, NTag } from 'naive-ui';

import { message } from '#/adapter/naive';
import {
  createChannelBindCodeApi,
  createChannelBindingApi,
  deleteChannelBindingApi,
  getChannelBindingsApi,
} from '#/api/modules/rbac';

interface Binding {
  id: number;
  channel: string;
  channel_user_id: string;
  created_at?: null | string;
}

const loading = ref(false);
const bindings = ref<Binding[]>([]);

// 绑定码
const bindCode = ref('');
const bindCodeTTL = ref(0);
let countdownTimer: null | ReturnType<typeof setInterval> = null;

// 推送渠道登记
const pushChannel = ref('bark');
const pushKey = ref('');
const pushSaving = ref(false);

const INTERACTIVE_CHANNELS = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'wechat', label: '企业微信' },
  { value: 'slack', label: 'Slack' },
  { value: 'synologychat', label: 'Synology Chat' },
];

const PUSH_CHANNELS = [
  {
    value: 'bark',
    label: 'Bark',
    hint: 'Bark App 首页地址中的 Key（api.day.app/<KEY>/）',
  },
  {
    value: 'ntfy',
    label: 'Ntfy',
    hint: '你的 ntfy topic 名称（自建或 ntfy.sh）',
  },
  { value: 'gotify', label: 'Gotify', hint: 'Gotify 后台创建应用的 Token' },
  {
    value: 'serverchan',
    label: 'Server酱',
    hint: 'Server酱官网登录后的 SendKey',
  },
  { value: 'pushplus', label: 'PushPlus', hint: 'PushPlus 个人中心的 token' },
  { value: 'pushdeer', label: 'PushDeer', hint: 'PushDeer App 内的 PushKey' },
  {
    value: 'dingtalk',
    label: '钉钉',
    hint: '群机器人 webhook 的 access_token',
  },
  { value: 'chanify', label: 'Chanify', hint: 'Chanify App 的 Token' },
];

const pushHint = computed(
  () => PUSH_CHANNELS.find((c) => c.value === pushChannel.value)?.hint || '',
);

const channelLabelMap = computed(() => {
  const map: Record<string, string> = {};
  for (const c of [...INTERACTIVE_CHANNELS, ...PUSH_CHANNELS]) {
    map[c.value] = c.label;
  }
  return map;
});

const ttlText = computed(() => {
  const m = Math.floor(bindCodeTTL.value / 60);
  const sec = bindCodeTTL.value % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
});

async function fetchBindings() {
  loading.value = true;
  try {
    const res: any = await getChannelBindingsApi();
    bindings.value = Array.isArray(res) ? res : res?.data || [];
  } catch {
    bindings.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleCreateCode() {
  try {
    const res: any = await createChannelBindCodeApi();
    const data = res?.data ?? res ?? {};
    bindCode.value = data.code || '';
    bindCodeTTL.value = data.ttl || 600;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      bindCodeTTL.value -= 1;
      if (bindCodeTTL.value <= 0) {
        bindCode.value = '';
        bindCodeTTL.value = 0;
        if (countdownTimer) clearInterval(countdownTimer);
        fetchBindings();
      }
    }, 1000);
  } catch (error: any) {
    message.error(error?.message || '生成绑定码失败');
  }
}

async function handleAddPushBinding() {
  const key = pushKey.value.trim();
  if (!key) {
    message.warning('请输入推送 Key');
    return;
  }
  pushSaving.value = true;
  try {
    await createChannelBindingApi({
      channel: pushChannel.value,
      channel_user_id: key,
    });
    message.success('绑定成功');
    pushKey.value = '';
    await fetchBindings();
  } catch (error: any) {
    message.error(error?.message || '绑定失败');
  } finally {
    pushSaving.value = false;
  }
}

async function handleUnbind(row: Binding) {
  try {
    await deleteChannelBindingApi({
      channel: row.channel,
      channel_user_id: row.channel_user_id,
    });
    message.success('已解绑');
    await fetchBindings();
  } catch (error: any) {
    message.error(error?.message || '解绑失败');
  }
}

function maskKey(key: string): string {
  if (key.length <= 6) return key;
  return `${key.slice(0, 3)}****${key.slice(-3)}`;
}

onMounted(fetchBindings);
onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});
</script>

<template>
  <div class="channel-binding">
    <!-- 交互渠道绑定 -->
    <div class="cb-section">
      <div class="cb-section-title">
        <IconifyIcon icon="lucide:message-square-link" class="size-4" />
        交互渠道绑定（Telegram / 企业微信 / Slack）
      </div>
      <p class="cb-desc">
        生成绑定码后，在对应 IM 中向机器人发送
        <code>/bind 绑定码</code> 即可完成绑定。绑定后可直接在 IM
        中搜索、订阅、接收通知。
      </p>
      <div class="cb-code-row">
        <template v-if="bindCode">
          <div class="cb-code">{{ bindCode }}</div>
          <div class="cb-ttl">{{ ttlText }} 后失效</div>
        </template>
        <NButton v-else type="primary" size="small" @click="handleCreateCode">
          <template #icon>
            <IconifyIcon icon="lucide:key-round" class="size-4" />
          </template>
          生成绑定码
        </NButton>
      </div>
    </div>

    <!-- 推送渠道登记 -->
    <div class="cb-section">
      <div class="cb-section-title">
        <IconifyIcon icon="lucide:bell-ring" class="size-4" />
        推送渠道（Bark / Ntfy 等）
      </div>
      <p class="cb-desc">
        登记你自己的推送 Key，订阅/下载完成等通知会定向推送到你的设备。
      </p>
      <div class="cb-push-row">
        <select v-model="pushChannel" class="cb-select">
          <option v-for="c in PUSH_CHANNELS" :key="c.value" :value="c.value">
            {{ c.label }}
          </option>
        </select>
        <input
          v-model="pushKey"
          class="cb-input"
          :placeholder="pushHint || '推送 Key / Token'"
          type="text"
          @keyup.enter="handleAddPushBinding"
        />
        <NButton
          type="primary"
          size="small"
          :loading="pushSaving"
          @click="handleAddPushBinding"
        >
          添加
        </NButton>
      </div>
    </div>

    <!-- 绑定列表 -->
    <div class="cb-section">
      <div class="cb-section-title">
        <IconifyIcon icon="lucide:link-2" class="size-4" />
        已绑定的渠道
      </div>
      <div v-if="bindings.length > 0" v-loading="loading" class="cb-list">
        <div v-for="row in bindings" :key="row.id" class="cb-row">
          <NTag size="small" class="cb-channel-tag">
            {{ channelLabelMap[row.channel] || row.channel }}
          </NTag>
          <span class="cb-target" :title="row.channel_user_id">
            {{ maskKey(row.channel_user_id) }}
          </span>
          <span v-if="row.created_at" class="cb-time">{{
            row.created_at
          }}</span>
          <NPopconfirm @positive-click="handleUnbind(row)">
            <template #trigger>
              <button type="button" class="cb-unbind-btn" title="解绑">
                <IconifyIcon icon="lucide:unlink" class="size-3.5" />
              </button>
            </template>
            确定解绑该渠道吗？
          </NPopconfirm>
        </div>
      </div>
      <NEmpty v-else description="暂无绑定的渠道" size="small" />
    </div>
  </div>
</template>

<style scoped>
.channel-binding {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cb-section {
  padding: 1rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
}

.cb-section-title {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.cb-desc {
  margin-top: 0.4rem;
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.cb-desc code {
  padding: 0.1rem 0.35rem;
  font-size: 11px;
  background: hsl(var(--muted) / 40%);
  border-radius: 0.25rem;
}

.cb-code-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.75rem;
}

.cb-code {
  padding: 0.3rem 0.9rem;
  font-family: ui-monospace, monospace;
  font-size: 22px;
  font-weight: 700;
  color: hsl(var(--primary));
  letter-spacing: 0.2em;
  background: hsl(var(--primary) / 8%);
  border: 1px dashed hsl(var(--primary) / 40%);
  border-radius: 0.5rem;
}

.cb-ttl {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.cb-push-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.75rem;
}

.cb-select,
.cb-input {
  height: 30px;
  padding: 0 0.6rem;
  font-size: 12px;
  color: hsl(var(--foreground));
  outline: none;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
}

.cb-select:focus,
.cb-input:focus {
  border-color: hsl(var(--primary));
}

.cb-input {
  flex: 1;
  min-width: 12rem;
}

.cb-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.cb-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  padding: 0.4rem 0.6rem;
  background: hsl(var(--muted) / 16%);
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 0.4rem;
}

.cb-channel-tag {
  flex-shrink: 0;
}

.cb-target {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.cb-time {
  flex-shrink: 0;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.cb-unbind-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 9999px;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.cb-unbind-btn:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
}

@media (max-width: 640px) {
  .cb-code {
    font-size: 18px;
  }
}
</style>
