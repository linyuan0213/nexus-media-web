<script lang="ts" setup>
import type { StorageApi } from '#/api/modules/storage';
import type { SyncApi } from '#/api/modules/sync';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

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
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
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

function isGroupEnabled(group: SyncGroup) {
  return group.items.some((i) => i.enabled);
}

const monitoredCount = computed(
  () => syncGroups.value.filter((g) => isGroupEnabled(g)).length,
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

function backendLabel(backendId: string) {
  return (
    backendOptions.value.find((b) => b.value === (backendId || 'local'))
      ?.label || '本地'
  );
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

    <!-- 概览 -->
    <div
      class="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm"
      style="color: hsl(var(--muted-foreground))"
    >
      <span class="inline-flex items-center gap-1.5">
        <IconifyIcon
          icon="lucide:folder-sync"
          class="size-4"
          style="color: hsl(var(--primary))"
        />
        <strong class="font-semibold" style="color: hsl(var(--foreground))">{{
          syncGroups.length
        }}</strong>
        个源目录
      </span>
      <span
        class="hidden sm:inline size-1 rounded-full"
        style="background: hsl(var(--border))"
      ></span>
      <span>{{ tasks.length }} 个目的目录</span>
      <span
        class="hidden sm:inline size-1 rounded-full"
        style="background: hsl(var(--border))"
      ></span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-1.5 rounded-full bg-success"></span>
        <strong class="font-semibold" style="color: hsl(var(--success))">{{
          monitoredCount
        }}</strong>
        个监控中
      </span>
    </div>

    <NSpin :show="loading" class="mt-4">
      <div v-if="syncGroups.length > 0" class="flex flex-col gap-4">
        <section
          v-for="group in syncGroups"
          :key="group.source"
          class="rounded-lg border overflow-hidden"
          style="background: hsl(var(--card)); border-color: hsl(var(--border))"
        >
          <!-- 源目录头部 -->
          <header
            class="flex items-center gap-3 px-4 sm:px-5 py-3 border-b"
            style="
              background: hsl(var(--muted) / 25%);
              border-color: hsl(var(--border));
            "
          >
            <IconifyIcon
              icon="lucide:folder-sync"
              class="size-4 flex-shrink-0"
              :style="{
                color: isGroupEnabled(group)
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--muted-foreground))',
              }"
            />
            <div class="min-w-0 flex-1 flex items-baseline gap-2.5 flex-wrap">
              <h3
                class="text-sm font-semibold font-mono truncate"
                style="color: hsl(var(--foreground))"
                :title="group.source"
              >
                {{ group.source || '未命名' }}
              </h3>
              <span
                class="text-xs flex-shrink-0"
                style="color: hsl(var(--muted-foreground))"
              >
                {{ group.items.length }} 个目的目录
              </span>
            </div>
            <span
              class="inline-flex items-center gap-1.5 text-xs flex-shrink-0"
              :style="{
                color: isGroupEnabled(group)
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--muted-foreground))',
              }"
            >
              <span
                class="size-1.5 rounded-full"
                :class="
                  isGroupEnabled(group) ? 'bg-success' : 'bg-muted-foreground'
                "
              ></span>
              {{ isGroupEnabled(group) ? '监控中' : '已停用' }}
            </span>
          </header>

          <!-- 目的目录列表 -->
          <ul>
            <li
              v-for="item in group.items"
              :key="item.id"
              class="group flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 sm:px-5 py-2.5 border-b transition-colors hover:bg-accent/40 focus-within:bg-accent/40"
              style="border-color: hsl(var(--border) / 50%)"
            >
              <IconifyIcon
                icon="lucide:corner-down-right"
                class="size-3.5 flex-shrink-0 hidden sm:block"
                style="color: hsl(var(--muted-foreground))"
              />
              <span
                class="text-sm font-mono truncate basis-full sm:basis-auto sm:flex-1 min-w-0"
                :style="{
                  color: item.enabled
                    ? 'hsl(var(--foreground))'
                    : 'hsl(var(--muted-foreground))',
                }"
                :title="item.dest"
              >
                {{ item.dest || '自动（媒体库目录）' }}
              </span>
              <span
                v-if="!item.enabled"
                class="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                style="
                  color: hsl(var(--muted-foreground));
                  background: hsl(var(--muted));
                "
              >
                已停用
              </span>
              <span
                class="inline-flex items-center gap-1.5 text-xs flex-shrink-0"
                style="color: hsl(var(--muted-foreground))"
              >
                <span
                  class="size-1.5 rounded-full"
                  :style="{
                    background:
                      (item.dst_backend_id || 'local') === 'local'
                        ? 'hsl(var(--success))'
                        : 'hsl(var(--primary))',
                  }"
                ></span>
                {{ backendLabel(item.dst_backend_id || 'local') }}
              </span>
              <span
                class="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                style="
                  color: hsl(var(--muted-foreground));
                  background: hsl(var(--accent));
                "
              >
                {{ modeLabel(item.operation) }}
              </span>
              <div
                class="flex items-center gap-1 flex-shrink-0 ml-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity"
              >
                <NTooltip>
                  <template #trigger>
                    <NButton
                      size="small"
                      quaternary
                      circle
                      aria-label="立即同步"
                      @click="handleRun(item)"
                    >
                      <template #icon>
                        <IconifyIcon icon="lucide:play" class="size-3.5" />
                      </template>
                    </NButton>
                  </template>
                  立即同步
                </NTooltip>
                <NTooltip>
                  <template #trigger>
                    <NButton
                      size="small"
                      quaternary
                      circle
                      aria-label="编辑"
                      @click="openEdit(item)"
                    >
                      <template #icon>
                        <IconifyIcon icon="lucide:pencil" class="size-3.5" />
                      </template>
                    </NButton>
                  </template>
                  编辑
                </NTooltip>
                <NTooltip>
                  <template #trigger>
                    <NButton
                      size="small"
                      quaternary
                      circle
                      type="error"
                      aria-label="删除"
                      @click="handleDelete(item)"
                    >
                      <template #icon>
                        <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                      </template>
                    </NButton>
                  </template>
                  删除
                </NTooltip>
              </div>
            </li>
            <!-- 添加目的目录 -->
            <li>
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs transition-colors hover:bg-accent/40"
                style="color: hsl(var(--muted-foreground))"
                @click="openAddDest(group)"
              >
                <IconifyIcon icon="lucide:plus" class="size-3.5" />
                添加目的目录
              </button>
            </li>
          </ul>
        </section>
      </div>

      <!-- 空状态 -->
      <div
        v-else
        class="rounded-lg border border-dashed flex flex-col items-center justify-center py-20"
        style="border-color: hsl(var(--border))"
      >
        <IconifyIcon
          icon="lucide:folder-sync"
          class="size-8 mb-3"
          style="color: hsl(var(--muted-foreground))"
        />
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
