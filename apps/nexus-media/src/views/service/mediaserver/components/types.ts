export interface MediaServerInstance {
  id?: number;
  name: string;
  type: string;
  enabled: number;
  is_default: number;
  config: Record<string, any>;
}

export interface MediaServerSchema {
  name: string;
  icon_url?: string;
  config: Record<string, Record<string, any>>;
}
