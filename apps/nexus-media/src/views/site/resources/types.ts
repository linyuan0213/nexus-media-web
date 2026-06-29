export interface SiteItem {
  id: string;
  name: string;
}

export interface ResourceItem {
  id: string;
  indexer: string;
  title: string;
  description?: string;
  size?: number;
  seeders?: number;
  leechers?: number;
  pubdate?: string;
  labels?: string | string[];
  enclosure?: string;
  page_url?: string;
  uploadvolumefactor?: number;
  downloadvolumefactor?: number;
}

export interface FreeTag {
  label: string;
  type: 'success' | 'warning';
}

export type LabelType =
  | 'audio'
  | 'danger'
  | 'default'
  | 'edition'
  | 'lang'
  | 'primary'
  | 'quality'
  | 'source';
