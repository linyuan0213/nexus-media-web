<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';

import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NSpace,
  NSpin,
  NSwitch,
  NSelect,
  NTooltip,
} from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 640);

function onResize() {
  windowWidth.value = window.innerWidth;
}
onMounted(() => {
  window.addEventListener('resize', onResize);
});

import {
  deleteSyncTaskApi,
  getSyncTasksApi,
  runSyncTaskApi,
  saveSyncTaskApi,
  SYNC_MODES,
} from '#/api/modules/sync';
import type { SyncApi } from '#/api/modules/sync';
import {
  getStorageBackendsApi,
} from '#/api/modules/storage';
import type { StorageApi } from '#/api/modules/storage';
import PageHeader from '#/components/page/PageHeader.vue';

interface SyncTask extends SyncApi.SyncTask {}

const tasks = ref<SyncTask[]>([]);
const backends = ref<StorageApi.StorageBackend[]>([]);
const backendOptions = computed(() => [
  { label: '本地', value: 'local' },
  ...backends.value.map((b) => ({ label: `${b.name} (${b.type})`, value: String(b.id) })),
]);
const loading = ref(false);

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

const enabledCount = computed(() => tasks.value.filter((t) => t.enabled).length);

async function fetch() {
  loading.value = true;
  try {
    const [res, backendRes] = await Promise.all([
      getSyncTasksApi(),
      getStorageBackendsApi(),
    ]);
    const dict = (res as unknown) as Record<string, SyncTask> || {};
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
      sid: item.id,
      source: item.from || item.source || '',
      dest: item.to || item.target || '',
      unknown: item.unknown || '',
      mode: item.syncmod || item.mode || 'copy',
      operation: item.operation || item.syncmod || item.mode || 'copy',
      src_backend: item.src_backend || 'local',
      dst_backend: item.dst_backend || 'local',
      compatibility: item.compatibility ? 1 : 0,
      rename: item.rename || item.renamer ? 1 : 0,
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
    mode: f.mode,
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
        <IconifyIcon icon="lucide:folder-sync" class="size-4" style="color: hsl(var(--primary))" />
        <span style="color: hsl(var(--muted-foreground))">
          共 <strong style="color: hsl(var(--foreground))">{{ tasks.length }}</strong> 个同步目录
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="size-1.5 rounded-full bg-success" />
        <span style="color: hsl(var(--muted-foreground))">
          <strong style="color: hsl(var(--success))">{{ enabledCount }}</strong> 个正在监控
        </span>
      </div>
    </div>

    <NSpin :show="loading" class="mt-5">
      <div
        v-if="tasks.length"
        class="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <div
          v-for="item in tasks"
          :key="item.id"
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
                  background: item.enabled
                    ? 'hsl(var(--success) / 0.1)'
                    : 'hsl(var(--muted))',
                }"
              >
                <IconifyIcon
                  icon="lucide:folder-sync"
                  class="size-4"
                  :style="{
                    color: item.enabled
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
                  {{ item.from || item.source || '未命名' }}
                </h3>
              </div>
            </div>

            <!-- 状态胶囊 -->
            <div
              class="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium flex-shrink-0"
              :style="{
                background: item.enabled
                  ? 'hsl(var(--success) / 0.1)'
                  : 'hsl(var(--muted))',
                color: item.enabled
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--muted-foreground))',
              }"
            >
              <span
                class="size-1.5 rounded-full"
                :class="item.enabled ? 'bg-success' : 'bg-muted-foreground'"
              />
              {{ item.enabled ? '监控中' : '已停用' }}
            </div>
          </div>

          <!-- 详情网格 -->
          <div class="p-5 grid grid-cols-2 gap-3">
            <div class="rounded-lg p-3" style="background: hsl(var(--muted) / 0.4)">
              <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                源目录
              </div>
              <div
                class="text-sm font-medium font-mono truncate"
                style="color: hsl(var(--foreground))"
                :title="item.from"
              >
                {{ item.from || '-' }}
              </div>
            </div>
            <div class="rounded-lg p-3" style="background: hsl(var(--muted) / 0.4)">
              <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                目的目录
              </div>
              <div
                class="text-sm font-medium font-mono truncate"
                style="color: hsl(var(--foreground))"
                :title="item.to"
              >
                {{ item.to || '自动' }}
              </div>
            </div>
            <div class="rounded-lg p-3" style="background: hsl(var(--muted) / 0.4)">
              <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                同步方式
              </div>
              <div
                class="text-sm font-medium"
                style="color: hsl(var(--foreground))"
              >
                {{ modeLabel(item.operation || item.syncmod || item.mode) }}
              </div>
            </div>
            <div class="rounded-lg p-3" style="background: hsl(var(--muted) / 0.4)">
              <div class="text-xs mb-1" style="color: hsl(var(--muted-foreground))">
                目标后端
              </div>
              <div
                class="text-sm font-medium font-mono truncate"
                style="color: hsl(var(--foreground))"
              >
                {{ backendOptions.find((b) => b.value === (item.dst_backend || 'local'))?.label || '本地' }}
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
                <NButton
                  size="small"
                  text
                  @click="handleRun(item)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:play" class="size-4" />
                  </template>
                </NButton>
              </template>
              立即同步
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  size="small"
                  text
                  @click="openEdit(item)"
                >
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
                  @click="handleDelete(item)"
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
              placeholder="需要监控的目录"
              clearable
            >
              <template #prefix>
                <IconifyIcon icon="lucide:folder-input" class="size-4" style="color: hsl(var(--muted-foreground))" />
              </template>
            </NInput>
          </NFormItem>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NFormItem label="目的目录">
              <NInput
                v-model:value="drawer.form.dest"
                placeholder="留空使用媒体库目录"
                clearable
              >
                <template #prefix>
                  <IconifyIcon icon="lucide:folder-output" class="size-4" style="color: hsl(var(--muted-foreground))" />
                </template>
              </NInput>
            </NFormItem>
            <NFormItem label="未识别目录">
              <NInput
                v-model:value="drawer.form.unknown"
                placeholder="留空不转移未识别文件"
                clearable
              >
                <template #prefix>
                  <IconifyIcon icon="lucide:folder-x" class="size-4" style="color: hsl(var(--muted-foreground))" />
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
              <NSelect v-model:value="drawer.form.src_backend" :options="backendOptions" />
            </NFormItem>
            <NFormItem label="目标后端">
              <NSelect v-model:value="drawer.form.dst_backend" :options="backendOptions" />
            </NFormItem>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <div class="flex items-center gap-2">
              <NSwitch
                v-model:value="drawer.form.compatibility"
                :checked-value="1"
                :unchecked-value="0"
              />
              <span class="text-sm" style="color: hsl(var(--foreground))">兼容模式</span>
            </div>
            <div class="flex items-center gap-2">
              <NSwitch
                v-model:value="drawer.form.rename"
                :checked-value="1"
                :unchecked-value="0"
              />
              <span class="text-sm" style="color: hsl(var(--foreground))">识别重命名</span>
            </div>
            <div class="flex items-center gap-2">
              <NSwitch
                v-model:value="drawer.form.enabled"
                :checked-value="1"
                :unchecked-value="0"
              />
              <span class="text-sm" style="color: hsl(var(--foreground))">开启同步</span>
            </div>
          </div>

          <div
            class="mt-4 rounded-lg p-3 text-xs flex items-start gap-2"
            style="background: hsl(var(--accent)); color: hsl(var(--muted-foreground))"
          >
            <IconifyIcon icon="lucide:info" class="size-4 flex-shrink-0 mt-0.5" />
            <span>硬链接要求源目录和目的目录在同一磁盘分区；移动模式会影响做种，请谨慎使用</span>
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
  </div>
</template>
