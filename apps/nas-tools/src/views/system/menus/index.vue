<script lang="ts" setup>
import { h, ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import type { TreeOption } from 'naive-ui';

import { useAccessStore, useUserStore } from '@vben/stores';
import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTree,
  NPopconfirm,
  NCollapse,
  NCollapseItem,
} from 'naive-ui';

import {
  createMenuApi,
  deleteMenuApi,
  getAllMenusForManagementApi,
  updateMenuApi,
  updateMenuSortApi,
} from '#/api';
import { generateAccess } from '#/router/access';
import { accessRoutes } from '#/router/routes';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

interface MenuItem {
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
  children?: MenuItem[];
  meta?: { icon?: string };
}

const menus = ref<MenuItem[]>([]);
const loading = ref(false);
const drawerShow = ref(false);
const drawerTitle = ref('');
const editingMenu = ref<Partial<MenuItem>>({});
const selectedMenu = ref<MenuItem | null>(null);
const selectedKeys = ref<string[]>([]);

const treeData = computed(() => buildTree(menus.value));

function buildTree(items: MenuItem[], parentId?: number): TreeOption[] {
  return items
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      key: String(item.id),
      label: item.menu_name,
      children: buildTree(items, item.id),
      menu: item as any,
    }));
}

function flattenTree(nodes: any[], result: MenuItem[] = []): MenuItem[] {
  for (const node of nodes) {
    const { children, ...rest } = node;
    result.push({ ...rest, parent_id: rest.parent_id ?? undefined } as MenuItem);
    if (children?.length) flattenTree(children, result);
  }
  return result;
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await getAllMenusForManagementApi();
    menus.value = flattenTree((res as unknown) as any[]);
    if (selectedMenu.value) {
      selectedMenu.value = menus.value.find((m) => m.id === selectedMenu.value!.id) || null;
    }
  } finally {
    loading.value = false;
  }
}

function handleAdd(parentId?: number) {
  editingMenu.value = {
    id: 0,
    menu_name: '',
    menu_code: '',
    parent_id: parentId ? String(parentId) : undefined,
    path: '',
    icon: '',
    component: '',
    sort_order: 0,
    menu_level: parentId ? 2 : 1,
    status: 1,
    hide_in_menu: 0,
  };
  drawerTitle.value = '新增菜单';
  drawerShow.value = true;
}

function handleEdit(menu: MenuItem) {
  editingMenu.value = {
    ...menu,
    parent_id: menu.parent_id ? String(menu.parent_id) : undefined,
  };
  drawerTitle.value = '编辑菜单';
  drawerShow.value = true;
}

const router = useRouter();

async function refreshSidebarMenus() {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const userInfo = userStore.userInfo;
  if (!userInfo) return;
  accessStore.setIsAccessChecked(false);
  const { accessibleMenus, accessibleRoutes } = await generateAccess({
    roles: userInfo.roles ?? [],
    router,
    routes: accessRoutes,
  });
  accessStore.setAccessMenus(accessibleMenus);
  accessStore.setAccessRoutes(accessibleRoutes);
  accessStore.setIsAccessChecked(true);
}

async function handleSave() {
  const data = editingMenu.value;
  if (!data.menu_name || !data.menu_code) return;
  const payload = {
    ...data,
    parent_id: data.parent_id ? Number(data.parent_id) : null,
    sort_order: Number(data.sort_order) || 0,
  };
  if (data.id) {
    await updateMenuApi(payload as any);
  } else {
    await createMenuApi(payload as any);
  }
  drawerShow.value = false;
  await fetchData();
  await refreshSidebarMenus();
}

async function handleDelete(id: number) {
  await deleteMenuApi(id);
  selectedMenu.value = null;
  await fetchData();
  await refreshSidebarMenus();
}

watch(selectedKeys, (keys) => {
  if (keys.length > 0) {
    const id = Number(keys[0]);
    selectedMenu.value = menus.value.find((m) => m.id === id) || null;
  } else {
    selectedMenu.value = null;
  }
});

function getParentOptions(): { label: string; value: string }[] {
  const options = menus.value
    .filter((m) => !m.parent_id)
    .map((m) => ({ label: m.menu_name, value: String(m.id) }));
  return [{ label: '顶级菜单', value: '' }, ...options];
}

function isFolder(item: MenuItem) {
  return item.menu_level === 1 && !item.parent_id;
}

function isMenu(item: MenuItem) {
  return !!item.component;
}

// ---------- 拖拽排序 ----------

/** 在树中查找指定 key 的节点所在的兄弟数组和索引 */
function findSiblingsAndIndex(
  key: string,
  nodes: TreeOption[],
): [TreeOption[], number] | [null, null] {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].key === key) return [nodes, i];
    if (nodes[i].children) {
      const result = findSiblingsAndIndex(key, nodes[i].children!);
      if (result[0] !== null) return result;
    }
  }
  return [null, null];
}

/** 从树中移除指定节点（包含其子树），返回被移除的节点 */
function removeNodeByKey(nodes: TreeOption[], key: string): TreeOption | null {
  const [siblings, index] = findSiblingsAndIndex(key, nodes);
  if (siblings !== null && index !== null) {
    return siblings.splice(index, 1)[0];
  }
  return null;
}

/** 根据 dropPosition 把节点插入到目标位置 */
function insertNodeToTree(
  tree: TreeOption[],
  targetKey: string,
  node: TreeOption,
  dropPosition: 'before' | 'after' | 'inside',
) {
  if (dropPosition === 'inside') {
    const [siblings] = findSiblingsAndIndex(targetKey, tree);
    if (siblings) {
      const target = siblings.find((n) => n.key === targetKey);
      if (target) {
        if (!target.children) target.children = [];
        target.children.push(node);
      }
    }
  } else {
    const [siblings, index] = findSiblingsAndIndex(targetKey, tree);
    if (siblings !== null && index !== null) {
      const insertIndex = dropPosition === 'before' ? index : index + 1;
      siblings.splice(insertIndex, 0, node);
    }
  }
}

/** 先序遍历树，重新分配 parent_id 和 sort_order */
function traverseAndAssign(
  nodes: TreeOption[],
  parentId: number | undefined,
  startOrder: number,
): Array<{ id: number; sort_order: number; parent_id: number | null }> {
  const updates: Array<{ id: number; sort_order: number; parent_id: number | null }> = [];
  let order = startOrder;
  for (const node of nodes) {
    const menu = node.menu as MenuItem;
    menu.parent_id = parentId;
    menu.sort_order = order;
    updates.push({ id: menu.id, sort_order: order, parent_id: parentId ?? null });
    order++;
    if (node.children && node.children.length > 0) {
      const childUpdates = traverseAndAssign(node.children, menu.id, order);
      updates.push(...childUpdates);
      order += childUpdates.length;
    }
  }
  return updates;
}

/** 深拷贝树数据（用于拖拽时修改） */
function cloneTree(nodes: TreeOption[]): TreeOption[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? cloneTree(node.children) : undefined,
  }));
}

async function handleDrop(info: {
  node: TreeOption;
  dragNode: TreeOption;
  dropPosition: 'before' | 'after' | 'inside' | number;
}) {
  const { node, dragNode } = info;
  if (dragNode.key === node.key) return;

  // Naive UI 某些版本 dropPosition 是 number：-1=before, 0=inside, 1=after
  let dropPosition: 'before' | 'after' | 'inside';
  if (typeof info.dropPosition === 'number') {
    if (info.dropPosition === -1) dropPosition = 'before';
    else if (info.dropPosition === 1) dropPosition = 'after';
    else dropPosition = 'inside';
  } else {
    dropPosition = info.dropPosition;
  }

  // 深拷贝当前树并修改结构
  const newTree = cloneTree(treeData.value);
  const removed = removeNodeByKey(newTree, dragNode.key as string);
  if (!removed) return;

  insertNodeToTree(newTree, node.key as string, removed, dropPosition);

  // 重新分配 sort_order / parent_id
  const updates = traverseAndAssign(newTree, undefined, 0);

  // 提交到后端
  loading.value = true;
  try {
    await updateMenuSortApi(updates);
    await fetchData();
    await refreshSidebarMenus();
  } finally {
    loading.value = false;
  }
}

/** 树节点渲染：纯展示，操作统一在右侧面板 */
function renderTreeLabel({
  option,
  selected,
}: {
  option: TreeOption;
  selected: boolean;
}) {
  const item = option.menu as MenuItem;
  const icon = item.meta?.icon || item.icon;
  const isDisabled = item.status === 0;
  return h(
    'div',
    {
      class: `flex items-center gap-2 min-w-0 cursor-pointer select-none py-0.5 px-1.5 rounded-md transition-colors ${selected ? 'bg-primary/10' : ''}`,
    },
    [
      icon
        ? h(IconifyIcon, {
            icon,
            class: 'size-[18px] flex-shrink-0',
            style: `color: ${isDisabled ? 'hsl(var(--muted-foreground) / 0.4)' : selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}`,
          })
        : h('span', { class: 'size-[18px] flex-shrink-0' }),
      h(
        'span',
        {
          class: 'truncate text-sm',
          style: `color: ${isDisabled ? 'hsl(var(--muted-foreground) / 0.5)' : selected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))'}`,
        },
        item.menu_name,
      ),
    ],
  );
}

onMounted(fetchData);
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="菜单管理" subtitle="管理系统菜单结构、路由及权限">
      <template #actions>
        <NButton type="primary" @click="handleAdd()">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增菜单
        </NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        <!-- 左侧菜单树 -->
        <div class="lg:col-span-4">
          <div
            class="rounded-xl border overflow-hidden"
            style="background: hsl(var(--card)); border-color: hsl(var(--border))"
          >
            <div
              class="flex items-center justify-between px-4 py-3 border-b"
              style="border-color: hsl(var(--border))"
            >
              <span class="text-sm font-semibold" style="color: hsl(var(--foreground))">
                菜单结构
              </span>
              <span class="text-xs" style="color: hsl(var(--muted-foreground))">
                共 {{ menus.length }} 项
              </span>
            </div>
            <div class="p-2">
              <NTree
                v-if="treeData.length > 0"
                v-model:selected-keys="selectedKeys"
                :data="treeData"
                selectable
                block-line
                draggable
                :render-label="renderTreeLabel"
                @drop="handleDrop"
              />
              <EmptyState v-else title="暂无菜单" />
            </div>
          </div>
        </div>

        <!-- 右侧详情 -->
        <div class="lg:col-span-8">
          <div
            v-if="selectedMenu"
            class="rounded-xl border overflow-hidden"
            style="background: hsl(var(--card)); border-color: hsl(var(--border))"
          >
            <!-- 详情头部 -->
            <div
              class="flex items-center justify-between px-5 py-4 border-b"
              style="border-color: hsl(var(--border))"
            >
              <div class="flex items-center gap-3">
                <div
                  v-if="selectedMenu.meta?.icon || selectedMenu.icon"
                  class="flex items-center justify-center w-10 h-10 rounded-lg"
                  style="background: hsl(var(--accent))"
                >
                  <IconifyIcon
                    :icon="selectedMenu.meta?.icon || selectedMenu.icon"
                    class="size-5"
                    style="color: hsl(var(--accent-foreground))"
                  />
                </div>
                <div v-else class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: hsl(var(--muted))">
                  <IconifyIcon icon="lucide:file-text" class="size-5" style="color: hsl(var(--muted-foreground))" />
                </div>
                <div>
                  <h3 class="text-base font-semibold" style="color: hsl(var(--foreground))">
                    {{ selectedMenu.menu_name }}
                  </h3>
                  <code class="text-xs" style="color: hsl(var(--muted-foreground))">
                    {{ selectedMenu.menu_code }}
                  </code>
                </div>
              </div>
              <NSpace>
                <NButton size="small" @click="handleEdit(selectedMenu)">
                  <template #icon>
                    <IconifyIcon icon="lucide:pencil" class="size-3.5" />
                  </template>
                  编辑
                </NButton>
                <NButton
                  v-if="!selectedMenu.parent_id"
                  size="small"
                  secondary
                  @click="handleAdd(selectedMenu.id)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:plus" class="size-3.5" />
                  </template>
                  子项
                </NButton>
                <NPopconfirm @positive-click="handleDelete(selectedMenu.id)">
                  <template #trigger>
                    <NButton size="small" type="error" ghost>
                      <template #icon>
                        <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                      </template>
                    </NButton>
                  </template>
                  确定删除「{{ selectedMenu.menu_name }}」吗？
                </NPopconfirm>
              </NSpace>
            </div>

            <!-- 详情内容 -->
            <div class="p-5">
              <!-- 状态栏 -->
              <div class="flex items-center gap-4 mb-6">
                <div
                  class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  :style="{
                    background:
                      selectedMenu.status === 1
                        ? 'hsl(var(--success) / 0.1)'
                        : 'hsl(var(--destructive) / 0.1)',
                    color:
                      selectedMenu.status === 1
                        ? 'hsl(var(--success))'
                        : 'hsl(var(--destructive))',
                  }"
                >
                  <span
                    class="size-1.5 rounded-full"
                    :class="selectedMenu.status === 1 ? 'bg-success' : 'bg-destructive'"
                  />
                  {{ selectedMenu.status === 1 ? '已启用' : '已禁用' }}
                </div>
                <div
                  v-if="selectedMenu.hide_in_menu === 1"
                  class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  style="background: hsl(var(--warning) / 0.1); color: hsl(var(--warning))"
                >
                  <span class="size-1.5 rounded-full bg-warning" />
                  已隐藏
                </div>
                <div
                  class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  style="background: hsl(var(--accent)); color: hsl(var(--accent-foreground))"
                >
                  <IconifyIcon icon="lucide:layers" class="size-3" />
                  {{ isFolder(selectedMenu) ? '目录' : isMenu(selectedMenu) ? '菜单' : '按钮' }}
                </div>
              </div>

              <!-- 信息网格 -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  class="rounded-lg p-4"
                  style="background: hsl(var(--muted) / 0.4)"
                >
                  <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                    路由路径
                  </div>
                  <div class="text-sm font-medium font-mono" style="color: hsl(var(--foreground))">
                    {{ selectedMenu.path || '-' }}
                  </div>
                </div>
                <div
                  class="rounded-lg p-4"
                  style="background: hsl(var(--muted) / 0.4)"
                >
                  <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                    组件路径
                  </div>
                  <div class="text-sm font-medium font-mono" style="color: hsl(var(--foreground))">
                    {{ selectedMenu.component || '-' }}
                  </div>
                </div>
                <div
                  class="rounded-lg p-4"
                  style="background: hsl(var(--muted) / 0.4)"
                >
                  <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                    排序权重
                  </div>
                  <div class="text-sm font-medium" style="color: hsl(var(--foreground))">
                    {{ selectedMenu.sort_order }}
                  </div>
                </div>
                <div
                  class="rounded-lg p-4"
                  style="background: hsl(var(--muted) / 0.4)"
                >
                  <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                    菜单级别
                  </div>
                  <div class="text-sm font-medium" style="color: hsl(var(--foreground))">
                    {{ selectedMenu.menu_level === 1 ? '一级菜单' : '二级菜单' }}
                  </div>
                </div>
              </div>

              <!-- 权限码 -->
              <div
                v-if="selectedMenu.permission_code"
                class="mt-4 rounded-lg p-4"
                style="background: hsl(var(--muted) / 0.4)"
              >
                <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                  权限码
                </div>
                <div class="text-sm font-medium font-mono" style="color: hsl(var(--foreground))">
                  {{ selectedMenu.permission_code }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div
            v-else
            class="rounded-xl border flex flex-col items-center justify-center py-20"
            style="background: hsl(var(--card)); border-color: hsl(var(--border))"
          >
            <div
              class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style="background: hsl(var(--muted))"
            >
              <IconifyIcon
                icon="lucide:menu"
                class="size-8"
                style="color: hsl(var(--muted-foreground))"
              />
            </div>
            <p class="text-sm" style="color: hsl(var(--muted-foreground))">
              请在左侧选择菜单查看详情
            </p>
          </div>
        </div>
      </div>
    </NSpin>

    <!-- 编辑抽屉 -->
    <NDrawer v-model:show="drawerShow" :width="480" placement="right" :trap-focus="false">
      <NDrawerContent :title="drawerTitle" :native-scrollbar="false">
        <NForm label-placement="top" size="medium">
          <!-- 基本信息 -->
          <NFormItem label="菜单名称" required>
            <NInput v-model:value="editingMenu.menu_name" placeholder="如：资源搜索" />
          </NFormItem>

          <NFormItem label="菜单代码" required>
            <NInput v-model:value="editingMenu.menu_code" placeholder="PascalCase，如 MediaSearch" />
          </NFormItem>

          <NFormItem label="父菜单">
            <NSelect
              v-model:value="editingMenu.parent_id"
              :options="getParentOptions()"
              clearable
              placeholder="不选则为顶级菜单"
            />
          </NFormItem>

          <div class="grid grid-cols-2 gap-3">
            <NFormItem label="路由路径">
              <NInput v-model:value="editingMenu.path" placeholder="如 media/search" />
            </NFormItem>
            <NFormItem label="组件">
              <NInput v-model:value="editingMenu.component" placeholder="如 /media/search/index" />
            </NFormItem>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <NFormItem label="图标">
              <div class="flex items-center gap-2">
                <NInput
                  v-model:value="editingMenu.icon"
                  placeholder="lucide:xxx"
                  class="flex-1"
                />
                <div
                  v-if="editingMenu.icon"
                  class="w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0"
                  style="border-color: hsl(var(--border))"
                >
                  <IconifyIcon :icon="editingMenu.icon" class="size-5" />
                </div>
              </div>
            </NFormItem>
            <NFormItem label="排序">
              <NInputNumber v-model:value="editingMenu.sort_order" :min="0" class="w-full" />
            </NFormItem>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <NFormItem label="显示菜单">
              <NSwitch
                v-model:value="editingMenu.hide_in_menu"
                :checked-value="0"
                :unchecked-value="1"
              >
                <template #checked>显示</template>
                <template #unchecked>隐藏</template>
              </NSwitch>
            </NFormItem>
            <NFormItem label="状态">
              <NSwitch
                v-model:value="editingMenu.status"
                :checked-value="1"
                :unchecked-value="0"
              >
                <template #checked>启用</template>
                <template #unchecked>禁用</template>
              </NSwitch>
            </NFormItem>
          </div>

          <!-- 高级设置折叠 -->
          <NCollapse class="mt-2">
            <NCollapseItem title="高级配置">
              <NFormItem label="权限码">
                <NInput v-model:value="editingMenu.permission_code" placeholder="如 search:view" />
              </NFormItem>
              <NFormItem label="重定向">
                <NInput v-model:value="editingMenu.redirect" placeholder="重定向路径" />
              </NFormItem>
            </NCollapseItem>
          </NCollapse>
        </NForm>

        <template #footer>
          <NSpace justify="end">
            <NButton @click="drawerShow = false">取消</NButton>
            <NButton type="primary" @click="handleSave">
              <template #icon>
                <IconifyIcon icon="lucide:check" class="size-4" />
              </template>
              保存
            </NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
