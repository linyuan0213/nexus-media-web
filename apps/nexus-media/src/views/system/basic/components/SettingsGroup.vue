<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NTag } from 'naive-ui';

interface Props {
  advanced?: boolean;
  badge?: string;
  description?: string;
  icon?: string;
  title: string;
}

withDefaults(defineProps<Props>(), {
  advanced: false,
  badge: '',
  description: '',
  icon: '',
});
</script>

<template>
  <section
    class="settings-group"
    :class="{ 'settings-group--advanced': advanced }"
  >
    <div class="group-heading">
      <IconifyIcon v-if="icon" :icon="icon" class="size-4 shrink-0" />
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="group-title">{{ title }}</h3>
          <NTag
            v-if="badge"
            size="small"
            :type="advanced ? 'warning' : 'default'"
          >
            {{ badge }}
          </NTag>
        </div>
        <p v-if="description" class="group-description">{{ description }}</p>
      </div>
    </div>
    <div class="group-content">
      <slot></slot>
    </div>
  </section>
</template>

<style scoped>
.settings-group {
  min-width: 0;
}

.settings-group + .settings-group {
  padding-top: 1.25rem;
  border-top: 1px solid hsl(var(--border));
}

.settings-group--advanced {
  padding-left: 1rem;
  border-left: 2px solid hsl(var(--warning) / 55%);
}

.group-heading {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin-bottom: 1rem;
  color: hsl(var(--muted-foreground));
}

.group-heading > .size-4 {
  margin-top: 0.125rem;
}

.group-title {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.5;
  color: hsl(var(--card-foreground));
}

.group-description {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.group-content {
  min-width: 0;
}

@media (max-width: 640px) {
  .settings-group--advanced {
    padding-left: 0.75rem;
  }
}
</style>
