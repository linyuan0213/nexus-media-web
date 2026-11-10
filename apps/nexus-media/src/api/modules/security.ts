/**
 * 账户安全 API（设备会话 / TOTP）
 */
import { requestClient } from '#/api/request';

export namespace SecurityApi {
  export interface SessionItem {
    session_id: string;
    device_type?: null | string;
    device_model?: null | string;
    os?: null | string;
    browser?: null | string;
    login_ip?: null | string;
    last_seen_at?: null | string;
    created_at?: null | string;
    expires_at?: null | string;
    revoked_at?: null | string;
    is_current?: boolean;
    is_active?: boolean;
  }

  export interface TOTPStatus {
    enabled: boolean;
    configured: boolean;
  }

  export interface TOTPSetupResult {
    secret: string;
    uri: string;
  }
}

export async function getSessionsApi() {
  return requestClient.get<SecurityApi.SessionItem[]>('/auth/sessions');
}

export async function revokeSessionApi(sessionId: string) {
  return requestClient.post(`/auth/sessions/${sessionId}/revoke`);
}

export async function revokeOtherSessionsApi() {
  return requestClient.post('/auth/sessions/revoke-others');
}

export async function getTOTPStatusApi() {
  return requestClient.get<SecurityApi.TOTPStatus>('/auth/totp/status');
}

export async function setupTOTPApi() {
  return requestClient.post<SecurityApi.TOTPSetupResult>('/auth/totp/setup');
}

export async function enableTOTPApi(code: string) {
  return requestClient.post<{ recovery_codes: string[] }>('/auth/totp/enable', {
    code,
  });
}

export async function disableTOTPApi(password: string, code: string) {
  return requestClient.post('/auth/totp/disable', { code, password });
}
