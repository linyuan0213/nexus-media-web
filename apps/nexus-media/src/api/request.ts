/**
 * Nexus Media 前端请求封装
 * 对接 FastAPI 后端，使用 JWT Access Token + Refresh Token 机制
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from '#/adapter/naive';
import { useAuthStore } from '#/store';
import { getApiBaseUrl } from '#/utils/backend-url';

import { refreshTokenApi } from './core';
import { ErrorCode, extractErrorCode } from './error-codes';

/** 统一错误提示：权限类用 warning，其余用 error */
function showErrorMessage(msg: string, error: any) {
  const responseData = error?.response?.data ?? {};
  const errorMessage =
    responseData?.message ?? responseData?.msg ?? responseData?.detail ?? msg;
  const errcode = extractErrorCode(responseData);
  if (errcode === ErrorCode.PERMISSION_DENIED) {
    message.warning(errorMessage || '权限不足');
  } else {
    message.error(errorMessage);
  }
}

/** 后端启动中响应（startup_guard 返回 503 + code=-1） */
function isServerStartingError(error: any): boolean {
  return error?.response?.status === 503 && error?.response?.data?.code === -1;
}

/** 启动中重试：最多 30 次，间隔 2s（覆盖后端后台初始化窗口） */
const STARTUP_RETRY_MAX = 30;
const STARTUP_RETRY_INTERVAL = 2000;

function startupRetryInterceptor(client: RequestClient) {
  return {
    rejected: async (error: any) => {
      const config = error?.config;
      if (
        !isServerStartingError(error) ||
        !config ||
        (config.__startupRetryCount ?? 0) >= STARTUP_RETRY_MAX
      ) {
        throw error;
      }
      config.__startupRetryCount = (config.__startupRetryCount ?? 0) + 1;
      await new Promise((resolve) =>
        setTimeout(resolve, STARTUP_RETRY_INTERVAL),
      );
      return client.request(config.url, { ...config });
    },
  };
}

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const runtimeApiURL = getApiBaseUrl() ?? apiURL;

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑：Token 失效时跳转登录
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 刷新 token 逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi();
    const newToken = resp.access_token;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理：注入 Token 和语言
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      // 确保携带 Cookie（对接后端 Session / Refresh Token）
      config.withCredentials = true;
      return config;
    },
  });

  // 处理返回的响应数据格式（后端统一返回 { code, data, message }）
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );

  // token 过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 服务启动中（503 + code=-1）自动退避重试，须在错误提示拦截器之前
  client.addResponseInterceptor(startupRetryInterceptor(client));

  // 通用的错误处理
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      showErrorMessage(msg, error);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(runtimeApiURL, {
  responseReturn: 'data',
});

// 暴露到全局供插件 UMD 使用
if (typeof window !== 'undefined') {
  (window as any).requestClient = requestClient;
}

export const baseRequestClient = new RequestClient({
  baseURL: runtimeApiURL,
  withCredentials: true,
});

// 为 baseRequestClient 也添加统一响应格式拦截器（不附加 token 过期处理）
baseRequestClient.addResponseInterceptor(
  defaultResponseInterceptor({
    codeField: 'code',
    dataField: 'data',
    successCode: 0,
  }),
);

baseRequestClient.addResponseInterceptor(
  startupRetryInterceptor(baseRequestClient),
);

baseRequestClient.addResponseInterceptor(
  errorMessageResponseInterceptor((msg: string, error) => {
    showErrorMessage(msg, error);
  }),
);
