import type { ConfigMap, ConfigValue, SectionKey } from './settings';

import { computed, onUnmounted, ref } from 'vue';

import { useMessage } from 'naive-ui';

import { getAllSystemConfigApi, updateConfigApi } from '#/api';

import { getSectionFieldKeys, PAYLOAD_FIELD_KEYS, SECTIONS } from './settings';

type SnapshotEntry = [
  key: string,
  value: ConfigValue,
  state: 'missing' | 'undefined' | 'value',
];

interface NumericRule {
  label: string;
  max: number;
  min: number;
}

const SECRET_KEY_RE =
  /(password|secret|token|api[_-]?key|apikey|tmdbkey|ssl_cert|ssl_key|cookie)/i;

const NUMERIC_RULES: Record<string, NumericRule> = {
  'app.web_port': { label: 'WEB 服务端口', min: 1, max: 65_535 },
  'media.min_filesize': { label: '转移最小文件大小', min: 0, max: 1_000_000 },
  'agent.batch_size': { label: '批量识别大小', min: 1, max: 1000 },
  'queue.transfer_workers': { label: '转移队列并发', min: 1, max: 64 },
  'queue.sync_workers': { label: '目录同步队列并发', min: 1, max: 64 },
  'queue.scrape_workers': { label: '刮削队列并发', min: 1, max: 64 },
  'queue.lifecycle_reconcile_seconds': {
    label: '生命周期对账周期',
    min: 0,
    max: 604_800,
  },
  'subscribe.queue_interval': {
    label: '订阅队列搜索间隔',
    min: 1,
    max: 604_800,
  },
  'subscribe.rss_interval': {
    label: '订阅 RSS 轮询间隔',
    min: 0,
    max: 604_800,
  },
  'subscribe.search_interval': {
    label: '订阅主动搜索间隔',
    min: 1,
    max: 8760,
  },
  'subscribe.batch_limit': { label: '每轮订阅上限', min: 1, max: 1000 },
  'subscribe.batch_workers': { label: '订阅搜索并发数', min: 1, max: 32 },
  'subscribe.reconcile_interval': {
    label: '待转移订阅对账间隔',
    min: 1,
    max: 604_800,
  },
  'media.mediasync_interval': {
    label: '媒体库同步周期',
    min: 0,
    max: 8760,
  },
  'media.sync_transfer_interval': {
    label: '目录同步监控间隔',
    min: 1,
    max: 604_800,
  },
};

export function useBasicSettings() {
  const message = useMessage();
  const config = ref<ConfigMap>({});
  const loading = ref(false);
  const saving = ref<null | SectionKey>(null);
  const savedSection = ref<null | SectionKey>(null);
  const numericKeys = new Set<string>();
  const snapshots = ref<Partial<Record<SectionKey, string>>>({});
  let savedTimer: null | ReturnType<typeof setTimeout> = null;

  function snapshotSection(section: SectionKey): string {
    const entries: SnapshotEntry[] = getSectionFieldKeys(section, config.value)
      .sort()
      .map((key) => {
        const exists = Object.prototype.hasOwnProperty.call(config.value, key);
        const value = config.value[key];
        return [
          key,
          value === undefined ? null : value,
          !exists ? 'missing' : value === undefined ? 'undefined' : 'value',
        ];
      });
    return JSON.stringify(entries);
  }

  function captureSnapshot(section: SectionKey) {
    snapshots.value = {
      ...snapshots.value,
      [section]: snapshotSection(section),
    };
  }

  function captureAllSnapshots() {
    for (const section of SECTIONS) captureSnapshot(section.key);
  }

  function isSectionDirty(section: SectionKey): boolean {
    const snapshot = snapshots.value[section];
    return snapshot !== undefined && snapshotSection(section) !== snapshot;
  }

  const dirtySections = computed(() =>
    SECTIONS.map((section) => section.key).filter(isSectionDirty),
  );

  const fieldErrors = computed<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    for (const [key, rule] of Object.entries(NUMERIC_RULES)) {
      const raw = config.value[key];
      if (raw === '' || raw === null || raw === undefined) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        errors[key] = `${rule.label}须为整数`;
      } else if (value < rule.min || value > rule.max) {
        errors[key] = `请输入 ${rule.min}–${rule.max} 之间的整数`;
      }
    }
    return errors;
  });

  function hasSectionErrors(section: SectionKey): boolean {
    return getSectionFieldKeys(section, config.value).some((key) =>
      Boolean(fieldErrors.value[key]),
    );
  }

  function updateConfig(key: string, value: ConfigValue) {
    if (Object.is(config.value[key], value)) return;
    config.value = { ...config.value, [key]: value };
    if (savedSection.value) savedSection.value = null;
  }

  function resetSection(section: SectionKey) {
    const snapshot = snapshots.value[section];
    if (!snapshot) return;
    const entries = JSON.parse(snapshot) as SnapshotEntry[];
    const snapshotMap = new Map(entries.map((entry) => [entry[0], entry]));
    const keys = new Set([
      ...getSectionFieldKeys(section, config.value),
      ...entries.map((entry) => entry[0]),
    ]);
    const next = { ...config.value };
    for (const key of keys) {
      const entry = snapshotMap.get(key);
      if (!entry || entry[2] === 'missing') {
        delete next[key];
      } else if (entry[2] === 'undefined') {
        next[key] = undefined;
      } else {
        next[key] = entry[1];
      }
    }
    config.value = next;
    if (savedSection.value === section) savedSection.value = null;
    message.info('已恢复上次保存的内容');
  }

  async function fetchData() {
    loading.value = true;
    try {
      const res = await getAllSystemConfigApi();
      numericKeys.clear();
      if (res) {
        for (const key of Object.keys(res)) {
          if (typeof res[key] === 'number') {
            numericKeys.add(key);
            res[key] = String(res[key]);
          }
        }
      }
      config.value = res || {};
      captureAllSnapshots();
    } finally {
      loading.value = false;
    }
  }

  function normalizeValue(key: string, value: ConfigValue): ConfigValue {
    if (numericKeys.has(key) && typeof value === 'string') {
      return value.includes('.')
        ? Number.parseFloat(value)
        : Number.parseInt(value, 10);
    }
    return value;
  }

  function buildPayload(fields: string[]): ConfigMap {
    const data: ConfigMap = {};
    for (const field of fields) {
      const value = config.value[field];
      if (value === undefined) continue;
      if (value === '') {
        if (!SECRET_KEY_RE.test(field)) data[field] = '';
        continue;
      }
      data[field] = normalizeValue(field, value);
    }
    return data;
  }

  async function saveSection(section: SectionKey, data: ConfigMap) {
    if (hasSectionErrors(section)) {
      message.error('请先修正当前分区中的无效字段');
      return;
    }
    saving.value = section;
    try {
      await updateConfigApi(data);
      captureSnapshot(section);
      savedSection.value = section;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        savedSection.value = null;
      }, 3000);
      message.success('保存成功');
    } catch {
      message.error('保存失败，已保留当前修改');
    } finally {
      saving.value = null;
    }
  }

  function saveSystem() {
    return saveSection('system', buildPayload(PAYLOAD_FIELD_KEYS.system));
  }

  function saveLog() {
    return saveSection('log', buildPayload(PAYLOAD_FIELD_KEYS.log));
  }

  function saveMedia() {
    return saveSection('media', buildPayload(PAYLOAD_FIELD_KEYS.media));
  }

  function saveRename() {
    return saveSection('rename', buildPayload(PAYLOAD_FIELD_KEYS.rename));
  }

  function saveService() {
    return saveSection('service', buildPayload(PAYLOAD_FIELD_KEYS.service));
  }

  function saveLaboratory() {
    return saveSection(
      'laboratory',
      buildPayload(PAYLOAD_FIELD_KEYS.laboratory),
    );
  }

  function resolveAgentProvider(): string {
    const configured = String(
      config.value['agent.default_provider'] || '',
    ).trim();
    if (configured) return configured;
    for (const key of Object.keys(config.value)) {
      const match = key.match(/^agent\.providers\.([^.]+)\.model$/);
      if (match?.[1] && String(config.value[key] || '').trim()) return match[1];
    }
    return 'openai';
  }

  function saveAi() {
    const data: ConfigMap = {};
    const explicitProvider = String(
      config.value['agent.default_provider'] || '',
    ).trim();
    const provider = resolveAgentProvider();
    const model = String(
      config.value[`agent.providers.${provider}.model`] || '',
    ).trim();
    if (model) {
      data['agent.default_provider'] = provider;
    } else if (explicitProvider) {
      message.error(`请为 ${provider} 选择或填写模型`);
      return;
    }
    for (const key of Object.keys(config.value)) {
      if (!key.startsWith('agent.') || key === 'agent.test') continue;
      const value = config.value[key];
      if (value === undefined || value === '') continue;
      data[key] = normalizeValue(key, value);
    }
    return saveSection('agent', data);
  }

  onUnmounted(() => {
    if (savedTimer) clearTimeout(savedTimer);
  });

  return {
    config,
    dirtySections,
    fieldErrors,
    fetchData,
    hasSectionErrors,
    isSectionDirty,
    loading,
    resetSection,
    resolveAgentProvider,
    saveAi,
    saveLaboratory,
    saveLog,
    saveMedia,
    saveRename,
    saveService,
    saveSystem,
    savedSection,
    saving,
    updateConfig,
  };
}
