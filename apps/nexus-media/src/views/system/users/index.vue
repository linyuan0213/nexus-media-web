<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  createUserApi,
  deleteUserApi,
  getRolesApi,
  getUsersApi,
  resetPasswordApi,
  updateUserApi,
  uploadAvatarApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

interface RoleOption {
  label: string;
  value: number;
}

interface RoleItem {
  id: number;
  role_name: string;
}

interface UserItem {
  id: number;
  username: string;
  nickname: string;
  email?: string;
  avatar?: string;
  roles?: RoleItem[];
  status: number;
  last_login_at?: string;
}

const message = useMessage();
const users = ref<UserItem[]>([]);
const roleOptions = ref<RoleOption[]>([]);
const loading = ref(false);
const editModalShow = ref(false);
const resetPwdModalShow = ref(false);
const deleteModalShow = ref(false);
const userStore = useUserStore();
const deleteTarget = ref<null | UserItem>(null);
const editingUser = ref<
  Partial<UserItem> & { password?: string; role_ids?: number[] }
>({});
const resetPwdTarget = ref<null | { id: number; nickname: string }>(null);
const newPassword = ref('');
const oldPassword = ref('');

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getUsersApi();
    users.value = res?.data ?? res ?? [];
  } catch (error: any) {
    message.error(error?.message || '获取用户列表失败');
  } finally {
    loading.value = false;
  }
}

async function fetchRoles() {
  try {
    const res: any = await getRolesApi();
    const list = res?.data ?? res ?? [];
    roleOptions.value = list.map((r: RoleItem) => ({
      label: r.role_name,
      value: r.id,
    }));
  } catch {
    roleOptions.value = [];
  }
}

const sortedUsers = computed(() => {
  return [...users.value].toSorted((a, b) => (a.id ?? 0) - (b.id ?? 0));
});

function handleAdd() {
  editingUser.value = {
    id: 0,
    username: '',
    nickname: '',
    email: '',
    avatar: '',
    password: '',
    status: 1,
    role_ids: [],
  };
  editModalShow.value = true;
}

function handleEdit(row: UserItem) {
  editingUser.value = {
    ...row,
    password: '',
    role_ids: row.roles?.map((r) => r.id) || [],
    avatar: row.avatar || '',
  };
  editModalShow.value = true;
}

async function handleSave() {
  const data = editingUser.value;
  if (!data.username?.trim()) {
    message.error('请输入用户名');
    return;
  }
  if (!data.nickname?.trim()) {
    message.error('请输入昵称');
    return;
  }
  if (!data.id && !data.password?.trim()) {
    message.error('请输入密码');
    return;
  }
  try {
    if (data.id) {
      await updateUserApi(data as any);
      message.success('保存成功');
    } else {
      await createUserApi(data as any);
      message.success('创建成功');
    }
    editModalShow.value = false;
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '操作失败');
  }
}

function confirmDelete(row: UserItem) {
  deleteTarget.value = row;
  deleteModalShow.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  try {
    await deleteUserApi(deleteTarget.value.id);
    message.success('删除成功');
    deleteModalShow.value = false;
    deleteTarget.value = null;
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '删除失败');
  }
}

function openResetPwd(row: UserItem) {
  resetPwdTarget.value = { id: row.id, nickname: row.nickname };
  newPassword.value = '';
  oldPassword.value = '';
  resetPwdModalShow.value = true;
}

const isResetSelf = computed(() => {
  return resetPwdTarget.value?.id === userStore.userInfo?.user_id;
});

async function handleResetPassword() {
  if (!resetPwdTarget.value || !newPassword.value) {
    message.error('请输入新密码');
    return;
  }
  if (isResetSelf.value && !oldPassword.value) {
    message.error('请输入旧密码');
    return;
  }
  try {
    await resetPasswordApi(
      resetPwdTarget.value.id,
      newPassword.value,
      isResetSelf.value ? oldPassword.value : undefined,
    );
    message.success('密码重置成功');
    resetPwdModalShow.value = false;
    resetPwdTarget.value = null;
    newPassword.value = '';
    oldPassword.value = '';
  } catch (error: any) {
    message.error(error?.message || '重置失败');
  }
}

async function handleAvatarUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || !editingUser.value.id) return;

  if (!file.type.startsWith('image/')) {
    message.error('请上传图片文件');
    return;
  }

  try {
    const res: any = await uploadAvatarApi(editingUser.value.id, file);
    const url = res?.data?.url ?? res?.url ?? '';
    if (url) {
      editingUser.value.avatar = url;
      message.success('头像上传成功');
    }
  } catch (error: any) {
    message.error(error?.message || '上传失败');
  } finally {
    target.value = '';
  }
}

onMounted(() => {
  fetchData();
  fetchRoles();
});
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="用户管理" subtitle="管理系统用户及其角色分配">
      <template #actions>
        <NButton type="primary" @click="handleAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增用户
        </NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <!-- 用户卡片网格 -->
      <div
        v-if="users.length > 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-5"
      >
        <div v-for="item in sortedUsers" :key="item.id" class="user-card">
          <!-- 顶部头像+状态 -->
          <div class="user-card-top">
            <div class="relative">
              <img
                v-if="item.avatar"
                :src="item.avatar"
                class="user-avatar"
                alt="avatar"
              />
              <div v-else class="user-avatar user-avatar--fallback">
                <span class="user-avatar-letter">
                  {{
                    item.nickname?.charAt(0)?.toUpperCase() ||
                    item.username?.charAt(0)?.toUpperCase() ||
                    '?'
                  }}
                </span>
              </div>
              <div
                v-if="item.status === 1"
                class="user-status-dot user-status-dot--online"
              ></div>
              <div
                v-else
                class="user-status-dot user-status-dot--offline"
              ></div>
            </div>
          </div>

          <!-- 用户信息 -->
          <div class="user-card-body">
            <div class="user-name">{{ item.nickname || item.username }}</div>
            <div class="user-username">@{{ item.username }}</div>

            <div v-if="item.email" class="user-email">
              <IconifyIcon icon="lucide:mail" class="size-3" />
              {{ item.email }}
            </div>

            <!-- 角色标签 -->
            <div class="user-roles">
              <span
                v-for="role in item.roles"
                :key="role.id"
                class="role-tag"
                :class="{
                  'role-tag--super': role.role_name === '超级管理员',
                  'role-tag--admin': role.role_name === '管理员',
                  'role-tag--guest': role.role_name === '访客',
                }"
              >
                <IconifyIcon icon="lucide:shield" class="size-3" />
                {{ role.role_name }}
              </span>
              <span
                v-if="!item.roles?.length"
                class="role-tag role-tag--default"
              >
                <IconifyIcon icon="lucide:user" class="size-3" />
                普通用户
              </span>
            </div>
          </div>

          <!-- 底部信息 -->
          <div class="user-card-footer">
            <div v-if="item.last_login_at" class="user-last-login">
              <IconifyIcon icon="lucide:clock" class="size-3" />
              {{ item.last_login_at }}
            </div>
            <div v-else class="user-last-login">
              <IconifyIcon icon="lucide:clock" class="size-3" />
              从未登录
            </div>

            <div class="user-actions">
              <NTooltip>
                <template #trigger>
                  <NButton text size="tiny" @click="handleEdit(item)">
                    <IconifyIcon icon="lucide:pencil" class="size-3.5" />
                  </NButton>
                </template>
                编辑
              </NTooltip>
              <NTooltip>
                <template #trigger>
                  <NButton text size="tiny" @click="openResetPwd(item)">
                    <IconifyIcon icon="lucide:key-round" class="size-3.5" />
                  </NButton>
                </template>
                重置密码
              </NTooltip>
              <NTooltip>
                <template #trigger>
                  <NButton
                    text
                    size="tiny"
                    type="error"
                    @click="confirmDelete(item)"
                  >
                    <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                  </NButton>
                </template>
                删除
              </NTooltip>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <IconifyIcon icon="lucide:users" class="size-8" />
        </div>
        <p class="empty-title">暂无用户</p>
        <p class="empty-subtitle">还没有任何用户，点击下方按钮添加第一个用户</p>
        <NButton type="primary" @click="handleAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增用户
        </NButton>
      </div>
    </NSpin>

    <!-- 新增/编辑用户弹窗 -->
    <NModal
      v-model:show="editModalShow"
      :title="editingUser.id ? '编辑用户' : '新增用户'"
      preset="card"
      class="edit-modal"
      :style="{ width: '520px', maxWidth: '92vw' }"
    >
      <!-- 头像区域 -->
      <div class="edit-modal-header">
        <div class="edit-modal-avatar-section">
          <div class="edit-modal-avatar">
            <img
              v-if="editingUser.avatar"
              :src="editingUser.avatar"
              alt="avatar"
            />
            <span v-else>
              {{
                editingUser.nickname?.charAt(0)?.toUpperCase() ||
                editingUser.username?.charAt(0)?.toUpperCase() ||
                '?'
              }}
            </span>

            <label class="edit-modal-avatar-upload">
              <IconifyIcon icon="lucide:camera" class="size-3.5" />
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleAvatarUpload"
              />
            </label>
          </div>
        </div>

        <p v-if="editingUser.id" class="edit-modal-subtitle">
          {{ editingUser.nickname || editingUser.username }}
        </p>
        <p v-else class="edit-modal-subtitle">创建新用户账号</p>
      </div>

      <NForm label-placement="top" class="edit-modal-form">
        <!-- 基本信息 -->
        <div class="form-section">
          <div class="form-section-title">
            <IconifyIcon icon="lucide:user" class="size-4" />
            基本信息
          </div>

          <div class="grid grid-cols-2 gap-3">
            <NFormItem label="用户名" required>
              <NInput v-model:value="editingUser.username" placeholder="用户名">
                <template #prefix>
                  <IconifyIcon
                    icon="lucide:at-sign"
                    class="size-4"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </template>
              </NInput>
            </NFormItem>
            <NFormItem label="昵称" required>
              <NInput v-model:value="editingUser.nickname" placeholder="昵称">
                <template #prefix>
                  <IconifyIcon
                    icon="lucide:smile"
                    class="size-4"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </template>
              </NInput>
            </NFormItem>
          </div>

          <NFormItem label="邮箱">
            <NInput v-model:value="editingUser.email" placeholder="邮箱地址">
              <template #prefix>
                <IconifyIcon
                  icon="lucide:mail"
                  class="size-4"
                  style="color: hsl(var(--muted-foreground))"
                />
              </template>
            </NInput>
          </NFormItem>
        </div>

        <!-- 安全设置 -->
        <div v-if="!editingUser.id" class="form-section">
          <div class="form-section-title">
            <IconifyIcon icon="lucide:shield" class="size-4" />
            安全设置
          </div>

          <NFormItem label="密码" required>
            <NInput
              v-model:value="editingUser.password"
              type="password"
              placeholder="设置登录密码"
            >
              <template #prefix>
                <IconifyIcon
                  icon="lucide:key-round"
                  class="size-4"
                  style="color: hsl(var(--muted-foreground))"
                />
              </template>
            </NInput>
          </NFormItem>
        </div>

        <!-- 权限配置 -->
        <div class="form-section">
          <div class="form-section-title">
            <IconifyIcon icon="lucide:sliders-horizontal" class="size-4" />
            权限配置
          </div>

          <div class="grid grid-cols-2 gap-3">
            <NFormItem label="状态">
              <div class="flex items-center gap-3 py-2">
                <NSwitch
                  v-model:value="editingUser.status"
                  :checked-value="1"
                  :unchecked-value="0"
                />
                <span
                  class="text-sm"
                  :style="{
                    color:
                      editingUser.status === 1
                        ? 'hsl(var(--success))'
                        : 'hsl(var(--muted-foreground))',
                  }"
                >
                  {{ editingUser.status === 1 ? '账号已启用' : '账号已禁用' }}
                </span>
              </div>
            </NFormItem>
            <NFormItem label="角色">
              <NSelect
                v-model:value="editingUser.role_ids"
                multiple
                placeholder="选择角色"
                :options="roleOptions"
              />
            </NFormItem>
          </div>
        </div>
      </NForm>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="editModalShow = false">取消</NButton>
          <NButton type="primary" @click="handleSave">
            <template #icon>
              <IconifyIcon icon="lucide:check" class="size-4" />
            </template>
            {{ editingUser.id ? '保存修改' : '创建用户' }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 重置密码弹窗 -->
    <NModal
      v-model:show="resetPwdModalShow"
      title="重置密码"
      preset="dialog"
      positive-text="确认"
      negative-text="取消"
      @positive-click="handleResetPassword"
    >
      <p v-if="resetPwdTarget" class="mb-3">
        为用户
        <strong style="color: hsl(var(--foreground))">{{
          resetPwdTarget.nickname
        }}</strong>
        设置新密码：
      </p>
      <div class="space-y-3">
        <NInput
          v-if="isResetSelf"
          v-model:value="oldPassword"
          type="password"
          placeholder="输入旧密码"
          class="mb-2"
        />
        <NInput
          v-model:value="newPassword"
          type="password"
          placeholder="输入新密码"
        />
      </div>
    </NModal>

    <!-- 删除确认 -->
    <NModal
      v-model:show="deleteModalShow"
      title="删除用户"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="handleDelete"
    >
      确定要删除用户
      <strong>{{ deleteTarget?.nickname || deleteTarget?.username }}</strong>
      吗？
    </NModal>
  </div>
</template>

<style scoped>
/* 用户卡片 */
.user-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.user-card:hover {
  box-shadow: 0 4px 12px hsl(var(--foreground) / 8%);
  transform: translateY(-1px);
}

/* 顶部头像区域 */
.user-card-top {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 1rem 0.5rem;
}

.user-avatar {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: cover;
  border: 2px solid hsl(var(--border));
  border-radius: 50%;
}

.user-avatar--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
}

.user-avatar-letter {
  font-size: 1.125rem;
  font-weight: 700;
  color: hsl(var(--primary-foreground));
}

/* 在线/离线状态指示器 */
.user-status-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid hsl(var(--card));
  border-radius: 50%;
}

.user-status-dot--online {
  background: hsl(var(--success));
}

.user-status-dot--offline {
  background: hsl(var(--muted-foreground));
}

/* 卡片主体 */
.user-card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  padding: 0 1rem 0.75rem;
  text-align: center;
}

.user-name {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--foreground));
}

.user-username {
  margin-top: 0.125rem;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.user-email {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

/* 角色标签 */
.user-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  justify-content: center;
  margin-top: 0.625rem;
}

.role-tag {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border: 1px solid;
  border-radius: 9999px;
}

.role-tag--super {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 12%);
  border-color: hsl(var(--warning) / 30%);
}

.role-tag--admin {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-color: hsl(var(--primary) / 30%);
}

.role-tag--guest {
  color: hsl(var(--info));
  background: hsl(var(--info) / 12%);
  border-color: hsl(var(--info) / 30%);
}

.role-tag--default {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--accent));
  border-color: hsl(var(--border));
}

/* 底部 */
.user-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 1rem;
  background: hsl(var(--accent) / 50%);
  border-top: 1px solid hsl(var(--border));
}

.user-last-login {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.user-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 1rem;
  margin-top: 1.25rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  margin-bottom: 1rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border-radius: 50%;
}

.empty-title {
  margin-bottom: 0.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.empty-subtitle {
  margin-bottom: 1rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

/* 编辑弹窗 */
.edit-modal :deep(.n-card__content) {
  padding: 0;
}

.edit-modal-header {
  padding: 1.5rem 1.5rem 0.5rem;
  text-align: center;
}

.edit-modal-avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: 0.75rem;
}

.edit-modal-avatar {
  position: relative;
  width: 4.5rem;
  height: 4.5rem;
  overflow: hidden;
  border: 2px solid hsl(var(--border));
  border-radius: 50%;
  box-shadow: 0 2px 8px hsl(var(--foreground) / 10%);
}

.edit-modal-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.edit-modal-avatar span {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1.375rem;
  font-weight: 700;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}

.edit-modal-avatar-upload {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: 1.5px solid hsl(var(--border));
  border-radius: 50%;
  transition: all 0.15s ease;
}

.edit-modal-avatar-upload:hover {
  background: hsl(var(--accent));
  transform: scale(1.1);
}

.edit-modal-subtitle {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.edit-modal-form {
  padding: 0.5rem 1.25rem;
}

.form-section {
  margin-bottom: 1rem;
}

.form-section-title {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  padding-bottom: 0.375rem;
  margin-bottom: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  border-bottom: 1px solid hsl(var(--border));
}
</style>
