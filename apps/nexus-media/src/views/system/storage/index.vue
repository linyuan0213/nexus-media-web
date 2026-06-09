<script lang="ts" setup>
import type { StorageApi, StorageTypeSchema } from '#/api/modules/storage';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  useMessage,
} from 'naive-ui';

import {
  createStorageBackendApi,
  deleteStorageBackendApi,
  getStorageBackendsApi,
  getStorageTypesApi,
  testStorageBackendApi,
  updateStorageBackendApi,
} from '#/api/modules/storage';
import PageHeader from '#/components/page/PageHeader.vue';

const message = useMessage();

// naive-ui NSelect prefix slot 类型缺失，临时包装
const NSelectWithPrefix = NSelect as any;
const backends = ref<StorageApi.StorageBackend[]>([]);
const typeSchema = ref<StorageTypeSchema[]>([]);
const loading = ref(false);

const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 640);

function onResize() {
  windowWidth.value = window.innerWidth;
}
onMounted(() => {
  window.addEventListener('resize', onResize);
});

// 删除确认
const deleteTarget = ref<null | StorageApi.StorageBackend>(null);
const showDeleteModal = computed({
  get: () => deleteTarget.value !== null,
  set: (v: boolean) => {
    if (!v) deleteTarget.value = null;
  },
});

// 抽屉
const drawer = ref({
  show: false,
  isEdit: false,
  form: {
    sid: 0,
    name: '',
    type: '',
    config: {} as Record<string, any>,
    enabled: 1,
  },
});
const testing = ref(false);
const testResult = ref<null | { msg: string; ok: boolean }>(null);

// 类型选项
const types = computed(() =>
  typeSchema.value.map((t) => ({ label: t.label, value: t.key })),
);

const currentFields = computed(() => {
  const schema = typeSchema.value.find((t) => t.key === drawer.value.form.type);
  return schema?.fields || [];
});

const currentIcon = computed(() => {
  const schema = typeSchema.value.find((t) => t.key === drawer.value.form.type);
  return schema?.icon || 'lucide:hard-drive';
});

function defaultConfig(type: string): Record<string, any> {
  const schema = typeSchema.value.find((t) => t.key === type);
  if (!schema) return {};
  const obj: Record<string, any> = {};
  for (const f of schema.fields) {
    obj[f.key] = '';
  }
  return obj;
}

async function fetch() {
  loading.value = true;
  try {
    const [backendRes, typeRes] = await Promise.all([
      getStorageBackendsApi(),
      getStorageTypesApi(),
    ]);
    backends.value = backendRes.items || [];
    typeSchema.value = typeRes.items || [];
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  drawer.value = {
    show: true,
    isEdit: false,
    form: {
      sid: 0,
      name: '',
      type: '',
      config: {},
      enabled: 1,
    },
  };
  testResult.value = null;
}

function openEdit(item: StorageApi.StorageBackend) {
  drawer.value = {
    show: true,
    isEdit: true,
    form: {
      sid: item.id,
      name: item.name,
      type: item.type,
      config: { ...defaultConfig(item.type), ...item.config },
      enabled: item.enabled ? 1 : 0,
    },
  };
  testResult.value = null;
}

async function save() {
  const f = drawer.value.form;
  if (!f.name || !f.type) {
    message.error('名称和类型不能为空');
    return;
  }
  for (const fd of currentFields.value) {
    if (fd.required && !f.config[fd.key]?.trim?.()) {
      message.error(`${fd.label} 不能为空`);
      return;
    }
  }
  const configJson = JSON.stringify(f.config);
  await (drawer.value.isEdit
    ? updateStorageBackendApi({
        sid: f.sid,
        name: f.name,
        type: f.type,
        config: configJson,
        enabled: f.enabled,
      })
    : createStorageBackendApi({
        name: f.name,
        type: f.type,
        config: configJson,
        enabled: f.enabled,
      }));
  drawer.value.show = false;
  message.success('保存成功');
  await fetch();
}

async function testConnection() {
  const f = drawer.value.form;
  if (!f.type) {
    message.error('请先选择类型');
    return;
  }
  testing.value = true;
  testResult.value = null;
  try {
    const res = await testStorageBackendApi({
      type: f.type,
      config: JSON.stringify(f.config),
    });
    if (res?.success) {
      testResult.value = { ok: true, msg: res.msg || '连接成功' };
      message.success(testResult.value.msg);
    } else {
      testResult.value = { ok: false, msg: res?.msg || '连接失败' };
      message.error(testResult.value.msg);
    }
  } catch (error: any) {
    testResult.value = { ok: false, msg: error?.message || '测试异常' };
    message.error(testResult.value.msg);
  } finally {
    testing.value = false;
  }
}

function confirmDelete(item: StorageApi.StorageBackend) {
  deleteTarget.value = item;
}

async function doDelete() {
  const item = deleteTarget.value;
  if (!item) return;
  await deleteStorageBackendApi(item.id);
  deleteTarget.value = null;
  message.success('删除成功');
  await fetch();
}

function typeLabel(type?: string) {
  return types.value.find((t) => t.value === type)?.label || type || '-';
}

function typeIcon(type?: string) {
  return (
    typeSchema.value.find((t) => t.key === type)?.icon || 'lucide:hard-drive'
  );
}

function typeColor(type?: string) {
  switch (type) {
    case 'local': {
      return 'hsl(var(--success))';
    }
    case 'rclone': {
      return 'hsl(var(--info))';
    }
    case 's3': {
      return 'hsl(var(--warning))';
    }
    default: {
      return 'hsl(var(--primary))';
    }
  }
}

onMounted(fetch);
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader
      title="存储后端"
      subtitle="配置本地或远程存储后端，用于同步和转移"
    >
      <template #actions>
        <NButton type="primary" @click="openAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增后端
        </NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading" class="mt-5">
      <div
        v-if="backends.length > 0"
        class="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <div
          v-for="item in backends"
          :key="item.id"
          class="rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
          style="background: hsl(var(--card)); border-color: hsl(var(--border))"
        >
          <!-- 头部 -->
          <div
            class="flex items-center justify-between px-5 py-4 border-b"
            style="border-color: hsl(var(--border))"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
                :style="{ background: `${typeColor(item.type)}20` }"
              >
                <IconifyIcon
                  :icon="typeIcon(item.type)"
                  class="size-5"
                  :style="{ color: typeColor(item.type) }"
                />
              </div>
              <div class="min-w-0">
                <h3
                  class="text-sm font-semibold truncate"
                  style="color: hsl(var(--foreground))"
                >
                  {{ item.name }}
                </h3>
                <div
                  class="text-xs mt-0.5"
                  style="color: hsl(var(--muted-foreground))"
                >
                  {{ typeLabel(item.type) }} · ID:{{ item.id }}
                </div>
              </div>
            </div>

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
              ></span>
              {{ item.enabled ? '启用' : '停用' }}
            </div>
          </div>

          <!-- 详情 -->
          <div class="p-5 grid grid-cols-2 gap-3">
            <div
              class="rounded-lg p-3"
              style="background: hsl(var(--muted) / 40%)"
            >
              <div
                class="text-xs mb-1"
                style="color: hsl(var(--muted-foreground))"
              >
                类型
              </div>
              <div
                class="text-sm font-medium"
                style="color: hsl(var(--foreground))"
              >
                {{ typeLabel(item.type) }}
              </div>
            </div>
            <div
              class="rounded-lg p-3"
              style="background: hsl(var(--muted) / 40%)"
            >
              <div
                class="text-xs mb-1"
                style="color: hsl(var(--muted-foreground))"
              >
                配置项
              </div>
              <div
                class="text-sm font-medium"
                style="color: hsl(var(--foreground))"
              >
                {{ Object.keys(item.config || {}).length }} 项
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div
            class="flex items-center justify-end gap-2 px-5 py-3 border-t"
            style="border-color: hsl(var(--border))"
          >
            <NButton size="small" text @click="openEdit(item)">
              <template #icon>
                <IconifyIcon icon="lucide:pencil" class="size-4" />
              </template>
              编辑
            </NButton>
            <NButton
              size="small"
              text
              type="error"
              @click="confirmDelete(item)"
            >
              <template #icon>
                <IconifyIcon icon="lucide:trash-2" class="size-4" />
              </template>
              删除
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
            icon="lucide:hard-drive"
            class="size-8"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
        <p class="text-sm mb-4" style="color: hsl(var(--muted-foreground))">
          暂无存储后端
        </p>
        <NButton type="primary" @click="openAdd">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增后端
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
        :title="drawer.isEdit ? '编辑存储后端' : '新增存储后端'"
        :native-scrollbar="false"
      >
        <NForm label-placement="top" size="medium">
          <NFormItem label="名称" required>
            <NInput
              v-model:value="drawer.form.name"
              placeholder="例如：冷存储 S3"
              clearable
            >
              <template #prefix>
                <IconifyIcon
                  icon="lucide:tag"
                  class="size-4"
                  style="color: hsl(var(--muted-foreground))"
                />
              </template>
            </NInput>
          </NFormItem>

          <NFormItem label="类型" required>
            <NSelectWithPrefix
              v-model:value="drawer.form.type"
              :options="types"
              placeholder="选择存储类型"
              @update:value="
                drawer.form.config = defaultConfig($event);
                testResult = null;
              "
            >
              <!-- @ts-ignore: naive-ui NSelect prefix slot -->
              <template #prefix>
                <IconifyIcon
                  :icon="currentIcon"
                  class="size-4"
                  style="color: hsl(var(--muted-foreground))"
                />
              </template>
            </NSelectWithPrefix>
          </NFormItem>

          <!-- 动态配置字段 -->
          <template v-if="drawer.form.type && currentFields.length > 0">
            <div
              class="rounded-lg p-3 mb-3"
              style="
                background: hsl(var(--muted) / 30%);
                border: 1px solid hsl(var(--border));
              "
            >
              <div
                class="text-xs font-medium mb-2"
                style="color: hsl(var(--muted-foreground))"
              >
                连接配置
              </div>
              <NFormItem
                v-for="fd in currentFields"
                :key="fd.key"
                :label="fd.label"
                :required="fd.required"
              >
                <NInput
                  v-model:value="drawer.form.config[fd.key]"
                  :placeholder="fd.placeholder"
                  clearable
                  @input="testResult = null"
                />
              </NFormItem>
            </div>
          </template>

          <!-- 测试结果 -->
          <div
            v-if="testResult"
            class="rounded-lg p-3 mb-3 flex items-start gap-2"
            :style="{
              background: testResult.ok
                ? 'hsl(var(--success) / 0.1)'
                : 'hsl(var(--destructive) / 0.1)',
              border: `1px solid ${
                testResult.ok
                  ? 'hsl(var(--success) / 0.3)'
                  : 'hsl(var(--destructive) / 0.3)'
              }`,
            }"
          >
            <IconifyIcon
              :icon="testResult.ok ? 'lucide:check-circle' : 'lucide:x-circle'"
              class="size-4 flex-shrink-0 mt-0.5"
              :style="{
                color: testResult.ok
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--destructive))',
              }"
            />
            <span
              class="text-sm"
              :style="{
                color: testResult.ok
                  ? 'hsl(var(--success))'
                  : 'hsl(var(--destructive))',
              }"
            >
              {{ testResult.msg }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <NSwitch
              v-model:value="drawer.form.enabled"
              :checked-value="1"
              :unchecked-value="0"
            />
            <span class="text-sm" style="color: hsl(var(--foreground))"
              >启用</span
            >
          </div>
        </NForm>

        <template #footer>
          <NSpace justify="end">
            <NButton @click="drawer.show = false">取消</NButton>
            <NButton :loading="testing" @click="testConnection">
              <template #icon>
                <IconifyIcon icon="lucide:activity" class="size-4" />
              </template>
              测试连接
            </NButton>
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

    <!-- 删除确认 -->
    <NModal
      v-model:show="showDeleteModal"
      title="确认删除"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="doDelete"
      @negative-click="showDeleteModal = false"
    >
      <div>
        确定要删除存储后端「{{ deleteTarget?.name }}」吗？
        <br />
        <span class="text-xs" style="color: hsl(var(--muted-foreground))"
          >该操作不可恢复，引用该后端的同步目录可能受影响。</span
        >
      </div>
    </NModal>
  </div>
</template>
