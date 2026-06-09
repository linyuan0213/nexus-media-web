import type { BrushApi } from '#/api/modules/brush';

import { ref } from 'vue';

import { defineStore } from 'pinia';

export type BrushTask = BrushApi.BrushTask;

export const useBrushStore = defineStore('brush', () => {
  const tasks = ref<BrushTask[]>([]);
  const loading = ref(false);

  function setTasks(items: BrushTask[]) {
    tasks.value = items;
  }

  function $reset() {
    tasks.value = [];
    loading.value = false;
  }

  return {
    $reset,
    loading,
    tasks,
    setTasks,
  };
});
