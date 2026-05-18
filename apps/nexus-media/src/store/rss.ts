import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { RssApi } from '#/api/modules/rss';

export type RssSubscription = RssApi.RssSubscription;
export type RssHistory = RssApi.RssHistory;
export type UserRssItem = RssApi.UserRssItem;

export const useRssStore = defineStore('rss', () => {
  const movieSubscriptions = ref<RssSubscription[]>([]);
  const tvSubscriptions = ref<RssSubscription[]>([]);
  const userRss = ref<UserRssItem[]>([]);
  const rssHistory = ref<RssHistory[]>([]);
  const loading = ref(false);

  function setMovieSubscriptions(items: RssSubscription[]) {
    movieSubscriptions.value = items;
  }

  function setTvSubscriptions(items: RssSubscription[]) {
    tvSubscriptions.value = items;
  }

  function setUserRss(items: UserRssItem[]) {
    userRss.value = items;
  }

  function setRssHistory(items: RssHistory[]) {
    rssHistory.value = items;
  }

  function $reset() {
    movieSubscriptions.value = [];
    tvSubscriptions.value = [];
    userRss.value = [];
    rssHistory.value = [];
    loading.value = false;
  }

  return {
    $reset,
    loading,
    movieSubscriptions,
    tvSubscriptions,
    userRss,
    rssHistory,
    setMovieSubscriptions,
    setTvSubscriptions,
    setUserRss,
    setRssHistory,
  };
});
