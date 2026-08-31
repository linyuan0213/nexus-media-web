import type { BrushApi } from '#/api/modules/brush';

/** 解析刷流规则内容字段（兼容对象或 JSON 字符串） */
export function parseBrushRuleObj(val: any): Record<string, any> {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

/** 计算刷流规则实际类型：type='all' 的旧规则按内容推断 */
export function brushRuleActualType(rule: BrushApi.BrushRule): string {
  const raw = rule.type || 'all';
  if (raw !== 'all') return raw;
  const rss = parseBrushRuleObj(rule.rss_rule);
  const remove = parseBrushRuleObj(rule.remove_rule);
  const stop = parseBrushRuleObj(rule.stop_rule);
  if (rss && Object.keys(rss).length > 0) return 'rss';
  if (remove && Object.keys(remove).length > 0) return 'remove';
  if (stop && Object.keys(stop).length > 0) return 'stop';
  return 'rss';
}
