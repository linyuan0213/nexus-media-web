<script setup lang="ts">
interface Props {
  title: string;
  subtitle?: string;
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
});
</script>

<template>
  <div class="empty-state">
    <div v-if="$slots.icon" class="empty-state-icon">
      <slot name="icon"></slot>
    </div>
    <div class="empty-state-title">{{ title }}</div>
    <div v-if="subtitle" class="empty-state-subtitle">{{ subtitle }}</div>
    <div v-if="$slots.action" class="empty-state-action">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
}

.empty-state-icon {
  margin-bottom: 1rem;
  color: hsl(var(--muted-foreground));
}

.empty-state-title {
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
}

.empty-state-subtitle {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.empty-state-action {
  margin-top: 1.5rem;
}
</style>
