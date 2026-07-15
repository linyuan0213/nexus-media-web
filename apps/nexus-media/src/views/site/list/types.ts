export interface SiteForm {
  id?: number;
  name: string;
  pri: string;
  signurl: string;
  cookie: string;
  api_key: string;
  bearer_token: string;
  rssurl: string;
  public: boolean;
  site_public: boolean;
  rss_enable: boolean;
  brush_enable: boolean;
  statistic_enable: boolean;
  parse: boolean;
  unread_msg_notify: boolean;
  chrome: boolean;
  proxy: boolean;
  subtitle: boolean;
  tag: boolean;
  ua: string;
  headers: string;
  rule: string;
  download_setting: string;
  rate_limit: string;
  rate_burst: string;
  search_enabled: boolean;
}

export interface SiteItem {
  id: number;
  name: string;
  pri?: number | string;
  signurl?: string;
  rssurl?: string;
  cookie?: string;
  api_key?: string;
  bearer_token?: string;
  headers?: string;
  note?: Record<string, any> | string;
  public?: boolean;
  rss_enable?: boolean;
  brush_enable?: boolean;
  statistic_enable?: boolean;
  parse?: boolean;
  unread_msg_notify?: boolean;
  chrome?: boolean;
  proxy?: boolean;
  subtitle?: boolean;
  tag?: boolean;
  rule?: string;
  download_setting?: string;
  rate_limit?: string;
  rate_burst?: string;
  /** 站点来源：builtin / jackett / prowlarr */
  source?: string;
  /** 是否为第三方索引器站点 */
  third_party?: boolean;
  /** 第三方站点是否启用 */
  enabled?: boolean;
  /** 站点默认设置 */
  default_settings?: Record<string, any>;
  /** 站点是否为公开/BT（来自引擎定义） */
  site_public?: boolean;
}

export interface SiteSelectOption {
  label: string;
  value: string;
}

export interface SiteDefinition {
  id: string;
  name: string;
  domain: string;
  type: string;
  public: boolean;
  domain_aliases: string[];
  encoding: string;
  detail_page_url: string;
}
