<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NEmpty, NInput, NPopconfirm, NSpin } from 'naive-ui';

export interface AgentSessionItem {
  preview: string;
  session_id: string;
  title?: string;
  token_usage?: number;
  updated_at?: string;
}

const props = defineProps<{
  sessions: AgentSessionItem[];
  currentSessionId: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  create: [];
  delete: [sessionId: string];
  rename: [sessionId: string, title: string];
  select: [sessionId: string];
}>();

const keyword = ref('');
const editingId = ref('');
const draftTitle = ref('');

function cleanText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sessionTitle(session: AgentSessionItem) {
  const text = cleanText(session.title || session.preview);
  if (!text) return '新对话';
  return text.length > 32 ? `${text.slice(0, 32)}…` : text;
}

function updatedAt(session: AgentSessionItem) {
  if (!session.updated_at) return '';
  const date = new Date(session.updated_at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupLabel(session: AgentSessionItem) {
  const date = session.updated_at ? new Date(session.updated_at) : null;
  if (!date || Number.isNaN(date.getTime())) return '更早';
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const value = date.getTime();
  if (value >= today) return '今天';
  if (value >= today - 86_400_000) return '昨天';
  if (value >= today - 7 * 86_400_000) return '最近 7 天';
  return '更早';
}

const groups = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  const filtered = props.sessions.filter((session) =>
    `${session.title || ''} ${session.preview}`.toLowerCase().includes(query),
  );
  const order = ['今天', '昨天', '最近 7 天', '更早'];
  return order
    .map((label) => ({
      label,
      items: filtered.filter((session) => groupLabel(session) === label),
    }))
    .filter((group) => group.items.length > 0);
});

function startRename(session: AgentSessionItem) {
  editingId.value = session.session_id;
  draftTitle.value = sessionTitle(session);
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(
      `[data-session-rename="${session.session_id}"] input`,
    );
    input?.focus();
    input?.select();
  });
}

function saveRename(session: AgentSessionItem) {
  const title = draftTitle.value.trim();
  if (title && title !== sessionTitle(session)) {
    emit('rename', session.session_id, title);
  }
  editingId.value = '';
}
</script>

<template>
  <aside class="session-sidebar">
    <div class="sidebar-heading">
      <span>对话</span>
      <NButton
        size="tiny"
        quaternary
        aria-label="新建对话"
        @click="emit('create')"
      >
        <template #icon>
          <IconifyIcon icon="lucide:plus" class="size-4" />
        </template>
      </NButton>
    </div>
    <div class="sidebar-search">
      <NInput
        v-model:value="keyword"
        size="small"
        clearable
        placeholder="搜索对话"
      >
        <template #prefix>
          <IconifyIcon icon="lucide:search" class="size-3.5" />
        </template>
      </NInput>
    </div>
    <NSpin :show="loading" size="small">
      <div class="session-list">
        <section
          v-for="group in groups"
          :key="group.label"
          class="session-group"
        >
          <div class="group-label">{{ group.label }}</div>
          <div
            v-for="session in group.items"
            :key="session.session_id"
            class="session-item"
            :class="{ active: session.session_id === currentSessionId }"
            @click="emit('select', session.session_id)"
          >
            <div class="session-main">
              <div
                v-if="editingId !== session.session_id"
                class="session-title"
              >
                {{ sessionTitle(session) }}
              </div>
              <NInput
                v-else
                v-model:value="draftTitle"
                size="tiny"
                :data-session-rename="session.session_id"
                maxlength="60"
                @click.stop
                @keyup.enter="saveRename(session)"
                @keyup.esc="editingId = ''"
                @blur="saveRename(session)"
              />
              <div class="session-preview">{{ updatedAt(session) }}</div>
            </div>
            <div
              v-if="editingId !== session.session_id"
              class="session-actions"
            >
              <NButton
                size="tiny"
                text
                class="session-action"
                aria-label="重命名对话"
                @click.stop="startRename(session)"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:pencil" class="size-3.5" />
                </template>
              </NButton>
              <NPopconfirm @positive-click="emit('delete', session.session_id)">
                <template #trigger>
                  <NButton
                    size="tiny"
                    text
                    class="session-action"
                    aria-label="删除对话"
                    @click.stop
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                    </template>
                  </NButton>
                </template>
                删除这段对话？
              </NPopconfirm>
            </div>
          </div>
        </section>
        <NEmpty
          v-if="!loading && groups.length === 0"
          :description="keyword ? '没有匹配的对话' : '暂无历史对话'"
          size="small"
        />
      </div>
    </NSpin>
  </aside>
</template>

<style scoped>
.session-sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 250px;
  height: 100%;
  overflow: hidden;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
}

.sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  font-size: 13px;
  font-weight: 600;
}

.sidebar-search {
  padding: 0 10px 8px;
}

.session-list {
  flex: 1;
  padding: 2px 6px 8px;
  overflow-y: auto;
}

.session-group + .session-group {
  margin-top: 8px;
}

.group-label {
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.04em;
}

.session-item {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 7px 8px;
  margin-bottom: 1px;
  cursor: pointer;
  border-radius: 7px;
}

.session-item:hover {
  background: hsl(var(--accent));
}

.session-item.active {
  background: var(--tblr-primary-light);
}

.session-main {
  flex: 1;
  min-width: 0;
}

.session-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.session-preview {
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.session-actions {
  display: flex;
  flex-shrink: 0;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.session-item:hover .session-actions,
.session-item.active .session-actions {
  opacity: 1;
}

.session-action {
  color: hsl(var(--muted-foreground));
}

@media (max-width: 768px) {
  .session-sidebar {
    width: 100%;
    border-right: 0;
  }

  .session-actions {
    opacity: 1;
  }
}
</style>
