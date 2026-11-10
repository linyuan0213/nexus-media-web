<script setup lang="ts">
import type { SecurityApi } from '#/api/modules/security';

import { onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NInput, NModal, NPopconfirm, NSpin } from 'naive-ui';

import { message } from '#/adapter/naive';
import { getUserInfoApi } from '#/api';
import {
  disableTOTPApi,
  enableTOTPApi,
  getSessionsApi,
  getTOTPStatusApi,
  revokeOtherSessionsApi,
  revokeSessionApi,
  setupTOTPApi,
} from '#/api/modules/security';

const userInfo = ref<{
  is_superadmin?: boolean;
  roles?: string[];
  username?: string;
}>({});

const sessions = ref<SecurityApi.SessionItem[]>([]);
const loading = ref(false);
const totp = ref<SecurityApi.TOTPStatus>({ configured: false, enabled: false });

const setupVisible = ref(false);
const setupData = ref<SecurityApi.TOTPSetupResult>({
  qr_data_uri: '',
  secret: '',
  uri: '',
});
const setupCode = ref('');
const setupLoading = ref(false);
const recoveryVisible = ref(false);
const recoveryCodes = ref<string[]>([]);

const disableVisible = ref(false);
const disablePassword = ref('');
const disableCode = ref('');
const disableLoading = ref(false);

function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T;
}

function deviceLabel(item: SecurityApi.SessionItem): string {
  const parts = [item.device_model, item.os, item.browser].filter(
    (value) => value && value !== 'Unknown',
  ) as string[];
  const unique = parts.filter(
    (value, index) =>
      parts.findIndex(
        (candidate) => candidate.toLowerCase() === value.toLowerCase(),
      ) === index,
  );
  return unique.join(' · ') || '未知设备';
}

async function fetchUserInfo() {
  try {
    const res: any = await getUserInfoApi();
    const data = res?.data ?? res ?? {};
    userInfo.value = {
      username: data.username,
      roles: data.roles || [],
      is_superadmin: data.is_superadmin,
    };
  } catch {
    // ignore
  }
}

async function fetchSessions() {
  loading.value = true;
  try {
    sessions.value =
      unwrap<SecurityApi.SessionItem[]>(await getSessionsApi()) || [];
  } catch (error: any) {
    message.error(error?.message || '获取登录设备失败');
  } finally {
    loading.value = false;
  }
}

async function fetchTotp() {
  try {
    totp.value = unwrap<SecurityApi.TOTPStatus>(await getTOTPStatusApi());
  } catch {
    // ignore
  }
}

async function revoke(item: SecurityApi.SessionItem) {
  try {
    await revokeSessionApi(item.session_id);
    message.success('该设备已退出登录');
    await fetchSessions();
  } catch (error: any) {
    message.error(error?.message || '退出失败');
  }
}

async function revokeOthers() {
  try {
    const result = unwrap<{ revoked: number }>(await revokeOtherSessionsApi());
    message.success(`已退出 ${result?.revoked ?? 0} 个其他设备`);
    await fetchSessions();
  } catch (error: any) {
    message.error(error?.message || '操作失败');
  }
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success(`${label}已复制`);
  } catch {
    message.error('复制失败');
  }
}

async function startSetup() {
  try {
    setupData.value = unwrap<SecurityApi.TOTPSetupResult>(await setupTOTPApi());
    setupCode.value = '';
    setupVisible.value = true;
  } catch (error: any) {
    message.error(error?.message || '开启两步验证失败');
  }
}

async function confirmSetup() {
  if (!setupCode.value.trim()) {
    message.warning('请输入验证器中的 6 位验证码');
    return;
  }
  setupLoading.value = true;
  try {
    const result = unwrap<{ recovery_codes: string[] }>(
      await enableTOTPApi(setupCode.value.trim()),
    );
    recoveryCodes.value = result?.recovery_codes || [];
    setupVisible.value = false;
    recoveryVisible.value = true;
    await fetchTotp();
  } catch (error: any) {
    message.error(error?.message || '验证码错误');
  } finally {
    setupLoading.value = false;
  }
}

function exportRecoveryPdf() {
  const win = window.open('', '_blank', 'width=760,height=900');
  if (!win) {
    message.error('浏览器阻止了弹窗，请允许后重试');
    return;
  }
  const account = (userInfo.value.username || 'Nexus Media 用户').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] || char,
  );
  const codes = recoveryCodes.value
    .map((code) => `<li><code>${code}</code></li>`)
    .join('');
  const generatedAt = new Date().toLocaleString('zh-CN');
  win.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>Nexus Media 两步验证恢复码</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif; color: #111; margin: 48px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .meta { color: #555; font-size: 13px; line-height: 1.8; }
  .warning { margin: 20px 0; padding: 12px 14px; background: #f5f5f5; border-left: 3px solid #111; font-size: 13px; }
  ul { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0; list-style: none; margin: 20px 0 0; }
  li { padding: 10px 12px; font-size: 15px; background: #f5f5f5; border-radius: 6px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  footer { margin-top: 28px; font-size: 12px; color: #777; }
  @media print { body { margin: 20mm; } .warning { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>Nexus Media 两步验证恢复码</h1>
  <div class="meta">账号：${account}<br />生成时间：${generatedAt}</div>
  <div class="warning">每个恢复码只能使用一次。请离线保存，不要通过聊天或邮件发送给他人。</div>
  <ul>${codes}</ul>
  <footer>如果怀疑泄露，请立即在安全设置中关闭并重新启用两步验证。</footer>
</body>
</html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 300);
}

async function confirmDisable() {
  if (!disablePassword.value || !disableCode.value.trim()) {
    message.warning('请输入密码和验证码');
    return;
  }
  disableLoading.value = true;
  try {
    await disableTOTPApi(disablePassword.value, disableCode.value.trim());
    disableVisible.value = false;
    disablePassword.value = '';
    disableCode.value = '';
    message.success('两步验证已关闭');
    await fetchTotp();
  } catch (error: any) {
    message.error(error?.message || '关闭失败');
  } finally {
    disableLoading.value = false;
  }
}

onMounted(() => {
  fetchUserInfo();
  fetchSessions();
  fetchTotp();
});
</script>

<template>
  <div class="profile-security">
    <div class="security-item">
      <div class="security-item-left">
        <div class="security-item-icon">
          <IconifyIcon icon="lucide:user" class="size-4" />
        </div>
        <div class="security-item-info">
          <div class="security-item-title">账户密码</div>
          <div class="security-item-desc">建议定期更换密码以保障账户安全</div>
        </div>
      </div>
      <span class="security-status security-status--success">
        <IconifyIcon icon="lucide:check-circle-2" class="size-3.5" />
        已设置
      </span>
    </div>

    <div class="security-item">
      <div class="security-item-left">
        <div class="security-item-icon">
          <IconifyIcon icon="lucide:shield" class="size-4" />
        </div>
        <div class="security-item-info">
          <div class="security-item-title">角色权限</div>
          <div class="security-item-desc">
            {{ userInfo.roles?.join(', ') || '普通用户' }}
          </div>
        </div>
      </div>
      <span
        class="security-status"
        :class="
          userInfo.is_superadmin
            ? 'security-status--warning'
            : 'security-status--muted'
        "
      >
        <span class="security-status-dot"></span>
        {{ userInfo.is_superadmin ? '超级管理员' : '普通用户' }}
      </span>
    </div>

    <div class="security-item">
      <div class="security-item-left">
        <div class="security-item-icon">
          <IconifyIcon icon="lucide:key-round" class="size-4" />
        </div>
        <div class="security-item-info">
          <div class="security-item-title">两步验证</div>
          <div class="security-item-desc">
            使用验证器生成动态验证码，防止密码泄露后被登录
          </div>
        </div>
      </div>
      <div class="security-actions">
        <span
          class="security-status"
          :class="
            totp.enabled ? 'security-status--success' : 'security-status--muted'
          "
        >
          <span class="security-status-dot"></span>
          {{ totp.enabled ? '已开启' : '未开启' }}
        </span>
        <NButton
          size="small"
          secondary
          :type="totp.enabled ? 'default' : 'primary'"
          @click="totp.enabled ? (disableVisible = true) : startSetup()"
        >
          <template #icon>
            <IconifyIcon
              :icon="totp.enabled ? 'lucide:shield-off' : 'lucide:shield-check'"
            />
          </template>
          {{ totp.enabled ? '关闭两步验证' : '启用两步验证' }}
        </NButton>
      </div>
    </div>

    <div class="security-section-header">
      <div>
        <div class="security-item-title">登录设备</div>
        <div class="security-item-desc">
          查看当前账户的登录设备，发现异常可立即退出该设备
        </div>
      </div>
      <NButton size="small" secondary @click="revokeOthers">
        <template #icon>
          <IconifyIcon icon="lucide:log-out" />
        </template>
        退出其他设备
      </NButton>
    </div>

    <NSpin :show="loading">
      <div v-if="sessions.length === 0" class="security-empty">
        暂无登录设备记录
      </div>
      <div
        v-for="item in sessions"
        :key="item.session_id"
        class="security-item security-session"
      >
        <div class="security-item-left">
          <div class="security-item-icon">
            <IconifyIcon
              :icon="
                item.device_type === 'mobile'
                  ? 'lucide:smartphone'
                  : 'lucide:monitor'
              "
              class="size-4"
            />
          </div>
          <div class="security-item-info">
            <div class="security-item-title">
              {{ deviceLabel(item) }}
              <span
                v-if="item.is_current"
                class="security-status security-status--success ml-2"
              >
                <span class="security-status-dot"></span>
                当前设备
              </span>
            </div>
            <div class="security-item-desc">
              {{ item.login_ip || '未知 IP' }} · 最近活跃
              {{ item.last_seen_at || item.created_at || '-' }}
            </div>
          </div>
        </div>
        <NPopconfirm
          v-if="!item.is_current && !item.revoked_at"
          @positive-click="revoke(item)"
        >
          <template #trigger>
            <NButton size="small" type="error" tertiary aria-label="退出该设备">
              <template #icon>
                <IconifyIcon icon="lucide:log-out" />
              </template>
              退出
            </NButton>
          </template>
          确认让该设备退出登录？
        </NPopconfirm>
        <span
          v-else-if="item.revoked_at"
          class="security-status security-status--muted"
        >
          已退出
        </span>
      </div>
    </NSpin>

    <NModal
      v-model:show="setupVisible"
      preset="card"
      title="启用两步验证"
      class="security-modal"
      style="width: 460px; max-width: 92vw"
    >
      <div class="totp-setup">
        <div class="totp-setup-head">
          <img
            v-if="setupData.qr_data_uri"
            :src="setupData.qr_data_uri"
            alt="两步验证二维码"
            class="totp-qr"
          />
          <div class="totp-setup-copy">
            <div class="totp-tip">使用验证器扫描二维码，或手动输入密钥。</div>
            <div class="totp-secret-row">
              <code>{{ setupData.secret }}</code>
              <NButton
                text
                type="primary"
                @click="copyText(setupData.secret, '密钥')"
              >
                复制
              </NButton>
            </div>
            <div class="totp-uri-label">otpauth 地址</div>
            <NInput :value="setupData.uri" readonly size="small" />
          </div>
        </div>
        <NInput
          v-model:value="setupCode"
          placeholder="输入验证器中的 6 位验证码"
          maxlength="6"
          class="totp-code-input"
        />
      </div>
      <template #footer>
        <div class="modal-footer">
          <NButton @click="setupVisible = false">取消</NButton>
          <NButton type="primary" :loading="setupLoading" @click="confirmSetup">
            确认启用
          </NButton>
        </div>
      </template>
    </NModal>

    <NModal
      v-model:show="recoveryVisible"
      preset="card"
      title="保存恢复码"
      class="security-modal"
      style="width: 460px; max-width: 92vw"
    >
      <div class="totp-tip">
        以下恢复码只显示一次，请离线保存。每使用一次即失效。
      </div>
      <div class="recovery-grid">
        <code v-for="code in recoveryCodes" :key="code">{{ code }}</code>
      </div>
      <template #footer>
        <div class="modal-footer">
          <NButton @click="exportRecoveryPdf">导出 PDF</NButton>
          <NButton type="primary" @click="recoveryVisible = false">
            我已保存
          </NButton>
        </div>
      </template>
    </NModal>

    <NModal
      v-model:show="disableVisible"
      preset="card"
      title="关闭两步验证"
      class="security-modal"
      style="width: 460px; max-width: 92vw"
    >
      <NInput
        v-model:value="disablePassword"
        type="password"
        show-password-on="click"
        placeholder="当前密码"
      />
      <NInput
        v-model:value="disableCode"
        placeholder="当前验证码"
        class="mt-3"
      />
      <template #footer>
        <div class="modal-footer">
          <NButton @click="disableVisible = false">取消</NButton>
          <NButton
            type="error"
            :loading="disableLoading"
            @click="confirmDisable"
          >
            确认关闭
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.profile-security {
  max-width: 720px;
}

.security-item,
.security-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  margin-bottom: 0.75rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
}

.security-section-header {
  margin-top: 1.5rem;
}

.security-item-left {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}

.security-item-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: calc(var(--radius) - 2px);
}

.security-item-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.security-item-desc {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.security-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
  align-items: center;
}

.security-status {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--muted));
  border-radius: 9999px;
}

.security-status--success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 12%);
}

.security-status--warning {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 14%);
}

.security-status--muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.security-status-dot {
  width: 0.375rem;
  height: 0.375rem;
  background: currentcolor;
  border-radius: 9999px;
}

.security-session {
  margin-bottom: 0.5rem;
}

.security-empty {
  padding: 1.5rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.security-modal {
  width: min(460px, 92vw);
}

.totp-setup-head {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.totp-qr {
  flex-shrink: 0;
  width: 168px;
  height: 168px;
  padding: 0.5rem;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
}

.totp-setup-copy {
  flex: 1;
  min-width: 0;
}

.totp-tip {
  margin-bottom: 0.65rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.totp-secret-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.7rem;
  background: hsl(var(--muted));
  border-radius: calc(var(--radius) - 4px);
}

.totp-secret-row code {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  font-size: 0.6875rem;
  white-space: nowrap;
}

.totp-uri-label {
  margin: 0.65rem 0 0.35rem;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.totp-code-input {
  margin-top: 1rem;
}

@media (max-width: 560px) {
  .totp-setup-head {
    flex-direction: column;
    align-items: stretch;
  }

  .totp-qr {
    align-self: center;
  }
}

.recovery-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.recovery-grid code {
  padding: 0.4rem;
  font-size: 0.75rem;
  text-align: center;
  background: hsl(var(--muted));
  border-radius: calc(var(--radius) - 4px);
}

.modal-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
