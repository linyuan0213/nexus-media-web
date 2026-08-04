<script lang="ts" setup>
import type { BackendGroup, FileItem } from '../types';

import { NDrawer, NDrawerContent, NSelect } from 'naive-ui';

import FileTree from './FileTree.vue';

interface Props {
  show: boolean;
  groups: BackendGroup[];
  backendOptions: Array<{ label: string; value: string }>;
  currentBackendId: string;
  currentPath: string;
  loadChildren: (path: string, backendId: string) => Promise<FileItem[]>;
}

defineProps<Props>();

const emit = defineEmits<{
  navigate: [path: string, backendId: string];
  switchBackend: [backendId: string];
  'update:show': [value: boolean];
}>();

function handleSelect(path: string, backendId: string) {
  emit('navigate', path, backendId);
  emit('update:show', false);
}
</script>

<template>
  <NDrawer
    :show="show"
    placement="left"
    :width="300"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <NDrawerContent
      title="文件导航"
      closable
      body-content-class="nav-drawer-body"
    >
      <div class="drawer-backend">
        <NSelect
          :value="currentBackendId"
          :options="backendOptions"
          size="small"
          @update:value="(v: string) => emit('switchBackend', v)"
        />
      </div>
      <FileTree
        :groups="groups"
        :current-path="currentPath"
        :current-backend-id="currentBackendId"
        :load-children="loadChildren"
        @select="handleSelect"
      />
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.drawer-backend {
  margin-bottom: 0.75rem;
}
</style>
