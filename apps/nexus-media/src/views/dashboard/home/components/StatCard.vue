<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

interface Props {
  title: string;
  value: number | string;
  icon: string;
  iconColor?: string;
  iconBg?: string;
  to?: string;
  trend?: string;
  trendType?: 'down' | 'neutral' | 'up';
}

const props = withDefaults(defineProps<Props>(), {
  iconColor: 'var(--tblr-primary)',
  iconBg: 'rgb(var(--tblr-primary-rgb) / 10%)',
  to: undefined,
  trend: undefined,
  trendType: 'neutral',
});

const router = useRouter();

const clickable = computed(() => !!props.to);

const trendClass = computed(() => {
  if (props.trendType === 'up') return 'trend-up';
  if (props.trendType === 'down') return 'trend-down';
  return 'trend-flat';
});

const trendIcon = computed(() => {
  if (props.trendType === 'up') return 'lucide:trending-up';
  if (props.trendType === 'down') return 'lucide:trending-down';
  return 'lucide:minus';
});

function handleClick() {
  if (props.to) router.push(props.to);
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.to) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    router.push(props.to);
  }
}
</script>

<template>
  <div
    class="tbl-card stat-card relative p-4"
    :class="{ 'stat-card--link': clickable }"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <div class="mb-3 flex items-start justify-between">
      <div
        class="flex h-10 w-10 items-center justify-center"
        style="border-radius: var(--tblr-card-border-radius)"
        :style="{ background: iconBg }"
      >
        <IconifyIcon
          :icon="icon"
          class="size-5"
          :style="{ color: iconColor }"
        />
      </div>
      <IconifyIcon
        v-if="clickable"
        icon="lucide:arrow-up-right"
        class="jump-icon size-3.5"
      />
    </div>
    <div class="num text-2xl font-semibold leading-tight">
      {{ value }}
    </div>
    <div class="mt-1 flex items-center justify-between gap-2">
      <span class="truncate text-xs" style="color: var(--tblr-text-muted)">
        {{ title }}
      </span>
      <span v-if="trend" class="trend-badge" :class="trendClass">
        <IconifyIcon :icon="trendIcon" class="size-3" />
        {{ trend }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.stat-card--link {
  cursor: pointer;
}

.stat-card--link:hover,
.stat-card--link:focus-visible {
  outline: none;
  border-color: rgb(var(--tblr-primary-rgb) / 40%);
  box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 10%);
  transform: translateY(-2px);
}

.num {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.jump-icon {
  color: var(--tblr-primary);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.stat-card--link:hover .jump-icon,
.stat-card--link:focus-visible .jump-icon {
  opacity: 1;
}

.trend-badge {
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  align-items: center;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 9999px;
}

.trend-up {
  color: var(--tblr-success);
  background: color-mix(in srgb, var(--tblr-success) 12%, transparent);
}

.trend-down {
  color: var(--tblr-danger);
  background: color-mix(in srgb, var(--tblr-danger) 12%, transparent);
}

.trend-flat {
  color: var(--tblr-text-muted);
  background: color-mix(in srgb, var(--tblr-text-muted) 10%, transparent);
}
</style>
