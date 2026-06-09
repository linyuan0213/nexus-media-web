import type { SubscriptionApi } from '#/api/modules/subscription';

import { ref } from 'vue';

import { defineStore } from 'pinia';

export type Subscription = SubscriptionApi.Subscription;
export type SubscriptionHistory = SubscriptionApi.SubscriptionHistory;
export type RssAutomationItem = SubscriptionApi.RssAutomationItem;

export const useSubscriptionStore = defineStore('subscription', () => {
  const movieSubscriptions = ref<Subscription[]>([]);
  const tvSubscriptions = ref<Subscription[]>([]);
  const rssAutomationItems = ref<RssAutomationItem[]>([]);
  const subscriptionHistory = ref<SubscriptionHistory[]>([]);
  const loading = ref(false);

  function setMovieSubscriptions(items: Subscription[]) {
    movieSubscriptions.value = items;
  }

  function setTvSubscriptions(items: Subscription[]) {
    tvSubscriptions.value = items;
  }

  function setRssAutomationItems(items: RssAutomationItem[]) {
    rssAutomationItems.value = items;
  }

  function setSubscriptionHistory(items: SubscriptionHistory[]) {
    subscriptionHistory.value = items;
  }

  function $reset() {
    movieSubscriptions.value = [];
    tvSubscriptions.value = [];
    rssAutomationItems.value = [];
    subscriptionHistory.value = [];
    loading.value = false;
  }

  return {
    $reset,
    loading,
    movieSubscriptions,
    tvSubscriptions,
    rssAutomationItems,
    subscriptionHistory,
    setMovieSubscriptions,
    setTvSubscriptions,
    setRssAutomationItems,
    setSubscriptionHistory,
  };
});
