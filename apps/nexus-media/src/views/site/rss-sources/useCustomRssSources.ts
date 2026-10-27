import type {
  CustomRssSource,
  CustomRssTestResult,
} from '#/api/modules/subscription';

import { computed, ref } from 'vue';

import { useMessage } from 'naive-ui';

import {
  deleteCustomRssSourceApi,
  getCustomRssSourcesApi,
  testCustomRssSourceApi,
  updateCustomRssSourceApi,
} from '#/api/modules/subscription';

export function useCustomRssSources() {
  const message = useMessage();
  const loading = ref(false);
  const sources = ref<CustomRssSource[]>([]);
  const keyword = ref('');
  const statusFilter = ref<'all' | 'enabled' | 'error'>('all');
  const editing = ref(false);
  const currentSource = ref<CustomRssSource | null>(null);
  const previewVisible = ref(false);
  const previewLoading = ref(false);
  const previewResult = ref<CustomRssTestResult | null>(null);
  const previewSourceName = ref('');
  const testingId = ref<null | number>(null);
  const deleteVisible = ref(false);
  const deleting = ref(false);
  const deleteTarget = ref<CustomRssSource | null>(null);

  const enabledCount = computed(
    () => sources.value.filter((source) => source.enabled).length,
  );
  const errorCount = computed(
    () =>
      sources.value.filter((source) => source.enabled && source.last_error)
        .length,
  );
  const filteredSources = computed(() => {
    const query = keyword.value.trim().toLowerCase();
    return sources.value.filter((source) => {
      if (statusFilter.value === 'enabled' && !source.enabled) return false;
      if (
        statusFilter.value === 'error' &&
        !(source.enabled && source.last_error)
      )
        return false;
      return `${source.name} ${source.domain}`.toLowerCase().includes(query);
    });
  });
  const hasFilters = computed(
    () => Boolean(keyword.value) || statusFilter.value !== 'all',
  );

  async function fetchData() {
    loading.value = true;
    try {
      sources.value = await getCustomRssSourcesApi();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || 'RSS 源加载失败');
    } finally {
      loading.value = false;
    }
  }

  function openCreate() {
    currentSource.value = null;
    editing.value = true;
  }

  function openEdit(source: CustomRssSource) {
    currentSource.value = source;
    editing.value = true;
  }

  function clearFilters() {
    keyword.value = '';
    statusFilter.value = 'all';
  }

  async function toggleSource(source: CustomRssSource, enabled: boolean) {
    const previous = source.enabled;
    source.enabled = enabled;
    try {
      await updateCustomRssSourceApi(source.id, { enabled });
      message.success(enabled ? 'RSS 源已启用' : 'RSS 源已停用');
    } catch (error: any) {
      source.enabled = previous;
      message.error(error?.response?.data?.detail || '状态更新失败');
    }
  }

  async function testSource(source: CustomRssSource) {
    testingId.value = source.id;
    previewSourceName.value = source.name;
    previewResult.value = null;
    previewVisible.value = true;
    previewLoading.value = true;
    try {
      previewResult.value = await testCustomRssSourceApi({ id: source.id });
      await fetchData();
    } catch (error: any) {
      previewVisible.value = false;
      message.error(
        error?.response?.data?.detail || error?.message || '测试失败',
      );
    } finally {
      previewLoading.value = false;
      testingId.value = null;
    }
  }

  function deleteSource(source: CustomRssSource) {
    deleteTarget.value = source;
    deleteVisible.value = true;
  }

  async function confirmDelete() {
    if (!deleteTarget.value) return;
    deleting.value = true;
    try {
      await deleteCustomRssSourceApi(deleteTarget.value.id);
      message.success('RSS 源已删除');
      deleteVisible.value = false;
      deleteTarget.value = null;
      await fetchData();
    } finally {
      deleting.value = false;
    }
  }

  return {
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
  };
}
