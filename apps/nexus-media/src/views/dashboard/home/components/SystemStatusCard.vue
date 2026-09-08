<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

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
  downloaderOnline?: boolean;
  downloaderCount?: number;
  downloadSpeed?: number;
  uploadSpeed?: number;
  downloadLimit?: null | number;
  uploadLimit?: null | number;
  updatedAt?: number;
}

const props = withDefaults(defineProps<Props>(), {
  status: undefined,
  storage: undefined,
  downloaderOnline: false,
  downloaderCount: 0,
  downloadSpeed: 0,
  uploadSpeed: 0,
  downloadLimit: null,
  uploadLimit: null,
  updatedAt: 0,
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

const updatedText = computed(() => {
  if (!props.updatedAt) return '-';
  const d = new Date(props.updatedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
});

const storagePercent = computed(() =>
  Math.min(Math.max(Number(props.storage?.UsedPercent ?? 0), 0), 100),
);

function formatSpeed(bps?: null | number): string {
  const b = Math.max(Number(bps ?? 0), 0);
  if (b >= 1024 ** 4) return `${(b / 1024 ** 4).toFixed(2)} TB/s`;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB/s`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(2)} MB/s`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB/s`;
  return `${Math.round(b)} B/s`;
}

function utilPercent(speed: number, limit?: null | number): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(Math.max((speed / limit) * 100, 0), 100);
}

const downloaderUtil = computed(() =>
  utilPercent(props.downloadSpeed, props.downloadLimit),
);
const uploaderUtil = computed(() =>
  utilPercent(props.uploadSpeed, props.uploadLimit),
);

const downloaderText = computed(() => {
  if (props.downloaderCount === 0) return '未启用下载器';
  if (!props.downloaderOnline) return '下载器离线';
  return '';
});
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
          <span
            class="inline-flex items-center gap-1.5"
            style="color: var(--tblr-text-muted)"
          >
            <IconifyIcon icon="lucide:hard-drive" class="size-3.5" />
            存储空间
          </span>
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
        <span
          class="inline-flex items-center gap-1.5"
          style="color: var(--tblr-text-muted)"
        >
          <IconifyIcon icon="lucide:gauge" class="size-3.5" />
          下载器负载
        </span>
        <span
          v-if="downloaderText"
          class="num font-medium"
          style="color: var(--tblr-text-muted)"
        >
          {{ downloaderText }}
        </span>
        <span
          v-else-if="downloaderCount > 1"
          class="num font-medium"
          style="color: var(--tblr-text-muted)"
        >
          {{ downloaderCount }} 个下载器
        </span>
      </div>
      <template v-if="downloaderOnline">
        <div class="mt-0.5">
          <div class="flex items-center justify-between text-xs">
            <span
              class="inline-flex items-center gap-1"
              style="color: var(--tblr-text-muted)"
            >
              <IconifyIcon
                icon="lucide:arrow-down"
                class="size-3"
                style="color: var(--tblr-warning)"
              />
              下载
            </span>
            <span class="num font-medium">{{
              formatSpeed(downloadSpeed)
            }}</span>
          </div>
          <div
            v-if="downloadLimit && downloadLimit > 0"
            class="mt-1 flex items-center gap-1.5"
          >
            <div class="progress-bar-tblr flex-1">
              <div
                class="progress-bar-tblr-fill"
                :style="{
                  width: `${downloaderUtil}%`,
                  backgroundColor: levelColor(downloaderUtil),
                }"
              ></div>
            </div>
            <span
              class="num shrink-0 text-[0.625rem]"
              style="color: var(--tblr-text-muted)"
              >{{ Math.round(downloaderUtil) }}%</span
            >
          </div>
        </div>
        <div class="mt-2">
          <div class="flex items-center justify-between text-xs">
            <span
              class="inline-flex items-center gap-1"
              style="color: var(--tblr-text-muted)"
            >
              <IconifyIcon
                icon="lucide:arrow-up"
                class="size-3"
                style="color: var(--tblr-success)"
              />
              上传
            </span>
            <span class="num font-medium">{{ formatSpeed(uploadSpeed) }}</span>
          </div>
          <div
            v-if="uploadLimit && uploadLimit > 0"
            class="mt-1 flex items-center gap-1.5"
          >
            <div class="progress-bar-tblr flex-1">
              <div
                class="progress-bar-tblr-fill"
                :style="{
                  width: `${uploaderUtil}%`,
                  backgroundColor: levelColor(uploaderUtil),
                }"
              ></div>
            </div>
            <span
              class="num shrink-0 text-[0.625rem]"
              style="color: var(--tblr-text-muted)"
              >{{ Math.round(uploaderUtil) }}%</span
            >
          </div>
        </div>
      </template>

      <div
        class="status-footer mt-auto flex items-center justify-between pt-3 text-xs"
      >
        <span>更新于 {{ updatedText }}</span>
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
