<script lang="ts" setup>
import { NForm, NFormItem, NGrid, NGridItem, NInput, NSwitch } from 'naive-ui';

import SettingsGroup from './SettingsGroup.vue';
import SettingsSwitch from './SettingsSwitch.vue';

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
      title="识别增强"
      description="TMDB 识别失败后的补充识别策略。"
      icon="lucide:scan-text"
    >
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
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
    </SettingsGroup>

    <SettingsGroup
      title="验证码识别"
      description="连接外部 OCR 服务处理登录验证码。"
      icon="lucide:scan-line"
    >
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="12" :y-gap="8" responsive="screen">
        <NGridItem span="1">
          <SettingsSwitch
            label="启用验证码识别服务器"
            description="登录遇到验证码时，自动调用 OCR 服务识别。"
            :value="config['laboratory.ocr_enabled']"
            @update="(v) => emit('updateConfig', 'laboratory.ocr_enabled', v)"
          />
        </NGridItem>
        <NGridItem span="1">
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
        </NGridItem>
      </NGrid>
    </SettingsGroup>

    <SettingsGroup
      title="网页自动化"
      description="连接 nexus-chrome 处理需要浏览器渲染的站点。"
      icon="lucide:mouse-pointer-click"
    >
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="12" :y-gap="8" responsive="screen">
        <NGridItem>
          <SettingsSwitch
            label="启用网页自动化"
            description="站点访问与抓取需要浏览器渲染时，调用 nexus-chrome。"
            :value="config['laboratory.chrome_enabled']"
            @update="
              (v) => emit('updateConfig', 'laboratory.chrome_enabled', v)
            "
          />
        </NGridItem>
        <NGridItem>
          <NFormItem label="网页自动化服务器" class="mb-0">
            <NInput
              :value="config['laboratory.chrome_server_host']"
              placeholder="http://127.0.0.1:9850"
              :disabled="!config['laboratory.chrome_enabled']"
              @update:value="
                (v) => emit('updateConfig', 'laboratory.chrome_server_host', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1 s:1 m:2 l:2">
          <NFormItem label="访问凭证（API Key）" class="mb-0">
            <NInput
              :value="config['laboratory.chrome_admin_token']"
              type="password"
              show-password-on="click"
              placeholder="nexus-chrome 启用 AUTH_PASSWORD 时必填（API Key）"
              :disabled="!config['laboratory.chrome_enabled']"
              @update:value="
                (v) => emit('updateConfig', 'laboratory.chrome_admin_token', v)
              "
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </SettingsGroup>
  </NForm>
</template>
