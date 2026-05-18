import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { SyncApi } from '#/api/modules/sync';

export type SyncTask = SyncApi.SyncTask;

export const useSyncStore = defineStore('sync', () => {
  const tasks = ref<SyncTask[]>([]);
  const loading = ref(false);

  function setTasks(items: SyncTask[]) {
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
