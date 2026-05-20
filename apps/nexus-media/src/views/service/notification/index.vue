<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSpin,
  NSelect,
  NCheckbox,
  useMessage,
  NTooltip,
  NGrid,
  NGridItem,
  NSwitch,
  NBadge,
} from 'naive-ui';
import { IconifyIcon } from '@vben/icons';

import {
  getMessageClientApi,
  getMessageClientConfigApi,
  getMessageClientDefaultTemplatesApi,
  updateMessageClientApi,
  deleteMessageClientApi,
  testMessageClientApi,
  sendCustomMessageApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

interface MessageClient {
  id: number;
  name: string;
  type: string;
  enabled: number;
  interactive: number;
  config: Record<string, any>;
  switchs: string[];
  templates?: Record<string, any>;
}

interface ChannelConf {
  name: string;
  icon_url?: string;
  search_type?: string;
  max_length?: number;
  config: Record<string, any>;
}

const message = useMessage();
const clients = ref<Record<string, MessageClient>>({});
const channels = ref<Record<string, ChannelConf>>({});
const switchs = ref<Record<string, { name: string }>>({});
const loading = ref(false);
const editModalShow = ref(false);
const customModalShow = ref(false);
const editingClient = ref<Partial<MessageClient>>({});
const editingType = ref('');
const editingConfig = ref<Record<string, any>>({});
const editingSwitchs = ref<string[]>([]);
const editingTemplateMap = ref<Record<string, { title: string; text: string }>>({});
const defaultTemplates = ref<Record<string, { title: string; text: string }>>({});
function channelIcon(type?: string): string {
  return type ? `/static/img/message/${type}.png` : '';
}

const testLoading = ref(false);
const deleteConfirmShow = ref(false);

const customTitle = ref('');
const customText = ref('');
const customImage = ref('');
const customClients = ref<string[]>([]);

const clientList = computed(() => Object.values(clients.value));
const enabledClients = computed(() => clientList.value.filter((c) => c.enabled === 1));

const switchCategories = [
  { key: 'download', label: '下载', color: 'bg-blue-500' },
  { key: 'transfer', label: '入库', color: 'bg-orange-500' },
  { key: 'rss', label: '订阅', color: 'bg-indigo-500' },
  { key: 'site', label: '站点', color: 'bg-purple-500' },
  { key: 'brush', label: '刷流', color: 'bg-pink-500' },
  { key: 'ptrefresh', label: '统计', color: 'bg-teal-500' },
  { key: 'auto_remove', label: '删种', color: 'bg-green-500' },
  { key: 'mediaserver', label: '媒体', color: 'bg-sky-500' },
  { key: 'custom', label: '插件', color: 'bg-gray-500' },
];

function getSwitchColorClass(swid: string): string {
  if (swid.includes('download')) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (swid.includes('transfer')) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (swid.includes('rss')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  if (swid.includes('site')) return 'bg-purple-100 text-purple-700 border-purple-200';
  if (swid.includes('brush')) return 'bg-pink-100 text-pink-700 border-pink-200';
  if (swid.includes('ptrefresh')) return 'bg-teal-100 text-teal-700 border-teal-200';
  if (swid.includes('torrent') || swid.includes('auto_remove')) return 'bg-green-100 text-green-700 border-green-200';
  if (swid.includes('mediaserver')) return 'bg-sky-100 text-sky-700 border-sky-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

async function fetchData() {
  loading.value = true;
  try {
    const [clientRes, configRes, templatesRes] = await Promise.all([
      getMessageClientApi(),
      getMessageClientConfigApi(),
      getMessageClientDefaultTemplatesApi(),
    ]);

    // AxiosResponse 中提取实际响应体
    const clientData = clientRes?.data ?? clientRes;
    const configData = configRes?.data ?? configRes;
    const templatesData = templatesRes?.data ?? templatesRes;

    // 处理客户端列表
    if (clientData?.code === 0 && clientData.data !== undefined) {
      clients.value = clientData.data || {};
    } else if (clientData && typeof clientData === 'object') {
      clients.value = clientData;
    }

    // 处理配置模板
    const cfg = configData?.code === 0 ? configData.data : configData;
    if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
      channels.value = cfg.channels || {};
      switchs.value = cfg.switchs || {};
    }

    // 处理默认模板
    const tpl = templatesData?.code === 0 ? templatesData.data : templatesData;
    if (tpl && typeof tpl === 'object' && !Array.isArray(tpl)) {
      defaultTemplates.value = tpl;
    }
  } catch (e: any) {
    console.error('fetchData error:', e);
    message.error(e?.message || '获取配置失败');
  } finally {
    loading.value = false;
  }
}

function initTemplateMap() {
  editingTemplateMap.value = {};
  for (const swid of Object.keys(switchs.value)) {
    editingTemplateMap.value[swid] = defaultTemplates.value[swid]
      ? { ...defaultTemplates.value[swid] }
      : { title: '', text: '' };
  }
}

function handleAdd() {
  editingClient.value = {
    id: 0,
    name: '',
    type: Object.keys(channels.value)[0] || '',
    enabled: 1,
    interactive: 0,
    switchs: [],
  };
  editingType.value = editingClient.value.type || '';
  editingConfig.value = {};
  editingSwitchs.value = [];
  initTemplateMap();
  editModalShow.value = true;
}

function handleEdit(row: MessageClient) {
  editingClient.value = { ...row };
  editingType.value = row.type;
  // 只加载 channels 中定义的 config 字段，避免多余的 interactive 等混入
  editingConfig.value = {};
  const conf = channels.value[row.type]?.config || {};
  for (const [key, field] of Object.entries(conf)) {
    editingConfig.value[key] = row.config?.[key] ?? (field.type === 'switch' ? 0 : '');
  }
  editingSwitchs.value = row.switchs || [];
  // 解析模板 JSON 到表单
  initTemplateMap();
  if (row.templates && typeof row.templates === 'object') {
    for (const [k, v] of Object.entries(row.templates)) {
      if (v && typeof v === 'object' && editingTemplateMap.value[k]) {
        editingTemplateMap.value[k] = {
          title: String(v.title || ''),
          text: String(v.text || ''),
        };
      }
    }
  }
  editModalShow.value = true;
}

function handleReset() {
  editingConfig.value = {};
  editingSwitchs.value = [];
  editingTemplateMap.value = {};
  message.success('已重置');
}

function toggleSwitch(swid: string) {
  if (editingSwitchs.value.includes(swid)) {
    editingSwitchs.value = editingSwitchs.value.filter((s) => s !== swid);
  } else {
    editingSwitchs.value = [...editingSwitchs.value, swid];
  }
}

function selectAllSwitchs() {
  editingSwitchs.value = [...new Set([...editingSwitchs.value, ...Object.keys(switchs.value)])];
}

function clearSwitchs() {
  editingSwitchs.value = [];
}

async function handleSave() {
  const data = editingClient.value;
  if (!data.name) {
    message.error('请输入名称');
    return;
  }
  // 自动组装模板 JSON
  const templates: Record<string, { title: string; text: string }> = {};
  for (const [k, v] of Object.entries(editingTemplateMap.value)) {
    if (v.title?.trim() || v.text?.trim()) {
      templates[k] = { title: v.title.trim(), text: v.text.trim() };
    }
  }
  try {
    await updateMessageClientApi({
      cid: data.id || undefined,
      name: data.name,
      type: editingType.value,
      config: JSON.stringify(editingConfig.value),
      switchs: JSON.stringify(editingSwitchs.value),
      interactive: data.interactive,
      enabled: data.enabled,
      templates: JSON.stringify(templates),
    });
    editModalShow.value = false;
    message.success('保存成功');
    await fetchData();
  } catch (e: any) {
    message.error(e?.message || '保存失败');
  }
}

function confirmDelete(row: MessageClient) {
  editingClient.value = { ...row };
  deleteConfirmShow.value = true;
}

async function handleDelete() {
  if (!editingClient.value.id) return;
  try {
    await deleteMessageClientApi(editingClient.value.id);
    deleteConfirmShow.value = false;
    editModalShow.value = false;
    message.success('删除成功');
    await fetchData();
  } catch (e: any) {
    message.error(e?.message || '删除失败');
  }
}

async function handleTest() {
  testLoading.value = true;
  try {
    await testMessageClientApi(editingType.value, JSON.stringify(editingConfig.value));
    message.success('测试成功');
  } catch (e: any) {
    message.error(e?.message || '测试失败');
  } finally {
    testLoading.value = false;
  }
}

function showCustomMessage() {
  customTitle.value = '';
  customText.value = '';
  customImage.value = '';
  customClients.value = [];
  customModalShow.value = true;
}

function toggleCustomClient(clientId: string, checked: boolean) {
  if (checked) {
    if (!customClients.value.includes(clientId)) {
      customClients.value = [...customClients.value, clientId];
    }
  } else {
    customClients.value = customClients.value.filter((id) => id !== clientId);
  }
}

function selectAllCustomClients() {
  customClients.value = enabledClients.value.map((c) => String(c.id));
}

function clearCustomClients() {
  customClients.value = [];
}

async function sendCustomMessage() {
  if (!customTitle.value) {
    message.error('请输入标题');
    return;
  }
  if (customClients.value.length === 0) {
    message.error('请选择消息服务');
    return;
  }
  try {
    await sendCustomMessageApi({
      title: customTitle.value,
      text: customText.value,
      image: customImage.value,
      message_clients: customClients.value,
    });
    customModalShow.value = false;
    message.success('消息已发送');
  } catch (e: any) {
    message.error(e?.message || '发送失败');
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader title="消息通知">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="handleAdd">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="w-4 h-4" />
            </template>
            新增消息通知
          </NButton>
          <NButton v-if="enabledClients.length" type="info" @click="showCustomMessage">
            <template #icon>
              <IconifyIcon icon="lucide:send" class="w-4 h-4" />
            </template>
            发送自定义消息
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="clientList.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <NCard
          v-for="item in clientList"
          :key="item.id"
          size="small"
          class="cursor-pointer hover:shadow-lg transition-all group"
          @click="handleEdit(item)"
        >
          <div class="flex items-start gap-3">
            <div class="relative w-12 h-12 rounded-xl flex-shrink-0 border overflow-hidden">
              <img
                :src="channels[item.type]?.icon_url || channelIcon(item.type)"
                class="absolute inset-0 z-10 w-full h-full object-contain"
                @error="($event.target as HTMLElement).style.display='none'"
              />
              <div class="w-full h-full flex items-center justify-center bg-muted">
                <IconifyIcon icon="lucide:message-square" class="size-5 text-muted-foreground" />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  :class="item.enabled === 1 ? 'bg-green-500' : 'bg-gray-400'"
                />
                <span class="font-medium truncate">{{ item.name }}</span>
              </div>
              <div class="text-xs text-gray-400 mt-0.5">
                {{ channels[item.type]?.name || item.type }}
              </div>
              <div v-if="channels[item.type]?.search_type && item.interactive === 1" class="mt-1">
                <NBadge value="交互" type="success" size="small" />
              </div>
              <div class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="swid in item.switchs"
                  :key="swid"
                  class="inline-block px-1.5 py-0.5 text-[10px] rounded border"
                  :class="getSwitchColorClass(swid)"
                >
                  {{ switchs[swid]?.name || swid }}
                </span>
              </div>
            </div>
            <NButton
              size="tiny"
              text
              class="opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="confirmDelete(item)"
            >
              <IconifyIcon icon="lucide:trash-2" class="w-4 h-4 text-red-500" />
            </NButton>
          </div>
        </NCard>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-20 text-gray-400">
        <IconifyIcon icon="lucide:bell-off" class="w-16 h-16 mb-4 opacity-50" />
        <div class="text-lg font-medium">没有通知渠道</div>
        <div class="text-sm mt-1">没有添加任何消息通知渠道，请点击上方按钮新增</div>
      </div>
    </NSpin>

    <!-- 新增/编辑弹窗 -->
    <NModal
      v-model:show="editModalShow"
      :title="editingClient.id ? '编辑消息通知' : '新增消息通知'"
      preset="card"
      class="w-[720px]"
    >
      <NForm label-placement="left" :label-width="120">
        <NGrid :cols="3" :x-gap="16">
          <NGridItem span="2">
            <NFormItem label="名称" required>
              <NInput v-model:value="editingClient.name" placeholder="别名" />
            </NFormItem>
          </NGridItem>
          <NGridItem span="1">
            <NFormItem label="状态" required>
              <NSelect
                v-model:value="editingClient.enabled"
                :options="[
                  { label: '启用', value: 1 },
                  { label: '停用', value: 0 },
                ]"
              />
            </NFormItem>
          </NGridItem>
          <NGridItem v-if="channels[editingType]?.search_type" span="1">
            <NFormItem label="交互" required>
              <NSelect
                v-model:value="editingClient.interactive"
                :options="[
                  { label: '是', value: 1 },
                  { label: '否', value: 0 },
                ]"
              />
            </NFormItem>
          </NGridItem>
        </NGrid>

        <!-- 类型选择卡片 -->
        <NFormItem label="类型" required>
          <div class="grid grid-cols-4 gap-3">
            <div
              v-for="(conf, key) in channels"
              :key="key"
              class="flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md"
              :class="editingType === key ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'"
              @click="editingType = key"
            >
              <div class="relative w-10 h-10 rounded-lg border overflow-hidden">
                <img
                  :src="conf.icon_url || channelIcon(key)"
                  class="absolute inset-0 z-10 w-full h-full object-contain"
                  @error="($event.target as HTMLElement).style.display='none'"
                />
                <div class="w-full h-full flex items-center justify-center bg-muted">
                  <IconifyIcon icon="lucide:message-square" class="size-4 text-muted-foreground" />
                </div>
              </div>
              <span class="text-xs font-medium">{{ conf.name }}</span>
            </div>
          </div>
        </NFormItem>

        <!-- 配置表单 -->
        <div v-for="(field, key) in channels[editingType]?.config" :key="key">
          <NFormItem :label="field.title">
            <template v-if="field.tooltip">
              <NTooltip trigger="hover">
                <template #trigger>
                  <NSwitch
                    v-if="field.type === 'switch'"
                    v-model:value="editingConfig[field.id]"
                    :checked-value="1"
                    :unchecked-value="0"
                  />
                  <NSelect
                    v-else-if="field.type === 'select'"
                    v-model:value="editingConfig[field.id]"
                    :options="Object.entries(field.options || {}).map(([k, v]) => ({ label: v as string, value: k }))"
                  />
                  <NInput
                    v-else-if="field.type === 'textarea'"
                    v-model:value="editingConfig[field.id]"
                    type="textarea"
                    :rows="4"
                    :placeholder="field.placeholder || ''"
                  />
                  <NInput
                    v-else
                    v-model:value="editingConfig[field.id]"
                    :placeholder="field.placeholder || ''"
                    :type="field.type === 'password' ? 'password' : 'text'"
                  />
                </template>
                {{ field.tooltip }}
              </NTooltip>
            </template>
            <template v-else>
              <NSwitch
                v-if="field.type === 'switch'"
                v-model:value="editingConfig[field.id]"
                :checked-value="1"
                :unchecked-value="0"
              />
              <NSelect
                v-else-if="field.type === 'select'"
                v-model:value="editingConfig[field.id]"
                :options="Object.entries(field.options || {}).map(([k, v]) => ({ label: v as string, value: k }))"
              />
              <NInput
                v-else-if="field.type === 'textarea'"
                v-model:value="editingConfig[field.id]"
                type="textarea"
                :rows="4"
                :placeholder="field.placeholder || ''"
              />
              <NInput
                v-else
                v-model:value="editingConfig[field.id]"
                :placeholder="field.placeholder || ''"
                :type="field.type === 'password' ? 'password' : 'text'"
              />
            </template>
          </NFormItem>
        </div>

        <!-- 推送设置 -->
        <NFormItem label="推送设置">
          <div class="flex flex-wrap gap-2 items-center">
            <NButton
              v-for="(sw, swid) in switchs"
              :key="swid"
              size="small"
              :type="editingSwitchs.includes(swid) ? 'primary' : 'default'"
              :ghost="!editingSwitchs.includes(swid)"
              @click="toggleSwitch(swid)"
            >
              {{ sw.name }}
            </NButton>
            <div class="flex gap-2 ml-auto">
              <NButton size="tiny" text type="primary" @click="selectAllSwitchs">
                全选
              </NButton>
              <NButton size="tiny" text type="primary" @click="clearSwitchs">
                清空
              </NButton>
            </div>
          </div>
        </NFormItem>

        <!-- 消息模板 -->
        <NFormItem label="消息模板">
          <div class="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            <div
              v-for="(sw, swid) in switchs"
              :key="swid"
              class="border rounded-lg p-3"
              :class="editingSwitchs.includes(swid) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 opacity-60'"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-sm">{{ sw.name }}</span>
                <span v-if="!editingSwitchs.includes(swid)" class="text-xs text-gray-400">未启用推送</span>
              </div>
              <div class="space-y-2">
                <NInput
                  v-model:value="editingTemplateMap[swid].title"
                  size="small"
                  placeholder="标题模板（可选）"
                  :disabled="!editingSwitchs.includes(swid)"
                />
                <NInput
                  v-model:value="editingTemplateMap[swid].text"
                  size="small"
                  type="textarea"
                  :rows="3"
                  placeholder="内容模板（可选）"
                  :disabled="!editingSwitchs.includes(swid)"
                />
              </div>
            </div>
          </div>
        </NFormItem>
      </NForm>

      <template #footer>
        <div class="flex justify-between items-center">
          <NSpace>
            <NButton :loading="testLoading" @click="handleTest">测试</NButton>
            <NButton @click="handleReset">重置</NButton>
          </NSpace>
          <NSpace>
            <NButton @click="editModalShow = false">取消</NButton>
            <NButton type="primary" @click="handleSave">保存</NButton>
          </NSpace>
        </div>
      </template>
    </NModal>

    <!-- 删除确认弹窗 -->
    <NModal v-model:show="deleteConfirmShow" preset="dialog" title="确认删除" type="warning">
      <div>确定要删除 "{{ editingClient.name }}" 吗？此操作不可恢复。</div>
      <template #action>
        <NSpace>
          <NButton @click="deleteConfirmShow = false">取消</NButton>
          <NButton type="error" @click="handleDelete">删除</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 发送自定义消息弹窗 -->
    <NModal v-model:show="customModalShow" title="发送自定义消息" preset="card" class="w-[600px]">
      <NForm label-placement="left" :label-width="100">
        <NFormItem label="标题" required>
          <NInput v-model:value="customTitle" placeholder="消息标题" />
        </NFormItem>
        <NFormItem label="图片">
          <NInput v-model:value="customImage" placeholder="图片URL（可选）" />
        </NFormItem>
        <NFormItem label="内容">
          <NInput v-model:value="customText" type="textarea" :rows="4" placeholder="消息内容（可选）" />
        </NFormItem>
        <NFormItem label="消息服务">
          <div class="flex flex-wrap gap-2 items-center">
            <NCheckbox
              v-for="client in enabledClients"
              :key="client.id"
              :checked="customClients.includes(String(client.id))"
              @update:checked="(v: boolean) => toggleCustomClient(String(client.id), v)"
            >
              {{ client.name }}
            </NCheckbox>
            <div class="flex gap-2 ml-auto">
              <NButton size="tiny" text type="primary" @click="selectAllCustomClients">
                全选
              </NButton>
              <NButton size="tiny" text type="primary" @click="clearCustomClients">
                清空
              </NButton>
            </div>
          </div>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="customModalShow = false">取消</NButton>
          <NButton type="primary" @click="sendCustomMessage">发送</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
