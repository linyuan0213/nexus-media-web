<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton, NTooltip } from 'naive-ui';

import { useGlassTheme } from '#/composables/useGlassTheme';

const { glassTheme, toggleGlassTheme } = useGlassTheme();
</script>

<template>
  <NTooltip trigger="hover">
    <template #trigger>
      <NButton
        quaternary
        circle
        size="small"
        class="glass-theme-toggle"
        :class="{ 'is-active': glassTheme }"
        :aria-pressed="glassTheme"
        :aria-label="glassTheme ? '切换回标准主题' : '启用毛玻璃主题'"
        data-glass-theme-toggle
        @click="toggleGlassTheme"
      >
        <template #icon>
          <IconifyIcon
            :icon="glassTheme ? 'lucide:layers-2' : 'lucide:layers'"
            class="size-4"
          />
        </template>
      </NButton>
    </template>
    {{ glassTheme ? '切换回标准主题' : '启用毛玻璃主题' }}
  </NTooltip>
</template>

<style scoped>
.glass-theme-toggle {
  margin-right: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.glass-theme-toggle:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.glass-theme-toggle.is-active {
  color: hsl(var(--primary));
  background: transparent;
}
</style>
