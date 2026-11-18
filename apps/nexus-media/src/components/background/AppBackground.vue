<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useAppBackground } from '#/composables/useAppBackground';

const emit = defineEmits<{
  error: [];
  loading: [];
  ready: [url: string, desktopFallback: boolean];
}>();

const { backgroundBlur, backgroundUrls, loadAppBackground } =
  useAppBackground();
const isMobile = ref(false);
const failedUrl = ref('');
const activeUrl = computed(() =>
  isMobile.value
    ? backgroundUrls.value.mobile || backgroundUrls.value.desktop
    : backgroundUrls.value.desktop,
);
const desktopFallback = computed(
  () =>
    isMobile.value &&
    !backgroundUrls.value.mobile &&
    !!backgroundUrls.value.desktop,
);
const displayUrl = computed(() =>
  activeUrl.value && activeUrl.value !== failedUrl.value ? activeUrl.value : '',
);
let mediaQuery: MediaQueryList | null = null;

function updateDevice(event?: MediaQueryListEvent) {
  isMobile.value = event?.matches ?? mediaQuery?.matches ?? false;
}

watch(activeUrl, () => {
  failedUrl.value = '';
  emit('loading');
});

function handleError() {
  failedUrl.value = activeUrl.value;
  emit('error');
}

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 640px)');
  updateDevice();
  mediaQuery.addEventListener('change', updateDevice);
  loadAppBackground().catch(() => {});
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', updateDevice);
});
</script>

<template>
  <div
    v-if="displayUrl"
    class="app-background"
    :style="{ '--app-background-blur': `${backgroundBlur}px` }"
    aria-hidden="true"
  >
    <img
      class="app-background__image"
      :class="{ 'is-desktop-fallback': desktopFallback }"
      :key="displayUrl"
      :src="displayUrl"
      alt=""
      @load="emit('ready', displayUrl, desktopFallback)"
      @error="handleError"
    />
    <div class="app-background__veil"></div>
  </div>
</template>

<style>
.app-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.app-background__image {
  position: absolute;
  inset: -4%;
  width: 108%;
  height: 108%;
  object-fit: cover;
  object-position: center;
  opacity: 0.78;
  filter: blur(var(--app-background-blur, 12px)) saturate(82%) brightness(0.9);
  transform: scale(1.04);
}

.app-background__veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    145deg,
    hsl(var(--background) / 20%),
    hsl(var(--background-deep) / 30%)
  );
}

.app-shell,
.app-shell__layout {
  position: relative;
  height: 100%;
  min-height: 100vh;
}

.app-shell__layout {
  z-index: 1;
}

.has-app-background,
.has-app-background .app-shell__layout,
.has-app-background .page-route-container {
  background: transparent;
}

html:has(.has-app-background) body {
  background: hsl(var(--background));
}

.has-app-background [data-layout-region='scroll'] {
  background: linear-gradient(
    145deg,
    hsl(var(--background) / 38%),
    hsl(var(--background-deep) / 48%)
  );
}

.has-app-background
  :is(.bg-sidebar, .bg-header, [data-layout-region='header'] > header) {
  background-color: hsl(var(--card) / 88%);
}

.has-app-background
  [data-layout-region='scroll']
  :is(
    [style*='background: hsl(var(--background))'],
    [style*='background-color: hsl(var(--background))']
  ) {
  background: transparent !important;
}

html.theme-glass .app-background__image {
  opacity: 0.82;
  filter: blur(var(--app-background-blur, 12px)) saturate(82%) brightness(0.9);
}

html.theme-glass .app-background__veil {
  background: linear-gradient(
    145deg,
    hsl(var(--background) / 14%),
    hsl(var(--background-deep) / 24%)
  );
}

html.theme-glass .has-app-background [data-layout-region='scroll'] {
  background:
    radial-gradient(
      780px 520px at 2% 0%,
      color-mix(in srgb, var(--tblr-teal) var(--glass-env-teal), transparent),
      transparent 72%
    ),
    radial-gradient(
      760px 520px at 100% 12%,
      color-mix(
        in srgb,
        var(--tblr-yellow) var(--glass-env-amber),
        transparent
      ),
      transparent 72%
    ),
    linear-gradient(
      145deg,
      hsl(var(--background) / 38%),
      hsl(var(--background-deep) / 48%)
    );
}

html.theme-glass
  .has-app-background
  :is(.bg-sidebar, .bg-sidebar-deep, .bg-header) {
  background:
    linear-gradient(
      125deg,
      hsl(var(--glass-highlight) / 20%),
      transparent 42%,
      hsl(var(--primary) / 5%)
    ),
    hsl(var(--glass-surface) / var(--glass-shell-opacity));
}

html.dark .app-background__image {
  opacity: 0.76;
}

html.dark .app-background__veil {
  background: linear-gradient(
    145deg,
    hsl(var(--background) / 24%),
    hsl(var(--background-deep) / 34%)
  );
}

html.dark.theme-glass .app-background__image {
  opacity: 0.82;
}

html.dark.theme-glass .app-background__veil {
  background: linear-gradient(
    145deg,
    hsl(var(--background) / 14%),
    hsl(var(--background-deep) / 24%)
  );
}

@media (max-width: 640px) {
  .app-background__image {
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.45;
    transform: none;
  }

  html.theme-glass .app-background__image {
    opacity: 0.55;
  }

  html.dark .app-background__image {
    opacity: 0.45;
  }

  html.dark.theme-glass .app-background__image {
    opacity: 0.55;
  }
}

.app-background__image.is-desktop-fallback {
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: none;
}

@media (prefers-reduced-transparency: reduce) {
  .app-background__image,
  html.theme-glass .app-background__image,
  html.dark.theme-glass .app-background__image {
    opacity: 0.08;
  }

  .app-background__veil,
  html.theme-glass .app-background__veil {
    background: hsl(var(--background) / 92%);
  }

  .has-app-background [data-layout-region='scroll'],
  html.theme-glass .has-app-background [data-layout-region='scroll'] {
    background: hsl(var(--background));
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-background__image {
    transform: none;
  }
}
</style>
