/**
 * 媒体订阅 API
 * 对应后端: /api/subscription/*, /api/rss-automation/*
 */
import { requestClient } from '#/api/request';

export namespace SubscriptionApi {
  export interface Subscription {
    id: number;
    name: string;
    type: 'movie' | 'tv';
    status: number;
    last_update?: string;
    rss_url?: string;
    keywords?: string;
    exclude?: string;
    image?: string;
    year?: string;
    tmdbid?: string;
    state?: string;
    season?: string;
    total?: number;
    lack?: number;
    over_edition?: boolean | number | string;
    filter_restype?: string;
    filter_pix?: string;
    filter_team?: string;
    filter_rule?: number | string;
    filter_include?: string;
    filter_exclude?: string;
    download_setting?: number | string;
    rss_sites?: string[];
    search_sites?: string[];
  }

  export interface SubscriptionHistory {
    id: number | string;
    title: string;
    type: 'movie' | 'tv';
    date: string;
    status: string;
    IMAGE?: string;
    NAME?: string;
    YEAR?: string;
    SEASON?: string;
    TMDBID?: string;
    TOTAL?: number;
    START?: number;
    DESC?: string;
    FINISH_TIME?: string;
    ID?: number | string;
  }

  export interface RssAutomationItem {
    id: number;
    name: string;
    address: string;
    parser?: string;
    status: number;
  }
}

/** 获取电影订阅 */
export async function getMovieSubscriptionApi() {
  return requestClient.post<SubscriptionApi.Subscription[]>(
    '/api/subscription/movie/list',
  );
}

/** 获取剧集订阅 */
export async function getTvSubscriptionApi() {
  return requestClient.post<SubscriptionApi.Subscription[]>(
    '/api/subscription/tv/list',
  );
}

/** 添加订阅 */
export async function addSubscriptionApi(data: Record<string, any>) {
  return requestClient.post('/api/subscription/add', data);
}

/** 更新订阅 */
export async function updateSubscriptionApi(data: Record<string, any>) {
  return requestClient.post('/api/subscription/update', data);
}

/** 删除订阅（简化版，优先使用 removeSubscriptionApi） */
export async function deleteSubscriptionApi(id: number) {
  return requestClient.post('/api/subscription/remove', { rssid: String(id) });
}

/** 获取默认订阅设置 */
export async function getDefaultSubscriptionSettingApi(mtype: string) {
  return requestClient.post('/api/subscription/default_setting', { mtype });
}

/** 保存默认订阅设置 */
export async function saveDefaultSubscriptionSettingApi(
  mtype: string,
  data: Record<string, any>,
) {
  return requestClient.post('/api/subscription/default_setting/save', {
    mtype,
    ...data,
  });
}

/** 刷新订阅 */
export async function refreshSubscriptionApi(mtype: string, rssid?: string) {
  return requestClient.post('/api/subscription/refresh', {
    type: mtype,
    rssid,
  });
}

/** 获取订阅详情 */
export async function getSubscriptionDetailApi(
  rssid: number | string,
  rsstype: string,
) {
  return requestClient.post('/api/subscription/detail', {
    rssid: String(rssid),
    rsstype,
  });
}

/** 获取订阅历史 */
export async function getSubscriptionHistoryApi(type?: 'movie' | 'tv') {
  return requestClient.post<SubscriptionApi.SubscriptionHistory[]>(
    '/api/subscription/history',
    { type },
  );
}

/** 重新订阅历史 */
export async function redoSubscriptionHistoryApi(
  rssid: number | string,
  type: 'movie' | 'tv',
) {
  return requestClient.post('/api/subscription/history/redo', { rssid, type });
}

/** 添加订阅（从发现页触发） */
export async function addSubscriptionMediaApi(data: {
  mediaid?: string;
  name: string;
  page?: string;
  season?: string;
  type: string;
  year?: string;
}) {
  return requestClient.post('/api/subscription/add', data);
}

/** 取消订阅 */
export async function removeSubscriptionApi(data: {
  name: string;
  page?: string;
  rssid?: string;
  tmdbid?: string;
  type: string;
  year?: string;
}) {
  return requestClient.post('/api/subscription/remove', data);
}

/** 删除订阅历史 */
export async function deleteSubscriptionHistoryApi(rssid: number | string) {
  return requestClient.post('/api/subscription/history/delete', { rssid });
}

/** 清理订阅缓存 */
export async function truncateSubscriptionHistoryApi() {
  return requestClient.post('/api/subscription/history/clear', {});
}

/** 获取 RSS 自动化任务列表 */
export async function getRssAutomationApi() {
  return requestClient.post<SubscriptionApi.RssAutomationItem[]>(
    '/api/rss-automation/tasks',
  );
}

/** 添加 RSS 自动化任务 */
export async function addRssAutomationApi(
  data: Partial<SubscriptionApi.RssAutomationItem>,
) {
  return requestClient.post('/api/rss-automation/tasks/update', data);
}

/** 更新 RSS 自动化任务 */
export async function updateRssAutomationApi(
  data: Partial<SubscriptionApi.RssAutomationItem>,
) {
  return requestClient.post('/api/rss-automation/tasks/update', data);
}

/** 删除 RSS 自动化任务 */
export async function deleteRssAutomationApi(id: number) {
  return requestClient.post('/api/rss-automation/tasks/delete', { id });
}

/** 获取电影订阅原始项（用于日历） */
export async function getMovieSubscriptionItemsApi() {
  return requestClient.post<
    Array<{ id: string; name?: string; rssid: string }>
  >('/api/subscription/movie/items');
}

/** 获取剧集订阅原始项（用于日历） */
export async function getTvSubscriptionItemsApi() {
  return requestClient.post<
    Array<{ id: string; name?: string; rssid: string; season?: string }>
  >('/api/subscription/tv/items');
}
