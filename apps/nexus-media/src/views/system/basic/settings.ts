export type ConfigMap = Record<string, any>;
export type ConfigValue = ConfigMap[string];

export type SectionKey =
  | 'agent'
  | 'laboratory'
  | 'log'
  | 'media'
  | 'rename'
  | 'service'
  | 'system';

export interface SectionDefinition {
  description: string;
  group: string;
  icon: string;
  key: SectionKey;
  label: string;
  title: string;
}

export const SECTIONS: SectionDefinition[] = [
  {
    key: 'system',
    label: '运行环境',
    title: '运行环境',
    description: '管理 Web 服务、访问地址与网络连接，维护站点配置版本。',
    icon: 'lucide:server-cog',
    group: '基础与媒体',
  },
  {
    key: 'media',
    label: '媒体与识别',
    title: '媒体与识别',
    description: '配置元数据来源、识别策略以及媒体整理的基础规则。',
    icon: 'lucide:library-big',
    group: '基础与媒体',
  },
  {
    key: 'rename',
    label: '整理与重命名',
    title: '整理与重命名',
    description: '通过变量和固定文本构建电影、电视剧的统一命名格式。',
    icon: 'lucide:folder-pen',
    group: '基础与媒体',
  },
  {
    key: 'service',
    label: '自动化服务',
    title: '自动化服务',
    description: '安排订阅、同步与站点任务，并控制后台队列的处理节奏。',
    icon: 'lucide:workflow',
    group: '自动化与智能',
  },
  {
    key: 'agent',
    label: 'AI Agent',
    title: 'AI Agent',
    description: '配置对话模型、知识库、长程记忆与智能通知增强。',
    icon: 'lucide:bot',
    group: '自动化与智能',
  },
  {
    key: 'log',
    label: '日志与诊断',
    title: '日志与诊断',
    description: '控制日志输出、详细程度以及文件轮转和保留策略。',
    icon: 'lucide:scroll-text',
    group: '诊断与实验',
  },
  {
    key: 'laboratory',
    label: '实验室',
    title: '实验室',
    description: '启用辅助识别能力和外部自动化服务，功能可能持续调整。',
    icon: 'lucide:flask-conical',
    group: '诊断与实验',
  },
];

export const NAV_GROUPS = ['基础与媒体', '自动化与智能', '诊断与实验'];

export const SECTION_FIELD_KEYS: Record<SectionKey, string[]> = {
  system: [
    'app.web_port',
    'app.ssl_cert',
    'app.ssl_key',
    'app.proxies',
    'app.domain',
    'app.user_agent',
    'app.enable_image_proxy',
  ],
  media: [
    'app.rmt_tmdbkey',
    'app.tmdb_domain',
    'app.rmt_match_mode',
    'media.tmdb_language',
    'media.metadata_default_policy',
    'app.tmdb_image_url',
    'pt.download_order',
    'media.min_filesize',
    'media.media_default_path',
    'media.ignored_paths',
    'media.ignored_files',
    'media.filesize_cover',
    'media.nfo_poster',
    'media.episode_mapping_enabled',
  ],
  rename: ['media.movie_name_format', 'media.tv_name_format'],
  service: [
    'media.mediasync_interval',
    'media.sync_transfer_interval',
    'pt.ptrefresh_date_cron',
    'pt.search_auto',
    'pt.search_no_result_rss',
    'queue.transfer_workers',
    'queue.sync_workers',
    'queue.scrape_workers',
    'queue.lifecycle_reconcile_seconds',
    'subscribe.queue_interval',
    'subscribe.rss_interval',
    'subscribe.search_interval',
    'subscribe.batch_limit',
    'subscribe.batch_workers',
    'subscribe.site_search_concurrency',
    'subscribe.site_search_timeout',
    'subscribe.reconcile_interval',
  ],
  agent: [],
  log: [
    'log.type',
    'log.path',
    'log.level',
    'log.format',
    'log.rotation',
    'log.retention',
  ],
  laboratory: [
    'laboratory.search_keyword',
    'laboratory.search_tmdbweb',
    'laboratory.search_multi_language',
    'laboratory.ocr_enabled',
    'laboratory.ocr_server_host',
    'laboratory.chrome_enabled',
    'laboratory.chrome_server_host',
    'laboratory.chrome_admin_token',
  ],
};

export const PAYLOAD_FIELD_KEYS = SECTION_FIELD_KEYS;

export function getSectionFieldKeys(
  section: SectionKey,
  config: ConfigMap,
): string[] {
  if (section === 'agent') {
    return Object.keys(config).filter(
      (key) => key.startsWith('agent.') && key !== 'agent.test',
    );
  }
  return SECTION_FIELD_KEYS[section];
}
