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
    <div class="flex items-center gap-2">
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
</style>
