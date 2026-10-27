<script lang="ts" setup>
import type { MediaApi } from '#/api/modules/media';

import { computed, reactive, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NAlert,
  NButton,
  NFormItem,
  NInput,
  NInputGroup,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  useMessage,
} from 'naive-ui';

import { getMediaLibrariesApi, saveLibraryRouteApi } from '#/api/modules/media';
import PathPickerModal from '#/components/media/PathPickerModal.vue';
import { getContentProfileOptions } from '#/plugin-framework';

const props = defineProps<{
  servers: MediaApi.MediaServerOption[];
  route: MediaApi.LibraryRoute | null;
}>();

const emit = defineEmits<{
  cancelEdit: [];
  saved: [];
}>();

const message = useMessage();
const saving = ref(false);
const pathPickerVisible = ref(false);
const libraryLoading = ref(false);
const libraryError = ref('');
const libraryOptions = ref<{ label: string; value: string }[]>([]);
let librarySequence = 0;
const form = reactive({
  content_profile: '',
  target_path: '',
  server_id: null as null | number,
  library_id: '',
  enabled: true,
  note: '',
});

const serverOptions = computed(() =>
  props.servers.map((server) => ({
    label: `${server.name}（${server.type}）${server.is_default ? ' · 默认' : ''}`,
    value: server.id,
  })),
);
const profileOptions = computed(() => {
  const options = [
    { label: '不限内容画像', value: '' },
    { label: '普通电影 / 电视剧（default）', value: 'default' },
    ...getContentProfileOptions(),
  ];
  if (
    props.route?.content_profile &&
    !options.some((item) => item.value === props.route?.content_profile)
  ) {
    options.push({
      label: `${props.route.content_profile}（自定义画像）`,
      value: props.route.content_profile,
    });
  }
  return options;
});
const profileLabel = computed(
  () =>
    profileOptions.value.find((item) => item.value === form.content_profile)
      ?.label || form.content_profile,
);
const serverName = computed(
  () =>
    props.servers.find((server) => server.id === form.server_id)?.name ||
    '未选择实例',
);
const libraryLabel = computed(
  () =>
    libraryOptions.value.find((item) => item.value === form.library_id)
      ?.label || '按路径自动匹配',
);

watch(
  () => props.route,
  () => resetForm(),
  { immediate: true },
);

function resetForm() {
  form.content_profile = props.route?.content_profile || '';
  form.target_path = props.route?.target_path || '';
  form.server_id =
    props.route?.server_id ||
    props.servers.find((server) => server.is_default)?.id ||
    props.servers[0]?.id ||
    null;
  form.library_id = props.route?.library_id || '';
  form.enabled = props.route?.enabled ?? true;
  form.note = props.route?.note || '';
  void loadLibraries();
}

async function handleServerChange(serverId: number) {
  form.server_id = serverId;
  form.library_id = '';
  await loadLibraries();
}

async function loadLibraries() {
  const serverId = form.server_id;
  if (!serverId) {
    libraryOptions.value = [];
    return;
  }
  const sequence = ++librarySequence;
  libraryLoading.value = true;
  libraryError.value = '';
  try {
    const libraries = await getMediaLibrariesApi(serverId);
    if (sequence !== librarySequence) return;
    libraryOptions.value = [
      { label: '全部媒体库（按路径自动匹配）', value: '' },
      ...libraries.map((library) => ({
        label: `${library.name}${library.type ? `（${library.type}）` : ''}`,
        value: String(library.id),
      })),
    ];
    if (
      form.library_id &&
      !libraryOptions.value.some((item) => item.value === form.library_id)
    ) {
      libraryOptions.value.push({
        label: `当前媒体库（${form.library_id}）`,
        value: form.library_id,
      });
    }
  } catch (error: any) {
    libraryOptions.value = [
      { label: '全部媒体库（按路径自动匹配）', value: '' },
    ];
    libraryError.value =
      error?.response?.data?.detail || error?.message || '媒体库加载失败';
  } finally {
    if (sequence === librarySequence) libraryLoading.value = false;
  }
}

function confirmDirectory(path: string) {
  form.target_path = path;
}

async function save() {
  if (!form.target_path.trim() && !form.content_profile) {
    message.warning('请填写目标目录，或选择内容画像');
    return;
  }
  if (!form.server_id) {
    message.warning('请选择目标媒体服务器');
    return;
  }
  saving.value = true;
  try {
    await saveLibraryRouteApi({
      id: props.route?.id,
      content_profile: form.content_profile,
      target_path: form.target_path.trim(),
      server_id: form.server_id,
      library_id: form.library_id || null,
      enabled: form.enabled,
      note: form.note.trim(),
    });
    message.success('媒体库路由已保存');
    emit('saved');
  } catch (error: any) {
    message.error(
      error?.response?.data?.detail || error?.message || '保存失败',
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="route-form">
    <NAlert type="info" :bordered="false">
      按文件目标目录选择要刷新的媒体服务器，最长目录优先；未命中再按内容画像，最后使用默认实例。路由不会修改文件保存目录。
    </NAlert>

    <div class="route-steps">
      <section class="route-step">
        <div class="step-heading">
          <span class="step-index">1</span>
          <div>
            <div class="step-title">填写目标目录</div>
            <div class="step-help">该目录及其子目录中的文件会使用这条路由</div>
          </div>
        </div>
        <NFormItem label="目录路径" label-placement="top" required>
          <NInputGroup>
            <NInput
              v-model:value="form.target_path"
              placeholder="选择或输入目录，例如 /media/adult"
            />
            <NButton @click="pathPickerVisible = true">
              <template #icon>
                <IconifyIcon icon="lucide:folder-open" />
              </template>
              选择目录
            </NButton>
          </NInputGroup>
          <template #feedback>
            可浏览本地或存储后端目录，也可以手动输入。
          </template>
        </NFormItem>
        <NFormItem label="内容画像（可选，默认不限）" label-placement="top">
          <NSelect
            v-model:value="form.content_profile"
            :options="profileOptions"
            filterable
          />
        </NFormItem>
      </section>

      <section class="route-step">
        <div class="step-heading">
          <span class="step-index">2</span>
          <div>
            <div class="step-title">选择目标实例</div>
            <div class="step-help">该类型内容入库后，将刷新这台服务器</div>
          </div>
        </div>
        <NFormItem label="媒体服务器" label-placement="top">
          <NSelect
            :value="form.server_id"
            :options="serverOptions"
            placeholder="选择媒体服务器实例"
            @update:value="handleServerChange"
          />
        </NFormItem>
      </section>

      <section class="route-step">
        <div class="step-heading">
          <span class="step-index">3</span>
          <div>
            <div class="step-title">选择媒体库</div>
            <div class="step-help">从实例 API 自动获取，无需手填媒体库 ID</div>
          </div>
        </div>
        <NSpin :show="libraryLoading" size="small">
          <NFormItem label="目标媒体库" label-placement="top">
            <NSelect
              v-model:value="form.library_id"
              :options="libraryOptions"
              :loading="libraryLoading"
              filterable
              placeholder="全部媒体库（按路径自动匹配）"
            />
          </NFormItem>
        </NSpin>
        <NAlert
          v-if="libraryError"
          type="warning"
          :bordered="false"
          class="library-error"
        >
          <div class="error-row">
            <span>{{ libraryError }}，可使用自动匹配或重新加载。</span>
            <NButton size="tiny" text type="primary" @click="loadLibraries">
              重新加载
            </NButton>
          </div>
        </NAlert>
      </section>
    </div>

    <NAlert type="success" :bordered="false" class="route-preview">
      <div class="preview-label">路由预览</div>
      <div class="preview-content">
        <strong>{{ form.target_path || profileLabel }}</strong>
        <IconifyIcon icon="lucide:arrow-right" class="h-4 w-4" />
        <span>{{ serverName }}</span>
        <IconifyIcon icon="lucide:arrow-right" class="h-4 w-4" />
        <span>{{ libraryLabel }}</span>
      </div>
    </NAlert>

    <NFormItem label="备注（可选）" label-placement="top">
      <NInput
        v-model:value="form.note"
        placeholder="例如：成人内容入库后刷新成人媒体库"
      />
    </NFormItem>
    <div class="form-footer">
      <label class="enable-label">
        <NSwitch v-model:value="form.enabled" />
        <span>保存后立即启用</span>
      </label>
      <NSpace>
        <NButton v-if="route" @click="emit('cancelEdit')">取消编辑</NButton>
        <NButton type="primary" :loading="saving" @click="save">
          {{ route ? '保存修改' : '添加路由' }}
        </NButton>
      </NSpace>
    </div>
    <PathPickerModal
      v-model:show="pathPickerVisible"
      :initial-path="form.target_path"
      title="选择路由目录"
      @confirm="confirmDirectory"
    />
  </div>
</template>

<style scoped>
.route-form,
.route-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.route-steps {
  margin-top: 18px;
}

.route-step {
  padding: 14px 16px;
  background: hsl(var(--muted) / 25%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.step-heading {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.step-index {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 50%;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
}

.step-help {
  margin-top: 2px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.library-error {
  margin-top: 8px;
}

.error-row {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.route-preview {
  margin-top: 2px;
}

.preview-label {
  margin-bottom: 6px;
  font-size: 12px;
  opacity: 0.75;
}

.preview-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.form-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.enable-label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}
</style>
