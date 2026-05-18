<script lang="ts" setup>import { ref, onMounted } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NInput,
  NSpin,
  useNotification,
} from 'naive-ui';

import {
  getFilterGroupsApi,
  restoreFilterGroupApi,
} from '#/api';
import {
  FilterGroupCard,
  GroupModal,
  RuleModal,
  ShareImportModal,
  TestRuleModal,
} from '#/components/filter';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';
import { useFilterStore } from '#/store';
import type { FilterApi } from '#/api/modules/filter';

const filterStore = useFilterStore();
const notification = useNotification();

const loading = ref(false);

// Modal states
const groupModalShow = ref(false);
const ruleModalShow = ref(false);
const ruleModalGroupId = ref(0);
const editingRule = ref<FilterApi.FilterRuleItem | null>(null);
const shareImportModalShow = ref(false);
const shareContent = ref('');
const testModalShow = ref(false);
const testGroupName = ref('');

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getFilterGroupsApi();
    const ruleGroups = Array.isArray(res) ? res : (res?.data || []);
    filterStore.setGroups(ruleGroups);
  } catch (err: any) {
    notification.error({ content: '获取数据失败', description: err?.message || '' });
  } finally {
    loading.value = false;
  }
}

async function handleRestore() {
  try {
    await restoreFilterGroupApi({});
    notification.success({ content: '已恢复默认规则组' });
    await fetchData();
  } catch (err: any) {
    notification.error({ content: '恢复失败', description: err?.message || '' });
  }
}

function handleAddGroup() {
  groupModalShow.value = true;
}

function handleAddRule(groupId: number) {
  ruleModalGroupId.value = groupId;
  editingRule.value = null;
  ruleModalShow.value = true;
}

function handleEditRule(groupId: number, rule: FilterApi.FilterRuleItem) {
  ruleModalGroupId.value = groupId;
  editingRule.value = rule;
  ruleModalShow.value = true;
}

function handleShare(content: string) {
  shareContent.value = content;
  shareImportModalShow.value = true;
}

function handleOpenImport() {
  shareContent.value = '';
  shareImportModalShow.value = true;
}

function handleTest(groupName: string) {
  testGroupName.value = groupName;
  testModalShow.value = true;
}

onMounted(fetchData);
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="过滤规则" subtitle="管理资源过滤规则组">
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
          <NInput
            v-model:value="filterStore.searchQuery"
            placeholder="搜索规则组或规则..."
            clearable
            style="width: 240px"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:search" class="size-4" />
            </template>
          </NInput>
          <div class="flex items-center gap-2">
            <NButton type="primary" @click="handleAddGroup">
              <template #icon>
                <IconifyIcon icon="lucide:plus" class="size-4" />
              </template>
              新增规则组
            </NButton>
            <NButton @click="handleOpenImport">
              <template #icon>
                <IconifyIcon icon="lucide:download" class="size-4" />
              </template>
              导入
            </NButton>
            <NButton @click="handleRestore">
              <template #icon>
                <IconifyIcon icon="lucide:rotate-ccw" class="size-4" />
              </template>
              恢复默认
            </NButton>
          </div>
        </div>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div
        v-if="filterStore.filteredGroups.length > 0"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-5"
      >
        <FilterGroupCard
          v-for="group in filterStore.filteredGroups"
          :key="group.id"
          :group="group"
          @refresh="fetchData"
          @add-rule="handleAddRule"
          @edit-rule="handleEditRule"
          @share="handleShare"
          @test="handleTest"
        />
      </div>

      <EmptyState
        v-else
        title="没有过滤规则"
        subtitle="当前没有过滤规则，请点击「新增规则组」按钮添加"
      >
        <template #action>
          <NButton type="primary" @click="handleAddGroup">新增规则组</NButton>
        </template>
      </EmptyState>
    </NSpin>

    <GroupModal
      v-model:show="groupModalShow"
      @success="fetchData"
    />

    <RuleModal
      v-model:show="ruleModalShow"
      :group-id="ruleModalGroupId"
      :editing-rule="editingRule"
      @success="fetchData"
    />

    <ShareImportModal
      v-model:show="shareImportModalShow"
      :share-content="shareContent"
      @success="fetchData"
    />

    <TestRuleModal
      v-model:show="testModalShow"
      :group-name="testGroupName"
    />
  </div>
</template>


