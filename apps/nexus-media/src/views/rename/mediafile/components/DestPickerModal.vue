<script lang="ts" setup>
import type { BackendGroup, FileItem } from '../types';

import { computed, ref, watch } from 'vue';

import { NButton, NModal } from 'naive-ui';

import FileTree from './FileTree.vue';

interface Props {
  show: boolean;
  title: string;
  count: number;
  groups: BackendGroup[];
  currentBackendId: string;
  currentPath: string;
  loadChildren: (path: string, backendId: string) => Promise<FileItem[]>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  confirm: [dest: string, backendId: string];
  'update:show': [value: boolean];
}>();

const destPath = ref('');
const destBackendId = ref('local');

watch(
  () => props.show,
  (v) => {
    if (v) {
      destPath.value = '';
      destBackendId.value = props.currentBackendId;
    }
  },
);

const canConfirm = computed(() => !!destPath.value);

function handleSelect(path: string, backendId: string) {
  destPath.value = path;
  destBackendId.value = backendId;
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    style="width: 480px; max-width: 92vw"
    :bordered="false"
    segmented
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="dest-picker">
      <div class="dest-tree">
        <FileTree
          v-if="show"
          :groups="groups"
          :current-path="destPath"
          :current-backend-id="destBackendId"
          :load-children="loadChildren"
          @select="handleSelect"
        />
      </div>
      <div class="dest-current">
        <span class="dest-label">目标目录：</span>
        <span class="dest-value">{{ destPath || '未选择' }}</span>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <NButton size="small" @click="emit('update:show', false)">取消</NButton>
        <NButton
          type="primary"
          size="small"
          :disabled="!canConfirm"
          @click="emit('confirm', destPath, destBackendId)"
        >
          确定 ({{ count }})
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.dest-picker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dest-tree {
  max-height: 50vh;
  padding: 0.25rem;
  overflow-y: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
}

.dest-current {
  display: flex;
  gap: 0.25rem;
  align-items: baseline;
  font-size: 0.85rem;
}

.dest-label {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.dest-value {
  color: hsl(var(--card-foreground));
  word-break: break-all;
}
</style>
