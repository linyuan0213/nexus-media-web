/**
 * 后端统一错误码（与 backend src/app/core/error_codes.py 保持一致）
 * 统一响应结构：{ code, message, data }
 * - code = 0 成功
 * - code != 0 业务错误码，message 为用户可读提示
 */
export enum ErrorCode {
  SUCCESS = 0,

  // 通用 10xxx
  UNKNOWN = 10_000,
  PARAM_VALIDATION_FAILED = 10_001,
  RESOURCE_NOT_FOUND = 10_002,
  RESOURCE_ALREADY_EXISTS = 10_003,
  OPERATION_FAILED = 10_004,
  RATE_LIMITED = 10_005,
  FILE_OPERATION_FAILED = 10_006,

  // 认证与权限 20xxx
  UNAUTHORIZED = 20_001,
  TOKEN_EXPIRED = 20_002,
  TOKEN_INVALID = 20_003,
  REFRESH_TOKEN_INVALID = 20_004,
  PERMISSION_DENIED = 20_005,
  USER_NOT_FOUND = 20_006,
  PASSWORD_INCORRECT = 20_007,
  APIKEY_NOT_FOUND = 20_008,
  APIKEY_INVALID = 20_009,

  // 媒体 30xxx
  MEDIA_RECOGNIZE_FAILED = 30_001,
  MEDIA_NOT_FOUND = 30_002,
  TMDB_REQUEST_FAILED = 30_003,
  DOUBAN_REQUEST_FAILED = 30_004,
  SCRAPE_FAILED = 30_005,
  IMAGE_FETCH_FAILED = 30_006,

  // 下载 40xxx
  DOWNLOADER_NOT_FOUND = 40_001,
  DOWNLOADER_CONNECT_FAILED = 40_002,
  TORRENT_ADD_FAILED = 40_003,
  TORRENT_NOT_FOUND = 40_004,
  DOWNLOAD_TASK_FAILED = 40_005,
  DOWNLOADER_SETTING_INVALID = 40_006,

  // 站点 / 索引器 / RSS 50xxx
  SITE_NOT_FOUND = 50_001,
  SITE_LOGIN_FAILED = 50_002,
  SITE_REQUEST_FAILED = 50_003,
  INDEXER_SEARCH_FAILED = 50_004,
  RSS_PARSE_FAILED = 50_005,

  // 订阅 60xxx
  SUBSCRIPTION_NOT_FOUND = 60_001,
  SUBSCRIPTION_ALREADY_EXISTS = 60_002,
  SUBSCRIPTION_FAILED = 60_003,

  // 插件 70xxx
  PLUGIN_NOT_FOUND = 70_001,
  PLUGIN_LOAD_FAILED = 70_002,
  PLUGIN_EXEC_FAILED = 70_003,
  PLUGIN_INSTALLING = 70_004,
  PLUGIN_NOT_INSTALLED = 70_005,
  PLUGIN_MANIFEST_INVALID = 70_006,
  PLUGIN_HOT_RELOAD_FAILED = 70_007,

  // 同步 / 刷流 80xxx
  SYNC_FAILED = 80_001,
  BRUSH_FAILED = 80_002,

  // 系统 / 基础设施 90xxx
  INTERNAL_ERROR = 90_000,
  DATABASE_ERROR = 90_001,
  CACHE_ERROR = 90_002,
  NETWORK_ERROR = 90_003,
  CONFIG_ERROR = 90_004,
  SCHEDULER_ERROR = 90_005,
  MESSAGE_SEND_FAILED = 90_006,
  STORAGE_ERROR = 90_007,
  MEDIA_SERVER_ERROR = 90_008,
}

/** 认证类错误码：触发重新登录 */
export const AUTH_ERROR_CODES: ReadonlySet<number> = new Set([
  ErrorCode.REFRESH_TOKEN_INVALID,
  ErrorCode.TOKEN_EXPIRED,
  ErrorCode.TOKEN_INVALID,
  ErrorCode.UNAUTHORIZED,
]);

/** 从响应体提取错误码（兼容旧格式 code=-1 / msg 字段） */
export function extractErrorCode(data: unknown): null | number {
  if (data && typeof data === 'object' && 'code' in data) {
    const code = (data as { code: unknown }).code;
    if (typeof code === 'number' && code !== 0) return code;
  }
  return null;
}
