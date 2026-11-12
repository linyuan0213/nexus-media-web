<script lang="ts" setup>
import { NForm, NFormItem, NGrid, NGridItem, NInput, NSwitch } from 'naive-ui';

import SettingsGroup from './SettingsGroup.vue';

interface Props {
  config: Record<string, any>;
}

defineProps<Props>();

const emit = defineEmits<{
  updateConfig: [key: string, value: any];
}>();
</script>

<template>
  <NForm label-placement="top">
    <SettingsGroup
      title="订阅调度"
      description="订阅队列、RSS 轮询与主动搜索的执行节奏。"
      icon="lucide:calendar-clock"
    >
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="订阅队列搜索间隔(秒)">
            <NInput
              :value="config['subscribe.queue_interval']"
              placeholder="默认 300"
              @update:value="
                (v) => emit('updateConfig', 'subscribe.queue_interval', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="订阅RSS轮询间隔(秒)">
            <NInput
              :value="config['subscribe.rss_interval']"
              placeholder="默认 600，0 表示关闭"
              @update:value="
                (v) => emit('updateConfig', 'subscribe.rss_interval', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="订阅主动搜索间隔(小时)">
            <NInput
              :value="config['subscribe.search_interval']"
              placeholder="默认 6"
              @update:value="
                (v) => emit('updateConfig', 'subscribe.search_interval', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="每轮订阅上限">
            <NInput
              :value="config['subscribe.batch_limit']"
              placeholder="默认 20"
              @update:value="
                (v) => emit('updateConfig', 'subscribe.batch_limit', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="订阅搜索并发数">
            <NInput
              :value="config['subscribe.batch_workers']"
              placeholder="默认 3；M-Team 5/min 建议 2"
              @update:value="
                (v) => emit('updateConfig', 'subscribe.batch_workers', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="站点搜索并发数">
            <NInput
              :value="config['subscribe.site_search_concurrency']"
              placeholder="默认 1；同一站点同时搜索数"
              @update:value="
                (v) =>
                  emit('updateConfig', 'subscribe.site_search_concurrency', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="站点搜索排队超时(秒)">
            <NInput
              :value="config['subscribe.site_search_timeout']"
              placeholder="默认 30；超时本轮延迟"
              @update:value="
                (v) => emit('updateConfig', 'subscribe.site_search_timeout', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="待转移订阅对账间隔(秒)">
            <NInput
              :value="config['subscribe.reconcile_interval']"
              placeholder="默认 900"
              @update:value="
                (v) => emit('updateConfig', 'subscribe.reconcile_interval', v)
              "
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </SettingsGroup>

    <SettingsGroup
      title="媒体同步与站点"
      description="媒体库、目录同步与站点数据的刷新周期。"
      icon="lucide:refresh-cw"
    >
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
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
      </NGrid>
    </SettingsGroup>

    <SettingsGroup
      title="下载与后台队列"
      description="远程下载行为和转移、同步、刮削的并发上限。"
      icon="lucide:workflow"
    >
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
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
        <NGridItem span="1">
          <NFormItem label="转移队列并发">
            <NInput
              :value="config['queue.transfer_workers']"
              placeholder="默认 2"
              @update:value="
                (v) => emit('updateConfig', 'queue.transfer_workers', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="目录同步队列并发">
            <NInput
              :value="config['queue.sync_workers']"
              placeholder="默认 2"
              @update:value="
                (v) => emit('updateConfig', 'queue.sync_workers', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="刮削队列并发">
            <NInput
              :value="config['queue.scrape_workers']"
              placeholder="默认 3"
              @update:value="
                (v) => emit('updateConfig', 'queue.scrape_workers', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="生命周期对账周期(秒)">
            <NInput
              :value="config['queue.lifecycle_reconcile_seconds']"
              placeholder="默认 300，0 关闭"
              @update:value="
                (v) =>
                  emit('updateConfig', 'queue.lifecycle_reconcile_seconds', v)
              "
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </SettingsGroup>
  </NForm>
</template>
