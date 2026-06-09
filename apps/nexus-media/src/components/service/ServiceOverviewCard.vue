<script setup lang="ts">
import { IconifyIcon } from '@vben/icons';

interface Props {
  title: string;
  icon: string;
  status: 'running' | 'stopped' | 'warning';
  statusText: string;
  description?: string;
  metrics?: { label: string; value: number | string }[];
}

withDefaults(defineProps<Props>(), {
  description: '',
  metrics: () => [],
});

const emit = defineEmits<{
  click: [];
}>();

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': {
      return 'hsl(var(--success))';
    }
    case 'warning': {
      return 'hsl(var(--warning))';
    }
    default: {
      return 'hsl(var(--muted-foreground))';
    }
  }
}
</script>

<template>
  <div
    class="service-overview-card"
    :class="{ 'service-overview-card--clickable': $attrs.onClick }"
    @click="emit('click')"
  >
    <div class="service-card-header">
      <div class="service-card-icon">
        <IconifyIcon :icon="icon" class="service-icon" />
      </div>
      <div class="service-card-title-area">
        <div class="service-card-title">{{ title }}</div>
        <div class="service-card-status">
          <span
            class="status-dot"
            :style="{ backgroundColor: getStatusColor(status) }"
          ></span>
          <span class="status-text">{{ statusText }}</span>
        </div>
      </div>
    </div>

    <div v-if="description" class="service-card-description">
      {{ description }}
    </div>

    <div v-if="metrics.length > 0" class="service-card-metrics">
      <div v-for="(metric, idx) in metrics" :key="idx" class="metric-item">
        <div class="metric-value">{{ metric.value }}</div>
        <div class="metric-label">{{ metric.label }}</div>
      </div>
    </div>

    <div v-if="$slots.action" class="service-card-footer">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<style scoped>
.service-overview-card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.25rem;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.service-overview-card--clickable {
  cursor: pointer;
}

.service-overview-card:hover {
  border-color: hsl(var(--primary) / 30%);
  box-shadow: 0 4px 12px rgb(0 0 0 / 5%);
}

.service-card-header {
  display: flex;
  gap: 0.875rem;
  align-items: center;
}

.service-card-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  background-color: hsl(var(--accent));
  border-radius: 0.625rem;
}

.service-icon {
  width: 1.375rem;
  height: 1.375rem;
  color: hsl(var(--primary));
}

.service-card-title-area {
  flex: 1;
  min-width: 0;
}

.service-card-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
}

.service-card-status {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  margin-top: 0.125rem;
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
}

.status-text {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.service-card-description {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.service-card-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
}

.metric-item {
  text-align: center;
}

.metric-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: hsl(var(--card-foreground));
}

.metric-label {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.service-card-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

@media (max-width: 640px) {
  .service-overview-card {
    padding: 1rem;
  }

  .service-card-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
