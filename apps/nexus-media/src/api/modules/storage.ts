/**
 * 存储后端 API
 * 对应后端: /api/storage/*
 */
import { requestClient } from '#/api/request';

export namespace StorageApi {
  export interface StorageBackend {
    id: number;
    name: string;
    type: string;
    config: Record<string, any>;
    enabled: boolean;
  }
}

/** 获取存储后端列表 */
export async function getStorageBackendsApi() {
  return requestClient.post<{
    count: number;
    items: StorageApi.StorageBackend[];
  }>('/storage/list', {});
}

/** 获取单个存储后端 */
export async function getStorageBackendApi(sid: number) {
  return requestClient.post<{ data: StorageApi.StorageBackend }>(
    '/storage/get',
    { sid },
  );
}

/** 创建存储后端 */
export async function createStorageBackendApi(data: {
  config: string;
  enabled?: number;
  name: string;
  type: string;
}) {
  return requestClient.post<{ id: number }>('/storage/save', data);
}

/** 更新存储后端 */
export async function updateStorageBackendApi(data: {
  config?: string;
  enabled?: number;
  name?: string;
  sid: number;
  type?: string;
}) {
  return requestClient.post('/storage/update', data);
}

/** 删除存储后端 */
export async function deleteStorageBackendApi(sid: number) {
  return requestClient.post('/storage/delete', { sid });
}

export interface StorageTypeSchema {
  key: string;
  label: string;
  icon: string;
  fields: Array<{
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
  }>;
}

/** 测试存储后端连接 */
export async function testStorageBackendApi(data: {
  config: string;
  type: string;
}) {
  return requestClient.post<{ msg?: string; success: boolean }>(
    '/storage/test',
    data,
  );
}

/** 获取支持的存储类型 */
export async function getStorageTypesApi() {
  return requestClient.post<{ items: StorageTypeSchema[] }>(
    '/storage/types',
    {},
  );
}
