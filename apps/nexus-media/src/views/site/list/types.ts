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
}

export interface SiteSelectOption {
  label: string;
  value: string;
}
