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

  .page-header > div:first-child {
    flex: 1 1 0;
    min-width: 0;
  }

  .page-header-actions {
    align-self: flex-start;
    width: auto;
    margin-left: auto;
  }

  .page-header-actions :deep(.n-button:has(.n-icon-slot)) {
    position: relative;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
  }

  .page-header-actions :deep(.n-button:has(.n-icon-slot) .n-button__content) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;
    clip-path: inset(50%);
  }

  .page-header-actions :deep(.n-button:has(.n-icon-slot) .n-icon-slot) {
    position: absolute;
    top: 50%;
    left: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin: 0 !important;
    transform: translate(-50%, -50%);
  }

  .page-header-actions :deep(.n-input) {
    flex: 1 1 180px;
    width: auto !important;
    min-width: 0;
  }

  .page-header:has(.page-header-actions .n-button:only-child),
  .page-header:has(
    .page-header-actions .n-button:first-child:nth-child(2):last-child
  ) {
    flex-wrap: nowrap;
    align-items: flex-start;
  }

  .page-header:has(.page-header-actions .n-button:only-child) > div:first-child,
  .page-header:has(
      .page-header-actions .n-button:first-child:nth-child(2):last-child
    )
    > div:first-child {
    min-width: 0;
  }

  .page-header:has(.page-header-actions .n-button:only-child)
    .page-header-actions,
  .page-header:has(
      .page-header-actions .n-button:first-child:nth-child(2):last-child
    )
    .page-header-actions {
    flex-shrink: 0;
  }

  .page-header-actions > * {
    flex: 0 0 auto;
  }
}
</style>
