<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
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
  deleteDownloaderApi,
  getDownloadersApi,
  getDownloaderTypesApi,
  saveDownloaderApi,
  setDefaultDownloaderApi,
  testDownloaderApi,
} from '#/api';
import DownloaderPathPickerModal from '#/components/media/DownloaderPathPickerModal.vue';
import PathPickerModal from '#/components/media/PathPickerModal.vue';
import PageHeader from '#/components/page/PageHeader.vue';

interface DownloaderItem {
  id: string;
  name: string;
  type: string;
  enabled: number;
  config: Record<string, any>;
  transfer?: number;
  only_nexus_media?: number;
  match_path?: number;
  rmt_mode?: string;
  rmt_mode_name?: string;
  download_dir?: any[];
}

interface DownloaderTypeConf {
  name: string;
  icon_url?: string;
  monitor_enable?: boolean;
  speedlimit_enable?: boolean;
  config: Record<string, any>;
}

const router = useRouter();
const message = useMessage();
const downloaders = ref<Record<string, any>>({});
const defaultDownloader = ref('');
const downloaderTypes = ref<Record<string, DownloaderTypeConf>>({});
const loading = ref(false);
const editDrawerShow = ref(false);
const editingDownloader = ref<Partial<DownloaderItem>>({});
const editingType = ref('qbittorrent');
const editingConfig = ref<Record<string, any>>({});
const editingDirs = ref<any[]>([
  { type: '', category: '', save_path: '', container_path: '', label: '' },
]);
const testLoading = ref(false);
const deleteModalShow = ref(false);
const deleteTarget = ref<DownloaderItem | null>(null);

const downloaderList = computed(() =>
  Object.entries(downloaders.value).map(([id, item]) => ({ ...item, id })),
);

const SYNC_MODES = [
  { label: '硬链接', value: 'link' },
  { label: '软链接', value: 'softlink' },
  { label: '复制', value: 'copy' },
  { label: '移动', value: 'move' },
];

function downloaderIcon(type?: string): string {
  const conf = typeConf(type);
  if (conf?.icon_url) return conf.icon_url;
  return type ? `/static/img/downloader/${type}.png` : '';
}

function typeConf(type?: string) {
  return downloaderTypes.value[type || ''];
}

async function fetchData() {
  loading.value = true;
  try {
    let downloaderRes: any;
    let typesRes: any;

    try {
      downloaderRes = await getDownloadersApi();
    } catch (error) {
      console.error('getDownloadersApi failed:', error);
    }
    try {
      typesRes = await getDownloaderTypesApi();
    } catch (error) {
      console.error('getDownloaderTypesApi failed:', error);
    }

    if (downloaderRes && typeof downloaderRes === 'object') {
      const dict = downloaderRes.data ?? downloaderRes;
      downloaders.value = dict;
      for (const item of Object.values(dict) as any[]) {
        if (item.is_default) {
          defaultDownloader.value = String(item.id);
          break;
        }
      }
    }
    if (typesRes && typeof typesRes === 'object') {
      downloaderTypes.value = typesRes.data ?? typesRes;
    }
  } finally {
    loading.value = false;
  }
}

function initConfig(type: string) {
  const cfg: Record<string, any> = {};
  const conf = downloaderTypes.value[type];
  if (conf?.config) {
    Object.entries(conf.config).forEach(([key, field]: [string, any]) => {
      cfg[key] = field.default ?? '';
    });
  }
  return cfg;
}

function handleAdd() {
  editingDownloader.value = {
    id: '',
    name: '',
    type: 'qbittorrent',
    enabled: 1,
    transfer: 0,
    only_nexus_media: 0,
    match_path: 0,
    rmt_mode: 'link',
  };
  editingType.value = 'qbittorrent';
  editingConfig.value = initConfig('qbittorrent');
  editingDirs.value = [
    { type: '', category: '', save_path: '', container_path: '', label: '' },
  ];
  editDrawerShow.value = true;
}

function handleEdit(item: DownloaderItem) {
  editingDownloader.value = { ...item };
  editingType.value = item.type;
  editingConfig.value = item.config
    ? { ...item.config }
    : initConfig(item.type);
  editingDirs.value =
    item.download_dir && item.download_dir.length > 0
      ? [...item.download_dir]
      : [
          {
            type: '',
            category: '',
            save_path: '',
            container_path: '',
            label: '',
          },
        ];
  editDrawerShow.value = true;
}

async function handleSave() {
  const data = editingDownloader.value;
  if (!data.name) {
    message.error('请输入名称');
    return;
  }
  const payload: Record<string, any> = {
    did: data.id || '',
    name: data.name,
    type: editingType.value,
    enabled: data.enabled,
    transfer: data.transfer,
    only_nexus_media: data.only_nexus_media,
    match_path: data.match_path,
    rmt_mode: data.rmt_mode,
    config: JSON.stringify(editingConfig.value),
    download_dir: JSON.stringify(editingDirs.value),
  };
  await saveDownloaderApi(payload as any);
  editDrawerShow.value = false;
  message.success('保存成功');
  await fetchData();
}

function confirmDelete(item: DownloaderItem) {
  deleteTarget.value = item;
  deleteModalShow.value = true;
}

async function handleDelete() {
  if (!deleteTarget.value) return;
  await deleteDownloaderApi(deleteTarget.value.id);
  deleteModalShow.value = false;
  deleteTarget.value = null;
  message.success('删除成功');
  await fetchData();
}

async function handleTest() {
  testLoading.value = true;
  try {
    const cfg: Record<string, any> = {};
    const conf = downloaderTypes.value[editingType.value];
    if (conf?.config) {
      Object.entries(conf.config).forEach(([key, field]: [string, any]) => {
        cfg[key] = editingConfig.value[key] ?? field.default ?? '';
      });
    }
    const res: any = await testDownloaderApi(
      editingType.value,
      JSON.stringify(cfg),
    );
    if (res?.success === true) {
      message.success(res?.message || '测试成功');
    } else {
      message.error(res?.message || '测试失败');
    }
  } catch (error: any) {
    message.error(error?.message || '测试失败');
  } finally {
    testLoading.value = false;
  }
}

async function setDefault(id: string) {
  await setDefaultDownloaderApi(id);
  defaultDownloader.value = id;
  message.success('已设为默认');
  await fetchData();
}

function addDir() {
  editingDirs.value.push({
    type: '',
    category: '',
    save_path: '',
    container_path: '',
    label: '',
  });
}

function removeDir(index: number) {
  editingDirs.value.splice(index, 1);
}

// 下载器目录选择器（save_path，来自下载器 API）
const dlPathPicker = ref({
  show: false,
  index: -1,
});

function openDlPathPicker(index: number) {
  dlPathPicker.value = { show: true, index };
}

function handleDlPathConfirm(path: string) {
  const idx = dlPathPicker.value.index;
  if (idx >= 0 && editingDirs.value[idx]) {
    editingDirs.value[idx].save_path = path;
  }
}

// 本地目录选择器（container_path，Nexus Media 访问目录）
const localPathPicker = ref({
  show: false,
  index: -1,
});

function openLocalPathPicker(index: number) {
  localPathPicker.value = { show: true, index };
}

function handleLocalPathConfirm(path: string) {
  const idx = localPathPicker.value.index;
  if (idx >= 0 && editingDirs.value[idx]) {
    editingDirs.value[idx].container_path = path;
  }
}

function gotoDownloadSetting() {
  router.push({ name: 'DownloadSettings' });
}

onMounted(fetchData);
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="下载器设置" subtitle="管理下载器配置及监控选项">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="handleAdd">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            新增下载器
          </NButton>
          <NButton @click="gotoDownloadSetting">
            <template #icon>
              <IconifyIcon icon="lucide:settings" class="size-4" />
            </template>
            下载设置
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div
        v-if="downloaderList.length > 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="item in downloaderList"
          :key="item.id"
          class="rounded-xl border overflow-hidden flex flex-col"
          :style="{
            background: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
            borderTopWidth: defaultDownloader === item.id ? '3px' : '1px',
            borderTopColor:
              defaultDownloader === item.id
                ? 'hsl(var(--warning))'
                : 'hsl(var(--border))',
          }"
        >
          <div class="flex flex-1 flex-col p-5">
            <!-- 头部：logo + 名称 + 星标 -->
            <div class="mb-3 flex items-start gap-3">
              <div class="relative h-10 w-10 flex-shrink-0">
                <img
                  :src="downloaderIcon(item.type)"
                  class="absolute inset-0 z-10 h-full w-full object-contain"
                  :alt="typeConf(item.type)?.name"
                  @error="($event.target as HTMLElement).style.display = 'none'"
                />
                <div
                  class="h-full w-full rounded-lg flex items-center justify-center"
                  style="background: hsl(var(--muted))"
                >
                  <IconifyIcon
                    icon="lucide:download"
                    class="size-5"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <div class="mb-0.5 flex items-center gap-2">
                  <span
                    class="truncate text-sm font-semibold"
                    style="color: hsl(var(--foreground))"
                  >
                    {{ item.name }}
                  </span>
                  <div
                    v-if="defaultDownloader === item.id"
                    class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style="
                      color: hsl(var(--warning));
                      background: hsl(var(--warning) / 10%);
                    "
                  >
                    <IconifyIcon icon="lucide:star" class="size-3" />
                    默认
                  </div>
                </div>
                <div
                  class="font-mono text-xs"
                  style="color: hsl(var(--muted-foreground))"
                >
                  {{ item.config?.host || '-' }}:{{ item.config?.port || '-' }}
                </div>
              </div>

              <NTooltip>
                <template #trigger>
                  <button
                    class="flex-shrink-0 p-1 rounded-md transition-colors"
                    :style="{
                      color:
                        defaultDownloader === item.id
                          ? 'hsl(var(--warning))'
                          : 'hsl(var(--muted-foreground))',
                    }"
                    @click.stop="setDefault(item.id)"
                  >
                    <IconifyIcon icon="lucide:star" class="size-5" />
                  </button>
                </template>
                {{ defaultDownloader === item.id ? '默认下载器' : '设为默认' }}
              </NTooltip>
            </div>

            <!-- 状态 + 功能标签 -->
            <div class="flex flex-wrap gap-2">
              <div
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                :style="{
                  background:
                    item.enabled === 1
                      ? 'hsl(var(--success) / 0.2)'
                      : 'hsl(var(--destructive) / 0.2)',
                  color:
                    item.enabled === 1
                      ? 'hsl(var(--success))'
                      : 'hsl(var(--destructive))',
                }"
              >
                <span
                  class="size-1.5 rounded-full"
                  :style="{
                    background:
                      item.enabled === 1
                        ? 'hsl(var(--success))'
                        : 'hsl(var(--destructive))',
                  }"
                ></span>
                {{ item.enabled === 1 ? '启用' : '停用' }}
              </div>
              <div
                v-if="item.transfer === 1"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="
                  color: hsl(var(--primary));
                  background: hsl(var(--primary) / 20%);
                "
              >
                {{ item.rmt_mode_name || item.rmt_mode }}
              </div>
              <div
                v-if="item.only_nexus_media === 1"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="
                  color: hsl(var(--warning));
                  background: hsl(var(--warning) / 20%);
                "
              >
                标签隔离
              </div>
              <div
                v-if="item.match_path === 1"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                style="
                  color: hsl(var(--foreground));
                  background: hsl(var(--foreground) / 10%);
                "
              >
                目录隔离
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
                <NButton size="small" text @click="handleEdit(item)">
                  <template #icon>
                    <IconifyIcon icon="lucide:pencil" class="size-4" />
                  </template>
                </NButton>
              </template>
              编辑配置
            </NTooltip>
            <NTooltip>
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
            icon="lucide:download"
            class="size-8"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
        <p class="text-sm mb-4" style="color: hsl(var(--muted-foreground))">
          暂无下载器配置
        </p>
        <NButton type="primary" @click="handleAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增下载器
        </NButton>
      </div>
    </NSpin>

    <!-- 新增/编辑弹窗 -->
    <NModal
      v-model:show="editDrawerShow"
      :title="editingDownloader.id ? '编辑下载器' : '新增下载器'"
      preset="card"
      :style="{ width: '640px', maxWidth: '92vw' }"
    >
      <NForm label-placement="left" :label-width="100">
        <NGrid :cols="2" :x-gap="16">
          <NGridItem span="1">
            <NFormItem label="名称" required>
              <NInput
                v-model:value="editingDownloader.name"
                placeholder="别名"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem span="1">
            <NFormItem label="状态" required>
              <NSelect
                v-model:value="editingDownloader.enabled"
                :options="[
                  { label: '启用', value: 1 },
                  { label: '停用', value: 0 },
                ]"
              />
            </NFormItem>
          </NGridItem>
        </NGrid>

        <NFormItem label="类型" required>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div
              v-for="(conf, key) in downloaderTypes"
              :key="key"
              class="flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all"
              :style="
                editingType === key
                  ? 'border-color: hsl(var(--primary)); background: hsl(var(--primary) / 0.08); box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2)'
                  : 'border-color: hsl(var(--border)); background: hsl(var(--card))'
              "
              :class="editingType === key ? '' : 'hover:border-primary/50'"
              @click="editingType = key"
            >
              <img
                v-if="downloaderIcon(key)"
                :src="downloaderIcon(key)"
                class="h-10 w-10 rounded-lg object-contain"
                :alt="conf.name"
              />
              <div
                v-else
                class="h-10 w-10 rounded-lg flex items-center justify-center"
                style="background: hsl(var(--muted))"
              >
                <IconifyIcon
                  icon="lucide:download"
                  class="size-5"
                  style="color: hsl(var(--muted-foreground))"
                />
              </div>
              <span
                class="text-xs font-medium"
                :style="{
                  color:
                    editingType === key
                      ? 'hsl(var(--primary))'
                      : 'hsl(var(--foreground))',
                }"
              >
                {{ conf.name }}
              </span>
            </div>
          </div>
        </NFormItem>

        <!-- 动态配置字段 -->
        <div
          class="rounded-xl border px-4 py-3"
          style="
            background: hsl(var(--muted) / 30%);
            border-color: hsl(var(--border));
          "
        >
          <div
            v-for="(field, key) in downloaderTypes[editingType]?.config"
            :key="key"
            class="mb-3 last:mb-0"
          >
            <NFormItem>
              <template #label>
                <span class="mr-1">{{ field.title || field.id }}</span>
                <NTooltip v-if="field.tooltip" trigger="hover">
                  <template #trigger>
                    <IconifyIcon
                      icon="lucide:circle-help"
                      class="inline size-3.5 cursor-help"
                      style="color: hsl(var(--muted-foreground))"
                    />
                  </template>
                  <div
                    class="max-w-xs whitespace-normal text-xs"
                    style="color: hsl(var(--card-foreground))"
                  >
                    {{ field.tooltip }}
                  </div>
                </NTooltip>
              </template>
              <NSelect
                v-if="field.type === 'select'"
                v-model:value="editingConfig[key]"
                :options="
                  Object.entries(field.options || {}).map(([k, v]) => ({
                    label: v as string,
                    value: k,
                  }))
                "
              />
              <NSwitch
                v-else-if="field.type === 'switch'"
                v-model:value="editingConfig[key]"
                :checked-value="1"
                :unchecked-value="0"
              />
              <NInput
                v-else
                v-model:value="editingConfig[key]"
                :type="field.type === 'password' ? 'password' : 'text'"
                :placeholder="field.placeholder || field.default"
              />
            </NFormItem>
          </div>
        </div>

        <!-- 监控设置 -->
        <div v-if="downloaderTypes[editingType]?.monitor_enable" class="mt-4">
          <div
            class="mb-2 flex items-center gap-1 text-sm font-medium"
            style="color: hsl(var(--foreground))"
          >
            监控设置
            <NTooltip trigger="hover">
              <template #trigger>
                <IconifyIcon
                  icon="lucide:circle-help"
                  class="size-3.5 cursor-help"
                  style="color: hsl(var(--muted-foreground))"
                />
              </template>
              <div class="max-w-xs text-xs">
                监控下载软件，下载完成后自动进行文件转移，与目录同步监控下载目录二选一开启
              </div>
            </NTooltip>
          </div>
          <NGrid :cols="2" :x-gap="16">
            <NGridItem span="1">
              <NFormItem>
                <template #label>
                  <span class="mr-1">监控</span>
                  <NTooltip trigger="hover">
                    <template #trigger>
                      <IconifyIcon
                        icon="lucide:circle-help"
                        class="inline size-3.5 cursor-help"
                        style="color: hsl(var(--muted-foreground))"
                      />
                    </template>
                    <div class="max-w-xs text-xs">
                      监控下载软件，下载完成后自动进行文件转移，与目录同步监控下载目录二选一开启
                    </div>
                  </NTooltip>
                </template>
                <NSelect
                  v-model:value="editingDownloader.transfer"
                  :options="[
                    { label: '是', value: 1 },
                    { label: '否', value: 0 },
                  ]"
                />
              </NFormItem>
            </NGridItem>
            <NGridItem span="1">
              <NFormItem label="转移方式">
                <NSelect
                  v-model:value="editingDownloader.rmt_mode"
                  :options="SYNC_MODES"
                />
              </NFormItem>
            </NGridItem>
            <NGridItem span="1">
              <NFormItem>
                <template #label>
                  <span class="mr-1">标签隔离</span>
                  <NTooltip trigger="hover">
                    <template #trigger>
                      <IconifyIcon
                        icon="lucide:circle-help"
                        class="inline size-3.5 cursor-help"
                        style="color: hsl(var(--muted-foreground))"
                      />
                    </template>
                    <div class="max-w-xs text-xs">
                      启用后只有含Nexus
                      Media标签的下载任务才会被自动转移和显示，关闭则下载软件中所有的任务都会转移和显示
                    </div>
                  </NTooltip>
                </template>
                <NSelect
                  v-model:value="editingDownloader.only_nexus_media"
                  :options="[
                    { label: '是', value: 1 },
                    { label: '否', value: 0 },
                  ]"
                />
              </NFormItem>
            </NGridItem>
            <NGridItem span="1">
              <NFormItem>
                <template #label>
                  <span class="mr-1">目录隔离</span>
                  <NTooltip trigger="hover">
                    <template #trigger>
                      <IconifyIcon
                        icon="lucide:circle-help"
                        class="inline size-3.5 cursor-help"
                        style="color: hsl(var(--muted-foreground))"
                      />
                    </template>
                    <div class="max-w-xs text-xs">
                      启用后只有在下载目录中的下载任务才会被自动转移和显示
                    </div>
                  </NTooltip>
                </template>
                <NSelect
                  v-model:value="editingDownloader.match_path"
                  :options="[
                    { label: '是', value: 1 },
                    { label: '否', value: 0 },
                  ]"
                />
              </NFormItem>
            </NGridItem>
          </NGrid>
        </div>

        <!-- 下载目录设置 -->
        <div class="mt-4">
          <div
            class="mb-2 flex items-center gap-1 text-sm font-medium"
            style="color: hsl(var(--foreground))"
          >
            下载目录设置
            <NTooltip trigger="hover">
              <template #trigger>
                <IconifyIcon
                  icon="lucide:circle-help"
                  class="size-3.5 cursor-help"
                  style="color: hsl(var(--muted-foreground))"
                />
              </template>
              <div class="max-w-xs text-xs">
                根据类型及二级分类自动选择下载目录，按优先级从前往后依次匹配，直到找到符合条件及空间要求的目录下载
              </div>
            </NTooltip>
          </div>
          <div class="space-y-2">
            <div
              v-for="(dir, idx) in editingDirs"
              :key="idx"
              class="rounded-lg border px-3 py-2"
              style="
                background: hsl(var(--muted) / 30%);
                border-color: hsl(var(--border));
              "
            >
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <NSelect
                  v-model:value="dir.type"
                  style="width: 80px; min-width: 80px"
                  size="small"
                  :options="[
                    { label: '全部', value: '' },
                    { label: '电影', value: '电影' },
                    { label: '电视剧', value: '电视剧' },
                    { label: '动漫', value: '动漫' },
                  ]"
                />
                <NInput
                  v-model:value="dir.category"
                  style="width: 80px; min-width: 80px"
                  size="small"
                  placeholder="分类"
                />
                <NInput
                  v-model:value="dir.label"
                  style="width: 80px; min-width: 80px"
                  size="small"
                  placeholder="标签"
                />
                <NButton size="tiny" type="error" text @click="removeDir(idx)">
                  <IconifyIcon icon="lucide:trash-2" class="size-4" />
                </NButton>
              </div>
              <div class="flex items-center gap-2">
                <NInput
                  v-model:value="dir.save_path"
                  class="flex-1"
                  size="small"
                  placeholder="下载保存目录（可手动输入或浏览选择）"
                >
                  <template #suffix>
                    <NButton
                      size="tiny"
                      text
                      title="从下载器浏览选择目录"
                      @click="openDlPathPicker(idx)"
                    >
                      <template #icon>
                        <IconifyIcon icon="lucide:folder-open" class="size-4" />
                      </template>
                    </NButton>
                  </template>
                </NInput>
                <NInput
                  v-model:value="dir.container_path"
                  class="flex-1"
                  size="small"
                  placeholder="Nexus Media访问目录（可手动输入或浏览选择）"
                >
                  <template #suffix>
                    <NButton
                      size="tiny"
                      text
                      title="浏览选择目录"
                      @click="openLocalPathPicker(idx)"
                    >
                      <template #icon>
                        <IconifyIcon icon="lucide:folder-open" class="size-4" />
                      </template>
                    </NButton>
                  </template>
                </NInput>
              </div>
            </div>
            <NButton size="small" text @click="addDir">
              <template #icon>
                <IconifyIcon icon="lucide:folder-plus" class="size-4" />
              </template>
              增加目录
            </NButton>
          </div>
        </div>
      </NForm>

      <template #footer>
        <div class="flex items-center justify-between">
          <NButton :loading="testLoading" @click="handleTest">
            <template #icon>
              <IconifyIcon icon="lucide:plug" class="size-4" />
            </template>
            测试连接
          </NButton>
          <NSpace>
            <NButton @click="editDrawerShow = false">取消</NButton>
            <NButton type="primary" @click="handleSave">保存</NButton>
          </NSpace>
        </div>
      </template>
    </NModal>

    <!-- 删除确认弹窗 -->
    <NModal
      v-model:show="deleteModalShow"
      title="删除下载器"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="handleDelete"
    >
      确定要删除下载器 <strong>{{ deleteTarget?.name }}</strong> 吗？
    </NModal>

    <!-- 下载器目录选择器 -->
    <DownloaderPathPickerModal
      v-model:show="dlPathPicker.show"
      title="选择下载保存目录"
      :downloader-type="editingType"
      :downloader-config="editingConfig"
      :initial-path="
        dlPathPicker.index >= 0
          ? editingDirs[dlPathPicker.index]?.save_path
          : ''
      "
      @confirm="handleDlPathConfirm"
    />

    <!-- 本地目录选择器（Nexus Media 访问目录） -->
    <PathPickerModal
      v-model:show="localPathPicker.show"
      title="选择访问目录"
      :initial-path="
        localPathPicker.index >= 0
          ? editingDirs[localPathPicker.index]?.container_path
          : ''
      "
      @confirm="handleLocalPathConfirm"
    />
  </div>
</template>
