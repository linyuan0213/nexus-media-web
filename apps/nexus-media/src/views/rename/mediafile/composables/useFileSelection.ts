import type { FileItem } from '../types';

import { computed, ref } from 'vue';

export function useFileSelection() {
  const selectedPaths = ref<Set<string>>(new Set());
  const anchorPath = ref<string>('');
  const selectionMode = ref(false);

  const selectedCount = computed(() => selectedPaths.value.size);

  function isSelected(item: FileItem) {
    return selectedPaths.value.has(item.path);
  }

  function clearSelection() {
    selectedPaths.value = new Set();
    anchorPath.value = '';
    selectionMode.value = false;
  }

  function selectSingle(item: FileItem) {
    selectedPaths.value = new Set([item.path]);
    anchorPath.value = item.path;
  }

  function toggle(item: FileItem) {
    const next = new Set(selectedPaths.value);
    if (next.has(item.path)) {
      next.delete(item.path);
    } else {
      next.add(item.path);
    }
    selectedPaths.value = next;
    anchorPath.value = item.path;
  }

  function rangeSelect(item: FileItem, orderedItems: FileItem[]) {
    const anchor = anchorPath.value;
    if (!anchor) {
      selectSingle(item);
      return;
    }
    const paths = orderedItems.map((i) => i.path);
    const ai = paths.indexOf(anchor);
    const bi = paths.indexOf(item.path);
    if (ai === -1 || bi === -1) {
      selectSingle(item);
      return;
    }
    const [start, end] = ai < bi ? [ai, bi] : [bi, ai];
    const next = new Set(selectedPaths.value);
    for (const p of paths.slice(start, end + 1)) next.add(p);
    selectedPaths.value = next;
  }

  function selectAll(items: FileItem[]) {
    selectedPaths.value = new Set(items.map((i) => i.path));
  }

  function isAllSelected(items: FileItem[]) {
    return (
      items.length > 0 && items.every((i) => selectedPaths.value.has(i.path))
    );
  }

  function selectedItems(items: FileItem[]): FileItem[] {
    return items.filter((i) => selectedPaths.value.has(i.path));
  }

  function pruneSelection(items: FileItem[]) {
    const valid = new Set(items.map((i) => i.path));
    const next = new Set([...selectedPaths.value].filter((p) => valid.has(p)));
    if (next.size !== selectedPaths.value.size) {
      selectedPaths.value = next;
    }
  }

  return {
    anchorPath,
    clearSelection,
    isAllSelected,
    isSelected,
    pruneSelection,
    rangeSelect,
    selectAll,
    selectSingle,
    selectedCount,
    selectedItems,
    selectedPaths,
    selectionMode,
    toggle,
  };
}
