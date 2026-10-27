/**
 * 媒体库 API
 * 对应后端: /api/media/*
 */
import { requestClient } from '#/api/request';

export namespace MediaApi {
  export interface SearchParams {
    keyword: string;
    searchtype?: '' | 'douban' | 'tmdb';
  }

  export interface MediaItem {
    id: number;
    title: string;
    original_title?: string;
    year?: string;
    type: 'movie' | 'tv';
    poster?: string;
    overview?: string;
    tmdb_id?: number;
  }

  export interface MediaDetail extends MediaItem {
    backdrop?: string;
    genres?: string[];
    runtime?: number;
    vote_average?: number;
    credits?: {
      cast: Array<{ character?: string; name: string; profile_path?: string }>;
      crew: Array<{ job?: string; name: string }>;
    };
  }

  export interface RecommendParams {
    type?: string;
    subtype?: string;
    page?: number;
    source?: string;
    tmdbid?: number;
    params?: Record<string, any>;
  }
  export interface MediaServerOption {
    id: number;
    name: string;
    type: string;
    is_default: boolean;
  }

  export interface LibrarySection {
    server: MediaServerOption;
    server_id: number;
    server_name: string;
    server_success: boolean;
    sync_state: string;
    media_counts: Record<string, number | string>;
    librarys: Record<string, any>[];
    resumes: Record<string, any>[];
    latests: Record<string, any>[];
    activitys: Record<string, any>[];
  }

  export interface LibraryHome {
    server_success: boolean;
    servers: MediaServerOption[];
    sections: LibrarySection[];
    media_counts: Record<string, number | string>;
    user_count: number;
    library_spaces: Record<string, any>;
    librarys: Record<string, any>[];
    resumes: Record<string, any>[];
    latests: Record<string, any>[];
    activitys: Record<string, any>[];
  }

  export interface LibraryRoute {
    id?: number;
    content_profile: string;
    target_path?: null | string;
    server_id: number;
    server_name?: string;
    library_id?: null | string;
    enabled: boolean;
    note?: string;
  }
}

/** 获取启用的媒体服务器实例 */
export async function getLibraryServersApi() {
  return requestClient.post<MediaApi.MediaServerOption[]>(
    '/media/library/servers',
    {},
  );
}

/** 获取指定实例的媒体库列表 */
export async function getMediaLibrariesApi(serverId?: number) {
  return requestClient.post<Record<string, any>[]>('/media/library/libraries', {
    server_id: serverId,
  });
}

/** 同步指定实例的媒体库 */
export async function syncMediaLibrariesApi(params: {
  server_id: number;
  librarys: string[];
}) {
  return requestClient.post('/media/sync/start', params);
}

/** 通知指定实例扫描媒体库 */
export async function refreshMediaLibraryApi(serverId: number) {
  return requestClient.post('/media/library/refresh', {
    server_id: serverId,
  });
}

/** 获取内容画像媒体库路由 */
export async function getLibraryRoutesApi() {
  return requestClient.post<MediaApi.LibraryRoute[]>(
    '/media/library/routes',
    {},
  );
}

/** 保存内容画像媒体库路由 */
export async function saveLibraryRouteApi(data: MediaApi.LibraryRoute) {
  const updating = Boolean(data.id);
  return requestClient.post<MediaApi.LibraryRoute>(
    updating ? '/media/library/routes/update' : '/media/library/routes/save',
    data,
  );
}

/** 删除内容画像媒体库路由 */
export async function deleteLibraryRouteApi(id: number) {
  return requestClient.post('/media/library/routes/delete', { id });
}

/** 搜索媒体 */
export async function searchMediaApi(params: MediaApi.SearchParams) {
  return requestClient.post<{ result: Record<string, any>; total: number }>(
    '/media/search',
    {
      keyword: params.keyword,
      searchtype: params.searchtype || '',
    },
  );
}

/** 按内容画像搜索元数据（插件 provider） */
export async function searchMetadataApi(params: {
  content_profile: string;
  limit?: number;
  provider?: string;
  query: string;
}) {
  return requestClient.post<Record<string, any>[]>(
    '/media/metadata/search',
    params,
  );
}

/** 获取可搜索的元数据来源（动态） */
export async function getMetadataProvidersApi() {
  return requestClient.get<Record<string, any>[]>(
    '/media/providers?include_health=false',
  );
}

/** 获取媒体详情 */
export async function getMediaDetailApi(tmdbid: number | string, type: string) {
  return requestClient.post<MediaApi.MediaDetail>('/media/detail', {
    tmdbid,
    type,
  });
}

export async function getMediaDetailByRefApi(
  provider: string,
  externalId: string,
  mediaType?: string,
  contentProfile?: string,
  contentId?: string,
) {
  return requestClient.post<Record<string, any>>('/media/detail_by_ref', {
    provider,
    external_id: externalId,
    media_type: mediaType,
    content_profile: contentProfile || undefined,
    content_id: contentId || undefined,
  });
}

/** 获取媒体库首页数据（libraries/resumes/latests/stats） */
export async function getLibraryHomeApi(serverId?: number) {
  return requestClient.post<MediaApi.LibraryHome>(
    '/media/library/home',
    { server_id: serverId },
    { timeout: 120_000 },
  );
}

/** 获取媒体库统计 */
export async function getLibraryApi() {
  return requestClient.post<Record<string, any>>('/media/library/count', {});
}

/** 获取正在观看 */
export async function getLibraryHistoryApi() {
  return requestClient.post('/media/library/history', {});
}

/** 获取最新入库 */
export async function getLibraryDownloadedApi(
  page?: number,
  pageSize?: number,
) {
  return requestClient.post('/media/library/downloaded', {
    page: page || 1,
    page_size: pageSize || 30,
  });
}

/** 获取推荐/发现 */
export async function getRecommendApi(params?: MediaApi.RecommendParams) {
  return requestClient.post('/media/recommend', params || {});
}

/** 获取类似影片 */
export async function getSimilarApi(params: {
  page?: number;
  tmdbid: number | string;
  type?: string;
}) {
  return requestClient.post<{ code: number; Items?: any[] }>(
    '/media/similar',
    params,
  );
}

/** 获取推荐影片 */
export async function getRecommendationsApi(params: {
  page?: number;
  tmdbid: number | string;
  type?: string;
}) {
  return requestClient.post<{ code: number; Items?: any[] }>(
    '/media/recommendations',
    params,
  );
}

/** 添加媒体到库 */
export async function addToLibraryApi(data: {
  tmdb_id: number;
  type: 'movie' | 'tv';
}) {
  return requestClient.post('/media/add', data);
}

/** 获取电影日历数据 */
export async function getMovieCalendarApi(data: { id: string; rssid: string }) {
  return requestClient.post<{
    id: string;
    poster: string;
    rssid: string;
    start: string;
    title: string;
    type: string;
    vote_average: number | string;
    year: string;
  }>('/media/calendar/movie', data);
}

/** 获取剧集日历数据 */
export async function getTvCalendarApi(data: {
  id: string;
  name: string;
  rssid: string;
  season: string;
}) {
  return requestClient.post<
    Array<{
      id: string;
      poster: string;
      rssid: string;
      start: string;
      title: string;
      type: string;
      vote_average: number | string;
      year: string;
    }>
  >('/media/calendar/tv', data);
}

/** 删除媒体 */
export async function removeFromLibraryApi(id: number) {
  return requestClient.post('/media/remove', { id });
}

/** 获取搜索结果 */
export async function getSearchResultApi(sessionId?: string) {
  return requestClient.post<{
    result: Record<string, any>;
    total: number;
  }>('/media/search/results', sessionId ? { session_id: sessionId } : {});
}

/** 订阅搜索进度 SSE */
export async function subscribeSearchProgressApi(
  sessionId: string,
  callbacks: {
    onEnd?: () => void;
    onProgress?: (
      pct: number,
      text: string,
      sites?: SiteSearchStatus[],
    ) => void;
  },
  signal?: AbortSignal,
) {
  return requestClient.requestSSE(
    `/system/search/progress/${sessionId}`,
    undefined,
    {
      method: 'GET',
      signal,
      onMessage: (content: string) => {
        const blocks = content.split('\n\n');
        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed) continue;
          const lines = trimmed.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try {
              const parsed = JSON.parse(raw);
              callbacks.onProgress?.(
                parsed.value ?? 0,
                parsed.text ?? '',
                parsed.sites ?? undefined,
              );
            } catch {
              // ignore parse errors
            }
          }
        }
      },
      onEnd: callbacks.onEnd,
    },
  );
}

export interface SiteSearchStatus {
  name: string;
  status: 'error' | 'ok' | 'timeout';
  count: number;
  error?: string;
}

/** WEB搜索（从发现页触发） */
export async function webSearchApi(params: {
  filters?: Record<string, any> | string;
  media_type?: string;
  search_word: string;
  tmdbid?: string;
  unident?: boolean;
}) {
  return requestClient.post<{ session_id: string }>('/system/search', params, {
    timeout: 300_000,
  });
}

/** 获取电视剧季列表 */
export async function getTvSeasonListApi(
  tmdbid: number | string,
  title?: string,
) {
  return requestClient.post<
    Array<{
      air_date?: string;
      episode_count?: number;
      name?: string;
      overview?: string;
      poster_path?: string;
      season_number: number;
    }>
  >('/media/season/list', { tmdbid, title });
}

// ---------- 识别/重命名模块 ----------

export interface TransferHistoryItem {
  ID: number;
  MODE: string;
  TYPE: string;
  CATEGORY: string;
  TMDBID: number;
  TITLE: string;
  YEAR: string;
  SEASON_EPISODE: string;
  SOURCE: string;
  SOURCE_PATH: string;
  SOURCE_FILENAME: string;
  DEST: string;
  DEST_PATH: string;
  DEST_FILENAME: string;
  DST_BACKEND?: string;
  image?: string;
  DATE: string;
  SYNC_MODE?: string;
  RMT_MODE?: string;
  SEEDS_SEASON?: number;
  SEEDS_EPISODE?: number;
  SEEDS_END_EPISODE?: number;
}

export interface TransferHistoryPageResult {
  total: number;
  result: TransferHistoryItem[];
  totalPage: number;
  pageNum: number;
  currentPage: number;
}

export interface TransferStatisticsResult {
  labels: string[];
  movie_nums: number[];
  tv_nums: number[];
  anime_nums: number[];
}

export interface UnknownItem {
  id: number;
  path: string;
  to: string;
  name: string;
  sync_mode: string;
  rmt_mode: string;
}

export interface UnknownListPageResult {
  total: number;
  items: UnknownItem[];
  totalPage: number;
  pageNum: number;
  currentPage: number;
}

export interface DirListItem {
  name: string;
  path: string;
  is_dir: boolean;
  ext?: string;
  size?: number;
  mtime?: number;
  ctime?: number;
}

/** 创建目录 */
export async function mkdirApi(data: {
  backend_id?: string;
  name: string;
  path: string;
}) {
  return requestClient.post<{ path: string }>('/media/dir/mkdir', data);
}

/** 批量移动文件 */
export async function moveFilesApi(data: {
  backend_id?: string;
  dest_dir: string;
  files: string[];
}) {
  return requestClient.post('/media/files/move', data);
}

/** 批量复制文件 */
export async function copyFilesApi(data: {
  backend_id?: string;
  dest_dir: string;
  files: string[];
}) {
  return requestClient.post('/media/files/copy', data);
}

/** 下载文件（返回 Blob） */
export async function downloadFileApi(path: string, backendId?: string) {
  const query = new URLSearchParams();
  query.set('path', path);
  query.set('backend_id', backendId || 'local');
  return requestClient.download(`/media/file/download?${query.toString()}`);
}

/** 上传文件到指定目录 */
export async function uploadFileApi(
  path: string,
  backendId: string,
  file: File,
) {
  return requestClient.upload('/media/file/upload', {
    file,
    path,
    backend_id: backendId,
  });
}

/** 获取转移历史（分页） */
export async function getTransferHistoryApi(params: {
  keyword?: string;
  page?: number;
  pagenum?: number;
}) {
  return requestClient.post<TransferHistoryPageResult>(
    '/media/transfer/history',
    params,
  );
}

/** 获取转移统计 */
export async function getTransferStatisticsApi(days?: number) {
  return requestClient.post<TransferStatisticsResult>(
    '/media/transfer/statistics',
    { days },
  );
}

/** 获取未识别列表（分页） */
export async function getUnknownListApi(params: {
  keyword?: string;
  page?: number;
  pagenum?: number;
}) {
  return requestClient.post<UnknownListPageResult>(
    '/media/unknown/paged',
    params,
  );
}

/** 清空识别记录 */
export async function clearTransferHistoryApi() {
  return requestClient.post('/media/history/clear', {});
}

/** 重新识别未识别记录 */
export async function reIdentifyUnknownApi() {
  return requestClient.post('/media/unknown/list', {});
}

/** 删除未识别记录 */
export async function deleteTransferUnknownApi(data: { ids: number[] }) {
  return requestClient.post('/sync/unknown/delete', data);
}

/** 获取目录列表 */
export async function getDirListApi(
  path?: string,
  filter?: string,
  backendId?: string,
) {
  return requestClient.post<DirListItem[]>('/media/dir/list', {
    path,
    filter,
    backend_id: backendId,
  });
}

/** 刮削路径 */
export async function scrapMediaPathApi(path: string, backendId?: string) {
  return requestClient.post('/media/scrap', {
    path,
    backend_id: backendId || 'local',
  });
}

/** 下载字幕 */
export async function downloadSubtitleApi(path: string, name: string) {
  return requestClient.post('/media/subtitle/download', { path, name });
}

/** 名称识别测试 */
export async function nameTestApi(name: string, subtitle?: string) {
  return requestClient.post<Record<string, any>>(
    '/media/name_test',
    { name, subtitle },
    { timeout: 60_000 },
  );
}

/** 获取媒体库目录列表 */
export async function getLibraryPathsApi() {
  return requestClient.post<{
    default_path: string;
    library_paths: Array<{
      backend_id?: string;
      name: string;
      path: string;
      type: string;
    }>;
    sync_dest_paths: Array<{
      backend_id?: string;
      name: string;
      path: string;
      type: string;
    }>;
    sync_source_paths: Array<{
      backend_id?: string;
      name: string;
      path: string;
      type: string;
    }>;
  }>('/media/library/paths', {});
}

// ---------- TMDB 黑名单 ----------

export interface TmdbBlacklistItem {
  id: number;
  title: string;
  tmdb_id: string;
  media_type: string;
  year?: string;
  poster_path?: string;
  backdrop_path?: string;
  note?: string;
}

export interface TmdbBlacklistPageResult {
  items: TmdbBlacklistItem[];
  total: number;
  page: number;
  count: number;
}

/** 获取 TMDB 黑名单列表 */
export async function getTmdbBlacklistApi(params: {
  count?: number;
  page?: number;
  s?: string;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.count) query.set('count', String(params.count));
  if (params.s) query.set('s', params.s);
  return requestClient.get<TmdbBlacklistPageResult>(
    `/media/tmdb_blacklist/list?${query.toString()}`,
  );
}

/** 添加 TMDB 黑名单 */
export async function addTmdbBlacklistApi(data: {
  media_type: string;
  tmdb_id: string;
}) {
  return requestClient.post('/media/tmdb_blacklist/add', data);
}

/** 删除 TMDB 黑名单 */
export async function deleteTmdbBlacklistApi(data: {
  media_type: string;
  tmdb_id: string;
}) {
  return requestClient.post('/media/tmdb_blacklist/delete', data);
}

/** 清空 TMDB 黑名单 */
export async function clearTmdbBlacklistApi() {
  return requestClient.post('/media/tmdb_blacklist/clear', {});
}

// ---------- 分类配置 ----------

export interface CategoryConfigItem {
  id?: number;
  media_type: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  rules: Record<string, string>;
}

/** 获取分类配置 */
export async function getCategoryConfigApi() {
  return requestClient.post<CategoryConfigItem[]>('/media/category/config', {});
}

/** 更新分类配置 */
export async function updateCategoryConfigApi(items: CategoryConfigItem[]) {
  return requestClient.post('/media/category/config/update', {
    config: items,
  });
}

/** 全局搜索文件（基于后台索引） */
export async function searchFilesApi(keyword: string, limit?: number) {
  const query = new URLSearchParams();
  query.set('keyword', keyword);
  if (limit) query.set('limit', String(limit));
  return requestClient.get<{
    indexed: number;
    items: Array<{
      ctime?: number;
      ext?: string;
      is_dir: boolean;
      mtime?: number;
      name: string;
      path: string;
      size?: number;
    }>;
    ready: boolean;
    total: number;
  }>(`/media/search/files?${query.toString()}`);
}

/** 获取媒体库路径配置 */
export async function getMediaLibraryConfigApi() {
  return requestClient.post<{
    anime_backend: string[];
    anime_path: string[];
    movie_backend: string[];
    movie_path: string[];
    tv_backend: string[];
    tv_path: string[];
    unknown_backend: string[];
    unknown_path: string[];
  }>('/media/library/path');
}

/** 添加媒体库路径 */
export async function addMediaLibraryPathApi(
  path_type: string,
  path: string,
  backend?: string,
) {
  return requestClient.post('/media/library/path/add', {
    path_type,
    path,
    backend,
  });
}

/** 移除媒体库路径 */
export async function removeMediaLibraryPathApi(
  path_type: string,
  path: string,
) {
  return requestClient.post('/media/library/path/remove', {
    path_type,
    path,
  });
}

/** 更新媒体库路径 */
export async function updateMediaLibraryPathApi(
  path_type: string,
  old_path: string,
  new_path: string,
  backend?: string,
) {
  return requestClient.post('/media/library/path/update', {
    path_type,
    old_path,
    new_path,
    backend,
  });
}

// ---------- 重命名格式：字段目录 / 校验 / 预览 ----------

export interface NameFormatField {
  key: string;
  label: string;
  desc: string;
  applies: 'both' | 'movie' | 'tv';
  requires_ms: boolean;
}

export interface NameFormatGroup {
  group: string;
  fields: NameFormatField[];
}

export interface NameFormatValidateResult {
  ok: boolean;
  problems: string[];
}

/** 获取重命名格式字段目录（供构建器插入按钮使用） */
export async function getNameFormatFieldsApi() {
  return requestClient.get<{
    fields: NameFormatField[];
    groups: NameFormatGroup[];
  }>('/media/name_format/fields');
}

/** 校验重命名格式串 */
export async function validateNameFormatApi(format: string) {
  return requestClient.post<NameFormatValidateResult>(
    '/media/name_format/validate',
    { format },
  );
}

/** 实时预览重命名格式渲染结果 */
export async function previewNameFormatApi(data: {
  format: string;
  media_type: string;
  values: Record<string, string>;
}) {
  return requestClient.post<{
    segments: Record<string, string>;
    validate: NameFormatValidateResult;
  }>('/media/name_format/preview', data);
}

export namespace DiscoveryApi {
  export interface Feed {
    key: string;
    title: string;
    kind: string;
    icon?: string;
    facets: string[];
    page_size: number;
  }

  export interface Source {
    provider: string;
    name: string;
    visibility: 'private' | 'public';
    feeds: Feed[];
  }

  export interface ItemRef {
    provider: string;
    external_id: string;
    media_type?: string;
    scope?: string;
  }

  export interface Item {
    provider: string;
    ref: ItemRef;
    content_profile: string;
    title: string;
    original_title?: string;
    year?: string;
    poster?: string;
    backdrop?: string;
    rating: Record<string, number>;
    tags: string[];
    anchor_ref?: ItemRef;
    actions: string[];
    extra?: Record<string, any>;
  }

  export interface Page {
    items: Item[];
    page: number;
    has_more: boolean;
    facets?: Record<string, Array<{ label?: string; value: string }>>;
    error?: null | string;
    retryable?: boolean;
  }
}

/** 获取探索页来源与 feed */
export async function getDiscoveryProvidersApi() {
  return requestClient.get<DiscoveryApi.Source[]>('/media/discovery/providers');
}

/** 获取探索 feed 内容 */
export async function getDiscoveryItemsApi(params: {
  provider: string;
  feed: string;
  page?: number;
  filters?: Record<string, any>;
}) {
  return requestClient.post<DiscoveryApi.Page>('/media/discovery/items', {
    page: 1,
    filters: {},
    ...params,
  });
}

/** 按 provider ref 获取元数据详情（用于缺失海报兜底） */
export async function lookupMetadataApi(data: {
  allow_missing?: boolean;
  external_id: string;
  provider: string;
  scope?: string;
}) {
  return requestClient.get<any>('/media/lookup', { params: data });
}
