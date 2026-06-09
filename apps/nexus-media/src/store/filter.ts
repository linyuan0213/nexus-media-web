import type { FilterApi } from '#/api/modules/filter';

import { computed, ref } from 'vue';

import { defineStore } from 'pinia';

export type FilterRule = FilterApi.FilterRule;
export type FilterRuleGroup = FilterApi.FilterRuleGroup;

export const useFilterStore = defineStore('filter', () => {
  const rules = ref<FilterRule[]>([]);
  const groups = ref<FilterRuleGroup[]>([]);
  const loading = ref(false);
  const searchQuery = ref('');

  const filteredGroups = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return groups.value;
    return groups.value.filter((g) => {
      const nameMatch = g.name?.toLowerCase().includes(q);
      const ruleMatch = g.rules?.some(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.free_text?.toLowerCase().includes(q) ||
          r.include?.some((i) => i.toLowerCase().includes(q)) ||
          r.exclude?.some((e) => e.toLowerCase().includes(q)),
      );
      return nameMatch || ruleMatch;
    });
  });

  const defaultGroup = computed(() =>
    groups.value.find((g) => g.default === 'Y'),
  );

  function setRules(items: FilterRule[]) {
    rules.value = items;
  }

  function setGroups(items: FilterRuleGroup[]) {
    groups.value = items;
  }

  function setSearchQuery(q: string) {
    searchQuery.value = q;
  }

  function $reset() {
    rules.value = [];
    groups.value = [];
    loading.value = false;
    searchQuery.value = '';
  }

  return {
    $reset,
    loading,
    rules,
    groups,
    searchQuery,
    filteredGroups,
    defaultGroup,
    setRules,
    setGroups,
    setSearchQuery,
  };
});
