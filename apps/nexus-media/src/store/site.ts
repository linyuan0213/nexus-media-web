import { ref } from 'vue';

import { defineStore } from 'pinia';

export interface SiteItem {
  id: number;
  name: string;
  url: string;
  status: number;
  signinStatus?: string;
  traffic?: string;
  public?: boolean;
  pri?: number;
  signurl?: string;
  cookie?: string;
  api_key?: string;
  bearer_token?: string;
  headers?: string;
  rssurl?: string;
  rss_enable?: boolean;
  brush_enable?: boolean;
  statistic_enable?: boolean;
  parse?: boolean;
  unread_msg_notify?: boolean;
  chrome?: boolean;
  proxy?: boolean;
}

export const useSiteStore = defineStore('site', () => {
  const sites = ref<SiteItem[]>([]);
  const statistics = ref<Record<string, any>>({});
  const loading = ref(false);

  function setSites(items: SiteItem[]) {
    sites.value = items;
  }

  function setStatistics(data: Record<string, any>) {
    statistics.value = data;
  }

  function $reset() {
    sites.value = [];
    statistics.value = {};
    loading.value = false;
  }

  return {
    $reset,
    loading,
    sites,
    statistics,
    setSites,
    setStatistics,
  };
});
