import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { SchedulerApi } from '#/api/modules/scheduler';

export type SchedulerJob = SchedulerApi.JobItem;

export const useSchedulerStore = defineStore('scheduler', () => {
  const jobs = ref<SchedulerJob[]>([]);
  const loading = ref(false);

  function setJobs(items: SchedulerJob[]) {
    jobs.value = items;
  }

  function $reset() {
    jobs.value = [];
    loading.value = false;
  }

  return {
    $reset,
    jobs,
    loading,
    setJobs,
  };
});
