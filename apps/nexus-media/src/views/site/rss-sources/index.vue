<script lang="ts" setup>
import { onMounted } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NEmpty,
  NInput,
  NRadioButton,
  NRadioGroup,
  NSpin,
} from 'naive-ui';

import PageHeader from '#/components/page/PageHeader.vue';

import FeedPreviewModal from './components/FeedPreviewModal.vue';
import SourceCard from './components/SourceCard.vue';
import SourceDeleteModal from './components/SourceDeleteModal.vue';
import SourceEditModal from './components/SourceEditModal.vue';
import SourceWorkflow from './components/SourceWorkflow.vue';
import { useCustomRssSources } from './useCustomRssSources';

const {
  clearFilters,
  confirmDelete,
  currentSource,
  deleteSource,
  deleteTarget,
  deleteVisible,
  deleting,
  editing,
  enabledCount,
  errorCount,
  fetchData,
  filteredSources,
  hasFilters,
  keyword,
  loading,
  openCreate,
  openEdit,
  previewLoading,
  previewResult,
  previewSourceName,
  previewVisible,
  sources,
  statusFilter,
  testSource,
  testingId,
  toggleSource,
} = useCustomRssSources();

onMounted(fetchData);
</script>

<template>
  <Page>
    <div class="rss-page">
      <PageHeader title="自定义 RSS">
        <template #actions>
          <NButton type="primary" @click="openCreate">
            <template #icon><IconifyIcon icon="lucide:plus" /></template>
            添加 RSS 源
          </NButton>
        </template>
      </PageHeader>
      <SourceWorkflow />

      <section class="sources-section">
        <div class="list-heading">
          <div>
            <h2>来源列表</h2>
            <p>
              共 {{ sources.length }} 个源 · {{ enabledCount }} 个启用
              <template v-if="errorCount > 0">
                · {{ errorCount }} 个异常
              </template>
            </p>
          </div>
          <div class="list-tools">
            <NRadioGroup v-model:value="statusFilter" size="small">
              <NRadioButton value="all">全部</NRadioButton>
              <NRadioButton value="enabled">已启用</NRadioButton>
              <NRadioButton value="error">异常</NRadioButton>
            </NRadioGroup>
            <NInput
              v-model:value="keyword"
              clearable
              class="source-search"
              placeholder="搜索名称或域名"
            >
              <template #prefix><IconifyIcon icon="lucide:search" /></template>
            </NInput>
          </div>
        </div>

        <NSpin :show="loading">
          <div v-if="filteredSources.length > 0" class="source-list">
            <SourceCard
              v-for="source in filteredSources"
              :key="source.id"
              :source="source"
              :testing="testingId === source.id"
              @edit="openEdit(source)"
              @toggle="toggleSource(source, $event)"
              @test="testSource(source)"
              @delete="deleteSource(source)"
            />
          </div>
          <NEmpty
            v-else-if="!loading"
            :description="
              hasFilters ? '没有符合条件的 RSS 源' : '从第一个 RSS 源开始'
            "
            class="empty-state"
          >
            <template #extra>
              <NButton v-if="hasFilters" @click="clearFilters">
                清除筛选
              </NButton>
              <NButton v-else type="primary" @click="openCreate">
                <template #icon><IconifyIcon icon="lucide:plus" /></template>
                添加 RSS 源
              </NButton>
            </template>
          </NEmpty>
        </NSpin>
      </section>
    </div>

    <SourceEditModal
      v-model:show="editing"
      :source="currentSource"
      @saved="fetchData"
    />
    <FeedPreviewModal
      v-model:show="previewVisible"
      :loading="previewLoading"
      :result="previewResult"
      :source-name="previewSourceName"
    />
    <SourceDeleteModal
      v-model:show="deleteVisible"
      :loading="deleting"
      :source-name="deleteTarget?.name || ''"
      @confirm="confirmDelete"
    />
  </Page>
</template>

<style scoped>
.rss-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sources-section {
  padding: 20px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.list-heading,
.list-tools {
  display: flex;
  gap: 12px;
  align-items: center;
}

.list-heading {
  justify-content: space-between;
  margin-bottom: 18px;
}

.list-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.list-heading p {
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.source-search {
  width: 240px;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-state {
  padding: 56px 0;
}

@media (max-width: 900px) {
  .list-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .list-tools {
    justify-content: space-between;
  }
}

@media (max-width: 640px) {
  .sources-section {
    padding: 16px 12px;
  }

  .list-tools {
    flex-direction: column;
    align-items: stretch;
  }

  .source-search {
    width: 100%;
  }
}
</style>
