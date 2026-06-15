import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    username: string;
    password: string;
  }

  /** 登录接口返回值（后端 TokenPair 结构） */
  export interface LoginResult {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }

  export interface RefreshTokenResult {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  }
}

/**
 * 登录（Nexus Media FastAPI 后端）
 */
export async function loginApi(data: AuthApi.LoginParams) {
  const formData = new URLSearchParams();
  formData.append('username', data.username);
  formData.append('password', data.password);

  return requestClient.post<AuthApi.LoginResult>('/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    withCredentials: true,
  });
}

/**
 * 刷新 accessToken
 * 请求级别指定 responseReturn: 'data'，让拦截器提取嵌套 data
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/refresh',
    null,
    {
      withCredentials: true,
      responseReturn: 'data',
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', null, {
    withCredentials: true,
  });
}

/**
 * 获取当前用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get('/auth/me', {
    withCredentials: true,
  });
}

/**
 * 获取登录页壁纸（无需认证）
 */
export async function getLoginWallpaperApi() {
  return baseRequestClient.get<{
    image_code: string;
    img_link: string;
    img_title: string;
  }>('/auth/wallpaper');
}
