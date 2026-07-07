<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCheckbox,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
} from 'naive-ui';

import { getDownloadSettingsApi, getIndexersApi } from '#/api/modules/download';
import { getFilterRulesApi } from '#/api/modules/filter';
import { getSitesApi } from '#/api/modules/site';
import { getDefaultSubscriptionSettingApi } from '#/api/modules/subscription';
import {
  joinMultiSelect,
  pixOptions,
  restypeOptions,
  splitMultiSelect,
} from '#/utils/subscribe';

interface Props {
  mtype: 'movie' | 'tv';
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (e: 'confirm', data: Record<string, any>): void;
}>();

const loading = ref(false);
const rssSites = ref<{ label: string; value: string }[]>([]);
const searchSites = ref<{ label: string; value: string }[]>([]);
const filterRules = ref<{ label: string; value: string }[]>([]);
const downloadSettings = ref<{ label: string; value: string }[]>([]);
const optionsLoaded = ref(false);

const form = ref({
  over_edition: '0',
  restype: [] as string[],
  pix: [] as string[],
  team: '',
  rule: '',
  include: '',
  exclude: '',
  free: '0',
  download_setting: '',
  rss_sites: [] as string[],
  search_sites: [] as string[],
});

const title = computed(() =>
  props.mtype === 'movie' ? '电影订阅默认设置' : '电视剧订阅默认设置',
);

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return;
    if (!optionsLoaded.value) {
      await loadOptions();
      optionsLoaded.value = true;
    }
    await loadSettings();
  },
);

async function loadOptions() {
  loading.value = true;
  try {
    const [sitesRes, idxRes, rulesRes, dsRes] = await Promise.all([
      getSitesApi().catch(() => ({ data: [] })),
      getIndexersApi().catch(() => ({ data: [] })),
      getFilterRulesApi().catch(() => ({ data: [] })),
      getDownloadSettingsApi().catch(() => ({ data: [] })),
    ]);
    const sites = Array.isArray(sitesRes) ? sitesRes : sitesRes?.data || [];
    rssSites.value = sites
      .filter((s: any) => s.rss_enable)
      .map((s: any) => ({ label: s.name, value: s.name }));
    searchSites.value = (
      Array.isArray(idxRes) ? idxRes : idxRes?.data || []
    ).map((i: any) => ({ label: i.name, value: i.name }));
    const rules = Array.isArray(rulesRes) ? rulesRes : rulesRes?.data || [];
    filterRules.value = [
      { label: '站点规则', value: '' },
      ...rules.map((r: any) => ({
        label: r.name || r.id,
        value: String(r.id),
      })),
    ];
    const ds = Array.isArray(dsRes) ? dsRes : dsRes?.data || [];
    downloadSettings.value = [
      { label: '站点设置', value: '' },
      ...ds.map((d: any) => ({ label: d.name || d.id, value: String(d.id) })),
    ];
  } finally {
    loading.value = false;
  }
}

function nullableString(val: any): string {
  if (val === null || val === undefined || val === 0 || val === '0') return '';
  return String(val);
}

async function loadSettings() {
  try {
    const res: any = await getDefaultSubscriptionSettingApi(props.mtype);
    const data = res?.data || res || {};
    form.value = {
      over_edition:
        data.over_edition && String(data.over_edition) === '1' ? '1' : '0',
      restype: splitMultiSelect(data.restype || data.filter_restype),
      pix: splitMultiSelect(data.pix || data.filter_pix).map((v) =>
        v.toUpperCase(),
      ),
      team: data.team || data.filter_team || '',
      rule: nullableString(data.rule),
      include: data.include || data.filter_include || '',
      exclude: data.exclude || data.filter_exclude || '',
      free: data.free && String(data.free) === '1' ? '1' : '0',
      download_setting: nullableString(data.download_setting),
      rss_sites: (Array.isArray(data.rss_sites) ? data.rss_sites : []).filter(
        (s: string) => rssSites.value.some((x) => x.value === s),
      ),
      search_sites: (Array.isArray(data.search_sites)
        ? data.search_sites
        : []
      ).filter((s: string) => searchSites.value.some((x) => x.value === s)),
    };
  } catch {
    // ignore
  }
}

function isAllSelected(type: 'rss' | 'search') {
  const arr = type === 'rss' ? form.value.rss_sites : form.value.search_sites;
  const all = type === 'rss' ? rssSites.value : searchSites.value;
  return all.length > 0 && all.every((s) => arr.includes(s.value));
}

function toggleAllSites(type: 'rss' | 'search', checked: boolean) {
  const all =
    type === 'rss'
      ? rssSites.value.map((s) => s.value)
      : searchSites.value.map((s) => s.value);
  if (type === 'rss') {
    form.value.rss_sites = checked ? [...all] : [];
  } else {
    form.value.search_sites = checked ? [...all] : [];
  }
}

function updateSite(type: 'rss' | 'search', value: string, checked: boolean) {
  const key = type === 'rss' ? 'rss_sites' : 'search_sites';
  const set = new Set(form.value[key]);
  if (checked) set.add(value);
  else set.delete(value);
  form.value[key] = [...set];
}

function toggleSite(type: 'rss' | 'search', value: string) {
  const key = type === 'rss' ? 'rss_sites' : 'search_sites';
  const set = new Set(form.value[key]);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  form.value[key] = [...set];
}

function handleConfirm() {
  emit('confirm', {
    over_edition: form.value.over_edition,
    restype: joinMultiSelect(form.value.restype),
    pix: joinMultiSelect(form.value.pix),
    team: form.value.team,
    rule: form.value.rule,
    include: form.value.include,
    exclude: form.value.exclude,
    free: form.value.free,
    download_setting: form.value.download_setting,
    rss_sites: form.value.rss_sites,
    search_sites: form.value.search_sites,
  });
  emit('update:show', false);
}
</script>

<template>
  <NModal
    :show="props.show"
    preset="card"
    :title="title"
    style="width: 720px; max-width: 90vw"
    body-style="max-height: 80vh; overflow-y: auto;"
    :bordered="false"
    @update:show="(v) => emit('update:show', v)"
  >
    <NForm label-placement="top" size="small">
      <!-- 过滤设置 -->
      <div class="form-section">
        <div class="form-section-header">
          <div class="form-section-icon form-icon-filter">
            <IconifyIcon icon="lucide:filter" class="h-4 w-4" />
          </div>
          <span class="form-section-title">过滤设置</span>
        </div>
        <div class="form-section-body">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NFormItem label="质量">
              <NSelect
                v-model:value="form.restype"
                :options="restypeOptions"
                multiple
                clearable
                max-tag-count="responsive"
                placeholder="留空不限制"
              />
            </NFormItem>
            <NFormItem label="分辨率">
              <NSelect
                v-model:value="form.pix"
                :options="pixOptions"
                multiple
                clearable
                max-tag-count="responsive"
                placeholder="留空不限制"
              />
            </NFormItem>
            <NFormItem label="制作组">
              <NInput v-model:value="form.team" placeholder="支持正则" />
            </NFormItem>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NFormItem label="包含">
              <NInput v-model:value="form.include" placeholder="关键字或正则" />
            </NFormItem>
            <NFormItem label="排除">
              <NInput v-model:value="form.exclude" placeholder="关键字或正则" />
            </NFormItem>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NFormItem label="过滤规则">
              <NSelect v-model:value="form.rule" :options="filterRules" />
            </NFormItem>
            <NFormItem label="洗版">
              <NSelect
                v-model:value="form.over_edition"
                :options="[
                  { label: '否', value: '0' },
                  { label: '是', value: '1' },
                ]"
              />
            </NFormItem>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NFormItem label="只订阅免费">
              <NSelect
                v-model:value="form.free"
                :options="[
                  { label: '否', value: '0' },
                  { label: '是', value: '1' },
                ]"
              />
            </NFormItem>
          </div>
        </div>
      </div>

      <!-- 下载设置 -->
      <div class="form-section">
        <div class="form-section-header">
          <div class="form-section-icon form-icon-download">
            <IconifyIcon icon="lucide:download" class="h-4 w-4" />
          </div>
          <span class="form-section-title">下载设置</span>
        </div>
        <div class="form-section-body">
          <NFormItem label="下载设置">
            <NSelect
              v-model:value="form.download_setting"
              :options="downloadSettings"
              clearable
            />
          </NFormItem>
        </div>
      </div>

      <!-- 订阅站点 -->
      <div class="form-section">
        <div class="form-section-header">
          <div class="form-section-icon form-icon-rss">
            <IconifyIcon icon="lucide:rss" class="h-4 w-4" />
          </div>
          <span class="form-section-title">订阅站点</span>
          <NCheckbox
            class="ml-auto"
            size="small"
            :checked="isAllSelected('rss')"
            @update:checked="(v) => toggleAllSites('rss', v)"
          >
            全选
          </NCheckbox>
        </div>
        <div class="form-section-body">
          <div class="site-select-grid">
            <div
              v-for="site in rssSites"
              :key="site.value"
              class="site-select-card"
              :class="{
                'site-select-card-on': form.rss_sites.includes(site.value),
              }"
              @click="toggleSite('rss', site.value)"
            >
              <div class="site-select-main">
                <div class="site-select-icon">
                  {{ site.label.charAt(0).toUpperCase() }}
                </div>
                <span class="site-select-label">{{ site.label }}</span>
              </div>
              <NCheckbox
                size="small"
                :checked="form.rss_sites.includes(site.value)"
                @click.stop
                @update:checked="
                  (v: boolean) => updateSite('rss', site.value, v)
                "
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 搜索站点 -->
      <div class="form-section">
        <div class="form-section-header">
          <div class="form-section-icon form-icon-search">
            <IconifyIcon icon="lucide:search" class="h-4 w-4" />
          </div>
          <span class="form-section-title">搜索站点</span>
          <NCheckbox
            class="ml-auto"
            size="small"
            :checked="isAllSelected('search')"
            @update:checked="(v) => toggleAllSites('search', v)"
          >
            全选
          </NCheckbox>
        </div>
        <div class="form-section-body">
          <div class="site-select-grid">
            <div
              v-for="site in searchSites"
              :key="site.value"
              class="site-select-card"
              :class="{
                'site-select-card-on': form.search_sites.includes(site.value),
              }"
              @click="toggleSite('search', site.value)"
            >
              <div class="site-select-main">
                <div class="site-select-icon">
                  {{ site.label.charAt(0).toUpperCase() }}
                </div>
                <span class="site-select-label">{{ site.label }}</span>
              </div>
              <NCheckbox
                size="small"
                :checked="form.search_sites.includes(site.value)"
                @click.stop
                @update:checked="
                  (v: boolean) => updateSite('search', site.value, v)
                "
              />
            </div>
          </div>
        </div>
      </div>
    </NForm>

    <div class="flex justify-end mt-4">
      <NSpace>
        <NButton size="small" @click="emit('update:show', false)">
          取消
        </NButton>
        <NButton type="primary" size="small" @click="handleConfirm">
          保存
        </NButton>
      </NSpace>
    </div>
  </NModal>
</template>

<style scoped>
.form-section {
  margin-bottom: 0.75rem;
  overflow: hidden;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.625rem;
}

.form-section-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.625rem 0.875rem;
  background-color: hsl(var(--muted) / 25%);
  border-bottom: 1px solid hsl(var(--border));
}

.form-section-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.625rem;
  height: 1.625rem;
  border-radius: 0.375rem;
}

.form-icon-filter {
  color: hsl(var(--warning));
  background-color: hsl(var(--warning) / 15%);
}

.form-icon-download {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 15%);
}

.form-icon-rss {
  color: hsl(var(--success));
  background-color: hsl(var(--success) / 15%);
}

.form-icon-search {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 15%);
}

.form-section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.form-section-body {
  padding: 0.75rem 0.875rem;
}

.site-select-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;
}

.site-select-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.site-select-card:hover {
  background-color: hsl(var(--accent) / 20%);
  border-color: hsl(var(--primary) / 30%);
}

.site-select-card-on {
  background-color: hsl(var(--primary) / 6%);
  border-color: hsl(var(--primary) / 40%);
}

.site-select-card-on .site-select-icon {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 15%);
}

.site-select-main {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  min-width: 0;
}

.site-select-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted) / 30%);
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.site-select-label {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

@media (max-width: 640px) {
  .site-select-grid {
    grid-template-columns: 1fr;
  }

  .form-section-body {
    padding: 0.5rem 0.625rem;
  }

  .form-section-header {
    padding: 0.5rem 0.625rem;
  }
}
</style>
