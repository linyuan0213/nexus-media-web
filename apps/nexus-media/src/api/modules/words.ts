/**
 * 识别词 API
 * 对应后端: /api/words/*
 */
import { requestClient } from '#/api/request';

export namespace WordsApi {
  export interface WordItem {
    id: number;
    replaced: string;
    replace: string;
    front: string;
    back: string;
    offset: string;
    type: string;
    group_id: string;
    season: number;
    enabled: number;
    regex: number;
    help: string;
  }

  export interface WordGroup {
    id: string;
    name: string;
    type?: string;
    seasons?: string;
    link?: string;
    words?: WordItem[];
  }

  export interface WordDetail {
    id: number;
    replaced: string;
    replace: string;
    front: string;
    back: string;
    offset: string;
    type: string;
    group_id: string;
    season: number;
    enabled: number;
    regex: number;
    help: string;
  }
}

/** 获取识别词组列表 */
export async function getWordGroupsApi() {
  return requestClient.post<WordsApi.WordGroup[]>('/api/words/words');
}

/** 获取单个识别词详情 */
export async function getWordDetailApi(wid: number) {
  return requestClient.post<WordsApi.WordDetail>('/api/words/words/detail', {
    wid,
  });
}

/** 保存识别词（新增/编辑） */
export async function saveWordApi(data: {
  enabled: number;
  gid: number;
  group_type: string;
  id?: number;
  new_back: string;
  new_front: string;
  new_help: string;
  new_offset: string;
  new_replace: string;
  new_replaced: string;
  regex: number;
  season?: number;
  type: string;
}) {
  return requestClient.post('/api/words/words/save', data);
}

/** 批量切换识别词状态 */
export async function toggleWordsApi(
  ids_info: string[],
  flag: 'disable' | 'enable',
) {
  return requestClient.post('/api/words/words/check', { ids_info, flag });
}

/** 删除识别词 */
export async function deleteWordApi(ids_info: string[]) {
  return requestClient.post('/api/words/words/delete', { ids_info });
}

/** 添加识别词组 */
export async function addWordGroupApi(tmdb_id: number, tmdb_type: string) {
  return requestClient.post('/api/words/groups/add', { tmdb_id, tmdb_type });
}

/** 删除识别词组 */
export async function deleteWordGroupApi(gid: number) {
  return requestClient.post('/api/words/groups/delete', { gid });
}

/** 导出识别词 */
export async function exportWordsApi(ids_info: string, note?: string) {
  return requestClient.post<string>('/api/words/words/export', {
    ids_info,
    note,
  });
}

/** 分析导入码 */
export async function analyseImportCodeApi(import_code: string) {
  return requestClient.post<{
    groups: WordsApi.WordGroup[];
    note_string: string;
  }>('/api/words/words/analyse', { import_code });
}

/** 导入识别词 */
export async function importWordsApi(import_code: string, ids_info: string) {
  return requestClient.post('/api/words/words/import', {
    import_code,
    ids_info,
  });
}
