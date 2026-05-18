<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSpace,
  NSpin,
  NSwitch,
  NTag,
  NTabs,
  NTabPane,
  NCheckbox,
  NCheckboxGroup,
  NTree,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  createRoleApi,
  deleteRoleApi,
  getPermissionsApi,
  getRolesApi,
  getAllMenusForManagementApi,
  updateRoleApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

interface PermissionGroup {
  module: string;
  permissions: { id: number; permission_name: string }[];
}

interface MenuTreeNode {
  key: number;
  label: string;
  children?: MenuTreeNode[];
}

interface RoleItem {
  id: number;
  role_name: string;
  role_code: string;
  description?: string;
  role_level: number;
  status: number;
  permissions?: { id: number; permission_name: string }[];
  menus?: { id: number; menu_name: string }[];
  users_count?: number;
}

const message = useMessage();
const roles = ref<RoleItem[]>([]);
const permissionGroups = ref<PermissionGroup[]>([]);
const menuTree = ref<MenuTreeNode[]>([]);
const loading = ref(false);
const editModalShow = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<RoleItem | null>(null);
const editingRole = ref<Partial<RoleItem> & { permission_ids?: number[]; menu_ids?: number[] }>({});

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getRolesApi();
    roles.value = res?.data ?? res ?? [];
  } catch (e: any) {
    message.error(e?.message || '获取角色列表失败');
  } finally {
    loading.value = false;
  }
}

async function fetchPermissions() {
  try {
    const res: any = await getPermissionsApi();
    const list = res?.data ?? res ?? [];
    const groups: Record<string, PermissionGroup> = {};
    for (const p of list) {
      const mod = p.module || '其他';
      if (!groups[mod]) {
        groups[mod] = { module: mod, permissions: [] };
      }
      groups[mod].permissions.push(p);
    }
    permissionGroups.value = Object.values(groups);
  } catch {
    permissionGroups.value = [];
  }
}

function buildMenuTree(nodes: any[]): MenuTreeNode[] {
  const result: MenuTreeNode[] = [];
  for (const node of nodes) {
    const child: MenuTreeNode = {
      key: node.id,
      label: node.menu_name || node.meta?.title || node.name || node.menu_code || '',
    };
    if (node.children?.length) {
      child.children = buildMenuTree(node.children);
    }
    result.push(child);
  }
  return result;
}

async function fetchMenus() {
  try {
    const res: any = await getAllMenusForManagementApi();
    const list = res?.data ?? res ?? [];
    menuTree.value = buildMenuTree(list);
  } catch {
    menuTree.value = [];
  }
}

const sortedRoles = computed(() => {
  return [...roles.value].sort((a, b) => (a.role_level ?? 100) - (b.role_level ?? 100));
});

function handleAdd() {
  editingRole.value = {
    id: 0,
    role_name: '',
    role_code: '',
    description: '',
    role_level: 100,
    status: 1,
    permission_ids: [],
    menu_ids: [],
  };
  editModalShow.value = true;
}

function handleEdit(row: RoleItem) {
  editingRole.value = {
    ...row,
    permission_ids: row.permissions?.map((p) => p.id) || [],
    menu_ids: row.menus?.map((m) => m.id) || [],
  };
  editModalShow.value = true;
}

async function handleSave() {
  const data = editingRole.value;
  if (!data.role_name?.trim()) {
    message.error('请输入角色名称');
    return;
  }
  if (!data.role_code?.trim()) {
    message.error('请输入角色代码');
    return;
  }
  try {
    if (data.id) {
      await updateRoleApi(data as any);
      message.success('保存成功');
    } else {
      await createRoleApi(data as any);
      message.success('创建成功');
    }
    editModalShow.value = false;
    await fetchData();
  } catch (e: any) {
    message.error(e?.message || '操作失败');
  }
}

function confirmDelete(row: RoleItem) {
  deleteTarget.value = row;
  deleteModalShow.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteRoleApi(deleteTarget.value.id);
    message.success('删除成功');
    deleteModalShow.value = false;
    deleteTarget.value = null;
    await fetchData();
  } catch (e: any) {
    message.error(e?.message || '删除失败');
  }
}

onMounted(() => {
  fetchData();
  fetchPermissions();
  fetchMenus();
});
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="角色管理" subtitle="管理系统角色及其权限配置">
      <template #actions>
        <NButton type="primary" @click="handleAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增角色
        </NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <!-- 角色卡片网格 -->
      <div
        v-if="roles.length > 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-5"
      >
        <div
          v-for="item in sortedRoles"
          :key="item.id"
          class="rounded-xl border overflow-hidden flex flex-col"
          style="background: hsl(var(--card)); border-color: hsl(var(--border))"
        >
          <!-- 头部 -->
          <div class="flex flex-1 flex-col p-5">
            <div class="mb-3 flex items-start gap-3">
              <div
                class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                style="background: hsl(var(--muted))"
              >
                <span
                  class="text-sm font-bold"
                  style="color: hsl(var(--primary))"
                >
                  {{ item.role_name?.charAt(0)?.toUpperCase() || '?' }}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-0.5 flex items-center gap-2">
                  <span
                    class="truncate text-sm font-semibold"
                    style="color: hsl(var(--foreground))"
                  >
                    {{ item.role_name }}
                  </span>
                  <div
                    v-if="item.status === 1"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style="background: hsl(var(--success) / 0.1); color: hsl(var(--success))"
                  >
                    <span class="size-1.5 rounded-full" style="background: hsl(var(--success))" />
                    启用
                  </div>
                  <div
                    v-else
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style="background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive))"
                  >
                    <span class="size-1.5 rounded-full" style="background: hsl(var(--destructive))" />
                    禁用
                  </div>
                </div>
                <div
                  class="text-xs font-mono"
                  style="color: hsl(var(--muted-foreground))"
                >
                  {{ item.role_code }}
                </div>
                <div
                  v-if="item.description"
                  class="mt-1 text-xs truncate"
                  style="color: hsl(var(--muted-foreground))"
                  :title="item.description"
                >
                  {{ item.description }}
                </div>
              </div>
            </div>

            <!-- 标签行 -->
            <div class="flex flex-wrap gap-2">
              <div
                class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                style="background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); border-color: hsl(var(--border))"
              >
                <IconifyIcon icon="lucide:layers" class="size-3" />
                级别 {{ item.role_level }}
              </div>
              <div
                class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                style="background: hsl(var(--primary) / 0.12); color: hsl(var(--primary)); border-color: hsl(var(--primary) / 0.25)"
              >
                <IconifyIcon icon="lucide:key" class="size-3" />
                {{ item.permissions?.length || 0 }} 权限
              </div>
              <div
                class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                style="background: hsl(var(--info) / 0.15); color: hsl(var(--foreground)); border-color: hsl(var(--info) / 0.35)"
              >
                <IconifyIcon icon="lucide:layout-grid" class="size-3" style="color: hsl(var(--info))" />
                {{ item.menus?.length || 0 }} 菜单
              </div>
              <div
                class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                style="background: hsl(var(--warning) / 0.12); color: hsl(var(--warning)); border-color: hsl(var(--warning) / 0.3)"
              >
                <IconifyIcon icon="lucide:users" class="size-3" />
                {{ item.users_count || 0 }} 用户
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div
            class="flex items-center justify-end gap-2 px-5 py-3 border-t"
            style="border-color: hsl(var(--border))"
          >
            <NTooltip>
              <template #trigger>
                <NButton text size="small" @click="handleEdit(item)">
                  <template #icon>
                    <IconifyIcon icon="lucide:pencil" class="size-4" />
                  </template>
                </NButton>
              </template>
              编辑
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton text size="small" type="error" @click="confirmDelete(item)">
                  <template #icon>
                    <IconifyIcon icon="lucide:trash-2" class="size-4" />
                  </template>
                </NButton>
              </template>
              删除
            </NTooltip>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-else
        class="rounded-xl border flex flex-col items-center justify-center py-20 mt-5"
        style="background: hsl(var(--card)); border-color: hsl(var(--border))"
      >
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style="background: hsl(var(--muted))"
        >
          <IconifyIcon
            icon="lucide:shield"
            class="size-8"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
        <p class="text-sm mb-4" style="color: hsl(var(--muted-foreground))">
          暂无角色
        </p>
        <NButton type="primary" @click="handleAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增角色
        </NButton>
      </div>
    </NSpin>

    <!-- 新增/编辑角色弹窗 -->
    <NModal
      v-model:show="editModalShow"
      :title="editingRole.id ? '编辑角色' : '新增角色'"
      preset="card"
      class="w-[640px]"
      :style="{ maxHeight: '80vh' }"
    >
      <NTabs type="line">
        <NTabPane tab="基本信息" name="basic">
          <NForm label-placement="top">
            <div class="grid grid-cols-2 gap-3">
              <NFormItem label="角色名称" required>
                <NInput v-model:value="editingRole.role_name" placeholder="角色名称" />
              </NFormItem>
              <NFormItem label="角色代码" required>
                <NInput v-model:value="editingRole.role_code" placeholder="如: admin, user" />
              </NFormItem>
            </div>
            <NFormItem label="描述">
              <NInput
                v-model:value="editingRole.description"
                type="textarea"
                :rows="2"
                placeholder="角色描述"
              />
            </NFormItem>
            <div class="grid grid-cols-2 gap-3">
              <NFormItem label="级别">
                <NInputNumber
                  v-model:value="editingRole.role_level"
                  :min="1"
                  placeholder="数字越小权限越高"
                />
              </NFormItem>
              <NFormItem label="状态">
                <NSwitch
                  v-model:value="editingRole.status"
                  :checked-value="1"
                  :unchecked-value="0"
                >
                  <template #checked>启用</template>
                  <template #unchecked>禁用</template>
                </NSwitch>
              </NFormItem>
            </div>
          </NForm>
        </NTabPane>

        <NTabPane tab="权限配置" name="permissions">
          <div
            v-if="permissionGroups.length"
            class="space-y-4 max-h-[50vh] overflow-y-auto pr-2"
          >
            <div
              v-for="group in permissionGroups"
              :key="group.module"
              class="rounded-lg border p-3"
              style="background: hsl(var(--card)); border-color: hsl(var(--border))"
            >
              <div
                class="text-xs font-semibold mb-2 uppercase tracking-wide"
                style="color: hsl(var(--primary))"
              >
                {{ group.module }}
              </div>
              <NCheckboxGroup v-model:value="editingRole.permission_ids">
                <NSpace>
                  <NCheckbox
                    v-for="opt in group.permissions"
                    :key="opt.id"
                    :value="opt.id"
                  >
                    {{ opt.permission_name }}
                  </NCheckbox>
                </NSpace>
              </NCheckboxGroup>
            </div>
          </div>
          <div
            v-else
            class="text-center py-8 text-sm"
            style="color: hsl(var(--muted-foreground))"
          >
            暂无权限数据
          </div>
        </NTabPane>

        <NTabPane tab="菜单配置" name="menus">
          <div
            v-if="menuTree.length"
            class="rounded-lg border p-3 max-h-[50vh] overflow-y-auto"
            style="background: hsl(var(--card)); border-color: hsl(var(--border))"
          >
            <NTree
              v-model:checked-keys="editingRole.menu_ids"
              :data="menuTree"
              checkable
              cascade
              check-on-click
              :default-expand-all="true"
              block-line
            />
          </div>
          <div
            v-else
            class="text-center py-8 text-sm"
            style="color: hsl(var(--muted-foreground))"
          >
            暂无菜单数据
          </div>
        </NTabPane>
      </NTabs>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="editModalShow = false">取消</NButton>
          <NButton type="primary" @click="handleSave">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 删除确认 -->
    <NModal
      v-model:show="deleteModalShow"
      title="删除角色"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="handleDelete"
    >
      确定要删除角色 <strong>{{ deleteTarget?.role_name }}</strong> 吗？
    </NModal>
  </div>
</template>
