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
  NSwitch,
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
</script>

<template>
  <NCard
    id="basic_service"
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
          icon="lucide:settings"
          class="size-4"
          style="color: hsl(var(--primary))"
        />
        <span class="font-semibold" style="color: hsl(var(--card-foreground))"
          >服务</span
        >
      </div>
    </template>
    <NForm label-placement="top">
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="订阅RSS周期(秒)">
            <NInput
              :value="config['pt.pt_check_interval']"
              placeholder="留空关闭RSS订阅"
              @update:value="
                (v) => emit('updateConfig', 'pt.pt_check_interval', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="订阅搜索周期(小时)">
            <NInput
              :value="config['pt.search_rss_interval']"
              placeholder="留空关闭订阅定时搜索"
              @update:value="
                (v) => emit('updateConfig', 'pt.search_rss_interval', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="媒体库同步周期(小时)">
            <NInput
              :value="config['media.mediasync_interval']"
              placeholder="留空关闭媒体库同步"
              @update:value="
                (v) => emit('updateConfig', 'media.mediasync_interval', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="目录同步监控间隔(秒)">
            <NInput
              :value="config['media.sync_transfer_interval']"
              placeholder="本地60，远程/网盘300+"
              @update:value="
                (v) => emit('updateConfig', 'media.sync_transfer_interval', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="站点数据刷新时间">
            <NInput
              :value="config['pt.ptrefresh_date_cron']"
              placeholder="留空关闭自动刷新"
              @update:value="
                (v) => emit('updateConfig', 'pt.ptrefresh_date_cron', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="远程搜索自动择优下载">
            <NSwitch
              :value="config['pt.search_auto']"
              @update:value="(v) => emit('updateConfig', 'pt.search_auto', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="远程下载不完整自动订阅">
            <NSwitch
              :value="config['pt.search_no_result_rss']"
              @update:value="
                (v) => emit('updateConfig', 'pt.search_no_result_rss', v)
              "
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
