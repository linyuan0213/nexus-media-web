<script lang="ts" setup>
/**
 * 统一媒体海报组件。
 *
 * 所有媒体卡片只通过这里处理：内容画像展示变换 → 图片代理 → 海报位置 → 懒加载/失败回退。
 * 消息通知的模糊由后端 message transformer 处理，组件不读取消息模糊配置。
 */
import { computed, ref, watch } from 'vue';

import { fallbackImage } from '#/utils/image';
import {
  resolveMediaPoster,
  resolveMediaPosterPosition,
} from '#/utils/media-poster';

interface Props {
  alt?: string;
  contentProfile?: null | string;
  fallback?: string;
  fit?: 'contain' | 'cover';
  lazy?: boolean;
  /** 显式位置优先于内容画像配置 */
  position?: string;
  src?: null | string;
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  contentProfile: '',
  fallback: '',
  fit: 'cover',
  lazy: true,
  position: '',
  src: '',
});

const failed = ref(false);

watch(
  () => [props.src, props.contentProfile],
  () => {
    failed.value = false;
  },
);

const resolved = computed(() => {
  if (failed.value || !props.src) return props.fallback || fallbackImage;
  return resolveMediaPoster(props.src, props.contentProfile);
});

const objectPosition = computed(
  () =>
    props.position ||
    resolveMediaPosterPosition(props.contentProfile) ||
    '50% 50%',
);

function onError(e: Event) {
  const img = e.target as HTMLImageElement;
  if (failed.value) return;
  failed.value = true;
  img.src = props.fallback || fallbackImage;
}
</script>

<template>
  <img
    :src="resolved"
    :alt="alt"
    :loading="lazy ? 'lazy' : 'eager'"
    decoding="async"
    :style="{ objectFit: fit, objectPosition }"
    @error="onError"
  />
</template>
