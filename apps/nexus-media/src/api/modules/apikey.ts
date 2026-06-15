/**
 * API Key 管理 API
 * 对应后端: /api/apikey/*
 */
import { requestClient } from '#/api/request';

export namespace APIKeyApi {
  export interface APIKeyItem {
    id: number;
    name: string;
    key_prefix: string;
    status: number;
    expires_at: null | string;
    created_at: null | string;
    updated_at: null | string;
    created_by: null | number;
    use_count: number;
    last_used_at: null | string;
    description: null | string;
    is_expired: boolean;
    is_active: boolean;
  }

  export interface APIKeyLogItem {
    id: number;
    api_key_id: number;
    request_id: string;
    request_name: null | string;
    source_ip: null | string;
    request_path: null | string;
    request_method: null | string;
    status: number;
    response_code: null | number;
    error_message: null | string;
    request_at: null | string;
    response_time_ms: null | number;
  }

  export interface CreateAPIKeyParams {
    name: string;
    expires_days?: null | number;
    description?: string;
  }

  export interface UpdateAPIKeyParams {
    name?: string;
    status?: number;
    description?: string;
  }

  export interface PagedResult<T> {
    total: number;
    page: number;
    page_size: number;
    items: T[];
  }

  export interface APIKeyStats {
    total_keys: number;
    active_keys: number;
    total_requests: number;
    today_requests: number;
  }

  export interface CreateAPIKeyResult {
    id: number;
    name: string;
    key: string;
    prefix: string;
    expires_at: null | string;
    created_at: null | string;
    status: number;
  }
}

/** 创建 API Key */
export async function createAPIKeyApi(params: APIKeyApi.CreateAPIKeyParams) {
  return requestClient.post<APIKeyApi.CreateAPIKeyResult>(
    '/apikey/keys',
    params,
  );
}

/** 获取 API Key 列表 */
export async function listAPIKeysApi(page = 1, pageSize = 50) {
  return requestClient.get<APIKeyApi.PagedResult<APIKeyApi.APIKeyItem>>(
    `/apikey/keys?page=${page}&page_size=${pageSize}`,
  );
}

/** 更新 API Key */
export async function updateAPIKeyApi(
  id: number,
  params: APIKeyApi.UpdateAPIKeyParams,
) {
  return requestClient.put(`/apikey/keys/${id}`, params);
}

/** 删除 API Key */
export async function deleteAPIKeyApi(id: number) {
  return requestClient.delete(`/apikey/keys/${id}`);
}

/** 获取 API Key 使用记录 */
export async function listAPIKeyLogsApi(
  keyId: number,
  page = 1,
  pageSize = 50,
) {
  return requestClient.get<APIKeyApi.PagedResult<APIKeyApi.APIKeyLogItem>>(
    `/apikey/keys/${keyId}/logs?page=${page}&page_size=${pageSize}`,
  );
}

/** 获取所有使用记录 */
export async function listAllLogsApi(page = 1, pageSize = 50) {
  return requestClient.get<APIKeyApi.PagedResult<APIKeyApi.APIKeyLogItem>>(
    `/apikey/logs?page=${page}&page_size=${pageSize}`,
  );
}

/** 获取统计信息 */
export async function getAPIKeyStatsApi() {
  return requestClient.get<APIKeyApi.APIKeyStats>('/apikey/stats');
}
