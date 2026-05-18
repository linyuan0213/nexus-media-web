<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPagination,
  NPopconfirm,
  NSelect,
  NSpace,
  NSpin,
  useNotification,
} from 'naive-ui';

import { IconifyIcon } from '@vben/icons';

import {
  addTmdbBlacklistApi,
  clearTmdbBlacklistApi,
  deleteTmdbBlacklistApi,
  getTmdbBlacklistApi,
} from '#/api/modules/media';
import EmptyState from '#/components/empty/EmptyState.vue';
import PageHeader from '#/components/page/PageHeader.vue';

const notification = useNotification();

const loading = ref(false);
const keyword = ref('');
const currentPage = ref(1);
const pageSize = ref(30);
const total = ref(0);
const totalPage = ref(1);
const list = ref<Array<Record<string, any>>>([]);

const addModalShow = ref(false);
const addLoading = ref(false);
const addForm = ref({ tmdb_id: '', media_type: '' });

const mediaTypeOptions = [
  { label: '电影', value: '电影' },
  { label: '电视剧', value: '电视剧' },
];

async function fetchData(page = 1) {
  loading.value = true;
  currentPage.value = page;
  try {
    const res = await getTmdbBlacklistApi({
      page,
      count: pageSize.value,
      s: keyword.value || undefined,
    });
    if (res) {
      list.value = res.items || [];
      total.value = res.total || 0;
      totalPage.value = Math.ceil((res.total || 0) / pageSize.value) || 1;
    }
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  fetchData(1);
}

function handlePageChange(page: number) {
  fetchData(page);
}

function openAddModal() {
  addForm.value = { tmdb_id: '', media_type: '' };
  addModalShow.value = true;
}

async function submitAdd() {
  if (!addForm.value.tmdb_id.trim()) {
    notification.warning({ content: '请输入 TMDB ID' });
    return;
  }
  if (!addForm.value.media_type) {
    notification.warning({ content: '请选择媒体类型' });
    return;
  }
  addLoading.value = true;
  try {
    await addTmdbBlacklistApi({
      tmdb_id: addForm.value.tmdb_id.trim(),
      media_type: addForm.value.media_type,
    });
    notification.success({ content: '已添加到黑名单' });
    addModalShow.value = false;
    await fetchData(currentPage.value);
  } catch (err: any) {
    notification.error({ content: '添加失败', description: err?.message || '' });
  } finally {
    addLoading.value = false;
  }
}

async function handleDelete(item: any) {
  try {
    await deleteTmdbBlacklistApi({
      tmdb_id: String(item.tmdb_id),
      media_type: item.media_type,
    });
    notification.success({ content: '已删除' });
    await fetchData(currentPage.value);
  } catch (err: any) {
    notification.error({ content: '删除失败', description: err?.message || '' });
  }
}

async function handleClear() {
  try {
    await clearTmdbBlacklistApi();
    notification.success({ content: '黑名单已清空' });
    await fetchData(1);
  } catch (err: any) {
    notification.error({ content: '清空失败', description: err?.message || '' });
  }
}

function getPosterUrl(path?: string) {
  if (!path) return '/static/img/no-image.png';
  if (path.startsWith('http')) return `/img?url=${path}`;
  return `https://image.tmdb.org/t/p/w500${path}`;
}

function getTmdbUrl(item: any) {
  return item.media_type === '电影'
    ? `https://www.themoviedb.org/movie/${item.tmdb_id}`
    : `https://www.themoviedb.org/tv/${item.tmdb_id}`;
}

function hasNote(note?: string) {
  if (!note) return false;
  const t = note.trim();
  return t.length > 0 && t !== '{}' && t !== 'None';
}

onMounted(() => fetchData(1));
</script>

<template>
  <div class="p-4">
    <PageHeader title="TMDB 黑名单" subtitle="屏蔽不想识别的 TMDB 条目">
      <template #actions>
        <NSpace align="center">
          <NInput
            v-model:value="keyword"
            placeholder="搜索标题或 TMDB ID..."
            style="width: 240px"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <IconifyIcon icon="lucide:search" class="size-4" style="color: hsl(var(--muted-foreground));" />
            </template>
          </NInput>
          <NButton @click="fetchData(currentPage)">
            <template #icon>
              <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
            </template>
          </NButton>
          <NButton type="primary" @click="openAddModal">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            添加
          </NButton>
          <NPopconfirm @positive-click="handleClear">
            <template #trigger>
              <NButton type="error" ghost>
                <template #icon>
                  <IconifyIcon icon="lucide:trash-2" class="size-4" />
                </template>
              </NButton>
            </template>
            <div class="max-w-[280px]">
              确定要清空所有 TMDB 黑名单记录吗？此操作不可恢复。
            </div>
          </NPopconfirm>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading" class="mt-4">
      <div v-if="list.length > 0">
        <div class="text-sm mb-3" style="color: hsl(var(--muted-foreground))">
          共 {{ total }} 条记录
        </div>

        <div class="blacklist-grid">
          <NCard
            v-for="item in list"
            :key="`${item.tmdb_id}-${item.media_type}`"
            size="small"
            :bordered="false"
            class="blacklist-card"
          >
            <div class="flex gap-3">
              <img
                v-if="item.poster_path"
                :src="getPosterUrl(item.poster_path)"
                class="blacklist-poster"
                onerror="this.src='/static/img/no-image.png'"
              />
              <div
                v-else
                class="blacklist-poster-placeholder flex items-center justify-center"
              >
                <IconifyIcon
                  icon="lucide:image-off"
                  class="size-5"
                  style="color: hsl(var(--muted-foreground));"
                />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="blacklist-title truncate" :title="item.title">
                    {{ item.title || '-' }}
                    <span v-if="item.year" class="blacklist-year">({{ item.year }})</span>
                  </div>
                  <NPopconfirm @positive-click="handleDelete(item)">
                    <template #trigger>
                      <NButton size="tiny" text type="error">
                        <template #icon>
                          <IconifyIcon icon="lucide:trash-2" class="size-4" />
                        </template>
                      </NButton>
                    </template>
                    <div>确定删除「{{ item.title }}」？</div>
                  </NPopconfirm>
                </div>

                <div class="blacklist-meta">
                  <span class="blacklist-tag">
                    <IconifyIcon
                      :icon="item.media_type === '电影' ? 'lucide:film' : 'lucide:tv'"
                      class="size-3 inline mr-1"
                    />
                    {{ item.media_type }}
                  </span>
                  <a
                    :href="getTmdbUrl(item)"
                    target="_blank"
                    class="blacklist-link"
                    @click.stop
                  >
                    <IconifyIcon icon="lucide:external-link" class="size-3 inline mr-1" />
                    TMDB {{ item.tmdb_id }}
                  </a>
                </div>

                <div v-if="hasNote(item.note)" class="blacklist-note truncate" :title="item.note">
                  {{ item.note }}
                </div>
              </div>
            </div>
          </NCard>
        </div>

        <div class="mt-4 flex justify-end">
          <NPagination
            v-model:page="currentPage"
            :page-size="pageSize"
            :page-count="totalPage"
            @update:page="handlePageChange"
          />
        </div>
      </div>

      <EmptyState
        v-else
        title="黑名单为空"
        subtitle="没有屏蔽的 TMDB 条目"
      >
        <template #icon>
          <IconifyIcon
            icon="lucide:shield-check"
            class="size-16"
            style="color: hsl(var(--success))"
          />
        </template>
        <template #action>
          <NButton type="primary" @click="openAddModal">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            添加黑名单
          </NButton>
        </template>
      </EmptyState>
    </NSpin>

    <!-- 添加弹窗 -->
    <NModal
      v-model:show="addModalShow"
      title="添加黑名单"
      preset="card"
      style="width: 400px; max-width: 90vw;"
      :mask-closable="false"
    >
      <NForm label-placement="left" label-width="80">
        <NFormItem label="TMDB ID" required>
          <NInput v-model:value="addForm.tmdb_id" placeholder="请输入 TMDB ID" />
        </NFormItem>
        <NFormItem label="媒体类型" required>
          <NSelect
            v-model:value="addForm.media_type"
            :options="mediaTypeOptions"
            placeholder="请选择"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="addModalShow = false">取消</NButton>
          <NButton type="primary" :loading="addLoading" @click="submitAdd">确定</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.blacklist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.75rem;
}

.blacklist-card {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  transition: box-shadow 0.2s, border-color 0.2s;
}

.blacklist-card:hover {
  box-shadow: 0 4px 16px hsl(var(--foreground) / 0.1);
  border-color: hsl(var(--primary) / 0.25);
}

.blacklist-poster {
  width: 3.5rem;
  height: 5rem;
  border-radius: 0.375rem;
  object-fit: cover;
  flex-shrink: 0;
}

.blacklist-poster-placeholder {
  width: 3.5rem;
  height: 5rem;
  border-radius: 0.375rem;
  background-color: hsl(var(--muted));
  flex-shrink: 0;
}

.blacklist-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  line-height: 1.4;
}

.blacklist-year {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  font-weight: 400;
  margin-left: 0.25rem;
}

.blacklist-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.blacklist-tag {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  background-color: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
  font-weight: 500;
}

.blacklist-link {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  transition: color 0.2s;
}

.blacklist-link:hover {
  color: hsl(var(--primary));
}

.blacklist-note {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
  margin-top: 0.25rem;
}

@media (max-width: 640px) {
  .blacklist-grid {
    grid-template-columns: 1fr;
  }

  .blacklist-poster,
  .blacklist-poster-placeholder {
    width: 3rem;
    height: 4.25rem;
  }
}
</style>
