<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  title: string;
  subtitle?: string;
}

const props = defineProps<Props>();

const hasSubtitle = computed(() => !!props.subtitle);
</script>

<template>
  <div class="page-header">
    <div>
      <h2 class="page-header-title">{{ title }}</h2>
      <div v-if="hasSubtitle" class="page-header-subtitle">{{ subtitle }}</div>
    </div>
    <div class="page-header-actions">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.page-header-title {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

.page-header-subtitle {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

.page-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .page-header-actions {
    width: auto;
  }

  .page-header-actions > * {
    flex: 0 0 auto;
  }
}
</style>
