<script setup lang="ts">
import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NTag,
  NTooltip,
  useNotification,
} from 'naive-ui';

import type { FilterApi } from '#/api/modules/filter';
import {
  deleteFilterGroupApi,
  deleteFilterRuleApi,
  setDefaultFilterGroupApi,
  shareFilterGroupApi,
} from '#/api/modules/filter';

interface Props {
  group: FilterApi.FilterRuleGroup;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  refresh: [];
  addRule: [groupId: number];
  editRule: [groupId: number, rule: FilterApi.FilterRuleItem];
  share: [content: string];
  test: [groupName: string];
}>();

const notification = useNotification();
const expandedRuleId = ref<number | null>(null);

const isDefault = computed(() => props.group.default === 'Y');

function toggleRule(ruleId: number) {
  expandedRuleId.value = expandedRuleId.value === ruleId ? null : ruleId;
}

function getRuleSummary(rule: FilterApi.FilterRuleItem): string {
  const parts: string[] = [];
  if (rule.include?.length) parts.push(`包含 ${rule.include.length}`);
  if (rule.exclude?.length) parts.push(`排除 ${rule.exclude.length}`);
  if (rule.size) parts.push(`大小 ${rule.size}`);
  if (rule.free_text) parts.push(rule.free_text);
  return parts.join(' · ') || '无过滤条件';
}

async function handleDeleteGroup() {
  try {
    await deleteFilterGroupApi(props.group.id);
    notification.success({ content: '规则组已删除' });
    emit('refresh');
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  }
}

async function handleToggleDefault() {
  try {
    await setDefaultFilterGroupApi(props.group.id);
    notification.success({ content: isDefault.value ? '已取消默认' : '已设为默认' });
    emit('refresh');
  } catch (err: any) {
    notification.error({ content: '设置失败', description: err?.message || '' });
  }
}

async function handleShare() {
  try {
    const res: any = await shareFilterGroupApi(props.group.id);
    const content = res?.data || res || '';
    emit('share', String(content));
  } catch (err: any) {
    notification.error({ content: '分享失败', description: err?.message || '' });
  }
}

async function handleDeleteRule(ruleId: number, ruleName: string) {
  try {
    await deleteFilterRuleApi(ruleId);
    notification.success({ content: `规则「${ruleName}」已删除` });
    emit('refresh');
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  }
}

function handleTest() {
  emit('test', props.group.name);
}
</script>

<template>
  <div
    class="filter-group-card"
    :style="{
      borderTopWidth: isDefault ? '3px' : '1px',
      borderTopColor: isDefault ? 'hsl(var(--warning))' : 'hsl(var(--border))',
    }"
  >
    <!-- Header -->
    <div class="filter-group-header">
      <div class="flex items-start gap-2 min-w-0 flex-1">
        <div
          class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg mt-0.5"
          style="background: hsl(var(--muted))"
        >
          <IconifyIcon
            icon="lucide:shield"
            class="size-4"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
        <div class="min-w-0 flex-1">
          <h3
            class="truncate text-sm font-semibold"
            style="color: hsl(var(--card-foreground))"
            :title="group.name"
          >
            {{ group.name }}
          </h3>
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            <div
              v-if="isDefault"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
              style="background: hsl(var(--warning) / 0.1); color: hsl(var(--warning))"
            >
              <IconifyIcon icon="lucide:star" class="size-3" />
              默认
            </div>
            <div
              v-if="group.rules?.length"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
              style="background: hsl(var(--accent)); color: hsl(var(--accent-foreground))"
            >
              {{ group.rules.length }} 条规则
            </div>
          </div>
        </div>
      </div>
      <div class="filter-group-actions">
        <NTooltip>
          <template #trigger>
            <NButton text size="tiny" @click="handleTest">
              <IconifyIcon icon="lucide:activity" class="size-3.5" />
            </NButton>
          </template>
          测试规则
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton text size="tiny" @click="handleShare">
              <IconifyIcon icon="lucide:share-2" class="size-3.5" />
            </NButton>
          </template>
          分享规则组
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              text
              size="tiny"
              :style="{
                color: isDefault
                  ? 'hsl(var(--warning))'
                  : 'hsl(var(--muted-foreground))',
              }"
              @click="handleToggleDefault"
            >
              <IconifyIcon icon="lucide:star" class="size-3.5" />
            </NButton>
          </template>
          {{ isDefault ? '取消默认' : '设为默认' }}
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton text size="tiny" type="error" @click="handleDeleteGroup">
              <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
            </NButton>
          </template>
          删除规则组
        </NTooltip>
      </div>
    </div>

    <!-- Rules List -->
    <div v-if="group.rules?.length" class="rules-list">
      <div
        v-for="rule in group.rules"
        :key="rule.id"
        class="rule-row"
        :class="{ 'rule-row--expanded': expandedRuleId === rule.id }"
        @click="toggleRule(rule.id)"
      >
        <div class="rule-row-main">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span
              class="inline-flex items-center justify-center min-w-[1.375rem] h-[1.375rem] px-1 rounded text-[0.6875rem] font-bold flex-shrink-0"
              style="background: hsl(var(--primary)); color: hsl(var(--primary-foreground))"
            >
              {{ rule.pri }}
            </span>
            <span
              class="truncate text-[0.8125rem] font-medium min-w-0"
              style="color: hsl(var(--card-foreground))"
              :title="rule.name"
            >
              {{ rule.name }}
            </span>
          </div>
          <div class="rule-summary">
            <span
              class="rule-summary-text"
              style="color: hsl(var(--muted-foreground))"
            >
              {{ getRuleSummary(rule) }}
            </span>
            <IconifyIcon
              icon="lucide:chevron-down"
              class="size-3.5 flex-shrink-0"
              style="color: hsl(var(--muted-foreground))"
              :style="{
                transform: expandedRuleId === rule.id ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }"
            />
          </div>
          <div class="rule-actions">
            <NTooltip>
              <template #trigger>
                <NButton
                  text
                  size="tiny"
                  @click.stop="emit('editRule', group.id, rule)"
                >
                  <IconifyIcon icon="lucide:pencil" class="size-3.5" />
                </NButton>
              </template>
              编辑
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  text
                  size="tiny"
                  type="error"
                  @click.stop="handleDeleteRule(rule.id, rule.name)"
                >
                  <IconifyIcon icon="lucide:x" class="size-3.5" />
                </NButton>
              </template>
              删除
            </NTooltip>
          </div>
        </div>

        <!-- Expanded Detail -->
        <div v-if="expandedRuleId === rule.id" class="rule-detail">
          <div v-if="rule.include?.length" class="rule-detail-section">
            <span
              class="rule-detail-label"
              style="color: hsl(var(--success)); background: hsl(var(--success) / 0.12)"
            >
              包含
            </span>
            <div class="rule-detail-items">
              <code
                v-for="(inc, idx) in rule.include"
                :key="idx"
                class="rule-detail-code"
              >
                {{ inc }}
              </code>
            </div>
          </div>
          <div v-if="rule.exclude?.length" class="rule-detail-section">
            <span
              class="rule-detail-label"
              style="color: hsl(var(--destructive)); background: hsl(var(--destructive) / 0.12)"
            >
              排除
            </span>
            <div class="rule-detail-items">
              <code
                v-for="(exc, idx) in rule.exclude"
                :key="idx"
                class="rule-detail-code"
              >
                {{ exc }}
              </code>
            </div>
          </div>
          <div v-if="rule.size || rule.free_text" class="rule-detail-section">
            <span
              class="rule-detail-label"
              style="color: hsl(var(--warning)); background: hsl(var(--warning) / 0.12)"
            >
              限制
            </span>
            <div class="rule-detail-items">
              <NTag v-if="rule.size" size="tiny" type="warning">大小: {{ rule.size }}</NTag>
              <NTag v-if="rule.free_text" size="tiny" type="info">{{ rule.free_text }}</NTag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="rules-empty">
      <p class="text-sm" style="color: hsl(var(--muted-foreground))">
        暂无规则
      </p>
    </div>

    <!-- Footer -->
    <div
      class="flex items-center justify-center px-3 py-2 border-t"
      style="border-color: hsl(var(--border)); background: hsl(var(--accent))"
    >
      <NButton text size="small" type="primary" @click="emit('addRule', group.id)">
        <template #icon>
          <IconifyIcon icon="lucide:plus" class="size-3.5" />
        </template>
        添加规则
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.filter-group-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  overflow: hidden;
}
.filter-group-card:hover {
  box-shadow: 0 4px 12px hsl(var(--foreground) / 0.08);
  transform: translateY(-1px);
}

.filter-group-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
}

.filter-group-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}
.filter-group-card:hover .filter-group-actions {
  opacity: 1;
}

/* Rules list with scroll */
.rules-list {
  max-height: 320px;
  overflow-y: auto;
  padding: 0.5rem;
}
.rules-list::-webkit-scrollbar {
  width: 4px;
}
.rules-list::-webkit-scrollbar-thumb {
  background-color: hsl(var(--border));
  border-radius: 2px;
}

.rules-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

/* Rule row */
.rule-row {
  border-radius: calc(var(--radius) - 2px);
  transition: background-color 0.15s ease;
  cursor: pointer;
}
.rule-row:hover {
  background-color: hsl(var(--accent));
}
.rule-row--expanded {
  background-color: hsl(var(--muted));
}

.rule-row-main {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  padding-right: 2rem;
}

.rule-summary {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 0 1 auto;
  min-width: 0;
  margin-left: auto;
  padding-left: 0.5rem;
}

.rule-summary-text {
  font-size: 0.6875rem;
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-actions {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.15s ease;
  background: hsl(var(--accent));
  padding: 0 0.25rem;
  border-radius: calc(var(--radius) - 2px);
}
.rule-row:hover .rule-actions {
  opacity: 1;
}

/* Expanded detail */
.rule-detail {
  padding: 0.5rem 0.625rem 0.75rem 2.25rem;
  border-top: 1px dashed hsl(var(--border));
  margin: 0 0.5rem;
  animation: detailSlideIn 0.15s ease;
}

@keyframes detailSlideIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.rule-detail-section {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}
.rule-detail-section:last-child {
  margin-bottom: 0;
}

.rule-detail-label {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: calc(var(--radius) - 2px);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.rule-detail-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  flex: 1;
}

.rule-detail-code {
  font-size: 0.6875rem;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  color: hsl(var(--card-foreground));
  background-color: hsl(var(--muted));
  padding: 0.125rem 0.375rem;
  border-radius: calc(var(--radius) - 2px);
  word-break: break-all;
  line-height: 1.4;
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .rule-row-main {
    padding-right: 0.625rem;
  }
  .rule-summary-text {
    display: none;
  }
  .rule-actions {
    position: static;
    right: auto;
    top: auto;
    transform: none;
    opacity: 1;
    background: transparent;
    padding: 0;
  }
  .filter-group-actions {
    opacity: 1;
  }
}
</style>
