/**
 * 过滤规则 API
 * 对应后端: /api/filter/*
 */
import { requestClient } from '#/api/request';

export namespace FilterApi {
  export interface FilterRuleItem {
    id: number;
    name: string;
    pri: number;
    include?: string[];
    exclude?: string[];
    size?: string;
    free_text?: string;
  }

  export interface FilterRuleGroup {
    id: number;
    name: string;
    default?: string;
    rules?: FilterRuleItem[];
  }

  export interface FilterRule {
    id: number;
    name: string;
    type: string;
    content: string;
    status: number;
  }
}

/** 获取过滤规则列表 */
export async function getFilterRulesApi() {
  return requestClient.post<FilterApi.FilterRule[]>('/api/filter/rules', {});
}

/** 获取过滤规则组（后端统一返回在 /api/filter/rules 中） */
export async function getFilterGroupsApi() {
  return requestClient.post<{
    initRules: FilterApi.FilterRuleGroup[];
    ruleGroups: FilterApi.FilterRuleGroup[];
  }>('/api/filter/rules');
}

/** 保存过滤规则 */
export async function saveFilterRuleApi(data: Partial<FilterApi.FilterRule>) {
  return requestClient.post('/api/filter/rules/save', data);
}

/** 删除过滤规则 */
export async function deleteFilterRuleApi(id: number | string) {
  return requestClient.post('/api/filter/rules/delete', { id });
}

/** 新增过滤规则组 */
export async function addFilterGroupApi(data: {
  default?: string;
  name: string;
}) {
  return requestClient.post('/api/filter/groups/add', data);
}

/** 删除过滤规则组 */
export async function deleteFilterGroupApi(id: number | string) {
  return requestClient.post('/api/filter/groups/delete', { id });
}

/** 新增/编辑过滤规则 */
export async function addFilterRuleApi(data: {
  group_id?: number;
  rule_exclude?: string;
  rule_free?: string;
  rule_id?: number;
  rule_include?: string;
  rule_name?: string;
  rule_pri?: string;
  rule_sizelimit?: string;
}) {
  return requestClient.post('/api/filter/rules/add', data);
}

/** 设置默认过滤规则组 */
export async function setDefaultFilterGroupApi(id: number | string) {
  return requestClient.post('/api/filter/groups/default', { id });
}

/** 分享过滤规则组 */
export async function shareFilterGroupApi(id: number | string) {
  return requestClient.post<string>('/api/filter/groups/share', { id });
}

/** 导入过滤规则组 */
export async function importFilterGroupApi(content: string) {
  return requestClient.post('/api/filter/groups/import', { content });
}

/** 恢复过滤规则组 */
export async function restoreFilterGroupApi(data: {
  groupids?: number[];
  init_rulegroups?: any[];
}) {
  return requestClient.post('/api/filter/groups/restore', data);
}

/** 测试过滤规则 */
export async function testFilterRuleApi(data: {
  rulegroup?: string;
  size?: string;
  subtitle?: string;
  title: string;
}) {
  return requestClient.post<{
    flag: boolean;
    order: number;
    text: string;
  }>('/api/filter/rules/test', data);
}

/** 获取规则详情 */
export async function getFilterRuleDetailApi(
  groupid?: number,
  ruleid?: number,
) {
  return requestClient.post('/api/filter/rules/detail', { groupid, ruleid });
}
