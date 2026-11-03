/**
 * 媒体生命周期 API
 * 对应后端: /api/media/lifecycle/*
 */
import { requestClient } from '#/api/request';

export namespace LifecycleApi {
  export interface Item {
    identity_id: string;
    media_type: string;
    season: number;
    episode: number;
    title?: null | string;
    year?: null | string;
    poster?: null | string;
    stage: string;
    status: string;
    run_id?: null | string;
    trace_id?: null | string;
    progress: number;
    source_provider?: null | string;
    content_profile?: null | string;
    user_id?: null | number;
    stage_started_at: string;
    last_event_at: string;
    next_retry_at?: null | string;
    retry_count: number;
    last_error?: null | string;
    episode_count: number;
    completed_episodes: number;
    in_library_episodes: number;
    subscribed_episodes?: number;
    missing?: boolean;
    elapsed_seconds: number;
  }

  export interface Event {
    id: number;
    stage: string;
    status: string;
    event_type: string;
    message?: null | string;
    occurred_at: string;
    run_id?: null | string;
    trace_id?: null | string;
    payload: Record<string, any>;
  }

  export interface ListParams {
    episode?: number;
    keyword?: string;
    media_type?: string;
    page?: number;
    pagenum?: number;
    season?: number;
    stage?: string;
    status?: string;
  }

  export interface Stats {
    total: number;
    by_status: Record<string, number>;
    by_stage: Record<string, number>;
  }
}

export async function getLifecycleListApi(params: LifecycleApi.ListParams) {
  return requestClient.get<{ items: LifecycleApi.Item[]; total: number }>(
    '/media/lifecycle',
    { params },
  );
}

export async function getLifecycleStatsApi() {
  return requestClient.get<LifecycleApi.Stats>('/media/lifecycle/stats');
}

export async function getLifecycleDetailApi(
  identityId: string,
  params: { episode?: number; season?: number } = {},
) {
  return requestClient.get<LifecycleApi.Item | null>(
    `/media/lifecycle/${encodeURIComponent(identityId)}`,
    { params },
  );
}

export async function getLifecycleEpisodesApi(identityId: string) {
  return requestClient.get<LifecycleApi.Item[]>(
    `/media/lifecycle/${encodeURIComponent(identityId)}/episodes`,
  );
}

export async function getLifecycleEventsApi(
  identityId: string,
  params: { episode?: number; limit?: number; season?: number } = {},
) {
  return requestClient.get<LifecycleApi.Event[]>(
    `/media/lifecycle/${encodeURIComponent(identityId)}/events`,
    { params },
  );
}

export async function retryLifecycleApi(
  identityId: string,
  params: { episode?: number; season?: number } = {},
) {
  return requestClient.post<{
    action: string;
    queue?: string;
    task_id?: string;
  }>(`/media/lifecycle/${encodeURIComponent(identityId)}/retry`, undefined, {
    params,
  });
}

export async function cancelLifecycleApi(
  identityId: string,
  params: { episode?: number; season?: number } = {},
) {
  return requestClient.post<{
    action: string;
    queue?: string;
    queue_cancelled: boolean;
    task_id?: string;
  }>(`/media/lifecycle/${encodeURIComponent(identityId)}/cancel`, undefined, {
    params,
  });
}

export async function identifyLifecycleApi(
  identityId: string,
  data: {
    episode?: number;
    external_id: string;
    poster?: string;
    provider: string;
    season?: number;
    title?: string;
    year?: string;
  },
) {
  return requestClient.post<{ action: string; updated: number }>(
    `/media/lifecycle/${encodeURIComponent(identityId)}/identify`,
    data,
  );
}

export async function pauseLifecycleApi(
  identityId: string,
  params: { episode?: number; season?: number } = {},
) {
  return requestClient.post<{ action: string; download_id: string }>(
    `/media/lifecycle/${encodeURIComponent(identityId)}/pause`,
    undefined,
    { params },
  );
}

export async function resumeLifecycleApi(
  identityId: string,
  params: { episode?: number; season?: number } = {},
) {
  return requestClient.post<{ action: string; download_id: string }>(
    `/media/lifecycle/${encodeURIComponent(identityId)}/resume`,
    undefined,
    { params },
  );
}
