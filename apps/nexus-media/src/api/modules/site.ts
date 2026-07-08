/**
 * 站点管理 API
 * 对应后端: /api/site/*
 */
import { requestClient } from '#/api/request';

export namespace SiteApi {
  export interface SiteItem {
    id: number;
    name: string;
    url?: string;
    signurl?: string;
    cookie?: string;
    api_key?: string;
    bearer_token?: string;
    headers?: string;
    rssurl?: string;
    pri?: number;
    status?: number;
    public?: boolean;
    rss_enable?: boolean;
    brush_enable?: boolean;
    statistic_enable?: boolean;
    parse?: boolean;
    unread_msg_notify?: boolean;
    chrome?: boolean;
    proxy?: boolean;
    signin_status?: string;
    traffic?: string;
    note?: string;
    include?: string;
    rule?: string;
    /** 站点来源：builtin / jackett / prowlarr */
    source?: string;
    /** 是否为第三方索引器站点 */
    third_party?: boolean;
    /** 第三方站点是否启用 */
    enabled?: boolean;
    /** 第三方站点下载设置 ID */
    download_setting?: number | string;
  }

  export interface SiteStatisticsItem {
    site_name: string;
    username?: string;
    user_level?: string;
    join_at?: string;
    upload: string;
    download: string;
    ratio: string;
    seeding_size: string;
    seeding_count: number;
    bonus: string;
    message_count?: number;
  }

  export interface SiteResourceItem {
    id: string;
    site_name: string;
    title: string;
    size?: string;
    seeders?: number;
    leechers?: number;
    date?: string;
    category?: string;
    enclosure?: string;
    pageurl?: string;
  }

  export interface SiteHistoryItem {
    date: string;
    upload: number;
    download: number;
    bonus?: number;
  }

  export interface SiteHistoryDataset {
    dataset: [string, number, number][];
  }
}

/** 获取站点列表 */
export async function getSitesApi(filter?: {
  basic?: boolean;
  brush?: boolean;
  rss?: boolean;
  source?: string;
  statistic?: boolean;
}) {
  return requestClient.post<SiteApi.SiteItem[]>('/site/sites', filter || {});
}

/** 获取站点详情 */
export async function getSiteApi(id: number | string) {
  return requestClient.post<{
    site: SiteApi.SiteItem;
    site_2xfree?: boolean;
    site_free?: boolean;
    site_hr?: boolean;
  }>('/site/sites/detail', { id });
}

/** 添加/更新站点 */
export async function saveSiteApi(data: Record<string, any>) {
  return requestClient.post('/site/sites/update', {
    site_id: data.id == null ? undefined : String(data.id),
    site_name: data.name,
    site_pri: data.pri == null ? undefined : String(data.pri),
    site_rssurl: data.rssurl,
    site_signurl: data.signurl,
    site_cookie: data.cookie,
    site_api_key: data.api_key,
    site_bearer_token: data.bearer_token,
    site_headers: data.headers,
    site_note: data.note,
    site_include: data.include,
    rss_enable: data.rss_enable,
    brush_enable: data.brush_enable,
    statistic_enable: data.statistic_enable,
  });
}

/** 删除站点 */
export async function deleteSiteApi(id: number) {
  return requestClient.post('/site/sites/delete', { id: String(id) });
}

/** 测试站点连通性 */
export async function testSiteApi(id: number) {
  return requestClient.post('/site/sites/test', { id: String(id) });
}

export interface SiteBatchTestResult {
  flag: boolean;
  id: string;
  msg: string;
  times: number;
}

/** 批量测试站点连接（不抛异常，返回每个站点结果） */
export async function testSiteBatchApi(ids: Array<number | string>) {
  return requestClient.post<SiteBatchTestResult[]>(
    '/site/sites/test_batch',
    { ids: ids.map(String) },
    // 后端并发测试多个站点，单站最长 ~15s，放宽超时避免整体请求超时
    { timeout: 300_000 },
  );
}

/** 执行签到 */
export async function signinSiteApi(id?: number) {
  return requestClient.post('/site/sites/signin', {
    id: id == null ? undefined : String(id),
  });
}

/** 获取站点统计 */
export async function getSiteStatisticsApi(params?: {
  sites?: string[];
  sort_by?: string;
  sort_on?: string;
}) {
  return requestClient.post<SiteApi.SiteStatisticsItem[]>(
    '/site/sites/statistics',
    {
      sites: params?.sites,
      sort_by: params?.sort_by,
      sort_on: params?.sort_on,
    },
  );
}

/** 获取站点资源 */
export async function getSiteResourcesApi(params: {
  id?: string;
  keyword?: string;
  page?: number;
}) {
  return requestClient.post<{
    list: SiteApi.SiteResourceItem[];
    total?: number;
  }>('/site/sites/resources', params, { timeout: 120_000 });
}

/** 获取站点历史 */
export async function getSiteHistoryApi(params: {
  days: number;
  end_day?: string;
}) {
  return requestClient.post<SiteApi.SiteHistoryDataset>(
    '/site/sites/history',
    params,
  );
}

/** 获取站点活动 */
export async function getSiteActivityApi(name: string) {
  return requestClient.post<{ dataset: any[] }>('/site/sites/activity', {
    name,
  });
}

/** 获取站点每日流量历史（按站点分组） */
export async function getSiteDailyHistoryApi(params: {
  days: number;
  end_day?: string;
}) {
  return requestClient.post<{
    dates: string[];
    series: Array<{ download: number[]; name: string; upload: number[] }>;
  }>('/site/sites/statistics/daily', params);
}

/** 刷新站点数据统计（批量或单站） */
export async function refreshSiteStatisticsApi(sites?: string[]) {
  return requestClient.post<{ message: string }>(
    '/site/sites/statistics/refresh',
    { sites },
  );
}

/** 获取站点做种信息 */
export async function getSiteSeedingApi(name: string) {
  return requestClient.post<{ dataset: any[] }>('/site/sites/seeding', {
    name,
  });
}

/** 获取所有站点图标 */
export async function getSiteFaviconsApi() {
  return requestClient.post<Record<string, string>>('/site/sites/favicon', {});
}

/** 更新站点配置 */
export async function updateIndexerSiteConfigApi(data: {
  default_settings?: Record<string, any>;
  download_setting?: number | string;
  enabled?: boolean;
  site_name: string;
}) {
  return requestClient.post('/site/sites/indexer-config/update', data);
}

/** 手动同步指定第三方索引器的站点列表 */
export async function syncIndexerSitesApi(clientId: string) {
  return requestClient.post('/site/sites/indexer-config/sync', {
    client_id: clientId,
  });
}

/** 批量更新站点配置 */
export async function batchUpdateIndexerSiteConfigApi(
  sites: Array<{
    default_settings?: Record<string, any>;
    download_setting?: number | string;
    enabled?: boolean;
    site_name: string;
  }>,
) {
  return requestClient.post('/site/sites/indexer-config/batch', { sites });
}
