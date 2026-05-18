import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { WordsApi } from '#/api/modules/words';

export type WordItem = WordsApi.WordItem;
export type WordGroup = WordsApi.WordGroup;

export const useWordsStore = defineStore('words', () => {
  const words = ref<WordItem[]>([]);
  const groups = ref<WordGroup[]>([]);
  const loading = ref(false);

  function setWords(items: WordItem[]) {
    words.value = items;
  }

  function setGroups(items: WordGroup[]) {
    groups.value = items;
  }

  function $reset() {
    words.value = [];
    groups.value = [];
    loading.value = false;
  }

  return {
    $reset,
    loading,
    words,
    groups,
    setWords,
    setGroups,
  };
});
