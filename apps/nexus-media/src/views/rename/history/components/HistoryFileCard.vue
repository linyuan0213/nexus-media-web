<script lang="ts" setup>
import type { FileTarget, HistoryItem } from '../types';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton } from 'naive-ui';

import { capabilitiesOf, fileStateMeta, joinPath } from '../types';

interface Props {
  item: HistoryItem;
  target: FileTarget;
}

const props = defineProps<Props>();
defineEmits<{
  delete: [];
}>();

const isSource = computed(() => props.target === 'source');
const state = computed(() =>
  isSource.value ? props.item.SOURCE_STATE : props.item.DEST_STATE,
);
const deletedAt = computed(() =>
  isSource.value ? props.item.SOURCE_DELETED_AT : props.item.DEST_DELETED_AT,
);
const path = computed(() =>
  isSource.value
    ? joinPath(props.item.SOURCE_PATH, props.item.SOURCE_FILENAME)
    : joinPath(props.item.DEST_PATH, props.item.DEST_FILENAME),
);
const backend = computed(() =>
  isSource.value
    ? props.item.SOURCE || 'local'
    : props.item.DST_BACKEND || 'local',
);
const meta = computed(() => fileStateMeta(state.value));
const canDelete = computed(() => {
  const capabilities = capabilitiesOf(props.item);
  return isSource.value
    ? capabilities.delete_source
    : capabilities.delete_library;
});
const canOpen = computed(() => Boolean(path.value));

async function copyPath() {
  if (!path.value) return;
  try {
    await navigator.clipboard.writeText(path.value);
  } catch {
    // 浏览器不允许时静默失败，路径仍可手动复制
  }
}
</script>

<template>
  <article class="file-card">
    <header class="file-head">
      <div class="file-title">
        <span class="file-kind" :class="{ library: !isSource }">
          <IconifyIcon
            :icon="isSource ? 'lucide:download' : 'lucide:library'"
            class="size-3.5"
          />
          {{ isSource ? '源文件' : '媒体库文件' }}
        </span>
        <span class="file-backend">{{ backend }}</span>
      </div>
      <span class="file-state" :class="`tone-${meta.tone}`">
        <span class="state-dot"></span>
        {{ meta.label }}
      </span>
    </header>

    <div v-if="path" class="file-path" :title="path">{{ path }}</div>
    <div v-else class="file-path is-empty">该记录没有关联此文件</div>

    <div class="file-meta">
      <span v-if="deletedAt">删除于 {{ deletedAt }}</span>
      <span v-else-if="state === 'present'">文件可用</span>
      <span v-else-if="state === 'missing'">存储中未找到该文件</span>
      <span v-else>尚未检测文件状态</span>
    </div>

    <footer class="file-actions">
      <NButton quaternary size="tiny" :disabled="!canOpen" @click="copyPath">
        <template #icon>
          <IconifyIcon icon="lucide:copy" class="size-3.5" />
        </template>
        复制路径
      </NButton>
      <NButton
        v-if="canDelete"
        quaternary
        size="tiny"
        type="error"
        @click="$emit('delete')"
      >
        <template #icon>
          <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
        </template>
        删除{{ isSource ? '源文件' : '媒体库文件' }}
      </NButton>
    </footer>
  </article>
</template>

<style scoped>
.file-card {
  padding: 13px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.file-card + .file-card {
  margin-top: 10px;
}

.file-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.file-title {
  display: flex;
  gap: 7px;
  align-items: center;
  min-width: 0;
}

.file-kind {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 7px;
  font-size: 0.68rem;
  font-weight: 550;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border-radius: 999px;
}

.file-kind.library {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.file-backend {
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  color: hsl(var(--muted-foreground));
}

.file-state {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 2px 7px;
  font-size: 0.67rem;
  font-weight: 500;
  border-radius: 999px;
}

.state-dot {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 999px;
}

.tone-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.tone-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.tone-danger {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 9%);
}

.tone-warning {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.file-path {
  padding: 7px 9px;
  margin: 9px 0;
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border) / 75%);
  border-radius: 6px;
}

.file-path.is-empty {
  font-family: inherit;
  font-style: italic;
}

.file-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.69rem;
  color: hsl(var(--muted-foreground));
}

.file-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 8px;
}

@media (max-width: 640px) {
  .file-actions :deep(.n-button) {
    flex: 1 1 auto;
  }
}
</style>
