/**
 * RSS 订阅 API
 * 对应后端: /api/rss/*, /api/userrss/*
 */
import { requestClient } from '#/api/request';

export namespace RssApi {
  export interface RssSubscription {
    id: number;
    name: string;
    type: 'movie' | 'tv';
    status: number;
    last_update?: string;
    rss_url?: string;
    keywords?: string;
    exclude?: string;
    // 海报、年份、TMDB 等元数据（与模板字段保持一致）
    image?: string;
    year?: string;
    tmdbid?: string;
    state?: string;
    season?: string;
    // 进度信息（TV 订阅）
    total?: number;
    lack?: number;
    // 过滤与设置标签
    over_edition?: boolean | number | string;
    filter_restype?: string;
    filter_pix?: string;
    filter_team?: string;
    filter_rule?: string | number;
    filter_include?: string;
    filter_exclude?: string;
    download_setting?: string | number;
    rss_sites?: string[];
    search_sites?: string[];
  }

  export interface RssHistory {
    id: number | string;
    title: string;
    type: 'movie' | 'tv';
    date: string;
    status: string;
    // 与模板字段保持一致
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

  export interface UserRssItem {
    id: number;
    name: string;
    address: string;
    parser?: string;
    status: number;
  }
}

/** 获取电影订阅 */
export async function getMovieRssApi() {
  return requestClient.post<RssApi.RssSubscription[]>('/api/rss/movie/list');
}

/** 获取剧集订阅 */
export async function getTvRssApi() {
  return requestClient.post<RssApi.RssSubscription[]>('/api/rss/tv/list');
}

/** 添加 RSS 订阅 */
export async function addRssApi(data: Record<string, any>) {
  return requestClient.post('/api/rss/add', data);
}

/** 更新 RSS 订阅 */
export async function updateRssApi(data: Record<string, any>) {
  return requestClient.post('/api/rss/update', data);
}

/** 删除 RSS 订阅（简化版，优先使用 removeRssMediaApi） */
export async function deleteRssApi(id: number) {
  return requestClient.post('/api/rss/remove', { rssid: String(id) });
}

/** 获取默认订阅设置 */
export async function getDefaultRssSettingApi(mtype: string) {
  return requestClient.post('/api/rss/default_setting', { mtype });
}

/** 保存默认订阅设置 */
export async function saveDefaultRssSettingApi(mtype: string, data: Record<string, any>) {
  return requestClient.post('/api/rss/default_setting/save', { mtype, ...data });
}

/** 刷新订阅 */
export async function refreshRssApi(mtype: string, rssid?: string) {
  return requestClient.post('/api/rss/refresh', { type: mtype, rssid });
}

/** 获取订阅详情 */
export async function getRssDetailApi(rssid: string | number, rsstype: string) {
  return requestClient.post('/api/rss/detail', { rssid: String(rssid), rsstype });
}

/** 获取 RSS 历史 */
export async function getRssHistoryApi(type?: 'movie' | 'tv') {
  return requestClient.post<RssApi.RssHistory[]>('/api/rss/history', { type });
}

/** 重新订阅历史 */
export async function reRssHistoryApi(rssid: number | string, type: 'movie' | 'tv') {
  return requestClient.post('/api/rss/history/redo', { rssid, type });
}

/** 添加订阅（从发现页触发） */
export async function addRssMediaApi(data: {
  name: string;
  year?: string;
  type: string;
  mediaid?: string;
  season?: string;
  page?: string;
}) {
  return requestClient.post('/api/rss/add', data);
}

/** 取消订阅 */
export async function removeRssMediaApi(data: {
  name: string;
  type: string;
  year?: string;
  rssid?: string;
  tmdbid?: string;
  page?: string;
}) {
  return requestClient.post('/api/rss/remove', data);
}

/** 删除订阅历史 */
export async function deleteRssHistoryApi(rssid: number | string) {
  return requestClient.post('/api/rss/history/delete', { rssid });
}

/** 清理RSS缓存 */
export async function truncateRssHistoryApi() {
  return requestClient.post('/api/rss/history/truncate', {});
}

/** 获取自定义 RSS 列表 */
export async function getUserRssApi() {
  return requestClient.post<RssApi.UserRssItem[]>('/api/userrss/tasks');
}

/** 添加自定义 RSS */
export async function addUserRssApi(data: Partial<RssApi.UserRssItem>) {
  return requestClient.post('/api/userrss/tasks/update', data);
}

/** 更新自定义 RSS */
export async function updateUserRssApi(data: Partial<RssApi.UserRssItem>) {
  return requestClient.post('/api/userrss/tasks/update', data);
}

/** 删除自定义 RSS */
export async function deleteUserRssApi(id: number) {
  return requestClient.post('/api/userrss/tasks/delete', { id });
}

/** 获取电影订阅原始项（用于日历） */
export async function getMovieRssItemsApi() {
  return requestClient.post<Array<{ id: string; rssid: string; name?: string }>>('/api/rss/movie/items');
}

/** 获取剧集订阅原始项（用于日历） */
export async function getTvRssItemsApi() {
  return requestClient.post<Array<{ id: string; rssid: string; season?: string; name?: string }>>('/api/rss/tv/items');
}
