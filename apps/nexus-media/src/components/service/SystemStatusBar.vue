<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  version?: string;
  uptime?: string;
  pythonVersion?: string;
  jobCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  version: '-',
  uptime: '-',
  pythonVersion: '-',
  jobCount: 0,
});

const stats = computed(() => [
  { label: '系统版本', value: props.version },
  { label: '运行时长', value: props.uptime },
  { label: 'Python', value: props.pythonVersion },
  { label: '调度任务', value: props.jobCount },
]);
</script>

<template>
  <div class="system-status-bar">
    <div v-for="(stat, idx) in stats" :key="idx" class="status-stat-item">
      <div class="status-stat-value">{{ stat.value }}</div>
      <div class="status-stat-label">{{ stat.label }}</div>
    </div>
  </div>
</template>

<style scoped>
.system-status-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 1.25rem;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
}

.status-stat-item {
  position: relative;
  text-align: center;
}

.status-stat-item:not(:last-child)::after {
  position: absolute;
  top: 10%;
  right: 0;
  bottom: 10%;
  width: 1px;
  content: '';
  background-color: hsl(var(--border));
}

.status-stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  color: hsl(var(--card-foreground));
}

.status-stat-label {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .system-status-bar {
    grid-template-columns: repeat(2, 1fr);
    padding: 1rem;
  }

  .status-stat-item:nth-child(2)::after {
    display: none;
  }

  .status-stat-item:nth-child(odd)::after {
    display: block;
  }
}
</style>
