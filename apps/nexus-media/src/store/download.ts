import { ref } from 'vue';

import { defineStore } from 'pinia';

export interface DownloadTask {
  id: string;
  name: string;
  progress: number;
  status: 'completed' | 'downloading' | 'error' | 'paused';
  speed?: string;
  size?: string;
  downloader?: string;
  image?: string;
  noprogress?: boolean;
  nomenu?: boolean;
  title?: string;
  state?: string;
}

export interface DownloadHistoryItem {
  state?: string;
  id: string;
  title: string;
  type: string;
  media_type: string;
  media_type_key?: string;
  media_type_name?: string;
  media_kind?: string;
  year: string;
  vote: string;
  image: string;
  overview: string;
  enclosure?: string;
  season_episode?: string;
  history_id?: number;
  identity_id?: string;
  anchor_provider?: string;
  anchor_external_id?: string;
  content_profile?: string;
  date: string;
  site: string;
}

export const useDownloadStore = defineStore('download', () => {
  const tasks = ref<DownloadTask[]>([]);
  const history = ref<DownloadHistoryItem[]>([]);
  const loading = ref(false);

  function setTasks(items: DownloadTask[]) {
    tasks.value = items;
  }

  function updateProgress(id: string, progress: number) {
    const task = tasks.value.find((t) => t.id === id);
    if (task) {
      task.progress = progress;
    }
  }

  function setHistory(items: DownloadHistoryItem[]) {
    history.value = items;
  }

  function $reset() {
    tasks.value = [];
    history.value = [];
    loading.value = false;
  }

  return {
    $reset,
    history,
    loading,
    tasks,
    setHistory,
    setTasks,
    updateProgress,
  };
});
