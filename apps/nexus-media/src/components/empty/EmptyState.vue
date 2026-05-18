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
      <slot name="icon" />
    </div>
    <div class="empty-state-title">{{ title }}</div>
    <div v-if="subtitle" class="empty-state-subtitle">{{ subtitle }}</div>
    <div v-if="$slots.action" class="empty-state-action">
      <slot name="action" />
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
  color: hsl(var(--muted-foreground));
  margin-bottom: 1rem;
}

.empty-state-title {
  font-size: 1.25rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  margin-bottom: 0.5rem;
}

.empty-state-subtitle {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.empty-state-action {
  margin-top: 1.5rem;
}
</style>
