<script lang="ts" setup>
import { NSwitch } from 'naive-ui';

interface Props {
  description: string;
  disabled?: boolean;
  label: string;
  value?: boolean;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
  value: false,
});

const emit = defineEmits<{
  update: [value: boolean];
}>();
</script>

<template>
  <div
    class="settings-switch"
    :class="{ 'settings-switch--disabled': disabled }"
  >
    <div class="min-w-0">
      <div class="switch-label">{{ label }}</div>
      <p class="switch-description">{{ description }}</p>
    </div>
    <NSwitch
      class="shrink-0"
      :value="value"
      :disabled="disabled"
      :aria-label="label"
      @update:value="emit('update', $event)"
    />
  </div>
</template>

<style scoped>
.settings-switch {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  min-height: 3.5rem;
  padding: 0.625rem 0.75rem;
  background: hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border) / 75%);
  border-radius: calc(var(--radius) - 2px);
}

.settings-switch--disabled {
  opacity: 0.65;
}

.switch-label {
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.5;
  color: hsl(var(--card-foreground));
}

.switch-description {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}
</style>
