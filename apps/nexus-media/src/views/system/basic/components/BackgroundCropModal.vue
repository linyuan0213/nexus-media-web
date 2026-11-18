<script lang="ts" setup>
import type { SystemApi } from '#/api/modules/system';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import Cropper from 'cropperjs';
import { NAlert, NButton, NModal, NProgress, NSlider } from 'naive-ui';

import 'cropperjs/dist/cropper.css';

const props = withDefaults(
  defineProps<{
    device: SystemApi.AppearanceDevice;
    file: File | null;
    open: boolean;
    progress?: number;
    uploading?: boolean;
  }>(),
  { progress: 0, uploading: false },
);

const emit = defineEmits<{
  cancel: [];
  confirm: [file: File];
  reselect: [];
  'update:open': [open: boolean];
}>();

const imageRef = ref<HTMLImageElement | null>(null);
const zoom = ref(1);
const error = ref('');
let cropper: Cropper | null = null;
let objectUrl = '';

const canvasSize = computed(() =>
  props.device === 'desktop'
    ? { width: 1600, height: 900 }
    : { width: 720, height: 1280 },
);
const aspectRatio = computed(() =>
  props.device === 'desktop' ? 16 / 9 : 9 / 16,
);
const title = computed(
  () => `裁剪${props.device === 'desktop' ? '桌面端' : '移动端'}背景`,
);

function destroyCropper() {
  cropper?.destroy();
  cropper = null;
}

function initCropper() {
  const image = imageRef.value;
  if (!image || !image.complete) return;
  destroyCropper();
  cropper = new Cropper(image, {
    aspectRatio: aspectRatio.value,
    autoCropArea: 0.9,
    background: true,
    center: true,
    cropBoxMovable: false,
    cropBoxResizable: false,
    dragMode: 'move',
    guides: true,
    highlight: false,
    modal: true,
    responsive: true,
    toggleDragModeOnDblclick: false,
    viewMode: 1,
    ready() {
      zoom.value = 1;
    },
  });
}

function releaseObjectUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
}

function loadImage() {
  destroyCropper();
  releaseObjectUrl();
  error.value = '';
  if (!props.open || !props.file) return;

  objectUrl = URL.createObjectURL(props.file);
  const image = imageRef.value;
  if (!image) return;
  image.onload = () => nextTick(initCropper);
  image.onerror = () => {
    error.value = '图片读取失败，请重新选择';
  };
  image.src = objectUrl;
}

function handleZoom(value: number) {
  zoom.value = value;
  cropper?.zoomTo(value);
}

function resetCrop() {
  cropper?.reset();
  zoom.value = 1;
}

function close() {
  if (props.uploading) return;
  destroyCropper();
  emit('update:open', false);
  emit('cancel');
}

function reselect() {
  if (props.uploading) return;
  destroyCropper();
  emit('update:open', false);
  emit('reselect');
}

async function confirmCrop() {
  if (!cropper || !props.file) return;
  const canvas = cropper.getCroppedCanvas({
    width: canvasSize.value.width,
    height: canvasSize.value.height,
    imageSmoothingQuality: 'high',
  });
  if (!canvas) {
    error.value = '裁剪图片导出失败，请重试';
    return;
  }
  const mime = props.file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mime, 0.92);
  });
  if (!blob) {
    error.value = '裁剪图片导出失败，请重试';
    return;
  }
  const extension = mime === 'image/png' ? 'png' : 'jpg';
  emit(
    'confirm',
    new File([blob], `background-${props.device}.${extension}`, { type: mime }),
  );
}

watch(
  () => [props.open, props.file, props.device],
  () => nextTick(loadImage),
  { immediate: true },
);
onBeforeUnmount(() => {
  destroyCropper();
  releaseObjectUrl();
});
</script>

<template>
  <NModal
    :show="open"
    preset="card"
    :title="title"
    class="background-crop-modal"
    :closable="!uploading"
    :mask-closable="!uploading"
    @update:show="(show: boolean) => !show && close()"
  >
    <div class="crop-content">
      <NAlert v-if="error" type="error" :bordered="false">{{ error }}</NAlert>
      <div class="crop-stage">
        <img ref="imageRef" alt="待裁剪背景" />
      </div>
      <div class="crop-zoom">
        <span>缩放</span>
        <NSlider
          :value="zoom"
          :min="0.1"
          :max="2.5"
          :step="0.01"
          :disabled="uploading"
          @update:value="handleZoom"
        />
        <NButton size="small" :disabled="uploading" @click="resetCrop">
          重置
        </NButton>
      </div>
      <p class="crop-help">
        拖动图片调整取景，框内为最终输出区域；框外内容不会保存。输出尺寸：{{
          canvasSize.width
        }}
        × {{ canvasSize.height }}。
      </p>
      <NProgress
        v-if="uploading"
        type="line"
        :percentage="progress"
        :height="18"
        processing
      />
    </div>
    <template #footer>
      <div class="crop-actions">
        <NButton :disabled="uploading" @click="reselect">重新选择</NButton>
        <NButton :disabled="uploading" @click="close">取消</NButton>
        <NButton
          type="primary"
          :loading="uploading"
          :disabled="!file || !!error"
          @click="confirmCrop"
        >
          裁剪并上传
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.crop-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.crop-stage {
  height: min(58vh, 32rem);
  overflow: hidden;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.crop-stage img {
  display: block;
  max-width: 100%;
}

.crop-zoom {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
}

.crop-help {
  font-size: 0.75rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.crop-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .crop-stage {
    height: min(52vh, 26rem);
  }
}
</style>

<style>
.background-crop-modal {
  width: min(46rem, calc(100vw - 2rem));
}

.background-crop-modal .cropper-modal {
  opacity: 0.5;
}
</style>
