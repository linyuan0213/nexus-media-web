<script setup lang="ts">
/* eslint-disable unicorn/explicit-length-check */
import type { FilterApi } from '#/api/modules/filter';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NTag, NTooltip, useNotification } from 'naive-ui';

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
  addRule: [groupId: number];
  editRule: [groupId: number, rule: FilterApi.FilterRuleItem];
  refresh: [];
  share: [content: string];
  test: [groupName: string];
}>();

const notification = useNotification();
const expandedRuleId = ref<null | number>(null);

const isDefault = computed(() => props.group.default === 'Y');

function toggleRule(ruleId: number) {
  expandedRuleId.value = expandedRuleId.value === ruleId ? null : ruleId;
}

function getRuleSummary(rule: FilterApi.FilterRuleItem): string {
  const parts: string[] = [];
  if (rule.include?.length) parts.push(`包含 ${rule.include.length}`);
  if (rule.exclude?.length) parts.push(`排除 ${rule.exclude.length}`);

  if (rule.size && Number(rule.size) > 0) parts.push(`大小 ${rule.size}`);
  if (rule.free_text) parts.push(rule.free_text);
  return parts.join(' · ') || '无过滤条件';
}

async function handleDeleteGroup() {
  try {
    await deleteFilterGroupApi(props.group.id);
    notification.success({ content: '规则组已删除' });
    emit('refresh');
  } catch (error: any) {
    notification.error({
      content: '删除失败',
      description: error?.message || '',
    });
  }
}

async function handleToggleDefault() {
  try {
    await setDefaultFilterGroupApi(props.group.id);
    notification.success({
      content: isDefault.value ? '已取消默认' : '已设为默认',
    });
    emit('refresh');
  } catch (error: any) {
    notification.error({
      content: '设置失败',
      description: error?.message || '',
    });
  }
}

async function handleShare() {
  try {
    const res: any = await shareFilterGroupApi(props.group.id);
    const content = res?.data || res || '';
    emit('share', String(content));
  } catch (error: any) {
    notification.error({
      content: '分享失败',
      description: error?.message || '',
    });
  }
}

async function handleDeleteRule(ruleId: number, ruleName: string) {
  try {
    await deleteFilterRuleApi(ruleId);
    notification.success({ content: `规则「${ruleName}」已删除` });
    emit('refresh');
  } catch (error: any) {
    notification.error({
      content: '删除失败',
      description: error?.message || '',
    });
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
              style="
                color: hsl(var(--warning));
                background: hsl(var(--warning) / 10%);
              "
            >
              <IconifyIcon icon="lucide:star" class="size-3" />
              默认
            </div>
            <div
              v-if="group.rules?.length"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
              style="
                color: hsl(var(--accent-foreground));
                background: hsl(var(--accent));
              "
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
              style="
                color: hsl(var(--primary-foreground));
                background: hsl(var(--primary));
              "
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
                transform:
                  expandedRuleId === rule.id
                    ? 'rotate(180deg)'
                    : 'rotate(0deg)',
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
              style="
                color: hsl(var(--success));
                background: hsl(var(--success) / 12%);
              "
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
              style="
                color: hsl(var(--destructive));
                background: hsl(var(--destructive) / 12%);
              "
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
          <div
            v-if="(rule.size && Number(rule.size) > 0) || rule.free_text"
            class="rule-detail-section"
          >
            <span
              class="rule-detail-label"
              style="
                color: hsl(var(--warning));
                background: hsl(var(--warning) / 12%);
              "
            >
              限制
            </span>
            <div class="rule-detail-items">
              <NTag
                v-if="rule.size && Number(rule.size) > 0"
                size="tiny"
                type="warning"
              >
                大小: {{ rule.size }}
              </NTag>
              <NTag v-if="rule.free_text" size="tiny" type="info">
                {{ rule.free_text }}
              </NTag>
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
      style="background: hsl(var(--accent)); border-color: hsl(var(--border))"
    >
      <NButton
        text
        size="small"
        type="primary"
        @click="emit('addRule', group.id)"
      >
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.filter-group-card:hover {
  box-shadow: 0 4px 12px hsl(var(--foreground) / 8%);
  transform: translateY(-1px);
}

.filter-group-header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
}

.filter-group-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.filter-group-card:hover .filter-group-actions {
  opacity: 1;
}

/* Rules list with scroll */
.rules-list {
  max-height: 320px;
  padding: 0.5rem;
  overflow-y: auto;
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
  cursor: pointer;
  border-radius: calc(var(--radius) - 2px);
  transition: background-color 0.15s ease;
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
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0.625rem;
  padding-right: 2rem;
}

.rule-summary {
  display: flex;
  flex: 0 1 auto;
  gap: 0.375rem;
  align-items: center;
  min-width: 0;
  padding-left: 0.5rem;
  margin-left: auto;
}

.rule-summary-text {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.6875rem;
  white-space: nowrap;
}

.rule-actions {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0 0.25rem;
  background: hsl(var(--accent));
  border-radius: calc(var(--radius) - 2px);
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 0.15s ease;
}

.rule-row:hover .rule-actions {
  opacity: 1;
}

/* Expanded detail */
.rule-detail {
  padding: 0.5rem 0.625rem 0.75rem 2.25rem;
  margin: 0 0.5rem;
  border-top: 1px dashed hsl(var(--border));
  animation: detail-slide-in 0.15s ease;
}

@keyframes detail-slide-in {
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
  gap: 0.5rem;
  align-items: flex-start;
  margin-bottom: 0.375rem;
}

.rule-detail-section:last-child {
  margin-bottom: 0;
}

.rule-detail-label {
  flex-shrink: 0;
  padding: 0.125rem 0.375rem;
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: calc(var(--radius) - 2px);
}

.rule-detail-items {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.rule-detail-code {
  padding: 0.125rem 0.375rem;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: hsl(var(--card-foreground));
  word-break: break-all;
  background-color: hsl(var(--muted));
  border-radius: calc(var(--radius) - 2px);
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
    top: auto;
    right: auto;
    padding: 0;
    background: transparent;
    opacity: 1;
    transform: none;
  }

  .filter-group-actions {
    opacity: 1;
  }
}
</style>
