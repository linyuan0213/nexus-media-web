<script lang="ts" setup>
import { NForm, NFormItem, NGrid, NGridItem, NInput } from 'naive-ui';

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
      title="服务与访问"
      description="Web 服务端口与外网访问地址。"
      icon="lucide:server"
    >
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="12" :y-gap="8" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="WEB服务端口">
            <NInput
              :value="config['app.web_port']"
              placeholder="3000"
              @update:value="(v) => emit('updateConfig', 'app.web_port', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="外网访问地址">
            <NInput
              :value="config['app.domain']"
              placeholder="http://IP:PORT"
              @update:value="(v) => emit('updateConfig', 'app.domain', v)"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </SettingsGroup>

    <SettingsGroup
      title="HTTPS 证书"
      description="使用自己的证书启用 HTTPS；两项都填写后生效。"
      icon="lucide:lock-keyhole"
    >
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="12" :y-gap="8" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="HTTPS证书文件路径">
            <NInput
              :value="config['app.ssl_cert']"
              placeholder="pem格式证书路径"
              @update:value="(v) => emit('updateConfig', 'app.ssl_cert', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="HTTPS证书密钥文件路径">
            <NInput
              :value="config['app.ssl_key']"
              placeholder="密钥文件路径"
              @update:value="(v) => emit('updateConfig', 'app.ssl_key', v)"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </SettingsGroup>

    <SettingsGroup
      title="网络与请求"
      description="代理、请求标识以及远程图片访问方式。"
      icon="lucide:wifi"
    >
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="12" :y-gap="8" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="代理服务器">
            <NInput
              :value="config['app.proxies']"
              placeholder="127.0.0.1:7890 或 socks5://127.0.0.1:1080"
              @update:value="(v) => emit('updateConfig', 'app.proxies', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="User-Agent">
            <NInput
              :value="config['app.user_agent']"
              placeholder="Mozilla/5.0 ..."
              @update:value="(v) => emit('updateConfig', 'app.user_agent', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1 s:1 m:2 l:2">
          <SettingsSwitch
            label="启用图片代理"
            description="远程图片经服务端代理加载，避免海报被浏览器跨域拦截。"
            :value="config['app.enable_image_proxy']"
            @update="(v) => emit('updateConfig', 'app.enable_image_proxy', v)"
          />
        </NGridItem>
      </NGrid>
    </SettingsGroup>
  </NForm>
</template>
