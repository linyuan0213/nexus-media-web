<script lang="ts" setup>
/**
 * PluginSlot - 插件插槽组件
 * 在核心页面中预留插槽位置，允许插件注入自定义 UI
 */
import { computed } from 'vue';

import { NCard, NEmpty } from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import { getSlotComponents } from '#/plugin-framework/loader';

const props = defineProps<{
  target: string;
  title?: string;
  showEmpty?: boolean;
}>();

const components = computed(() => {
  return getSlotComponents(props.target).filter((c) => c.component !== null);
});

function getIconBg(color?: string) {
  if (!color) return 'hsl(var(--primary) / 0.08)';
  return `${color}15`;
}

function getIconColor(color?: string) {
  if (!color) return 'hsl(var(--primary))';
  return color;
}
</script>

<template>
  <div v-if="components.length > 0" class="plugin-slot">
    <div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <NCard
        v-for="item in components"
        :key="item.pluginId"
        size="small"
        class="plugin-slot-card"
      >
        <template #header>
          <div class="plugin-slot-header">
            <div
              class="plugin-slot-icon"
              :style="{
                backgroundColor: getIconBg(item.color),
                color: getIconColor(item.color),
              }"
            >
              <IconifyIcon :icon="item.icon" class="h-4 w-4" />
            </div>
            <span class="plugin-slot-name">{{ item.name }}</span>
            <span class="plugin-slot-badge">插件</span>
          </div>
        </template>
        <component :is="item.component" />
      </NCard>
    </div>
  </div>
  <NEmpty v-else-if="showEmpty" size="small" description="暂无插件内容" />
</template>

<style scoped>
.plugin-slot {
  width: 100%;
}

.plugin-slot-card {
  transition: all 0.2s ease;
}

.plugin-slot-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px hsl(var(--border) / 0.4);
}

.plugin-slot-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.plugin-slot-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

.plugin-slot-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: hsl(var(--card-foreground));
}

.plugin-slot-badge {
  margin-left: auto;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  background-color: hsl(var(--muted) / 0.4);
  color: hsl(var(--muted-foreground));
}
</style>