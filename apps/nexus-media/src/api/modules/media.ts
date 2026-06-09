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
  }
}

/** 搜索媒体 */
export async function searchMediaApi(params: MediaApi.SearchParams) {
  return requestClient.post<{ result: Record<string, any>; total: number }>(
    '/api/media/search',
    {
      keyword: params.keyword,
      searchtype: params.searchtype || '',
    },
  );
}

/** 获取媒体详情 */
export async function getMediaDetailApi(tmdbid: number | string, type: string) {
  return requestClient.post<MediaApi.MediaDetail>('/api/media/detail', {
    tmdbid,
    type,
  });
}

/** 获取媒体库首页数据（libraries/resumes/latests/stats） */
export async function getLibraryHomeApi() {
  return requestClient.post<Record<string, any>>('/api/media/library/home', {});
}

/** 获取媒体库统计 */
export async function getLibraryApi() {
  return requestClient.post<Record<string, any>>(
    '/api/media/library/count',
    {},
  );
}

/** 获取正在观看 */
export async function getLibraryHistoryApi() {
  return requestClient.post('/api/media/library/history', {});
}

/** 获取最新入库 */
export async function getLibraryDownloadedApi(page?: number) {
  return requestClient.post('/api/media/library/downloaded', {
    page: page || 1,
  });
}

/** 获取推荐/发现 */
export async function getRecommendApi(params?: MediaApi.RecommendParams) {
  return requestClient.post('/api/media/recommend', params || {});
}

/** 获取类似影片 */
export async function getSimilarApi(params: {
  page?: number;
  tmdbid: number | string;
  type?: string;
}) {
  return requestClient.post<{ code: number; Items?: any[] }>(
    '/api/media/similar',
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
    '/api/media/recommendations',
    params,
  );
}

/** 添加媒体到库 */
export async function addToLibraryApi(data: {
  tmdb_id: number;
  type: 'movie' | 'tv';
}) {
  return requestClient.post('/api/media/add', data);
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
  }>('/api/media/calendar/movie', data);
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
  >('/api/media/calendar/tv', data);
}

/** 删除媒体 */
export async function removeFromLibraryApi(id: number) {
  return requestClient.post('/api/media/remove', { id });
}

/** 获取搜索结果 */
export async function getSearchResultApi() {
  return requestClient.post<{ code: number; data?: Record<string, any> }>(
    '/api/media/search/results',
    {},
  );
}

/** WEB搜索（从发现页触发） */
export async function webSearchApi(params: {
  filters?: string;
  media_type?: string;
  search_word: string;
  tmdbid?: string;
  unident?: boolean;
}) {
  return requestClient.post('/api/system/search', params, { timeout: 300_000 });
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
  >('/api/media/season/list', { tmdbid, title });
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
  DATE: string;
  SYNC_MODE?: string;
  RMT_MODE?: string;
}

export interface TransferHistoryPageResult {
  total: number;
  result: TransferHistoryItem[];
  totalPage: number;
  pageNum: number;
  currentPage: number;
}

export interface TransferStatisticsResult {
  Labels: string[];
  MovieNums: number[];
  TvNums: number[];
  AnimeNums: number[];
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
}

/** 获取转移历史（分页） */
export async function getTransferHistoryApi(params: {
  keyword?: string;
  page?: number;
  pagenum?: number;
}) {
  return requestClient.post<TransferHistoryPageResult>(
    '/api/media/transfer/history',
    params,
  );
}

/** 获取转移统计 */
export async function getTransferStatisticsApi(days?: number) {
  return requestClient.post<TransferStatisticsResult>(
    '/api/media/transfer/statistics',
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
    '/api/media/unknown/paged',
    params,
  );
}

/** 清空识别记录 */
export async function clearTransferHistoryApi() {
  return requestClient.post('/api/media/history/clear', {});
}

/** 重新识别未识别记录 */
export async function reIdentifyUnknownApi() {
  return requestClient.post('/api/media/unknown/list', {});
}

/** 删除未识别记录 */
export async function deleteTransferUnknownApi(data: { ids: number[] }) {
  return requestClient.post('/api/sync/unknown/delete', data);
}

/** 获取目录列表 */
export async function getDirListApi(
  path?: string,
  filter?: string,
  backendId?: string,
) {
  return requestClient.post<DirListItem[]>('/api/media/dir/list', {
    path,
    filter,
    backend_id: backendId,
  });
}

/** 刮削路径 */
export async function scrapMediaPathApi(path: string, backendId?: string) {
  return requestClient.post('/api/media/scrap', {
    path,
    backend_id: backendId || 'local',
  });
}

/** 下载字幕 */
export async function downloadSubtitleApi(path: string, name: string) {
  return requestClient.post('/api/media/subtitle/download', { path, name });
}

/** 名称识别测试 */
export async function nameTestApi(name: string) {
  return requestClient.post<Record<string, any>>(
    '/api/media/name_test',
    { name },
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
  }>('/api/media/library/paths', {});
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
    `/api/media/tmdb_blacklist/list?${query.toString()}`,
  );
}

/** 添加 TMDB 黑名单 */
export async function addTmdbBlacklistApi(data: {
  media_type: string;
  tmdb_id: string;
}) {
  return requestClient.post('/api/media/tmdb_blacklist/add', data);
}

/** 删除 TMDB 黑名单 */
export async function deleteTmdbBlacklistApi(data: {
  media_type: string;
  tmdb_id: string;
}) {
  return requestClient.post('/api/media/tmdb_blacklist/delete', data);
}

/** 清空 TMDB 黑名单 */
export async function clearTmdbBlacklistApi() {
  return requestClient.post('/api/media/tmdb_blacklist/clear', {});
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
  }>(`/api/media/search/files?${query.toString()}`);
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
  }>('/api/media/library/path');
}

/** 添加媒体库路径 */
export async function addMediaLibraryPathApi(
  path_type: string,
  path: string,
  backend?: string,
) {
  return requestClient.post('/api/media/library/path/add', {
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
  return requestClient.post('/api/media/library/path/remove', {
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
  return requestClient.post('/api/media/library/path/update', {
    path_type,
    old_path,
    new_path,
    backend,
  });
}
