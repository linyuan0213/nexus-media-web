import type { FileItem } from './types';

const VIDEO_EXTS = new Set([
  'avi',
  'flv',
  'm4v',
  'mkv',
  'mov',
  'mp4',
  'ts',
  'webm',
  'wmv',
]);
const AUDIO_EXTS = new Set(['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav']);
const IMAGE_EXTS = new Set(['bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const SUBTITLE_EXTS = new Set(['ass', 'srt', 'ssa', 'sub', 'vtt']);
const META_EXTS = new Set(['json', 'nfo', 'xml']);

export function getFileIcon(item: FileItem): string {
  if (item.is_dir) return 'lucide:folder';
  const ext = (item.ext || '').toLowerCase();
  if (VIDEO_EXTS.has(ext)) return 'lucide:film';
  if (AUDIO_EXTS.has(ext)) return 'lucide:music';
  if (IMAGE_EXTS.has(ext)) return 'lucide:image';
  if (SUBTITLE_EXTS.has(ext)) return 'lucide:subtitles';
  if (META_EXTS.has(ext)) return 'lucide:file-code';
  return 'lucide:file';
}

export function getFileIconColor(item: FileItem): string {
  if (item.is_dir) return 'hsl(var(--warning))';
  const ext = (item.ext || '').toLowerCase();
  if (VIDEO_EXTS.has(ext)) return 'hsl(var(--primary))';
  if (AUDIO_EXTS.has(ext)) return 'hsl(var(--success))';
  if (IMAGE_EXTS.has(ext)) return 'hsl(var(--warning))';
  if (SUBTITLE_EXTS.has(ext)) return 'hsl(var(--destructive))';
  return 'hsl(var(--muted-foreground))';
}

export function getLibraryIcon(type: string): string {
  const map: Record<string, string> = {
    movie: 'lucide:film',
    tv: 'lucide:tv',
    anime: 'lucide:sparkles',
    sync: 'lucide:refresh-cw',
    sync_dest: 'lucide:folder-output',
    download: 'lucide:download',
  };
  return map[type] || 'lucide:folder-open';
}

export function getLibraryColor(type: string): string {
  const map: Record<string, string> = {
    movie: 'hsl(var(--primary))',
    tv: 'hsl(var(--success))',
    anime: 'hsl(var(--warning))',
    sync: 'hsl(var(--primary))',
    sync_dest: 'hsl(var(--warning))',
    download: 'hsl(var(--success))',
  };
  return map[type] || 'hsl(var(--muted-foreground))';
}

export function formatSize(bytes?: null | number): string {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatTime(ts?: null | number): string {
  if (ts == null) return '-';
  try {
    return new Date(ts * 1000).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

export function parentDir(path: string): string {
  const norm = path.replaceAll('\\', '/');
  const idx = norm.lastIndexOf('/');
  return idx > 0 ? norm.slice(0, idx) : '/';
}
