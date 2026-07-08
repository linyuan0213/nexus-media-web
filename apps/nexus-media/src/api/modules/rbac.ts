/**
 * RBAC 权限管理 API（API 重新设计 v1.0）
 * 对应后端: /api/rbac/*
 */
import { requestClient } from '#/api/request';

export namespace RbacApi {
  export interface UserItem {
    id: number;
    username: string;
    nickname?: string;
    email?: string;
    status: number;
    roles?: RoleItem[];
    last_login_at?: string;
  }

  export interface RoleItem {
    id: number;
    role_name: string;
    role_code: string;
    description?: string;
    role_level: number;
    status: number;
  }

  export interface MenuItem {
    id: number;
    menu_name: string;
    menu_code: string;
    parent_id?: number;
    path?: string;
    icon?: string;
    component?: string;
    sort_order: number;
    menu_level: number;
    permission_code?: string;
    status: number;
    redirect?: string;
    keep_alive?: number;
    affix_tab?: number;
    hide_in_menu?: number;
    hide_in_tab?: number;
    hide_in_breadcrumb?: number;
    active_icon?: string;
    badge?: string;
    badge_type?: string;
  }

  export interface VbenMenuRoute {
    path: string;
    name: string;
    component?: string;
    redirect?: string;
    meta: {
      activeIcon?: string;
      affixTab?: boolean;
      authority?: string[];
      badge?: string;
      badgeType?: string;
      hideInBreadcrumb?: boolean;
      hideInMenu?: boolean;
      hideInTab?: boolean;
      icon?: string;
      keepAlive?: boolean;
      order?: number;
      title: string;
    };
    children?: VbenMenuRoute[];
  }

  export interface PermissionItem {
    id: number;
    permission_name: string;
    permission_code: string;
  }
}

// ---------- 用户管理 ----------

/** 获取用户列表 */
export async function getUsersApi() {
  return requestClient.post<RbacApi.UserItem[]>('/rbac/users', {});
}

/** 创建用户 */
export async function createUserApi(data: {
  email?: string;
  nickname?: string;
  password: string;
  role_ids?: number[];
  username: string;
}) {
  return requestClient.post('/rbac/users/create', data);
}

/** 更新用户 */
export async function updateUserApi(
  data: Partial<RbacApi.UserItem> & { id: number; role_ids?: number[] },
) {
  return requestClient.post('/rbac/users/update', data);
}

/** 删除用户 */
export async function deleteUserApi(id: number) {
  return requestClient.post('/rbac/users/delete', { id });
}

/** 用户详情 */
export async function getUserDetailApi(id: number) {
  return requestClient.post('/rbac/users/detail', { id });
}

/** 重置密码 */
export async function resetPasswordApi(
  userId: number,
  newPassword: string,
  oldPassword?: string,
) {
  return requestClient.post(`/rbac/users/${userId}/reset-password`, {
    new_password: newPassword,
    old_password: oldPassword,
  });
}

/** 上传头像 */
export async function uploadAvatarApi(userId: number, file: File) {
  return requestClient.upload<{ url: string }>(`/rbac/users/${userId}/avatar`, {
    file,
  });
}

// ---------- 角色管理 ----------

/** 获取角色列表 */
export async function getRolesApi() {
  return requestClient.post<RbacApi.RoleItem[]>('/rbac/roles', {});
}

/** 创建角色 */
export async function createRoleApi(data: {
  description?: string;
  menu_ids?: number[];
  permission_ids?: number[];
  role_code: string;
  role_level?: number;
  role_name: string;
}) {
  return requestClient.post('/rbac/roles/create', data);
}

/** 更新角色 */
export async function updateRoleApi(
  data: Partial<RbacApi.RoleItem> & {
    id: number;
    menu_ids?: number[];
    permission_ids?: number[];
  },
) {
  return requestClient.post('/rbac/roles/update', data);
}

/** 删除角色 */
export async function deleteRoleApi(id: number) {
  return requestClient.post('/rbac/roles/delete', { id });
}

/** 角色详情 */
export async function getRoleDetailApi(id: number) {
  return requestClient.post('/rbac/roles/detail', { id });
}

// ---------- 菜单管理 ----------

/** 获取当前用户菜单树（Vben 格式） */
export async function getUserMenusApi() {
  return requestClient.post<RbacApi.VbenMenuRoute[]>('/rbac/menus', {});
}

/** 获取顶部菜单 */
export async function getTopMenusApi() {
  return requestClient.post<RbacApi.VbenMenuRoute[]>('/rbac/menus/top', {});
}

/** 创建菜单 */
export async function createMenuApi(data: Partial<RbacApi.MenuItem>) {
  return requestClient.post('/rbac/menus/create', data);
}

/** 更新菜单 */
export async function updateMenuApi(
  data: Partial<RbacApi.MenuItem> & { id: number },
) {
  return requestClient.post('/rbac/menus/update', data);
}

/** 删除菜单 */
export async function deleteMenuApi(id: number) {
  return requestClient.post('/rbac/menus/delete', { id });
}

/** 重置菜单到初始状态（恢复默认菜单，清除删除墓碑） */
export async function resetMenusApi() {
  return requestClient.post<{ affected: number; success: boolean }>(
    '/rbac/menus/reset',
    {},
  );
}

/** 更新菜单排序 */
export async function updateMenuSortApi(
  menuOrders: Array<{ id: number; parent_id?: number; sort_order: number }>,
) {
  return requestClient.post('/rbac/menus/sort', {
    menu_orders: menuOrders,
  });
}

/** 菜单详情 */
export async function getMenuDetailApi(id: number) {
  return requestClient.post('/rbac/menus/detail', { id });
}

/** 获取所有菜单（菜单管理专用） */
export async function getAllMenusForManagementApi() {
  return requestClient.post<RbacApi.VbenMenuRoute[]>('/rbac/menus/all', {});
}

/** 获取所有权限列表 */
export async function getPermissionsApi() {
  return requestClient.post<RbacApi.PermissionItem[]>('/rbac/permissions', {});
}

// ---------- 权限码 ----------

/** 获取当前用户权限码列表 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/rbac/codes');
}
