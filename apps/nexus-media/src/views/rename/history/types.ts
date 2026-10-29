import type {
  HistoryCapabilities,
  HistoryFileState,
  TransferHistoryItem,
} from '#/api/modules/media';

import { getContentProfileLabel } from '#/plugin-framework';

export type HistoryItem = TransferHistoryItem;
export type FileTarget = 'library' | 'source';

export interface FileStateMeta {
  label: string;
  tone: 'danger' | 'muted' | 'success' | 'warning';
}

const TYPE_LABELS: Record<string, string> = {
  anime: '动漫',
  movie: '电影',
  tv: '电视剧',
  动漫: '动漫',
  电影: '电影',
  电视剧: '电视剧',
};

const MODE_LABELS: Record<string, string> = {
  copy: '复制',
  link: '硬链接',
  minio: 'Minio 移动',
  miniocopy: 'Minio 复制',
  move: '移动',
  rclone: 'Rclone 移动',
  rclonecopy: 'Rclone 复制',
  softlink: '软链接',
};

const FILE_STATE_META: Record<HistoryFileState, FileStateMeta> = {
  deleted: { label: '已删除', tone: 'muted' },
  missing: { label: '文件缺失', tone: 'danger' },
  present: { label: '存在', tone: 'success' },
  unknown: { label: '未检测', tone: 'warning' },
};

export function contentProfileLabel(profile?: null | string): string {
  if (!profile) return '';
  return getContentProfileLabel(String(profile)) || String(profile);
}

export function isCustomProfile(profile?: null | string): boolean {
  return Boolean(profile) && !['anime', 'default'].includes(String(profile));
}

export function typeLabel(type?: string): string {
  if (!type) return '未知';
  return TYPE_LABELS[type] || type;
}

export function modeLabel(item: HistoryItem): string {
  const mode = item.RMT_MODE || item.MODE || '';
  return MODE_LABELS[mode] || mode || '-';
}

export function fileStateMeta(state?: HistoryFileState): FileStateMeta {
  return FILE_STATE_META[state || 'unknown'] || FILE_STATE_META.unknown;
}

export function defaultCapabilities(item: HistoryItem): HistoryCapabilities {
  const sourceState = item.SOURCE_STATE || 'unknown';
  const destState = item.DEST_STATE || 'unknown';
  const sourceActionable =
    Boolean(item.SOURCE_PATH && item.SOURCE_FILENAME) &&
    !['deleted', 'missing'].includes(sourceState);
  const destActionable =
    Boolean(item.DEST_PATH) && !['deleted', 'missing'].includes(destState);
  return {
    delete_library: destActionable,
    delete_record: true,
    delete_source: sourceActionable,
    manual_identify: sourceActionable,
    reidentify: sourceActionable,
  };
}

export function capabilitiesOf(item: HistoryItem): HistoryCapabilities {
  return item.CAPABILITIES || defaultCapabilities(item);
}

export function joinPath(dir?: string, filename?: string): string {
  if (!dir && !filename) return '';
  return [dir, filename].filter(Boolean).join('/').replaceAll(/\/+/g, '/');
}

export function formatDate(value?: null | string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatShortDate(value?: null | string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}

export function statusText(item: HistoryItem): string {
  if (item.DEST_STATE === 'deleted') return '媒体库文件已删除';
  if (item.SOURCE_STATE === 'deleted') return '源文件已删除';
  if (item.SOURCE_STATE === 'missing') return '源文件缺失';
  return '已转移';
}

export function statusTone(
  item: HistoryItem,
): 'danger' | 'muted' | 'success' | 'warning' {
  if (item.DEST_STATE === 'deleted' || item.SOURCE_STATE === 'deleted') {
    return 'muted';
  }
  if (item.SOURCE_STATE === 'missing') return 'danger';
  if (!item.DEST_STATE || item.DEST_STATE === 'unknown') return 'warning';
  return 'success';
}
