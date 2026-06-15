import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取用户信息（供内部使用，不对外重复导出 getUserInfoApi）
 */
export async function fetchUserProfileApi() {
  return requestClient.get<UserInfo>('/auth/me');
}
