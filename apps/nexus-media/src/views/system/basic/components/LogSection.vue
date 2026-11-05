<script lang="ts" setup>
import { NForm, NFormItem, NGrid, NGridItem, NInput, NSelect } from 'naive-ui';

import SettingsGroup from './SettingsGroup.vue';

interface Props {
  config: Record<string, any>;
}

defineProps<Props>();

const emit = defineEmits<{
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

const logRotations = [
  { label: '1 MB', value: '1 MB' },
  { label: '5 MB', value: '5 MB' },
  { label: '10 MB', value: '10 MB' },
  { label: '20 MB', value: '20 MB' },
  { label: '50 MB', value: '50 MB' },
  { label: '100 MB', value: '100 MB' },
];

const logRetentions = [
  { label: '1 天', value: '1 days' },
  { label: '3 天', value: '3 days' },
  { label: '5 天', value: '5 days' },
  { label: '7 天', value: '7 days' },
  { label: '14 天', value: '14 days' },
  { label: '30 天', value: '30 days' },
];
</script>

<template>
  <NForm label-placement="top">
    <SettingsGroup
      title="输出目标"
      description="日志写往控制台还是文件，以及文件位置。"
      icon="lucide:file-text"
    >
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="12" :y-gap="8" responsive="screen">
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
      </NGrid>
    </SettingsGroup>

    <SettingsGroup
      title="格式与级别"
      description="选择日志格式和详细程度。"
      icon="lucide:sliders-horizontal"
    >
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="12" :y-gap="8" responsive="screen">
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
    </SettingsGroup>

    <SettingsGroup
      title="轮转与保留"
      description="控制单个日志文件大小和历史保留时间。"
      icon="lucide:archive"
    >
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="12" :y-gap="8" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="日志轮转大小">
            <NSelect
              :value="config['log.rotation'] || '5 MB'"
              :options="logRotations"
              @update:value="(v) => emit('updateConfig', 'log.rotation', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="日志保留天数">
            <NSelect
              :value="config['log.retention'] || '5 days'"
              :options="logRetentions"
              @update:value="(v) => emit('updateConfig', 'log.retention', v)"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </SettingsGroup>
  </NForm>
</template>
