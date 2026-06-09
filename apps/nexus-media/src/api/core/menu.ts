import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取用户所有菜单（对接后端 RBAC）
 */
export async function getAllMenusApi() {
  return requestClient.post<RouteRecordStringComponent[]>(
    '/api/rbac/menus',
    {},
  );
}
