<script lang="ts" setup>
import type { SystemApi } from '#/api/modules/system';

import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  NAlert,
  NButton,
  NInput,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NSlider,
  useMessage,
} from 'naive-ui';

import {
  clearAppBackgroundApi,
  saveAppBackgroundApi,
  uploadAppBackgroundApi,
} from '#/api/modules/system';
import {
  resolveAppBackgroundUrl,
  useAppBackground,
} from '#/composables/useAppBackground';

import BackgroundCropModal from './BackgroundCropModal.vue';
import SettingsGroup from './SettingsGroup.vue';

type Device = SystemApi.AppearanceDevice;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const message = useMessage();
const userStore = useUserStore();
const {
  background,
  backgroundBlur,
  loadAppBackground,
  setAppBackground,
  setAppBackgroundBlur,
} = useAppBackground();

const device = ref<Device>('desktop');
const inputUrls = ref<Record<Device, string>>({ desktop: '', mobile: '' });
const previewUrls = ref<Record<Device, string>>({ desktop: '', mobile: '' });
const previewError = ref('');
const operationError = ref('');
const loading = ref(true);
const saving = ref(false);
const uploading = ref(false);
const clearing = ref(false);
const uploadProgress = ref(0);
const fileInput = ref<HTMLInputElement | null>(null);
const cropOpen = ref(false);
const cropFile = ref<File | null>(null);
const cropDevice = ref<Device>('desktop');

const canEdit = computed(() => {
  const info: any = userStore.userInfo || {};
  const permissions: string[] = info.permissions || [];
  return (
    !!info.is_superadmin ||
    permissions.includes('*') ||
    permissions.includes('setting:update')
  );
});
const busy = computed(
  () => loading.value || saving.value || uploading.value || clearing.value,
);
const currentSlot = computed(() => background.value[device.value]);
const previewSource = computed(() =>
  resolveAppBackgroundUrl(previewUrls.value[device.value]),
);
const previewImageStyle = computed(() => ({
  filter: `blur(${backgroundBlur.value}px)`,
  transform: backgroundBlur.value > 0 ? 'scale(1.04)' : 'none',
}));
const sourceLabel = computed(() => {
  if (currentSlot.value.source === 'upload') return '本地上传';
  if (currentSlot.value.source === 'url') return '外部 URL';
  return '';
});
const updatedLabel = computed(() => {
  if (!currentSlot.value.updated_at) return '';
  const date = new Date(currentSlot.value.updated_at);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
});

function syncBackground() {
  inputUrls.value = {
    desktop: background.value.desktop.url || '',
    mobile: background.value.mobile.url || '',
  };
  previewUrls.value = { ...inputUrls.value };
  previewError.value = '';
}

function validateUrl(value: string) {
  if (!value || value.length > 2048 || value.includes('\\')) return false;
  if (/^https?:\/\/[^\s]+$/i.test(value)) return true;
  const path = value.split(/[?#]/)[0] || '';
  return (
    /^\/(?:static|img|api\/system\/appearance\/background\/file)\//.test(
      path,
    ) && !path.split('/').includes('..')
  );
}

function handlePreview() {
  operationError.value = '';
  const url = inputUrls.value[device.value].trim();
  if (!validateUrl(url)) {
    previewError.value = '请输入有效的 HTTP(S)、/static 或 /img 图片地址';
    return;
  }
  previewError.value = '';
  previewUrls.value[device.value] = url;
}

async function handleSave() {
  const currentDevice = device.value;
  const url = inputUrls.value[currentDevice].trim();
  if (!validateUrl(url)) {
    operationError.value = '请输入有效的 HTTP(S)、/static 或 /img 图片地址';
    return;
  }
  saving.value = true;
  operationError.value = '';
  try {
    const result = await saveAppBackgroundApi(url, currentDevice);
    setAppBackground(result);
    syncBackground();
    message.success(
      `${currentDevice === 'desktop' ? '桌面端' : '移动端'}背景已保存`,
    );
  } catch (error: any) {
    operationError.value = error?.message || '背景海报保存失败';
  } finally {
    saving.value = false;
  }
}

function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  operationError.value = '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    operationError.value = '仅支持 JPG、PNG 或 WebP 图片';
    input.value = '';
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    operationError.value = '背景图片不能超过 10MB';
    input.value = '';
    return;
  }
  cropDevice.value = device.value;
  cropFile.value = file;
  cropOpen.value = true;
  input.value = '';
}

async function handleCroppedUpload(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    operationError.value = '裁剪后的图片超过 10MB，请降低原图尺寸后重试';
    cropOpen.value = false;
    return;
  }
  uploading.value = true;
  uploadProgress.value = 0;
  operationError.value = '';
  try {
    const result = await uploadAppBackgroundApi(
      file,
      cropDevice.value,
      (percentage) => {
        uploadProgress.value = percentage;
      },
    );
    setAppBackground(result);
    syncBackground();
    cropOpen.value = false;
    cropFile.value = null;
    message.success(
      `${cropDevice.value === 'desktop' ? '桌面端' : '移动端'}背景上传成功`,
    );
  } catch (error: any) {
    operationError.value = error?.message || '背景海报上传失败';
    cropOpen.value = false;
  } finally {
    uploading.value = false;
  }
}

function reselectFile() {
  cropFile.value = null;
  nextTick(() => fileInput.value?.click());
}

async function handleClear() {
  const currentDevice = device.value;
  clearing.value = true;
  operationError.value = '';
  try {
    const result = await clearAppBackgroundApi(currentDevice);
    setAppBackground(result);
    syncBackground();
    message.success(
      `${currentDevice === 'desktop' ? '桌面端' : '移动端'}背景已清除`,
    );
  } catch (error: any) {
    operationError.value = error?.message || '背景海报清除失败';
  } finally {
    clearing.value = false;
  }
}

watch(device, () => {
  previewError.value = '';
  operationError.value = '';
});

onMounted(async () => {
  loading.value = true;
  await loadAppBackground(true);
  syncBackground();
  loading.value = false;
});
</script>

<template>
  <SettingsGroup
    title="应用背景海报"
    description="分别为桌面端和移动端设置轻量背景，正文、表格和输入区域仍保持清晰。"
    icon="lucide:image"
  >
    <NAlert v-if="!canEdit" type="info" :bordered="false" class="mb-4">
      当前账号仅可预览背景，修改需要系统设置更新权限。
    </NAlert>

    <NRadioGroup
      v-model:value="device"
      name="background-device"
      :disabled="busy || cropOpen"
      class="mb-4"
    >
      <NRadioButton value="desktop">桌面端 · 16:9</NRadioButton>
      <NRadioButton value="mobile">移动端 · 9:16</NRadioButton>
    </NRadioGroup>

    <div class="appearance-layout" :class="`appearance-layout--${device}`">
      <div class="appearance-preview" :class="`appearance-preview--${device}`">
        <img
          v-if="previewSource && !previewError"
          :src="previewSource"
          :style="previewImageStyle"
          :alt="`${device === 'desktop' ? '桌面端' : '移动端'}背景海报预览`"
          @error="previewError = '图片加载失败，请检查地址或图片代理设置'"
        />
        <div v-else class="appearance-preview__empty">
          <IconifyIcon icon="lucide:image-off" class="size-7" />
          <span>{{ previewError || '暂无背景海报' }}</span>
        </div>
        <div
          v-if="previewSource && !previewError"
          class="appearance-preview__live"
        >
          <span class="appearance-preview__live-dot"></span>
          实时生效
        </div>
        <div class="appearance-preview__caption">
          {{ device === 'desktop' ? '桌面端 16:9' : '移动端 9:16' }} ·
          实际应用会叠加主题遮罩
        </div>
      </div>

      <div class="appearance-controls">
        <NInput
          v-model:value="inputUrls[device]"
          :disabled="!canEdit || busy"
          placeholder="https://… 或后端背景图片地址"
          :input-props="{ 'aria-label': '背景海报图片地址' }"
          @keyup.enter="handleSave"
        />
        <div class="appearance-actions">
          <NButton :disabled="busy" @click="handlePreview">
            <template #icon><IconifyIcon icon="lucide:eye" /></template>
            预览
          </NButton>
          <NButton
            type="primary"
            :disabled="!canEdit || busy"
            :loading="saving"
            @click="handleSave"
          >
            <template v-if="!saving" #icon>
              <IconifyIcon icon="lucide:save" />
            </template>
            保存 URL
          </NButton>
          <NButton
            :disabled="!canEdit || saving || clearing"
            :loading="uploading"
            @click="fileInput?.click()"
          >
            <template v-if="!uploading" #icon>
              <IconifyIcon icon="lucide:upload" />
            </template>
            选择并裁剪
          </NButton>
          <NButton
            tertiary
            type="error"
            :disabled="!canEdit || busy || !currentSlot.url"
            :loading="clearing"
            @click="handleClear"
          >
            <template v-if="!clearing" #icon>
              <IconifyIcon icon="lucide:trash-2" />
            </template>
            清除
          </NButton>
        </div>

        <div class="appearance-blur">
          <div class="appearance-blur__label">
            <span>背景模糊</span>
            <span>{{ backgroundBlur }}px</span>
          </div>
          <NSlider
            :value="backgroundBlur"
            :min="0"
            :max="30"
            :step="1"
            @update:value="setAppBackgroundBlur"
          />
        </div>

        <NProgress
          v-if="uploading && !cropOpen"
          type="line"
          :percentage="uploadProgress"
          :height="18"
          processing
        />
        <NAlert v-if="operationError" type="error" :bordered="false">
          {{ operationError }}
        </NAlert>
        <p class="appearance-help">
          支持 JPG、PNG、WebP，原图与裁剪结果均不超过
          10MB。上传前可拖动和缩放取景。
        </p>
        <p v-if="sourceLabel" class="appearance-meta">
          当前来源：{{ sourceLabel
          }}<span v-if="updatedLabel"> · 更新于 {{ updatedLabel }}</span>
        </p>
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept="image/jpeg,image/png,image/webp"
          aria-label="选择背景海报图片"
          @change="handleUpload"
        />
      </div>
    </div>

    <BackgroundCropModal
      v-model:open="cropOpen"
      :file="cropFile"
      :device="cropDevice"
      :uploading="uploading"
      :progress="uploadProgress"
      @cancel="cropFile = null"
      @reselect="reselectFile"
      @confirm="handleCroppedUpload"
    />
  </SettingsGroup>
</template>

<style scoped>
.appearance-layout {
  display: grid;
  grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.appearance-layout--mobile {
  grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr);
}

.appearance-preview {
  position: relative;
  width: 100%;
  max-width: 26rem;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
}

.appearance-preview--mobile {
  width: min(100%, 14rem);
  max-width: 14rem;
  aspect-ratio: 9 / 16;
  margin-inline: auto;
}

.appearance-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    filter 180ms ease,
    transform 180ms ease;
}

.appearance-preview__live {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.28rem 0.55rem;
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1.2;
  color: #fff;
  letter-spacing: 0.02em;
  background: rgb(0 0 0 / 38%);
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 999px;
  box-shadow: 0 4px 12px -6px rgb(0 0 0 / 45%);
  backdrop-filter: blur(10px) saturate(120%);
}

.appearance-preview__live-dot {
  width: 0.35rem;
  height: 0.35rem;
  background: hsl(var(--success));
  border-radius: 999px;
  box-shadow: 0 0 0 2px hsl(var(--success) / 18%);
}

.appearance-preview__empty {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 0;
  padding: 1rem;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.appearance-preview__caption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 0.75rem;
  font-size: 0.75rem;
  color: hsl(var(--background));
  background: linear-gradient(transparent, hsl(var(--foreground) / 68%));
}

.appearance-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.appearance-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.appearance-blur {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.appearance-blur__label {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.appearance-help,
.appearance-meta {
  font-size: 0.75rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 900px) {
  .appearance-layout,
  .appearance-layout--mobile {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .appearance-actions :deep(.n-button) {
    flex: 1 1 calc(50% - 0.5rem);
  }
}
</style>
