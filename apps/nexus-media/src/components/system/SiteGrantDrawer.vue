<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCheckbox,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NSpin,
  NTag,
} from 'naive-ui';

import { getIndexersApi } from '#/api/modules/download';
import {
  getRoleSiteGrantsApi,
  getUserSiteGrantsApi,
  setRoleSiteGrantsApi,
  setUserSiteGrantsApi,
} from '#/api/modules/rbac';
import { useAppNotification } from '#/utils/notify';

interface Props {
  show: boolean;
  targetType: 'role' | 'user';
  targetId: null | number;
  targetName?: string;
  /** 超级管理员：默认拥有全部站点授权，全选展示且不可编辑 */
  unrestricted?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  targetName: '',
  unrestricted: false,
});

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const notification = useAppNotification();
const loading = ref(false);
const saving = ref(false);

interface SiteRow {
  name: string;
  builtin: boolean;
  search: boolean;
  rss: boolean;
}

const sites = ref<SiteRow[]>([]);
const keyword = ref('');

const filteredSites = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return sites.value;
  return sites.value.filter((s) => s.name.toLowerCase().includes(kw));
});

const grantedCount = computed(
  () => sites.value.filter((s) => s.search || s.rss).length,
);

async function fetchData() {
  if (!props.targetId) return;
  loading.value = true;
  try {
    const [indexersRes, grantsRes]: any[] = await Promise.all([
      getIndexersApi(),
      props.targetType === 'role'
        ? getRoleSiteGrantsApi(props.targetId)
        : getUserSiteGrantsApi(props.targetId),
    ]);
    const indexerList = Array.isArray(indexersRes)
      ? indexersRes
      : indexersRes?.data || [];
    const grantList = Array.isArray(grantsRes)
      ? grantsRes
      : grantsRes?.data || [];
    const grantMap = new Map<string, Set<string>>(
      grantList.map((g: any) => [g.site_name, new Set(g.permissions || [])]),
    );
    sites.value = indexerList.map((i: any) => {
      if (props.unrestricted) {
        // 超级管理员默认拥有全部站点授权
        return { name: i.name, builtin: !!i.builtin, search: true, rss: true };
      }
      const perms = grantMap.get(i.name) || grantMap.get(`builtin:${i.name}`);
      return {
        name: i.name,
        builtin: !!i.builtin,
        search: perms?.has('search') ?? false,
        rss: perms?.has('rss') ?? false,
      };
    });
  } catch (error: any) {
    notification.error('加载失败', { description: error?.message || '' });
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.show, props.targetId],
  ([show]) => {
    if (show) {
      keyword.value = '';
      fetchData();
    }
  },
);

function toggleAll(perm: 'rss' | 'search', checked: boolean) {
  for (const s of filteredSites.value) {
    s[perm] = checked;
  }
}

async function handleSave() {
  if (!props.targetId) return;
  saving.value = true;
  try {
    const grants = sites.value
      .filter((s) => s.search || s.rss)
      .map((s) => {
        const permissions: string[] = [];
        if (s.search) permissions.push('search');
        if (s.rss) permissions.push('rss');
        return { site_name: s.name, permissions };
      });
    if (props.targetType === 'role') {
      await setRoleSiteGrantsApi(props.targetId, grants);
    } else {
      await setUserSiteGrantsApi(props.targetId, grants);
    }
    notification.success('站点授权已保存');
    emit('update:show', false);
  } catch (error: any) {
    notification.error('保存失败', { description: error?.message || '' });
  } finally {
    saving.value = false;
  }
}

const title = computed(
  () =>
    `站点授权 - ${props.targetType === 'role' ? '角色' : '用户'}：${props.targetName || ''}`,
);
</script>

<template>
  <NDrawer
    :show="show"
    :width="560"
    placement="right"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <NDrawerContent :title="title" closable>
      <NSpin :show="loading">
        <div class="grant-toolbar">
          <input
            v-model="keyword"
            class="grant-search"
            placeholder="搜索站点…"
            type="text"
          />
          <div class="grant-batch">
            <NButton size="tiny" @click="toggleAll('search', true)">
              全选搜索
            </NButton>
            <NButton size="tiny" @click="toggleAll('rss', true)">
              全选RSS
            </NButton>
            <NButton
              size="tiny"
              @click="
                toggleAll('search', false);
                toggleAll('rss', false);
              "
            >
              清空
            </NButton>
          </div>
        </div>

        <div class="grant-summary">
          已授权 {{ grantedCount }} / {{ sites.length }} 个站点
        </div>
        <div v-if="unrestricted" class="grant-notice">
          <IconifyIcon icon="lucide:shield-check" class="size-4" />
          超级管理员默认拥有全部站点授权，无需单独配置
        </div>

        <div v-if="filteredSites.length > 0" class="grant-list">
          <div v-for="site in filteredSites" :key="site.name" class="grant-row">
            <div class="grant-site">
              <span class="grant-site-name" :title="site.name">
                {{ site.name }}
              </span>
              <NTag v-if="site.builtin" size="tiny" class="grant-tag-builtin">
                内置
              </NTag>
            </div>
            <div class="grant-perms">
              <NCheckbox
                v-model:checked="site.search"
                size="small"
                :disabled="unrestricted"
              >
                搜索
              </NCheckbox>
              <NCheckbox
                v-model:checked="site.rss"
                size="small"
                :disabled="unrestricted"
              >
                RSS
              </NCheckbox>
            </div>
          </div>
        </div>
        <NEmpty v-else description="没有匹配的站点" style="margin-top: 3rem" />
      </NSpin>

      <template #footer>
        <div class="grant-footer">
          <NButton @click="emit('update:show', false)">
            {{ unrestricted ? '关闭' : '取消' }}
          </NButton>
          <NButton
            v-if="!unrestricted"
            type="primary"
            :loading="saving"
            @click="handleSave"
          >
            <template #icon>
              <IconifyIcon icon="lucide:save" class="size-4" />
            </template>
            保存授权
          </NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.grant-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.grant-search {
  flex: 1;
  min-width: 10rem;
  height: 28px;
  padding: 0 0.6rem;
  font-size: 12px;
  color: hsl(var(--foreground));
  outline: none;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
}

.grant-search:focus {
  border-color: hsl(var(--primary));
}

.grant-batch {
  display: flex;
  flex-shrink: 0;
  gap: 0.4rem;
}

.grant-summary {
  margin-top: 0.6rem;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.grant-notice {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.5rem 0.6rem;
  margin-top: 0.5rem;
  font-size: 12px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border: 1px solid hsl(var(--primary) / 25%);
  border-radius: 0.4rem;
}

.grant-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.grant-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.6rem;
  background: hsl(var(--muted) / 16%);
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 0.4rem;
}

.grant-site {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
}

.grant-site-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.grant-tag-builtin {
  flex-shrink: 0;
}

.grant-perms {
  display: flex;
  flex-shrink: 0;
  gap: 0.8rem;
}

.grant-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
