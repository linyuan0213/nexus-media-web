<script lang="ts" setup>
import type { TreeOption } from 'naive-ui';

import type { BackendGroup, FileItem } from '../types';

import { computed, h, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NTree } from 'naive-ui';

import { getLibraryColor, getLibraryIcon } from '../utils';

interface Props {
  groups: BackendGroup[];
  currentBackendId?: string;
  currentPath?: string;
  loadChildren: (path: string, backendId: string) => Promise<FileItem[]>;
}

const props = withDefaults(defineProps<Props>(), {
  currentBackendId: '',
  currentPath: '',
});

const emit = defineEmits<{
  select: [path: string, backendId: string];
}>();

function dirToNode(item: FileItem, backendId: string): TreeOption {
  return {
    key: `${backendId}::${item.path}`,
    label: item.name,
    path: item.path,
    backendId,
    isLeaf: false,
  };
}

const expandedKeys = ref<string[]>([]);
const loadVersion = ref(0);
const childrenCache = new Map<string, TreeOption[]>();

const treeData = computed<TreeOption[]>(() => {
  // 依赖 loadVersion：子节点加载完成后强制重建，刷新 treemate
  void loadVersion.value;
  return props.groups.map((g) => ({
    key: `backend::${g.backendId}`,
    label: g.backendName,
    isGroup: true,
    children: g.sections.map((s) => ({
      key: `section::${g.backendId}::${s.type}`,
      label: s.label,
      isGroup: true,
      children: s.items.map((p) => {
        const key = `${g.backendId}::${p.path}`;
        const cached = childrenCache.get(key);
        return {
          key,
          label: p.name,
          path: p.path,
          backendId: g.backendId,
          isLeaf: false,
          ...(cached ? { children: cached } : {}),
        };
      }),
    })),
  }));
});

const rootTypeMap = computed(() => {
  const map = new Map<string, string>();
  for (const g of props.groups) {
    for (const s of g.sections) {
      for (const p of s.items) {
        map.set(`${g.backendId}::${p.path}`, p.type);
      }
    }
  }
  return map;
});

const selectedKeys = computed(() =>
  props.currentPath ? [`${props.currentBackendId}::${props.currentPath}`] : [],
);

async function handleLoad(node: TreeOption) {
  const path = node.path as string;
  const backendId = node.backendId as string;
  if (!path || !backendId) return;
  let children: TreeOption[];
  try {
    const items = await props.loadChildren(path, backendId);
    children = items.map((c) => dirToNode(c, backendId));
  } catch {
    children = [];
  }
  node.children = children;
  childrenCache.set(node.key as string, children);
  loadVersion.value += 1;
}

function handleSelect(_keys: string[], options: Array<null | TreeOption>) {
  const node = options[0];
  if (!node) return;
  if (node.isGroup) {
    const key = node.key as string;
    expandedKeys.value = expandedKeys.value.includes(key)
      ? expandedKeys.value.filter((k) => k !== key)
      : [...expandedKeys.value, key];
    return;
  }
  if (node.path && node.backendId) {
    emit('select', node.path as string, node.backendId as string);
  }
}

function clearCache() {
  childrenCache.clear();
  loadVersion.value += 1;
}

defineExpose({ clearCache });

function renderPrefix({ option }: { option: TreeOption }) {
  if (option.isGroup) {
    return h(IconifyIcon, {
      icon: option.children?.some((c: any) => c.path)
        ? 'lucide:database'
        : 'lucide:layers',
      class: 'size-4 tree-icon',
    });
  }
  const type = rootTypeMap.value.get(option.key as string);
  const icon = type ? getLibraryIcon(type) : 'lucide:folder';
  const color = type ? getLibraryColor(type) : 'hsl(var(--warning))';
  return h(IconifyIcon, {
    icon,
    class: 'size-4 tree-icon',
    style: { color },
  });
}
</script>

<template>
  <NTree
    :data="treeData"
    :selected-keys="selectedKeys"
    :expanded-keys="expandedKeys"
    :on-load="handleLoad"
    :render-prefix="renderPrefix"
    block-line
    :cancelable="false"
    class="file-tree"
    @update:selected-keys="handleSelect"
    @update:expanded-keys="(keys: string[]) => (expandedKeys = keys)"
  />
</template>

<style scoped>
.file-tree {
  font-size: 0.875rem;
}

.file-tree :deep(.n-tree-node) {
  --n-node-height: 2rem;
}

.file-tree :deep(.tree-icon) {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}
</style>
