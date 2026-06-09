import type { PluginApi } from '#/api/modules/plugin';

import { ref } from 'vue';

import { defineStore } from 'pinia';

export type PluginItem = PluginApi.PluginItem;

export const usePluginStore = defineStore('plugin', () => {
  const installed = ref<PluginItem[]>([]);
  const market = ref<PluginItem[]>([]);
  const loading = ref(false);

  function setInstalled(items: PluginItem[]) {
    installed.value = items;
  }

  function setMarket(items: PluginItem[]) {
    market.value = items;
  }

  function $reset() {
    installed.value = [];
    market.value = [];
    loading.value = false;
  }

  return {
    $reset,
    installed,
    loading,
    market,
    setInstalled,
    setMarket,
  };
});
