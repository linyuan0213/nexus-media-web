<script lang="ts" setup>
interface TypeTab {
  label: string;
  value: string;
}

const props = defineProps<{
  active: string;
  tabs: TypeTab[];
}>();

const emit = defineEmits<{
  (e: 'update:active', value: string): void;
  (e: 'change', value: string): void;
}>();

function handleClick(value: string) {
  emit('update:active', value);
  emit('change', value);
}
</script>

<template>
  <div class="type-tab-group" role="tablist">
    <button
      v-for="tab in props.tabs"
      :key="tab.value"
      class="type-tab-btn"
      :class="{ 'type-tab-active': props.active === tab.value }"
      :aria-selected="props.active === tab.value"
      role="tab"
      type="button"
      @click="handleClick(tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.type-tab-group {
  display: inline-flex;
  gap: 0.125rem;
  padding: 0.25rem;
  background-color: hsl(var(--muted) / 40%);
  border-radius: 0.625rem;
}

.type-tab-btn {
  padding: 0.375rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background-color: transparent;
  border: none;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.type-tab-btn:hover {
  color: hsl(var(--foreground));
}

.type-tab-active {
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--card));
  box-shadow: 0 1px 2px hsl(var(--foreground) / 5%);
}

@media (max-width: 640px) {
  .type-tab-btn {
    flex: 1;
    padding: 0.375rem 0.75rem;
  }
}
</style>
