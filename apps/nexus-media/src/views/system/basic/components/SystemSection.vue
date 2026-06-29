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
    id="basic_system"
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
            icon="lucide:monitor"
            class="size-4"
            style="color: hsl(var(--primary))"
          />
          <span class="font-semibold" style="color: hsl(var(--card-foreground))"
            >系统</span
          >
        </div>
        <div class="mt-1 text-xs" style="color: hsl(var(--muted-foreground))">
          WEB服务端口、HTTPS证书、代理等基础运行配置
        </div>
      </div>
    </template>
    <NForm label-placement="top">
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
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
          <NFormItem label="外网访问地址">
            <NInput
              :value="config['app.domain']"
              placeholder="http://IP:PORT"
              @update:value="(v) => emit('updateConfig', 'app.domain', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1 s:1 m:2 l:2">
          <NFormItem label="User-Agent">
            <NInput
              :value="config['app.user_agent']"
              placeholder="Mozilla/5.0 ..."
              @update:value="(v) => emit('updateConfig', 'app.user_agent', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="启用图片代理">
            <NSwitch
              :value="config['app.enable_image_proxy']"
              @update:value="
                (v) => emit('updateConfig', 'app.enable_image_proxy', v)
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
