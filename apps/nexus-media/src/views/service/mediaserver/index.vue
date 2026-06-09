<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSpin,
  NSwitch,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  getMediaServersConfigApi,
  saveMediaServerConfigApi,
  testMediaServerApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

interface MediaServerConf {
  name: string;
  icon_url?: string;
  config?: Record<string, any>;
}

function mediaserverIcon(type: string): string {
  return `/static/img/mediaserver/${type}.png`;
}

const message = useMessage();
const servers = ref<Record<string, MediaServerConf>>({});
const serverConfigs = ref<Record<string, any>>({});
const loading = ref(false);
const testLoading = ref<Record<string, boolean>>({});
const editModalShow = ref(false);
const editingType = ref('');
const editingConfig = ref<Record<string, any>>({});

const serverList = computed(() =>
  Object.entries(servers.value).map(([type, conf]) => ({ type, ...conf })),
);

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getMediaServersConfigApi();
    const data = res.data ?? res;
    if (data.mediaserver_conf) {
      servers.value = data.mediaserver_conf;
    }
    if (data.servers) {
      for (const [name, srv] of Object.entries(
        data.servers as Record<string, any>,
      )) {
        serverConfigs.value[name] = {
          ...srv.config,
          enabled: srv.enabled,
          is_default: srv.is_default,
        };
      }
    }
  } catch {
    message.error('获取媒体服务器配置失败');
  } finally {
    loading.value = false;
  }
}

function openModal(type: string) {
  editingType.value = type;
  editingConfig.value = {};
  const cfg = serverConfigs.value[type] || {};
  const conf = servers.value[type];
  if (conf?.config) {
    Object.entries(conf.config).forEach(([key, field]: [string, any]) => {
      editingConfig.value[field.id] =
        cfg[key] ?? (field.type === 'switch' ? 0 : '');
    });
  }
  editModalShow.value = true;
}

async function handleSave() {
  const data: Record<string, any> = {
    type: editingType.value,
    test: false,
  };
  for (const [key, value] of Object.entries(editingConfig.value)) {
    data[key] = value;
  }
  try {
    await saveMediaServerConfigApi(data);
    editModalShow.value = false;
    message.success('保存成功');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '保存失败');
  }
}

async function handleTest() {
  testLoading.value[editingType.value] = true;
  try {
    const data: Record<string, any> = {
      type: editingType.value,
      test: true,
    };
    for (const [key, value] of Object.entries(editingConfig.value)) {
      data[key] = value;
    }
    await testMediaServerApi(data);
    message.success('测试成功');
  } catch (error: any) {
    message.error(error?.message || '测试失败');
  } finally {
    testLoading.value[editingType.value] = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader title="媒体服务器" />

    <NSpin :show="loading">
      <div class="grid-normal-card">
        <NCard
          v-for="item in serverList"
          :key="item.type"
          size="small"
          class="cursor-pointer hover:shadow-lg transition-all"
          @click="openModal(item.type)"
        >
          <div class="text-center">
            <div
              class="relative w-16 h-16 mx-auto rounded-full mb-3 overflow-hidden"
            >
              <img
                :src="item.icon_url || mediaserverIcon(item.type)"
                class="absolute inset-0 z-10 w-full h-full object-contain"
                @error="($event.target as HTMLElement).style.display = 'none'"
              />
              <div
                class="w-full h-full flex items-center justify-center bg-muted"
              >
                <IconifyIcon
                  icon="lucide:server"
                  class="size-6 text-muted-foreground"
                />
              </div>
            </div>
            <div class="font-medium">{{ item.name }}</div>
            <div class="text-sm text-gray-400 mt-1">
              <span
                v-if="serverConfigs[item.type]?.enabled"
                class="inline-flex items-center gap-1"
              >
                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                已启用
              </span>
              <span
                v-if="serverConfigs[item.type]?.is_default"
                class="inline-flex items-center gap-1 ml-2"
              >
                <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                默认
              </span>
            </div>
          </div>
        </NCard>
      </div>
    </NSpin>

    <!-- 编辑模态框 -->
    <NModal
      v-model:show="editModalShow"
      :title="servers[editingType]?.name || '媒体服务器'"
      preset="card"
      :style="{ width: '600px', maxWidth: '92vw' }"
    >
      <NForm label-placement="left" :label-width="140">
        <div v-for="(field, key) in servers[editingType]?.config" :key="key">
          <NFormItem>
            <template #label>
              <span class="inline-flex items-center">
                {{ field.title }}
                <NTooltip v-if="field.tooltip" trigger="hover">
                  <template #trigger>
                    <IconifyIcon
                      icon="lucide:help-circle"
                      class="ml-1 size-4 cursor-help"
                      style="color: hsl(var(--muted-foreground))"
                    />
                  </template>
                  <div style="max-width: 320px; white-space: pre-wrap">
                    {{ field.tooltip }}
                  </div>
                </NTooltip>
              </span>
            </template>
            <NSwitch
              v-if="field.type === 'switch'"
              v-model:value="editingConfig[field.id]"
              :checked-value="1"
              :unchecked-value="0"
            />
            <NInput
              v-else
              v-model:value="editingConfig[field.id]"
              :placeholder="field.placeholder"
              :type="field.type === 'password' ? 'password' : 'text'"
            />
          </NFormItem>
        </div>
      </NForm>
      <template #footer>
        <div class="flex justify-between items-center">
          <NButton :loading="testLoading[editingType]" @click="handleTest">
            测试
          </NButton>
          <NSpace>
            <NButton @click="editModalShow = false">取消</NButton>
            <NButton type="primary" @click="handleSave">保存</NButton>
          </NSpace>
        </div>
      </template>
    </NModal>
  </div>
</template>
