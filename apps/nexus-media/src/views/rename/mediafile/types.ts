import type { DirListItem } from '#/api/modules/media';

export type FileItem = DirListItem;

export interface SidebarPath {
  name: string;
  path: string;
  type: string;
  backend_id?: string;
}

export interface TypeGroup {
  label: string;
  type: string;
  items: SidebarPath[];
}

export interface BackendGroup {
  backendId: string;
  backendName: string;
  dotColor: string;
  textColor: string;
  sections: TypeGroup[];
}

export type ViewMode = 'grid' | 'list';

export type SortKey = 'ctime' | 'mtime' | 'name' | 'size';

export type SortOrder = 'asc' | 'desc';

export type SearchScope = 'dir' | 'global';

export type FileActionKey =
  | 'copy'
  | 'delete'
  | 'download'
  | 'hardlink'
  | 'identify'
  | 'mkdir'
  | 'move'
  | 'rename'
  | 'scrap'
  | 'subtitle'
  | 'transfer'
  | 'upload';
