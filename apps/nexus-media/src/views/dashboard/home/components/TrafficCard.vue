<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

interface TrafficTrend {
  text: string;
  type: 'down' | 'neutral' | 'up';
}

interface Props {
  to?: string;
  upload: string;
  download: string;
  uploadTrend?: TrafficTrend;
  downloadTrend?: TrafficTrend;
}

const props = withDefaults(defineProps<Props>(), {
  to: undefined,
  upload: '0',
  download: '0',
  uploadTrend: undefined,
  downloadTrend: undefined,
});

const router = useRouter();
const clickable = computed(() => !!props.to);

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

function trendColor(type?: TrafficTrend['type']) {
  if (type === 'up') return 'var(--tblr-success)';
  if (type === 'down') return 'var(--tblr-danger)';
  return 'var(--tblr-text-muted)';
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
        class="stat-icon-box flex items-center justify-center"
        :style="{
          background: 'var(--tblr-primary-light)',
          borderRadius: 'var(--tblr-card-border-radius)',
        }"
      >
        <IconifyIcon
          icon="lucide:arrow-up-down"
          class="size-[22px]"
          style="color: var(--tblr-primary)"
        />
      </div>
      <IconifyIcon
        v-if="clickable"
        icon="lucide:arrow-up-right"
        class="jump-icon size-3.5"
      />
    </div>

    <!-- 上传/下载各占一行，增量徽标与数值同行，避免撑高卡片 -->
    <div class="space-y-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-xs" style="color: var(--tblr-text-muted)">上传</span>
        <span class="traffic-value">
          <span
            v-if="uploadTrend"
            class="traffic-delta"
            :style="{ color: trendColor(uploadTrend.type) }"
            >{{ uploadTrend.text }}</span
          >
          <span class="arrow-up">↑</span>
          {{ upload }}
        </span>
      </div>
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-xs" style="color: var(--tblr-text-muted)">下载</span>
        <span class="traffic-value">
          <span
            v-if="downloadTrend"
            class="traffic-delta"
            :style="{ color: trendColor(downloadTrend.type) }"
            >{{ downloadTrend.text }}</span
          >
          <span class="arrow-down">↓</span>
          {{ download }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.stat-card--link {
  cursor: pointer;
}

.stat-card--link:hover,
.stat-card--link:focus-visible {
  outline: none;
  box-shadow: var(--tblr-box-shadow);
  transform: translateY(-2px);
}

.stat-icon-box {
  width: 44px;
  height: 44px;
}

.traffic-value {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--tblr-text-heading);
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.traffic-delta {
  display: inline-flex;
  margin-right: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  vertical-align: 0.0625rem;
}

.arrow-up {
  color: var(--tblr-success);
}

.arrow-down {
  color: var(--tblr-warning);
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
</style>
