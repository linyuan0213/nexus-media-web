import type { FreeTag, LabelType, ResourceItem } from '../types';

export function useResourceHelpers() {
  function getFreeTag(item: ResourceItem): FreeTag | null {
    const up = item.uploadvolumefactor ?? 1;
    const down = item.downloadvolumefactor ?? 1;
    if (down === 0 && up === 2)
      return { label: '2X免费', type: 'warning' as const };
    if (down === 0) return { label: '免费', type: 'success' as const };
    return null;
  }

  function parseLabels(labels?: string | string[]): string[] {
    if (!labels) return [];
    if (Array.isArray(labels)) return labels;
    return labels.split('|').filter(Boolean);
  }

  function getLabelType(label: string): LabelType {
    const lower = label.toLowerCase();
    if (/国语|中字|粤语|双语|中英|英文|简繁|繁体|简体|字幕|sub/.test(lower))
      return 'lang';
    if (/禁转|禁止|禁|exclusive/.test(lower)) return 'danger';
    if (/官组|官方|官|official/.test(lower)) return 'primary';
    if (/(?:^|\b)dv\b|dovi|dolby[.\s]vision|杜比视界/.test(lower))
      return 'dolby';
    if (/hdr10\+|hdr10|hdr/.test(lower)) return 'hdr';
    if (/sdr|画质|4k|2160p|1080p|720p|hevc|x264|x265|avc|vp9/.test(lower))
      return 'quality';
    if (
      /杜比|dolby|atmos|truehd|dts|flac|aac|ac3|eac3|mp3|opus|audio/.test(lower)
    )
      return 'audio';
    if (
      /web-dl|blu-ray|bdrip|brrip|dvdrip|hdtv|tvrip|转制|压制|remux|webrip/.test(
        lower,
      )
    )
      return 'source';
    if (/去广告|纯净版|完整版|未删减|导演剪辑|加长版|uncut|unrated/.test(lower))
      return 'edition';
    return 'default';
  }

  function getLabelClass(label: string): string {
    const type = getLabelType(label);
    const map: Record<LabelType, string> = {
      audio: 'resource-tag-audio',
      danger: 'resource-tag-danger',
      default: 'resource-tag-default',
      dolby: 'resource-tag-dolby',
      edition: 'resource-tag-edition',
      hdr: 'resource-tag-hdr',
      lang: 'resource-tag-lang',
      primary: 'resource-tag-primary',
      quality: 'resource-tag-quality',
      source: 'resource-tag-source',
    };
    return map[type];
  }

  function formatSize(size?: number): string {
    if (size == null || size <= 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let val = size;
    let idx = 0;
    while (val >= 1024 && idx < units.length - 1) {
      val /= 1024;
      idx++;
    }
    return `${val.toFixed(1)} ${units[idx]}`;
  }

  function formatDate(date?: string): string {
    if (!date) return '-';
    return date;
  }

  return {
    formatDate,
    formatSize,
    getFreeTag,
    getLabelClass,
    getLabelType,
    parseLabels,
  };
}
