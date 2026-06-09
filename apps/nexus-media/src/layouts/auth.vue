<script lang="ts" setup>
import { computed } from 'vue';

import { AuthPageLayout } from '@vben/layouts';
import { preferences } from '@vben/preferences';

import { $t } from '#/locales';

const appName = computed(() => preferences.app.name);
const logo = computed(() => preferences.logo.source);
const logoDark = computed(() => preferences.logo.sourceDark);
</script>

<template>
  <AuthPageLayout
    :app-name="appName"
    :logo="logo"
    :logo-dark="logoDark"
    :page-description="$t('authentication.pageDesc')"
    :page-title="$t('authentication.pageTitle')"
    slogan-image="/static/img/media-nas.svg"
  >
    <!-- 自定义工具栏 -->
    <!-- <template #toolbar></template> -->
  </AuthPageLayout>
</template>

<style scoped>
:deep(.login-background) {
  background:
    radial-gradient(
      ellipse at 20% 30%,
      hsl(var(--primary) / 12%) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 70%,
      hsl(var(--accent) / 8%) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 50% 50%,
      hsl(var(--primary) / 5%) 0%,
      transparent 70%
    );
}

:deep(.dark .login-background) {
  background:
    radial-gradient(
      ellipse at 20% 30%,
      hsl(var(--primary) / 8%) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 70%,
      hsl(var(--accent) / 5%) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 50% 50%,
      hsl(var(--primary) / 3%) 0%,
      transparent 70%
    );
}
</style>
