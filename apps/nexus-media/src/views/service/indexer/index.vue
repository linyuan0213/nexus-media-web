<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import {
  NButton,
  NCard,
  NCheckbox,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  NSpin,
  useMessage,
} from 'naive-ui';

import {
  getIndexersConfigApi,
  getIndexerStatisticsApi,
  saveIndexerConfigApi,
  testIndexerConfigApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

interface IndexerConf {
  name: string;
  icon_url?: string;
  test_command?: string;
  config?: Record<string, any>;
}

function indexerIcon(type: string): string {
  return `/static/img/indexer/${type}.png`;
}

const message = useMessage();
const indexers = ref<Record<string, IndexerConf>>({});
const builtinIndexers = ref<{ id: string; name: string; public: boolean }[]>(
  [],
);
const searchIndexer = ref('builtin');
const selectedSites = ref<string[]>([]);
const loading = ref(false);
const testLoading = ref<Record<string, boolean>>({});
const editModalShow = ref(false);
const editingType = ref('');
const editingConfig = ref<Record<string, any>>({});
const statsModal = ref(false);
const statsData = ref<any[]>([]);
const statsDataset = ref<any[]>([]);
const chartRef = ref<any>(null);
const { renderEcharts } = useEcharts(chartRef);

const indexerList = computed(() =>
  Object.entries(indexers.value).map(([type, conf]) => ({ type, ...conf })),
);
const privateIndexers = computed(() =>
  builtinIndexers.value.filter((i) => !i.public),
);
const publicIndexers = computed(() =>
  builtinIndexers.value.filter((i) => i.public),
);

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getIndexersConfigApi();
    const data = res.data ?? res;
    if (data.indexer_conf) {
      indexers.value = data.indexer_conf;
    }
    if (data.indexers) {
      builtinIndexers.value = data.indexers;
    }
    if (data.search_indexer) {
      searchIndexer.value = data.search_indexer;
    }
    if (data.indexer_sites) {
      selectedSites.value = data.indexer_sites;
    }
    if (data.indexer_config) {
      // 预填充外部索引器配置
      for (const [type, conf] of Object.entries(
        data.indexer_config as Record<string, any>,
      )) {
        if (indexers.value[type]) {
          indexers.value[type] = { ...indexers.value[type], ...conf };
        }
      }
    }
  } catch {
    message.error('获取索引器配置失败');
  } finally {
    loading.value = false;
  }
}

function openModal(type: string) {
  editingType.value = type;
  editingConfig.value = {};
  // 预填充已有配置
  const conf = indexers.value[type];
  if (conf?.config) {
    Object.entries(conf.config).forEach(([key, field]: [string, any]) => {
      editingConfig.value[field.id] = (conf as any)[key] || '';
    });
  }
  editModalShow.value = true;
}

async function handleSave() {
  const data: Record<string, any> = {
    type: editingType.value,
    test: false,
  };
  // 构造 key.value 格式的配置
  for (const [key, value] of Object.entries(editingConfig.value)) {
    data[key] = value;
  }
  await saveIndexerConfigApi(data);
  searchIndexer.value = editingType.value;
  editModalShow.value = false;
  message.success('保存成功');
  await fetchData();
}

async function handleTest(type: string) {
  testLoading.value[type] = true;
  try {
    const data: Record<string, any> = {
      type,
      test: true,
    };
    for (const [key, value] of Object.entries(editingConfig.value)) {
      data[key] = value;
    }
    await testIndexerConfigApi(data);
    message.success('测试成功');
  } catch (error: any) {
    message.error(error?.message || '测试失败');
  } finally {
    testLoading.value[type] = false;
  }
}

async function showStats() {
  try {
    const res = await getIndexerStatisticsApi();
    statsData.value = res.stats || [];
    statsDataset.value = res.dataset || [];
    statsModal.value = true;
    // 渲染南丁格尔玫瑰图
    if (statsData.value.length > 0) {
      setTimeout(() => {
        renderEcharts({
          tooltip: { trigger: 'item' },
          legend: { top: 'bottom' },
          series: [
            {
              name: '请求次数',
              type: 'pie',
              radius: [20, 100],
              center: ['50%', '50%'],
              roseType: 'area',
              itemStyle: { borderRadius: 5 },
              label: { show: false },
              labelLine: { show: false },
              data: statsData.value.map((item) => ({
                value: item.total || 0,
                name: item.name || '未知',
              })),
            },
          ],
        });
      }, 300);
    }
  } catch {
    message.error('获取统计失败');
  }
}

async function saveBuiltin() {
  await saveIndexerConfigApi({
    type: 'builtin',
    indexer_sites: selectedSites.value,
  });
  searchIndexer.value = 'builtin';
  editModalShow.value = false;
  message.success('保存成功');
  await fetchData();
}

onMounted(fetchData);
</script>

<template>
  <div class="p-4">
    <PageHeader title="索引器">
      <template #actions>
        <NButton type="primary" @click="showStats">
          <template #icon>
            <IconifyIcon icon="lucide:pie-chart" class="w-4 h-4" />
          </template>
          统计信息
        </NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div class="grid-normal-card">
        <NCard
          v-for="item in indexerList"
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
                :src="item.icon_url || indexerIcon(item.type)"
                class="absolute inset-0 z-10 w-full h-full object-contain"
                @error="($event.target as HTMLElement).style.display = 'none'"
              />
              <div
                class="w-full h-full flex items-center justify-center bg-muted"
              >
                <IconifyIcon
                  icon="lucide:search"
                  class="size-6 text-muted-foreground"
                />
              </div>
            </div>
            <div class="font-medium">{{ item.name }}</div>
            <div
              class="text-sm mt-1"
              style="color: hsl(var(--muted-foreground))"
            >
              <span
                v-if="searchIndexer === item.type"
                class="inline-flex items-center gap-1"
              >
                <span
                  class="w-2 h-2 rounded-full"
                  style="background-color: hsl(var(--success))"
                ></span>
                正在使用
              </span>
            </div>
          </div>
        </NCard>
      </div>
    </NSpin>

    <!-- 编辑模态框 -->
    <NModal
      v-model:show="editModalShow"
      :title="indexers[editingType]?.name || '内建索引器'"
      preset="card"
      :style="{ width: '600px', maxWidth: '92vw' }"
    >
      <div v-if="editingType === 'builtin'">
        <div class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium">私有站点</span>
            <NButton
              size="tiny"
              text
              @click="
                selectedSites = [
                  ...new Set([
                    ...selectedSites,
                    ...privateIndexers.map((i: any) => i.id),
                  ]),
                ]
              "
            >
              全选
            </NButton>
          </div>
          <NSpace>
            <NCheckbox
              v-for="site in privateIndexers"
              :key="site.id"
              :value="site.id"
              :checked="selectedSites.includes(site.id)"
              @update:checked="
                (v: boolean) => {
                  if (v) selectedSites.push(site.id);
                  else
                    selectedSites = selectedSites.filter((s) => s !== site.id);
                }
              "
            >
              {{ site.name }}
            </NCheckbox>
          </NSpace>
        </div>
        <div v-if="publicIndexers.length > 0" class="mb-4">
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium">公开站点</span>
            <NButton
              size="tiny"
              text
              @click="
                selectedSites = [
                  ...new Set([
                    ...selectedSites,
                    ...publicIndexers.map((i: any) => i.id),
                  ]),
                ]
              "
            >
              全选
            </NButton>
          </div>
          <NSpace>
            <NCheckbox
              v-for="site in publicIndexers"
              :key="site.id"
              :value="site.id"
              :checked="selectedSites.includes(site.id)"
              @update:checked="
                (v: boolean) => {
                  if (v) selectedSites.push(site.id);
                  else
                    selectedSites = selectedSites.filter((s) => s !== site.id);
                }
              "
            >
              {{ site.name }}
            </NCheckbox>
          </NSpace>
        </div>
      </div>
      <div v-else>
        <NForm label-placement="left" :label-width="140">
          <NFormItem
            v-for="(field, key) in indexers[editingType]?.config"
            :key="key"
            :label="field.title"
          >
            <NInput
              v-model:value="editingConfig[field.id]"
              :placeholder="field.placeholder"
              :type="field.type === 'password' ? 'password' : 'text'"
            />
          </NFormItem>
        </NForm>
      </div>
      <template #footer>
        <div class="flex justify-between items-center">
          <NButton
            v-if="editingType !== 'builtin'"
            :loading="testLoading[editingType]"
            @click="handleTest(editingType)"
          >
            测试
          </NButton>
          <span v-else></span>
          <NSpace>
            <NButton @click="editModalShow = false">取消</NButton>
            <NButton
              type="primary"
              @click="editingType === 'builtin' ? saveBuiltin() : handleSave()"
            >
              保存
            </NButton>
          </NSpace>
        </div>
      </template>
    </NModal>

    <!-- 统计模态框 -->
    <NModal
      v-model:show="statsModal"
      title="索引器统计"
      preset="card"
      :style="{ width: '600px', maxWidth: '92vw' }"
    >
      <div v-if="statsData.length > 0">
        <EchartsUI ref="chartRef" height="400px" />
      </div>
      <div
        v-else
        class="text-center py-8"
        style="color: hsl(var(--muted-foreground))"
      >
        暂无统计数据
      </div>
    </NModal>
  </div>
</template>
