<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NEmpty,
  NInput,
  NSelect,
  NSpin,
  NTag,
  useMessage,
} from 'naive-ui';

import {
  getAgentKbStatus,
  reindexAgentKb,
  searchAgentKb,
} from '#/api/modules/agent';

interface Citation {
  source: string;
  heading?: string;
  snippet: string;
  score?: number;
}

const NS_LABELS: Record<string, string> = {
  media_library: '媒体库',
  messages: '消息模板',
  faq: '文档 FAQ',
  operations: '运维文档',
};

const message = useMessage();
const loading = ref(true);
const rebuilding = ref(false);
const namespaces = ref<Record<string, number>>({});
const rebuildingNs = ref<null | string>(null);

const searchQuery = ref('');
const searchNs = ref<null | string>(null);
const searching = ref(false);
const citations = ref<Citation[]>([]);
const searched = ref(false);

async function loadStatus() {
  loading.value = true;
  try {
    const res = await getAgentKbStatus();
    namespaces.value = res?.namespaces ?? {};
  } catch (error: any) {
    message.error(error?.message || '获取知识库状态失败');
  } finally {
    loading.value = false;
  }
}

async function rebuildAll() {
  rebuilding.value = true;
  try {
    const res = await reindexAgentKb();
    namespaces.value = res?.indexed ?? {};
    message.success('知识库重建完成');
  } catch (error: any) {
    message.error(error?.message || '重建失败');
  } finally {
    rebuilding.value = false;
  }
}

async function rebuildNamespace(ns: string) {
  rebuildingNs.value = ns;
  try {
    const res = await reindexAgentKb(ns);
    namespaces.value = res?.indexed ?? {};
    message.success('重建完成');
  } catch (error: any) {
    message.error(error?.message || '重建失败');
  } finally {
    rebuildingNs.value = null;
  }
}

async function doSearch() {
  if (!searchQuery.value.trim()) return;
  searching.value = true;
  try {
    const res = await searchAgentKb(
      searchQuery.value.trim(),
      searchNs.value || undefined,
    );
    citations.value = res?.citations ?? [];
    searched.value = true;
  } catch (error: any) {
    message.error(error?.message || '检索失败');
  } finally {
    searching.value = false;
  }
}

onMounted(loadStatus);
</script>

<template>
  <div class="flex min-h-full flex-col gap-3 p-3 sm:p-4">
    <!-- 头部 -->
    <div
      class="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3"
      :style="{
        backgroundColor: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
      }"
    >
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:library-big"
          class="size-5"
          :style="{ color: 'hsl(var(--primary))' }"
        />
        <span
          class="text-sm font-semibold"
          :style="{ color: 'hsl(var(--foreground))' }"
        >
          知识库管理
        </span>
        <NTag size="small" round>RAG</NTag>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <NButton
          size="small"
          secondary
          :loading="rebuilding"
          @click="rebuildAll"
        >
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          全部重建
        </NButton>
      </div>
    </div>

    <!-- 命名空间状态 -->
    <NCard :bordered="true" size="small" title="命名空间索引">
      <template #header-extra>
        <NTag size="small" round :type="loading ? 'warning' : 'success'">
          {{
            loading ? '加载中' : `${Object.keys(namespaces).length} 个命名空间`
          }}
        </NTag>
      </template>
      <NSpin :show="loading">
        <div
          v-if="!loading && Object.keys(namespaces).length > 0"
          class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div
            v-for="(count, ns) in namespaces"
            :key="ns"
            class="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
            :style="{ borderColor: 'hsl(var(--border))' }"
          >
            <div class="min-w-0">
              <div
                class="truncate text-sm font-medium"
                :style="{ color: 'hsl(var(--foreground))' }"
              >
                {{ NS_LABELS[ns] || ns }}
              </div>
              <div
                class="text-xs"
                :style="{ color: 'hsl(var(--muted-foreground))' }"
              >
                {{ count }} 个分块
              </div>
            </div>
            <NButton
              size="tiny"
              secondary
              :loading="rebuildingNs === ns"
              @click="rebuildNamespace(ns)"
            >
              重建
            </NButton>
          </div>
        </div>
        <NEmpty
          v-else-if="!loading"
          description="Agent RAG 未启用或知识库为空"
        />
      </NSpin>
    </NCard>

    <!-- 检索调试 -->
    <NCard :bordered="true" size="small" title="检索调试">
      <div class="flex flex-col gap-2 sm:flex-row">
        <div class="min-w-0 flex-1">
          <NInput
            v-model:value="searchQuery"
            placeholder="输入问题，如：如何配置刷流任务"
            @keyup.enter="doSearch"
          />
        </div>
        <div class="sm:w-40">
          <NSelect
            v-model:value="searchNs"
            placeholder="全部命名空间"
            clearable
            :options="
              Object.keys(NS_LABELS).map((k) => ({
                label: NS_LABELS[k],
                value: k,
              }))
            "
          />
        </div>
        <NButton type="primary" :loading="searching" @click="doSearch">
          <template #icon>
            <IconifyIcon icon="lucide:search" class="size-4" />
          </template>
          检索
        </NButton>
      </div>

      <div v-if="searched" class="mt-3 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <span
            class="text-xs font-medium"
            :style="{ color: 'hsl(var(--muted-foreground))' }"
          >
            命中 {{ citations.length }} 条引用
          </span>
          <NTag v-if="citations.length === 0" size="small" type="warning" round>
            无命中
          </NTag>
        </div>
        <div
          v-for="(c, idx) in citations"
          :key="idx"
          class="flex flex-col gap-1.5 rounded-lg border px-3 py-2.5"
          :style="{
            borderColor: 'hsl(var(--border))',
            backgroundColor: 'hsl(var(--accent))',
          }"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-1.5">
              <span
                class="flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold"
                :style="{
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                }"
              >
                {{ idx + 1 }}
              </span>
              <span
                class="truncate text-xs font-medium"
                :style="{ color: 'hsl(var(--foreground))' }"
              >
                {{ c.source }}
              </span>
            </div>
            <NTag v-if="c.score !== undefined" size="tiny" round>
              相关度 {{ Number(c.score).toFixed(3) }}
            </NTag>
          </div>
          <div
            v-if="c.heading"
            class="text-[11px]"
            :style="{ color: 'hsl(var(--primary))' }"
          >
            {{ c.heading }}
          </div>
          <div
            class="whitespace-pre-wrap break-words text-xs leading-relaxed"
            :style="{ color: 'hsl(var(--muted-foreground))' }"
          >
            {{ c.snippet }}
          </div>
        </div>
      </div>
    </NCard>
  </div>
</template>
