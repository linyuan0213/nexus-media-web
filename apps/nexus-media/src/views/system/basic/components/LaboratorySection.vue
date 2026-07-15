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
    id="basic_laboratory"
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
      <div>
        <div class="flex items-center gap-2">
          <IconifyIcon
            icon="lucide:flask-conical"
            class="size-4"
            style="color: hsl(var(--primary))"
          />
          <span class="font-semibold" style="color: hsl(var(--card-foreground))"
            >实验室</span
          >
        </div>
        <div class="mt-1 text-xs" style="color: hsl(var(--muted-foreground))">
          实验性功能、辅助识别与外部服务地址
        </div>
      </div>
    </template>
    <NForm label-placement="top">
      <NGrid cols="1 s:1 m:2 l:4" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="辅助识别">
            <NSwitch
              :value="config['laboratory.search_keyword']"
              @update:value="
                (v) => emit('updateConfig', 'laboratory.search_keyword', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="WEB增强识别">
            <NSwitch
              :value="config['laboratory.search_tmdbweb']"
              @update:value="
                (v) => emit('updateConfig', 'laboratory.search_tmdbweb', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="TMDB缓存过期策略">
            <NSwitch
              :value="config['laboratory.tmdb_cache_expire']"
              @update:value="
                (v) => emit('updateConfig', 'laboratory.tmdb_cache_expire', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="默认搜索豆瓣资源">
            <NSwitch
              :value="config['laboratory.use_douban_titles']"
              @update:value="
                (v) => emit('updateConfig', 'laboratory.use_douban_titles', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="多语言搜索">
            <NSwitch
              :value="config['laboratory.search_multi_language']"
              @update:value="
                (v) =>
                  emit('updateConfig', 'laboratory.search_multi_language', v)
              "
            />
          </NFormItem>
        </NGridItem>
      </NGrid>

      <div
        class="mt-4 mb-2 text-sm font-semibold"
        style="color: hsl(var(--card-foreground))"
      >
        外部服务
      </div>
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem span="1">
          <div class="flex flex-col gap-4">
            <NFormItem label="启用验证码识别服务器" class="mb-0">
              <NSwitch
                :value="config['laboratory.ocr_enabled']"
                @update:value="
                  (v) => emit('updateConfig', 'laboratory.ocr_enabled', v)
                "
              />
            </NFormItem>
            <NFormItem label="验证码识别服务器" class="mb-0">
              <NInput
                :value="config['laboratory.ocr_server_host']"
                placeholder="http://127.0.0.1:9300"
                :disabled="!config['laboratory.ocr_enabled']"
                @update:value="
                  (v) => emit('updateConfig', 'laboratory.ocr_server_host', v)
                "
              />
            </NFormItem>
          </div>
        </NGridItem>
        <NGridItem span="1">
          <div class="flex flex-col gap-4">
            <NFormItem label="启用网页自动化" class="mb-0">
              <NSwitch
                :value="config['laboratory.chrome_enabled']"
                @update:value="
                  (v) => emit('updateConfig', 'laboratory.chrome_enabled', v)
                "
              />
            </NFormItem>
            <NFormItem label="网页自动化服务器" class="mb-0">
              <NInput
                :value="config['laboratory.chrome_server_host']"
                placeholder="http://127.0.0.1:9850"
                :disabled="!config['laboratory.chrome_enabled']"
                @update:value="
                  (v) =>
                    emit('updateConfig', 'laboratory.chrome_server_host', v)
                "
              />
            </NFormItem>
          </div>
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
