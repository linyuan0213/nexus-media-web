<script lang="ts" setup>
import { computed } from 'vue';

import { NEmpty } from 'naive-ui';

interface SystemStatus {
  cpu_percent: number;
  memory_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  python_version: string;
  uptime: number;
  version: string;
}

interface StorageSpace {
  FreeSpace: string;
  TotalSpace: string;
  UsedPercent: number;
  UsedSpace: string;
}

interface Props {
  status?: SystemStatus | undefined;
  storage?: StorageSpace | undefined;
  downloaderActive?: number;
  downloaderTotal?: number;
}

const props = withDefaults(defineProps<Props>(), {
  status: undefined,
  storage: undefined,
  downloaderActive: 0,
  downloaderTotal: 0,
});

function levelColor(percent: number): string {
  if (percent >= 85) return 'var(--tblr-danger)';
  if (percent >= 60) return 'var(--tblr-warning)';
  return 'var(--tblr-primary)';
}

function ringStyle(percent: number) {
  const clamped = Math.min(Math.max(percent || 0, 0), 100);
  const color = levelColor(clamped);
  return {
    background: `conic-gradient(${color} 0 ${clamped}%, color-mix(in srgb, ${color} 10%, var(--tblr-card-bg)) ${clamped}% 100%)`,
  };
}

const cpuPercent = computed(() => Math.round(props.status?.cpu_percent ?? 0));
const memPercent = computed(() =>
  Math.round(props.status?.memory_percent ?? 0),
);

const memText = computed(() => {
  const used = props.status?.memory_used_mb ?? 0;
  const total = props.status?.memory_total_mb ?? 0;
  const toGb = (mb: number) =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
  return `${toGb(used)} / ${toGb(total)}`;
});

const uptimeText = computed(() => {
  const s = props.status?.uptime ?? 0;
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `运行 ${days} 天 ${hours} 小时`;
  if (hours > 0) return `运行 ${hours} 小时 ${mins} 分钟`;
  return `运行 ${mins} 分钟`;
});

const storagePercent = computed(() =>
  Math.min(Math.max(Number(props.storage?.UsedPercent ?? 0), 0), 100),
);

const downloaderPercent = computed(() =>
  props.downloaderTotal > 0
    ? Math.min(
        Math.max((props.downloaderActive / props.downloaderTotal) * 100, 0),
        100,
      )
    : 0,
);
</script>

<template>
  <div class="tbl-card flex h-full flex-col">
    <div
      class="flex items-center justify-between px-5 pb-2 pt-4"
      style="border-bottom: 1px solid var(--tblr-card-border-color)"
    >
      <span class="text-sm font-semibold">系统状态</span>
      <span
        class="flex items-center gap-1.5 text-xs"
        style="color: var(--tblr-success)"
      >
        <span class="status-dot status-dot--success status-dot--pulse"></span>
        运行正常
      </span>
    </div>

    <div v-if="status" class="flex flex-1 flex-col p-5">
      <div class="mb-5 flex justify-around">
        <div class="text-center">
          <div class="status-ring" :style="ringStyle(cpuPercent)">
            <div class="status-ring-inner">
              <span class="num text-xl font-semibold">{{ cpuPercent }}%</span>
            </div>
          </div>
          <div class="mt-2 text-xs" style="color: var(--tblr-text-muted)">
            CPU
          </div>
        </div>
        <div class="text-center">
          <div class="status-ring" :style="ringStyle(memPercent)">
            <div class="status-ring-inner">
              <span class="num text-xl font-semibold">{{ memPercent }}%</span>
            </div>
          </div>
          <div class="mt-2 text-xs" style="color: var(--tblr-text-muted)">
            内存 {{ memText }}
          </div>
        </div>
      </div>

      <template v-if="storage">
        <div class="mb-1.5 flex items-center justify-between text-xs">
          <span style="color: var(--tblr-text-muted)">存储空间</span>
          <span class="num font-medium">
            {{ storage.UsedSpace }} / {{ storage.TotalSpace }}
          </span>
        </div>
        <div class="progress-bar-tblr">
          <div
            class="progress-bar-tblr-fill"
            :style="{
              width: `${storagePercent}%`,
              backgroundColor: levelColor(storagePercent),
            }"
          ></div>
        </div>
      </template>

      <div class="mb-1.5 mt-4 flex items-center justify-between text-xs">
        <span style="color: var(--tblr-text-muted)">下载器负载</span>
        <span class="num font-medium">
          {{ downloaderActive }} / {{ downloaderTotal }} 个任务进行中
        </span>
      </div>
      <div class="progress-bar-tblr">
        <div
          class="progress-bar-tblr-fill"
          :style="{
            width: `${downloaderPercent}%`,
            backgroundColor: 'var(--tblr-teal)',
          }"
        ></div>
      </div>

      <div
        class="status-footer mt-auto flex items-center justify-between pt-3 text-xs"
      >
        <span>{{ uptimeText }}</span>
        <span>{{ status.version }} · Python {{ status.python_version }}</span>
      </div>
    </div>
    <NEmpty v-else description="暂无系统状态" class="py-10" />
  </div>
</template>

<style scoped>
.status-footer {
  color: var(--tblr-text-muted);
  border-top: 1px solid var(--tblr-card-border-color);
}

.status-ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  margin: 0 auto;
  border-radius: 50%;
}

.status-ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 78%;
  height: 78%;
  background: var(--tblr-card-bg);
  border-radius: 50%;
}

.num {
  font-variant-numeric: tabular-nums;
}

.status-dot--pulse {
  position: relative;
}

.status-dot--pulse::after {
  position: absolute;
  inset: -4px;
  content: '';
  border: 2px solid var(--tblr-success);
  border-radius: 9999px;
  opacity: 0;
  animation: status-pulse 2s infinite;
}

@keyframes status-pulse {
  0% {
    opacity: 0.8;
    transform: scale(0.6);
  }

  100% {
    opacity: 0;
    transform: scale(1.4);
  }
}

@media (max-width: 640px) {
  .status-ring {
    width: 76px;
    height: 76px;
  }
}
</style>
