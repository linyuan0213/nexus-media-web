import { ref } from 'vue';
import { defineStore } from 'pinia';

import type {
  TransferHistoryItem,
  TransferStatisticsResult,
  UnknownItem,
} from '#/api/modules/media';

export interface MediaItem {
  id: number;
  title: string;
  originalTitle?: string;
  year?: string;
  type: 'movie' | 'tv';
  poster?: string;
  overview?: string;
  tmdbId?: number;
}

export const useMediaStore = defineStore('media', () => {
  const searchResults = ref<MediaItem[]>([]);
  const searchLoading = ref(false);
  const library = ref<MediaItem[]>([]);

  // rename module state
  const transferHistory = ref<TransferHistoryItem[]>([]);
  const transferStatistics = ref<TransferStatisticsResult | null>(null);
  const unknownList = ref<UnknownItem[]>([]);

  function setSearchResults(results: MediaItem[]) {
    searchResults.value = results;
  }

  function setSearchLoading(loading: boolean) {
    searchLoading.value = loading;
  }

  function setLibrary(items: MediaItem[]) {
    library.value = items;
  }

  function setTransferHistory(items: TransferHistoryItem[]) {
    transferHistory.value = items;
  }

  function setTransferStatistics(stats: TransferStatisticsResult | null) {
    transferStatistics.value = stats;
  }

  function setUnknownList(items: UnknownItem[]) {
    unknownList.value = items;
  }

  function $reset() {
    searchResults.value = [];
    searchLoading.value = false;
    library.value = [];
    transferHistory.value = [];
    transferStatistics.value = null;
    unknownList.value = [];
  }

  return {
    $reset,
    library,
    searchLoading,
    searchResults,
    transferHistory,
    transferStatistics,
    unknownList,
    setLibrary,
    setSearchLoading,
    setSearchResults,
    setTransferHistory,
    setTransferStatistics,
    setUnknownList,
  };
});
