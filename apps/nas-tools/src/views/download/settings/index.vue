<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSpin,
  NSelect,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import {
  getDownloadSettingsApi,
  saveDownloadSettingApi,
  deleteDownloadSettingApi,
  getDownloadersApi,
  setDefaultDownloadSettingApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

interface SettingItem {
  id: string | number;
  name: string;
  category?: string;
  tags?: string;
  is_paused?: number;
  upload_limit?: number;
  download_limit?: number;
  ratio_limit?: number;
  seeding_time_limit?: number;
  downloader?: string;
  downloader_name?: string;
}

const router = useRouter();
const message = useMessage();
const settings = ref<SettingItem[]>([]);
const defaultSetting = ref('');
const downloaders = ref<Record<string, { name: string }>>({});
const loading = ref(false);
const editModalShow = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<SettingItem | null>(null);
const editing = ref<Partial<SettingItem>>({});

async function fetchData() {
  loading.value = true;
  try {
    let settingRes: any;
    let downloaderRes: any;
    try { settingRes = await getDownloadSettingsApi(); } catch (e) { /* ignore */ }
    try { downloaderRes = await getDownloadersApi(); } catch (e) { /* ignore */ }

    if (settingRes && typeof settingRes === 'object') {
      let list: any[];
      if (Array.isArray(settingRes)) {
        list = settingRes;
      } else if (settingRes.data) {
        list = Array.isArray(settingRes.data)
          ? settingRes.data
          : Object.values(settingRes.data);
      } else {
        list = Object.values(settingRes);
      }
      settings.value = list as SettingItem[];
      for (const item of list) {
        if (item.is_default) {
          defaultSetting.value = String(item.id);
          break;
        }
      }
    }
    if (downloaderRes && typeof downloaderRes === 'object') {
      const dict = downloaderRes.data ?? downloaderRes;
      downloaders.value = Object.fromEntries(
        Object.entries(dict).map(([k, v]: [string, any]) => [k, { name: v.name || v }]),
      );
    }
  } finally {
    loading.value = false;
  }
}

function getDownloaderOptions() {
  return Object.entries(downloaders.value).map(([k, v]) => ({
    label: v.name,
    value: k,
  }));
}

function handleAdd() {
  editing.value = {
    id: '',
    name: '',
    category: '',
    tags: '',
    is_paused: 0,
    upload_limit: undefined,
    download_limit: undefined,
    ratio_limit: undefined,
    seeding_time_limit: undefined,
    downloader: '',
  };
  editModalShow.value = true;
}

function handleEdit(row: SettingItem) {
  editing.value = { ...row };
  editModalShow.value = true;
}

async function handleSave() {
  const d = editing.value;
  if (!d.name) { message.error('请输入名称'); return; }
  if (!d.downloader) { message.error('请选择下载器'); return; }
  await saveDownloadSettingApi({
    sid: d.id || '',
    name: d.name,
    category: d.category || '',
    tags: d.tags || '',
    is_paused: d.is_paused || 0,
    upload_limit: d.upload_limit || 0,
    download_limit: d.download_limit || 0,
    ratio_limit: d.ratio_limit || 0,
    seeding_time_limit: d.seeding_time_limit || 0,
    downloader: d.downloader,
  } as any);
  editModalShow.value = false;
  message.success('保存成功');
  await fetchData();
}

function confirmDelete(row: SettingItem) {
  deleteTarget.value = row;
  deleteModalShow.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  await deleteDownloadSettingApi(String(deleteTarget.value.id));
  deleteModalShow.value = false;
  deleteTarget.value = null;
  message.success('删除成功');
  await fetchData();
}

async function setDefault(id: string) {
  await setDefaultDownloadSettingApi(id);
  defaultSetting.value = id;
  message.success('已设为默认');
  await fetchData();
}

function goBack() {
  // 延迟导航，避免组件卸载时的 vnode 竞态错误
  setTimeout(() => {
    router.push({ name: 'SystemDownloader' }).catch(() => {});
  }, 0);
}

onMounted(fetchData);
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="下载设置" subtitle="管理下载预设参数">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="handleAdd">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            新增下载设置
          </NButton>
          <NButton @click="goBack">
            <template #icon>
              <IconifyIcon icon="lucide:arrow-left" class="size-4" />
            </template>
            返回下载器
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div
        v-if="settings.length"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="item in settings"
          :key="item.id"
          class="rounded-xl border overflow-hidden flex flex-col"
          :style="{
            background: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            borderTopWidth: String(defaultSetting) === String(item.id) ? '3px' : '1px',
            borderTopColor: String(defaultSetting) === String(item.id) ? 'hsl(var(--warning))' : 'hsl(var(--border))',
          }"
        >
          <!-- 头部 -->
          <div class="flex flex-1 flex-col p-5">
            <div class="mb-3 flex items-start gap-3">
              <div
                class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                style="background: hsl(var(--muted))"
              >
                <IconifyIcon
                  icon="lucide:settings-2"
                  class="size-5"
                  style="color: hsl(var(--muted-foreground))"
                />
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-0.5 flex items-center gap-2">
                  <span
                    class="truncate text-sm font-semibold"
                    style="color: hsl(var(--foreground))"
                  >{{ item.name }}</span>
                  <div
                    v-if="String(defaultSetting) === String(item.id)"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style="background: hsl(var(--warning) / 0.1); color: hsl(var(--warning))"
                  >
                    <IconifyIcon icon="lucide:star" class="size-3" />
                    默认
                  </div>
                </div>
                <div
                  class="text-xs"
                  style="color: hsl(var(--muted-foreground))"
                >
                  {{ item.downloader_name || downloaders[item.downloader || '']?.name || item.downloader || '-' }}
                </div>
              </div>
              <NTooltip>
                <template #trigger>
                  <button
                    class="flex-shrink-0 p-1 rounded-md transition-colors"
                    :style="{
                      color: String(defaultSetting) === String(item.id)
                        ? 'hsl(var(--warning))'
                        : 'hsl(var(--muted-foreground))',
                    }"
                    @click.stop="setDefault(String(item.id))"
                  >
                    <IconifyIcon icon="lucide:star" class="size-5" />
                  </button>
                </template>
                {{ String(defaultSetting) === String(item.id) ? '默认设置' : '设为默认' }}
              </NTooltip>
            </div>

            <!-- 参数标签 -->
            <div class="flex flex-wrap gap-2">
              <div
                v-if="item.category"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="background: hsl(var(--accent)); color: hsl(var(--accent-foreground))"
              >
                {{ item.category }}
              </div>
              <div
                v-if="item.tags"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="background: hsl(var(--primary) / 0.1); color: hsl(var(--primary))"
              >
                {{ item.tags }}
              </div>
              <div
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                :style="item.is_paused
                  ? { background: 'hsl(var(--warning) / 0.1)', color: 'hsl(var(--warning))' }
                  : { background: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))' }"
              >
                <span
                  class="size-1.5 rounded-full"
                  :style="{ background: item.is_paused ? 'hsl(var(--warning))' : 'hsl(var(--success))' }"
                />
                {{ item.is_paused ? '添加后暂停' : '添加后开始' }}
              </div>
              <div
                v-if="item.upload_limit"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive))"
              >
                上传 {{ item.upload_limit }} KB/s
              </div>
              <div
                v-if="item.download_limit"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive))"
              >
                下载 {{ item.download_limit }} KB/s
              </div>
              <div
                v-if="item.ratio_limit"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="background: hsl(var(--info) / 0.1); color: hsl(var(--info))"
              >
                分享率 {{ item.ratio_limit }}
              </div>
              <div
                v-if="item.seeding_time_limit"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="background: hsl(var(--info) / 0.1); color: hsl(var(--info))"
              >
                做种 {{ item.seeding_time_limit }} 分钟
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div
            class="flex items-center justify-end gap-2 px-5 py-3 border-t"
            style="border-color: hsl(var(--border))"
          >
            <NTooltip v-if="Number(item.id) >= 0">
              <template #trigger>
                <NButton
                  size="small"
                  text
                  @click="handleEdit(item)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:pencil" class="size-4" />
                  </template>
                </NButton>
              </template>
              编辑
            </NTooltip>
            <NTooltip v-if="Number(item.id) >= 0">
              <template #trigger>
                <NButton
                  size="small"
                  text
                  type="error"
                  @click="confirmDelete(item)"
                >
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
        class="rounded-xl border flex flex-col items-center justify-center py-20"
        style="background: hsl(var(--card)); border-color: hsl(var(--border))"
      >
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style="background: hsl(var(--muted))"
        >
          <IconifyIcon
            icon="lucide:settings-2"
            class="size-8"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
        <p class="text-sm mb-4" style="color: hsl(var(--muted-foreground))">
          暂无下载设置
        </p>
        <NButton type="primary" @click="handleAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增下载设置
        </NButton>
      </div>
    </NSpin>

    <!-- 新增/编辑弹窗 -->
    <NModal
      v-model:show="editModalShow"
      :title="editing.id ? '编辑下载设置' : '新增下载设置'"
      preset="card"
      class="w-[480px]"
    >
      <NForm label-placement="top">
        <NFormItem label="名称" required>
          <NInput v-model:value="editing.name" placeholder="别名" />
        </NFormItem>

        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="下载器" required>
            <NSelect
              v-model:value="editing.downloader"
              :options="getDownloaderOptions()"
              placeholder="请选择"
            />
          </NFormItem>
          <NFormItem label="动作">
            <NSelect
              v-model:value="editing.is_paused"
              :options="[
                { label: '添加后开始', value: 0 },
                { label: '添加后暂停', value: 1 },
              ]"
            />
          </NFormItem>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="分类">
            <NInput
              v-model:value="editing.category"
              placeholder="仅适用于 Qbittorrent"
            />
          </NFormItem>
          <NFormItem label="标签">
            <NInput
              v-model:value="editing.tags"
              placeholder="多个标签用 ; 分隔"
            />
          </NFormItem>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="上传速度限制 (KB/s)">
            <NInput
              v-model:value="editing.upload_limit"
              placeholder="0 为不限速"
            />
          </NFormItem>
          <NFormItem label="下载速度限制 (KB/s)">
            <NInput
              v-model:value="editing.download_limit"
              placeholder="0 为不限速"
            />
          </NFormItem>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="分享率限制">
            <NInput
              v-model:value="editing.ratio_limit"
              placeholder="0 为无限制"
            />
          </NFormItem>
          <NFormItem label="做种时间限制 (分钟)">
            <NInput
              v-model:value="editing.seeding_time_limit"
              placeholder="0 为无限制"
            />
          </NFormItem>
        </div>
      </NForm>

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
      title="删除下载设置"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="handleDelete"
    >
      确定要删除下载设置 <strong>{{ deleteTarget?.name }}</strong> 吗？
    </NModal>
  </div>
</template>
