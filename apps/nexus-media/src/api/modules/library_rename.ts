/**
 * 媒体库批量重命名 API
 * 对应后端: /api/media/library/rename/* 与 /api/media/library/metadata
 */
import { requestClient } from '#/api/request';

export namespace LibraryRenameApi {
  export type LayoutMode = 'filename_only' | 'full';
  export type MediaType = 'anime' | 'movie' | 'tv';
  export type PlanAction =
    | 'conflict'
    | 'needs_metadata'
    | 'rename'
    | 'skip'
    | 'unchanged';
  export type JobStatus =
    | 'cancelled'
    | 'cancelling'
    | 'completed'
    | 'failed'
    | 'interrupted'
    | 'planned'
    | 'rolled_back'
    | 'running';
  export type ItemStatus =
    | 'done'
    | 'failed'
    | 'manual_intervention'
    | 'planned'
    | 'rolled_back'
    | 'running';

  export interface RenameScope {
    media_types: MediaType[];
    roots: string[];
    layout_mode: LayoutMode;
    preserve_current_category: boolean;
    reorganize_category: boolean;
    use_mediaserver_metadata: boolean;
    allow_online_metadata: boolean;
    reidentify_no_metadata: boolean;
    limit: number;
    server_id?: null | number;
  }

  export interface PlanJob {
    job_id: number;
    plan_id: string;
    status: JobStatus;
    scope: null | RenameScope;
    total: number;
    changed: number;
    unchanged: number;
    skipped: number;
    conflict: number;
    needs_metadata: number;
    failed: number;
    done: number;
    rolled_back: number;
    created_by?: null | number;
    created_at?: string;
    started_at?: string;
    finished_at?: string;
  }

  export interface PlanItem {
    id: number;
    backend_id: string;
    root: string;
    old_path: string;
    new_path: null | string;
    action: PlanAction;
    status: ItemStatus;
    reason?: null | string;
    error?: null | string;
    metadata_source?: null | string;
    metadata?: null | Record<string, any>;
  }

  export interface PlanItemsPage {
    plan_id: string;
    total: number;
    page: number;
    page_size: number;
    items: PlanItem[];
  }

  export interface ManualMetadataRequest {
    backend_id: string;
    path: string;
    media_type: MediaType;
    title?: string;
    year?: string;
    tmdbid?: number | string;
    season?: number | string;
    episode?: number | string;
  }
}

/** 生成批量重命名预览计划 */
export async function previewRenamePlanApi(data: LibraryRenameApi.RenameScope) {
  return requestClient.post<LibraryRenameApi.PlanJob>(
    '/media/library/rename/preview',
    data,
    { timeout: 300_000 },
  );
}

/** 获取重命名计划 */
export async function getRenamePlanApi(planId: string) {
  return requestClient.get<LibraryRenameApi.PlanJob>(
    `/media/library/rename/plans/${planId}`,
  );
}

/** 分页获取计划条目 */
export async function getRenamePlanItemsApi(
  planId: string,
  params: { action?: string; page: number; page_size: number },
) {
  return requestClient.get<LibraryRenameApi.PlanItemsPage>(
    `/media/library/rename/plans/${planId}/items`,
    { params },
  );
}

/** 执行重命名计划 */
export async function executeRenamePlanApi(planId: string) {
  return requestClient.post<LibraryRenameApi.PlanJob>(
    `/media/library/rename/plans/${planId}/execute`,
    {},
  );
}

/** 获取任务进度 */
export async function getRenameJobApi(jobId: number) {
  return requestClient.get<LibraryRenameApi.PlanJob>(
    `/media/library/rename/jobs/${jobId}`,
  );
}

/** 取消任务 */
export async function cancelRenameJobApi(jobId: number) {
  return requestClient.post<LibraryRenameApi.PlanJob>(
    `/media/library/rename/jobs/${jobId}/cancel`,
    {},
  );
}

/** 回滚任务 */
export async function rollbackRenameJobApi(jobId: number) {
  return requestClient.post<LibraryRenameApi.PlanJob>(
    `/media/library/rename/jobs/${jobId}/rollback`,
    {},
    { timeout: 300_000 },
  );
}

/** 人工补录库内文件元数据 */
export async function setLibraryMetadataApi(
  data: LibraryRenameApi.ManualMetadataRequest,
) {
  return requestClient.post('/media/library/metadata', data);
}
