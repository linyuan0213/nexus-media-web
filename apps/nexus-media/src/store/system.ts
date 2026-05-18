import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface SystemStatus {
  version: string;
  uptime: number;
  python_version: string;
}

export interface LogItem {
  level: string;
  message: string;
  timestamp: string;
}

export const useSystemStore = defineStore('system', () => {
  const status = ref<SystemStatus | null>(null);
  const logs = ref<LogItem[]>([]);
  const loading = ref(false);

  function setStatus(data: SystemStatus) {
    status.value = data;
  }

  function setLogs(items: LogItem[]) {
    logs.value = items;
  }

  function $reset() {
    status.value = null;
    logs.value = [];
    loading.value = false;
  }

  return {
    $reset,
    loading,
    logs,
    status,
    setLogs,
    setStatus,
  };
});
