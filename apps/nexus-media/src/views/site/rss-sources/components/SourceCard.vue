<script lang="ts" setup>
import type { CustomRssSource } from '#/api/modules/subscription';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NSwitch, NTag } from 'naive-ui';

const props = defineProps<{
  source: CustomRssSource;
  testing: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  edit: [];
  test: [];
  toggle: [enabled: boolean];
}>();

const status = computed(() => {
  if (!props.source.enabled)
    return { label: '已停用', type: 'default' as const };
  if (props.source.last_error)
    return { label: '需要检查', type: 'error' as const };
  if (!props.source.last_fetch_at)
    return { label: '等待测试', type: 'warning' as const };
  return { label: '运行正常', type: 'success' as const };
});

const lastSuccess = computed(() => {
  if (!props.source.last_success_at) return '尚未成功抓取';
  return new Date(props.source.last_success_at).toLocaleString();
});

const errorText = computed(() => {
  const error = props.source.last_error || '';
  if (/connection reset|errno 104/i.test(error))
    return '连接被远端重置，请检查网络或代理设置';
  if (/timeout|timed out/i.test(error))
    return '连接超时，请检查网络和 RSS 地址';
  return error;
});
</script>

<template>
  <NCard
    size="small"
    class="source-card"
    :class="{ 'is-disabled': !source.enabled }"
  >
    <div class="source-layout">
      <div class="source-identity">
        <div class="source-icon">
          <IconifyIcon icon="lucide:rss" class="h-5 w-5" />
        </div>
        <div class="source-title-wrap">
          <div class="source-title" :title="source.name">{{ source.name }}</div>
          <div class="source-domain" :title="source.url">
            <IconifyIcon icon="lucide:globe-2" class="h-3.5 w-3.5" />
            {{ source.domain }}
          </div>
        </div>
      </div>

      <div class="source-health">
        <div class="health-tags">
          <NTag :type="status.type" size="small" :bordered="false">
            <template #icon>
              <span class="status-dot"></span>
            </template>
            {{ status.label }}
          </NTag>
          <NTag v-if="source.proxy" size="small" :bordered="false">代理</NTag>
        </div>
        <div class="health-time" :title="lastSuccess">{{ lastSuccess }}</div>
      </div>

      <div class="source-metric">
        <strong>{{ source.item_count }}</strong>
        <span>最近报文</span>
      </div>

      <div class="source-actions">
        <NSwitch
          :value="source.enabled"
          size="small"
          :aria-label="source.enabled ? '停用 RSS 源' : '启用 RSS 源'"
          @update:value="emit('toggle', $event)"
        />
        <NButton
          size="small"
          secondary
          type="primary"
          :loading="testing"
          @click="emit('test')"
        >
          <template #icon><IconifyIcon icon="lucide:scan-text" /></template>
          测试与预览
        </NButton>
        <NButton size="small" quaternary @click="emit('edit')">
          <template #icon><IconifyIcon icon="lucide:pencil" /></template>
          编辑
        </NButton>
        <NButton
          size="small"
          quaternary
          type="error"
          aria-label="删除 RSS 源"
          @click="emit('delete')"
        >
          <template #icon><IconifyIcon icon="lucide:trash-2" /></template>
        </NButton>
      </div>
    </div>

    <div v-if="source.last_error" class="source-error">
      <IconifyIcon icon="lucide:circle-alert" class="h-4 w-4 shrink-0" />
      <span>{{ errorText }}</span>
      <button type="button" @click="emit('test')">重新检查</button>
    </div>
  </NCard>
</template>

<style scoped>
.source-card {
  overflow: hidden;
  background: hsl(var(--card));
  transition: border-color 0.2s ease;
}

.source-card:hover {
  border-color: hsl(var(--primary) / 35%);
}

.source-card.is-disabled {
  opacity: 0.68;
}

.source-layout {
  display: grid;
  grid-template-columns: minmax(240px, 1.3fr) minmax(180px, 0.9fr) 90px auto;
  gap: 24px;
  align-items: center;
}

.source-identity,
.health-tags,
.source-actions {
  display: flex;
  align-items: center;
}

.source-identity {
  gap: 14px;
  min-width: 0;
}

.source-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border: 1px solid hsl(var(--primary) / 10%);
  border-radius: 12px;
}

.source-title-wrap {
  min-width: 0;
}

.source-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.source-domain {
  display: flex;
  gap: 5px;
  align-items: center;
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.health-tags {
  gap: 6px;
}

.status-dot {
  width: 5px;
  height: 5px;
  background: currentcolor;
  border-radius: 50%;
}

.health-time {
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.source-metric {
  display: flex;
  flex-direction: column;
  padding-left: 20px;
  border-left: 1px solid hsl(var(--border));
}

.source-metric strong {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
}

.source-metric span {
  margin-top: 4px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.source-actions {
  gap: 8px;
  justify-content: flex-end;
}

.source-error {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 9px 12px;
  margin-top: 14px;
  font-size: 12px;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 5%);
  border-radius: 8px;
}

.source-error button {
  flex-shrink: 0;
  padding: 0;
  margin-left: auto;
  font-size: 12px;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  background: none;
  border: 0;
}

@media (max-width: 1180px) {
  .source-layout {
    grid-template-columns: minmax(220px, 1.2fr) minmax(170px, 0.8fr) auto;
  }

  .source-metric {
    display: none;
  }
}

@media (max-width: 760px) {
  .source-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .source-metric {
    display: flex;
    padding-top: 12px;
    padding-left: 0;
    border-top: 1px solid hsl(var(--border));
    border-left: 0;
  }

  .source-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
