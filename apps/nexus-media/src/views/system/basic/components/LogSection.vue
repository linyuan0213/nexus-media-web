<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NSelect,
} from 'naive-ui';

interface Props {
  config: Record<string, any>;
  saving?: boolean;
}

withDefaults(defineProps<Props>(), {
  saving: false,
});

const emit = defineEmits<{
  save: [];
  updateConfig: [key: string, value: any];
}>();

const logTypes = [
  { label: '控制台', value: 'console' },
  { label: '文件', value: 'file' },
];

const logFormats = [
  { label: '可读文本', value: 'text' },
  { label: 'JSON', value: 'json' },
];

const logLevels = [
  { label: 'INFO', value: 'info' },
  { label: 'DEBUG', value: 'debug' },
  { label: 'ERROR', value: 'error' },
];
</script>

<template>
  <NCard
    id="basic_log"
    size="small"
    class="mb-6 overflow-hidden"
    style="
      background: hsl(var(--card));
      border-color: hsl(var(--border));
      border-left-color: hsl(var(--primary));
      border-left-width: 4px;
    "
  >
    <template #header>
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:log-in"
          class="size-4"
          style="color: hsl(var(--primary))"
        />
        <span class="font-semibold" style="color: hsl(var(--card-foreground))"
          >日志</span
        >
      </div>
    </template>
    <NForm label-placement="top">
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="日志输出类型">
            <NSelect
              :value="config['log.type']"
              :options="logTypes"
              @update:value="(v) => emit('updateConfig', 'log.type', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="日志文件路径">
            <NInput
              :value="config['log.path']"
              placeholder="data/logs"
              @update:value="(v) => emit('updateConfig', 'log.path', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="日志格式">
            <NSelect
              :value="config['log.format']"
              :options="logFormats"
              @update:value="(v) => emit('updateConfig', 'log.format', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="日志级别">
            <NSelect
              :value="config['log.level']"
              :options="logLevels"
              @update:value="(v) => emit('updateConfig', 'log.level', v)"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </NForm>
    <template #footer>
      <div class="flex justify-end">
        <NButton
          type="primary"
          size="small"
          :loading="saving"
          @click="emit('save')"
        >
          保存
        </NButton>
      </div>
    </template>
  </NCard>
</template>
