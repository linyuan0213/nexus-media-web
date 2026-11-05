<script lang="ts" setup>
import type { SectionDefinition, SectionKey } from '../settings';

import { IconifyIcon } from '@vben/icons';

import { NAV_GROUPS } from '../settings';

interface Props {
  active: SectionKey;
  dirtySections: SectionKey[];
  sections: SectionDefinition[];
}

defineProps<Props>();

const emit = defineEmits<{
  select: [section: SectionKey];
}>();
</script>

<template>
  <nav class="settings-navigation" aria-label="基础设置分区">
    <div v-for="group in NAV_GROUPS" :key="group" class="nav-group">
      <div class="nav-group-label">{{ group }}</div>
      <button
        v-for="section in sections.filter((item) => item.group === group)"
        :key="section.key"
        type="button"
        class="nav-item"
        :class="{ 'nav-item--active': active === section.key }"
        :aria-current="active === section.key ? 'page' : undefined"
        @click="emit('select', section.key)"
      >
        <IconifyIcon :icon="section.icon" class="size-4 shrink-0" />
        <span class="nav-label">{{ section.label }}</span>
        <span
          v-if="dirtySections.includes(section.key)"
          class="dirty-indicator"
          title="有未保存的更改"
        >
          <span class="sr-only">有未保存的更改</span>
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.settings-navigation {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-group-label {
  padding: 0 0.75rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.08em;
}

.nav-item {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  width: 100%;
  min-height: 2.5rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: calc(var(--radius) - 2px);
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.nav-item:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 60%);
}

.nav-item:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

.nav-item--active {
  font-weight: 500;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 20%);
}

.nav-label {
  flex: 1;
  white-space: nowrap;
}

.dirty-indicator {
  flex: 0 0 auto;
  width: 0.4375rem;
  height: 0.4375rem;
  background: hsl(var(--warning));
  border-radius: 50%;
}

@media (max-width: 1023px) {
  .settings-navigation {
    flex-direction: row;
    gap: 0.375rem;
    padding-bottom: 0.375rem;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .nav-group {
    flex-direction: row;
    gap: 0.375rem;
  }

  .nav-group-label {
    display: none;
  }

  .nav-item {
    flex: 0 0 auto;
    width: auto;
    white-space: nowrap;
  }
}
</style>
