<script lang="ts" setup>
import type { StorageApi } from '#/api/modules/storage';
import type { SyncApi } from '#/api/modules/sync';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTooltip,
} from 'naive-ui';

import { getStorageBackendsApi } from '#/api/modules/storage';
import {
  deleteSyncTaskApi,
  getSyncTasksApi,
  runSyncTaskApi,
  saveSyncTaskApi,
  SYNC_MODES,
} from '#/api/modules/sync';
import PathPickerModal from '#/components/media/PathPickerModal.vue';
import PageHeader from '#/components/page/PageHeader.vue';

const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 640);

function onResize() {
  windowWidth.value = window.innerWidth;
}
onMounted(() => {
  window.addEventListener('resize', onResize);
});

interface SyncTask extends SyncApi.SyncTask {}

interface SyncGroup {
  source: string;
  src_backend: string;
  items: SyncTask[];
}

const tasks = ref<SyncTask[]>([]);
const backends = ref<StorageApi.StorageBackend[]>([]);
const backendOptions = computed(() => [
  { label: '本地', value: 'local' },
  ...backends.value.map((b) => ({
    label: `${b.name} (${b.type})`,
    value: String(b.id),
  })),
]);
const loading = ref(false);

const syncGroups = computed<SyncGroup[]>(() => {
  const map = new Map<string, SyncTask[]>();
  for (const t of tasks.value) {
    const key = t.source || '';
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (list) {
      list.push(t);
    }
  }
  return [...map.entries()].map(([source, items]) => ({
    source,
    src_backend: items[0]?.src_backend_id || 'local',
    items,
  }));
});

const enabledCount = computed(
  () => tasks.value.filter((t) => t.enabled).length,
);

// 抽屉
const drawer = ref({
  show: false,
  isEdit: false,
  form: {
    sid: undefined as number | undefined,
    source: '',
    dest: '',
    unknown: '',
    mode: 'copy',
    operation: 'copy',
    src_backend: 'local',
    dst_backend: 'local',
    compatibility: 0,
    rename: 1,
    enabled: 1,
  },
});

// 路径选择器
const pathPicker = ref({
  show: false,
  title: '选择目录',
  targetField: 'source' as 'dest' | 'source' | 'unknown',
});

function openPathPicker(field: 'dest' | 'source' | 'unknown') {
  const titles = {
    source: '选择源目录',
    dest: '选择目的目录',
    unknown: '选择未识别目录',
  };
  pathPicker.value = {
    show: true,
    title: titles[field],
    targetField: field,
  };
}

function handlePathConfirm(path: string, backendId: string) {
  const field = pathPicker.value.targetField;
  drawer.value.form[field] = path;
  // 自动关联后端：源目录对应源后端，目的/未识别目录对应目标后端
  if (field === 'source') {
    drawer.value.form.src_backend = backendId;
  } else if (field === 'dest' || field === 'unknown') {
    drawer.value.form.dst_backend = backendId;
  }
}

async function fetch() {
  loading.value = true;
  try {
    const [res, backendRes] = await Promise.all([
      getSyncTasksApi(),
      getStorageBackendsApi(),
    ]);
    const dict = (res as unknown as Record<string, SyncTask>) || {};
    tasks.value = Object.values(dict);
    backends.value = backendRes.items || [];
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  drawer.value = {
    show: true,
    isEdit: false,
    form: {
      sid: undefined,
      source: '',
      dest: '',
      unknown: '',
      mode: 'copy',
      operation: 'copy',
      src_backend: 'local',
      dst_backend: 'local',
      compatibility: 0,
      rename: 1,
      enabled: 1,
    },
  };
}

function openEdit(item: SyncTask) {
  drawer.value = {
    show: true,
    isEdit: true,
    form: {
      sid: Number(item.id),
      source: item.source || '',
      dest: item.dest || '',
      unknown: item.unknown || '',
      mode: item.operation || 'copy',
      operation: item.operation || 'copy',
      src_backend: item.src_backend_id || 'local',
      dst_backend: item.dst_backend_id || 'local',
      compatibility: item.compatibility ? 1 : 0,
      rename: item.rename ? 1 : 0,
      enabled: item.enabled ? 1 : 0,
    },
  };
}

async function save() {
  const f = drawer.value.form;
  await saveSyncTaskApi({
    sid: f.sid,
    source: f.source,
    dest: f.dest,
    unknown: f.unknown,
    mode: f.operation,
    operation: f.operation,
    src_backend: f.src_backend,
    dst_backend: f.dst_backend,
    compatibility: f.compatibility,
    rename: f.rename,
    enabled: f.enabled,
  });
  drawer.value.show = false;
  await fetch();
}

async function handleDelete(item: SyncTask) {
  await deleteSyncTaskApi(item.id);
  await fetch();
}

async function handleRun(item: SyncTask) {
  await runSyncTaskApi(item.id);
}

function modeLabel(mode?: string) {
  return SYNC_MODES.find((m) => m.value === mode)?.label || mode || '-';
}

function backendTagStyle(backendId: string) {
  if (backendId === 'local') {
    return {
      background: 'hsl(var(--success) / 0.1)',
      color: 'hsl(var(--success))',
    };
  }
  return {
    background: 'hsl(var(--primary) / 0.1)',
    color: 'hsl(var(--primary))',
  };
}

function openAddDest(group: SyncGroup) {
  drawer.value = {
    show: true,
    isEdit: false,
    form: {
      sid: undefined,
      source: group.source,
      dest: '',
      unknown: '',
      mode: 'copy',
      operation: 'copy',
      src_backend: group.src_backend || 'local',
      dst_backend: 'local',
      compatibility: 0,
      rename: 1,
      enabled: 1,
    },
  };
}

onMounted(fetch);
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="目录同步" subtitle="配置目录监控与自动同步转移">
      <template #actions>
        <NButton type="primary" @click="openAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增同步目录
        </NButton>
      </template>
    </PageHeader>

    <!-- 统计栏 -->
    <div
      class="mt-5 flex items-center gap-6 rounded-xl border px-5 py-3 text-sm"
      style="background: hsl(var(--card)); border-color: hsl(var(--border))"
    >
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:folder-sync"
          class="size-4"
          style="color: hsl(var(--primary))"
        />
        <span style="color: hsl(var(--muted-foreground))">
          共
          <strong style="color: hsl(var(--foreground))">{{
            tasks.length
          }}</strong>
          个同步目录
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="size-1.5 rounded-full bg-success"></span>
        <span style="color: hsl(var(--muted-foreground))">
          <strong style="color: hsl(var(--success))">{{ enabledCount }}</strong>
          个正在监控
        </span>
      </div>
    </div>

    <NSpin :show="loading" class="mt-5">
      <div
        v-if="syncGroups.length > 0"
        class="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <div
          v-for="group in syncGroups"
          :key="group.source"
          class="rounded-xl border overflow-hidden"
          style="background: hsl(var(--card)); border-color: hsl(var(--border))"
        >
          <!-- 头部 -->
          <div
            class="flex items-center justify-between px-5 py-4 border-b"
            style="border-color: hsl(var(--border))"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                :style="{
                  background: group.items.some((i: any) => i.enabled)
                    ? 'hsl(var(--success) / 0.1)'
                    : 'hsl(var(--muted))',
                }"
              >
                <IconifyIcon
                  icon="lucide:folder-sync"
                  class="size-4"
                  :style="{
                    color: group.items.some((i: any) => i.enabled)
                      ? 'hsl(var(--success))'
                      : 'hsl(var(--muted-foreground))',
                  }"
                />
              </div>
              <div class="min-w-0">
                <h3
                  class="text-sm font-semibold truncate"
                  style="color: hsl(var(--foreground))"
                >
                  {{ group.source || '未命名' }}
                </h3>
                <p
                  class="text-xs mt-0.5"
                  style="color: hsl(var(--muted-foreground))"
                >
                  {{ group.items.length }} 个同步配置
                </p>
              </div>
            </div>

            <!-- 状态胶囊 -->
            <div
              class="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium flex-shrink-0"
              :style="{
                background: group.items.some((i: any) => i.enabled)
                  ? 'hsl(var(--success) / 0.1)'
                  : 'hsl(var(--muted))',
                color: group.items.some((i: any) => i.enabled)
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--muted-foreground))',
              }"
            >
              <span
                class="size-1.5 rounded-full"
                :class="
                  group.items.some((i: any) => i.enabled)
                    ? 'bg-success'
                    : 'bg-muted-foreground'
                "
              ></span>
              {{
                group.items.some((i: any) => i.enabled) ? '监控中' : '已停用'
              }}
            </div>
          </div>

          <!-- 配置列表 -->
          <div>
            <div
              v-for="(item, idx) in group.items"
              :key="item.id"
              class="px-5 py-2.5 flex items-center justify-between gap-3 group hover:bg-accent/30"
              :style="
                idx % 2 === 0 ? '' : 'background: hsl(var(--muted) / 0.15)'
              "
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <!-- 固定宽度的标签区域，保证目的目录对齐 -->
                <div class="flex items-center gap-2 flex-shrink-0">
                  <!-- 后端标签 -->
                  <span
                    class="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold text-center"
                    style="width: 80px"
                    :style="backendTagStyle(item.dst_backend_id || 'local')"
                  >
                    {{
                      backendOptions.find(
                        (b: any) =>
                          b.value === (item.dst_backend_id || 'local'),
                      )?.label || '本地'
                    }}
                  </span>
                  <!-- 同步方式 -->
                  <span
                    class="text-xs px-1.5 py-0.5 rounded font-medium text-center"
                    style="
                      display: inline-block;
                      width: 56px;
                      color: hsl(var(--muted-foreground));
                      background: hsl(var(--accent));
                    "
                  >
                    {{ modeLabel(item.operation) }}
                  </span>
                </div>
                <!-- 状态圆点 -->
                <span
                  v-if="item.enabled"
                  class="size-1.5 rounded-full bg-success flex-shrink-0"
                ></span>
                <span
                  v-else
                  class="size-1.5 rounded-full flex-shrink-0"
                  style="visibility: hidden"
                ></span>
                <!-- 目的目录 -->
                <span
                  class="text-sm truncate font-mono flex-1"
                  style="color: hsl(var(--foreground))"
                  :title="item.dest"
                >
                  {{ item.dest || '自动' }}
                </span>
              </div>
              <div
                class="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
              >
                <NTooltip>
                  <template #trigger>
                    <NButton size="tiny" text @click="handleRun(item)">
                      <IconifyIcon icon="lucide:play" class="size-4" />
                    </NButton>
                  </template>
                  立即同步
                </NTooltip>
                <NTooltip>
                  <template #trigger>
                    <NButton size="tiny" text @click="openEdit(item)">
                      <IconifyIcon icon="lucide:pencil" class="size-4" />
                    </NButton>
                  </template>
                  编辑
                </NTooltip>
                <NTooltip>
                  <template #trigger>
                    <NButton
                      size="tiny"
                      text
                      type="error"
                      @click="handleDelete(item)"
                    >
                      <IconifyIcon icon="lucide:trash-2" class="size-4" />
                    </NButton>
                  </template>
                  删除
                </NTooltip>
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div
            class="flex items-center justify-end gap-2 px-5 py-3 border-t"
            style="border-color: hsl(var(--border))"
          >
            <NButton size="small" text @click="openAddDest(group)">
              <template #icon>
                <IconifyIcon icon="lucide:plus" class="size-4" />
              </template>
              添加目的目录
            </NButton>
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
            icon="lucide:folder-sync"
            class="size-8"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
        <p class="text-sm mb-4" style="color: hsl(var(--muted-foreground))">
          暂无同步目录
        </p>
        <NButton type="primary" @click="openAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增同步目录
        </NButton>
      </div>
    </NSpin>

    <!-- 右侧抽屉 -->
    <NDrawer
      v-model:show="drawer.show"
      :width="isMobile ? '100%' : 480"
      placement="right"
      :trap-focus="false"
    >
      <NDrawerContent
        :title="drawer.isEdit ? '编辑同步目录' : '新增同步目录'"
        :native-scrollbar="false"
      >
        <NForm label-placement="top" size="medium">
          <NFormItem label="源目录" required>
            <NInput
              v-model:value="drawer.form.source"
              placeholder="需要监控的目录（可手动输入或浏览选择）"
              clearable
            >
              <template #prefix>
                <IconifyIcon
                  icon="lucide:folder-input"
                  class="size-4"
                  style="color: hsl(var(--muted-foreground))"
                />
              </template>
              <template #suffix>
                <NButton
                  size="tiny"
                  text
                  @click="openPathPicker('source')"
                  title="浏览选择目录"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:folder-open" class="size-4" />
                  </template>
                </NButton>
              </template>
            </NInput>
          </NFormItem>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NFormItem label="目的目录">
              <NInput
                v-model:value="drawer.form.dest"
                placeholder="留空使用媒体库目录（可手动输入或浏览选择）"
                clearable
              >
                <template #prefix>
                  <IconifyIcon
                    icon="lucide:folder-output"
                    class="size-4"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </template>
                <template #suffix>
                  <NButton
                    size="tiny"
                    text
                    @click="openPathPicker('dest')"
                    title="浏览选择目录"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:folder-open" class="size-4" />
                    </template>
                  </NButton>
                </template>
              </NInput>
            </NFormItem>
            <NFormItem label="未识别目录">
              <NInput
                v-model:value="drawer.form.unknown"
                placeholder="留空不转移未识别文件（可手动输入或浏览选择）"
                clearable
              >
                <template #prefix>
                  <IconifyIcon
                    icon="lucide:folder-x"
                    class="size-4"
                    style="color: hsl(var(--muted-foreground))"
                  />
                </template>
                <template #suffix>
                  <NButton
                    size="tiny"
                    text
                    @click="openPathPicker('unknown')"
                    title="浏览选择目录"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:folder-open" class="size-4" />
                    </template>
                  </NButton>
                </template>
              </NInput>
            </NFormItem>
          </div>

          <NFormItem label="同步方式" required>
            <NSelect
              v-model:value="drawer.form.operation"
              :options="SYNC_MODES"
              placeholder="选择同步方式"
            />
          </NFormItem>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NFormItem label="源后端">
              <NSelect
                v-model:value="drawer.form.src_backend"
                :options="backendOptions"
              />
            </NFormItem>
            <NFormItem label="目标后端">
              <NSelect
                v-model:value="drawer.form.dst_backend"
                :options="backendOptions"
              />
            </NFormItem>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <div class="flex items-center gap-2">
              <NSwitch
                v-model:value="drawer.form.compatibility"
                :checked-value="1"
                :unchecked-value="0"
              />
              <span class="text-sm" style="color: hsl(var(--foreground))"
                >兼容模式</span
              >
            </div>
            <div class="flex items-center gap-2">
              <NSwitch
                v-model:value="drawer.form.rename"
                :checked-value="1"
                :unchecked-value="0"
              />
              <span class="text-sm" style="color: hsl(var(--foreground))"
                >识别重命名</span
              >
            </div>
            <div class="flex items-center gap-2">
              <NSwitch
                v-model:value="drawer.form.enabled"
                :checked-value="1"
                :unchecked-value="0"
              />
              <span class="text-sm" style="color: hsl(var(--foreground))"
                >开启同步</span
              >
            </div>
          </div>

          <div
            class="mt-4 rounded-lg p-3 text-xs flex items-start gap-2"
            style="
              color: hsl(var(--muted-foreground));
              background: hsl(var(--accent));
            "
          >
            <IconifyIcon
              icon="lucide:info"
              class="size-4 flex-shrink-0 mt-0.5"
            />
            <span
              >硬链接要求源目录和目的目录在同一磁盘分区；移动模式会影响做种，请谨慎使用</span
            >
          </div>
        </NForm>

        <template #footer>
          <NSpace justify="end">
            <NButton @click="drawer.show = false">取消</NButton>
            <NButton type="primary" @click="save">
              <template #icon>
                <IconifyIcon icon="lucide:check" class="size-4" />
              </template>
              保存
            </NButton>
          </NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>

    <!-- 目录选择器 -->
    <PathPickerModal
      v-model:show="pathPicker.show"
      :title="pathPicker.title"
      :initial-path="drawer.form[pathPicker.targetField]"
      :initial-backend-id="
        pathPicker.targetField === 'source'
          ? drawer.form.src_backend
          : drawer.form.dst_backend
      "
      @confirm="handlePathConfirm"
    />
  </div>
</template>
