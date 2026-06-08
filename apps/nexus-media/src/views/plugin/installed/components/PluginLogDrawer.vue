<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import { useNotification, NButton, NDrawer, NDrawerContent, NPopconfirm, NPagination, NSpin, NEmpty } from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import { getPluginLogsApi, clearPluginLogsApi } from '#/api/modules/plugin_framework';

const props = defineProps<{
  show: boolean;
  pluginId: string;
}>();

const emit = defineEmits(['update:show']);

const notification = useNotification();
const loading = ref(false);
const logs = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const visible = computed({
  get: () => props.show,
  set: (v) => emit('update:show', v),
});

async function fetchLogs() {
  if (!props.pluginId) return;
  loading.value = true;
  try {
    const res: any = await getPluginLogsApi(props.pluginId, page.value, pageSize.value);
    logs.value = res?.items || [];
    total.value = res?.total || 0;
  } catch (err: any) {
    notification.error({ content: '获取日志失败', description: err?.message || '' });
  } finally {
    loading.value = false;
  }
}

async function handleClear() {
  try {
    await clearPluginLogsApi(props.pluginId);
    notification.success({ content: '日志已清空' });
    logs.value = [];
    total.value = 0;
  } catch (err: any) {
    notification.error({ content: '清空失败', description: err?.message || '' });
  }
}

function getLevelColor(level: string) {
  switch (level?.toLowerCase()) {
    case 'error': return 'text-destructive';
    case 'warn': return 'text-warning';
    case 'info': return 'text-primary';
    default: return 'text-muted-foreground';
  }
}

watch(() => [props.show, props.pluginId], () => {
  if (props.show && props.pluginId) {
    page.value = 1;
    fetchLogs();
  }
});
</script>

<template>
  <NDrawer v-model:show="visible" :width="500" placement="right">
    <NDrawerContent :title="`插件日志`" closable
>
      <template #header>
        <NPopconfirm @positive-click="handleClear">
          <template #trigger>
            <NButton size="tiny" type="error">
              <IconifyIcon icon="lucide:trash-2" class="mr-1 h-3 w-3" />清空
            </NButton>
          </template>
          确认清空所有日志？
        </NPopconfirm>
      </template>

      <NSpin :show="loading">
        <div v-if="logs.length > 0" class="space-y-2">
          <div
            v-for="log in logs"
            :key="log.id"
            class="rounded border p-3 dark:border-border"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium" :class="getLevelColor(log.level)">
                {{ log.level }}
              </span>
              <span class="text-xs text-muted-foreground">{{ log.created_at }}</span>
            </div>
            <div class="mt-1 text-sm">{{ log.message }}</div>
          </div>

          <NPagination
            v-if="total > pageSize"
            v-model:page="page"
            :page-size="pageSize"
            :item-count="total"
            @update:page="fetchLogs"
          />
        </div>

        <NEmpty v-else description="暂无日志" />
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>


