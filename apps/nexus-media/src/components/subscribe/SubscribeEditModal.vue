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

import {
  getDownloadDirsApi,
  getDownloadSettingsApi,
  getIndexersApi,
} from '#/api/modules/download';
import { getFilterRulesApi } from '#/api/modules/filter';
import { getSitesApi } from '#/api/modules/site';

export interface SubscribeEditItem {
  rssid?: string;
  name: string;
  year?: string;
  type: 'movie' | 'tv';
  tmdbid?: string;
  image?: string;
  season?: string;
  keyword?: string;
  fuzzy_match?: boolean;
  over_edition?: boolean;
  filter_restype?: string;
  filter_pix?: string;
  filter_team?: string;
  filter_rule?: string;
  filter_include?: string;
  filter_exclude?: string;
  download_setting?: string;
  save_path?: string;
  total_ep?: number | string;
  current_ep?: number | string;
  rss_sites?: string[];
  search_sites?: string[];
}

const props = defineProps<{
  item: null | SubscribeEditItem;
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (e: 'confirm', data: Record<string, any>): void;
}>();

const isEdit = computed(() => !!props.item?.rssid);

const rssSites = ref<{ label: string; value: string }[]>([]);
const searchSites = ref<{ label: string; value: string }[]>([]);
const filterRules = ref<{ label: string; value: string }[]>([]);
const downloadSettings = ref<{ label: string; value: string }[]>([]);
const downloadDirs = ref<{ label: string; value: string }[]>([]);
const loading = ref(false);
const optionsLoaded = ref(false);

const seasonOptions = Array.from({ length: 51 }, (_, i) =>
  i === 0
    ? { label: '请选择', value: '' }
    : { label: `第${i}季`, value: String(i) },
);

const restypeOptions = [
  { label: '全部', value: '' },
  { label: 'BluRay', value: 'BluRay' },
  { label: 'Remux', value: 'Remux' },
  { label: 'UHD', value: 'UHD' },
  { label: 'WEB-DL', value: 'WEB-DL' },
  { label: 'HDTV', value: 'HDTV' },
  { label: 'H265', value: 'H265' },
  { label: 'H264', value: 'H264' },
];

const pixOptions = [
  { label: '全部', value: '' },
  { label: '4k', value: '4k' },
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
];

const form = ref({
  name: '',
  year: '',
  type: 'tv',
  season: '',
  tmdbid: '',
  image: '',
  keyword: '',
  fuzzy_match: false,
  over_edition: false,
  filter_restype: '',
  filter_pix: '',
  filter_team: '',
  filter_rule: '',
  filter_include: '',
  filter_exclude: '',
  download_setting: '',
  save_path: '',
  total_ep: '',
  current_ep: '',
  rss_sites: [] as string[],
  search_sites: [] as string[],
});

const isTv = computed(() => form.value.type === 'tv');

watch([() => props.show, () => props.item], async ([visible, item]) => {
  if (visible && item) {
    form.value = {
      name: item.name,
      year: item.year || '',
      type: item.type || 'tv',
      season: item.season || '',
      tmdbid: item.tmdbid || '',
      image: item.image || '',
      keyword: item.keyword || '',
      fuzzy_match: item.fuzzy_match ?? false,
      over_edition: item.over_edition ?? false,
      filter_restype: item.filter_restype || '',
      filter_pix: item.filter_pix || '',
      filter_team: item.filter_team || '',
      filter_rule:
        item.filter_rule != null && String(item.filter_rule) !== '0'
          ? String(item.filter_rule)
          : '',
      filter_include: item.filter_include || '',
      filter_exclude: item.filter_exclude || '',
      download_setting:
        item.download_setting == null ? '' : String(item.download_setting),
      save_path: item.save_path || '',
      total_ep: item.total_ep == null ? '' : String(item.total_ep),
      current_ep: item.current_ep == null ? '' : String(item.current_ep),
      rss_sites: Array.isArray(item.rss_sites) ? [...item.rss_sites] : [],
      search_sites: Array.isArray(item.search_sites)
        ? [...item.search_sites]
        : [],
    };
    if (!optionsLoaded.value) {
      await loadOptions();
      optionsLoaded.value = true;
    }
    if (item.download_setting != null) {
      await fetchDownloadDirs();
    }
  }
});

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

async function fetchDownloadDirs() {
  try {
    const sid = form.value.download_setting || undefined;
    const res: any = await getDownloadDirsApi(sid);
    const dirs = Array.isArray(res) ? res : res?.data || [];
    downloadDirs.value = [
      { label: '请选择', value: '' },
      ...dirs.map((d: any) => ({ label: d.name || d, value: d.path || d })),
    ];
  } catch {
    /* ignore */
  }
}

function isAllSelected(type: string) {
  const arr = type === 'rss' ? form.value.rss_sites : form.value.search_sites;
  const all = type === 'rss' ? rssSites.value : searchSites.value;
  return all.length > 0 && all.every((s: any) => arr.includes(s.value));
}

function toggleAllSites(type: string, checked: boolean) {
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
  const data: Record<string, any> = {
    name: form.value.name,
    year: form.value.year,
    type: form.value.type,
    mediaid: form.value.tmdbid,
    tmdbid: form.value.tmdbid,
    image: form.value.image,
    keyword: form.value.keyword || undefined,
    fuzzy_match: form.value.fuzzy_match,
    over_edition: form.value.over_edition,
    filter_restype: form.value.filter_restype,
    filter_pix: form.value.filter_pix,
    filter_team: form.value.filter_team,
    filter_rule: form.value.filter_rule,
    filter_include: form.value.filter_include,
    filter_exclude: form.value.filter_exclude,
    download_setting: form.value.download_setting || undefined,
    save_path: form.value.save_path || undefined,
    rss_sites: form.value.rss_sites,
    search_sites: form.value.search_sites,
    in_form: 'manual',
  };
  if (isTv.value) {
    data.season = form.value.season || undefined;
    data.total_ep = form.value.total_ep
      ? Number(form.value.total_ep)
      : undefined;
    data.current_ep = form.value.current_ep
      ? Number(form.value.current_ep)
      : undefined;
  }
  if (isEdit.value && props.item?.rssid) {
    data.rssid = props.item.rssid;
  }
  emit('confirm', data);
  emit('update:show', false);
}
</script>

<template>
  <NModal
    :show="props.show"
    @update:show="(v) => emit('update:show', v)"
    preset="card"
    :title="`${isEdit ? '编辑' : '新增'}订阅 - ${item?.name || ''}${item?.year ? ` (${item.year})` : ''}`"
    style="width: 720px; max-width: 90vw"
    body-style="max-height: 80vh; overflow-y: auto;"
    :bordered="false"
  >
    <div v-if="item" class="space-y-3">
      <NForm label-placement="left" label-width="90" size="small">
        <!-- 基础信息 -->
        <div class="form-section">
          <div class="form-section-header">
            <div class="form-section-icon form-icon-info">
              <IconifyIcon icon="lucide:info" class="h-4 w-4" />
            </div>
            <span class="form-section-title">基础信息</span>
          </div>
          <div class="form-section-body">
            <NFormItem label="自定义搜索词">
              <NInput
                v-model:value="form.keyword"
                placeholder="留空使用TMDB数据"
              />
            </NFormItem>
            <div class="grid grid-cols-2 gap-3">
              <NFormItem label="模糊匹配">
                <NCheckbox v-model:checked="form.fuzzy_match"> 开启 </NCheckbox>
              </NFormItem>
              <NFormItem label="洗版">
                <NCheckbox v-model:checked="form.over_edition">
                  开启
                </NCheckbox>
              </NFormItem>
            </div>
            <div v-if="isTv" class="grid grid-cols-3 gap-3">
              <NFormItem label="季">
                <NSelect v-model:value="form.season" :options="seasonOptions" />
              </NFormItem>
              <NFormItem label="总集数">
                <NInput v-model:value="form.total_ep" placeholder="可留空" />
              </NFormItem>
              <NFormItem label="开始集数">
                <NInput
                  v-model:value="form.current_ep"
                  placeholder="开始订阅集数"
                />
              </NFormItem>
            </div>
          </div>
        </div>

        <!-- 过滤设置 -->
        <div class="form-section">
          <div class="form-section-header">
            <div class="form-section-icon form-icon-filter">
              <IconifyIcon icon="lucide:filter" class="h-4 w-4" />
            </div>
            <span class="form-section-title">过滤设置</span>
          </div>
          <div class="form-section-body">
            <div class="grid grid-cols-3 gap-3">
              <NFormItem label="质量">
                <NSelect
                  v-model:value="form.filter_restype"
                  :options="restypeOptions"
                />
              </NFormItem>
              <NFormItem label="分辨率">
                <NSelect
                  v-model:value="form.filter_pix"
                  :options="pixOptions"
                />
              </NFormItem>
              <NFormItem label="制作组">
                <NInput
                  v-model:value="form.filter_team"
                  placeholder="支持正则"
                />
              </NFormItem>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <NFormItem label="包含">
                <NInput
                  v-model:value="form.filter_include"
                  placeholder="关键字或正则"
                />
              </NFormItem>
              <NFormItem label="排除">
                <NInput
                  v-model:value="form.filter_exclude"
                  placeholder="关键字或正则"
                />
              </NFormItem>
            </div>
            <NFormItem label="过滤规则">
              <NSelect
                v-model:value="form.filter_rule"
                :options="filterRules"
              />
            </NFormItem>
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
            <div class="grid grid-cols-2 gap-3">
              <NFormItem label="下载设置">
                <NSelect
                  v-model:value="form.download_setting"
                  :options="downloadSettings"
                  @update:value="fetchDownloadDirs"
                />
              </NFormItem>
              <NFormItem label="保存路径">
                <NSelect
                  v-model:value="form.save_path"
                  :options="downloadDirs"
                />
              </NFormItem>
            </div>
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

      <div class="flex justify-end">
        <NSpace>
          <NButton size="small" @click="emit('update:show', false)">
            取消
          </NButton>
          <NButton type="primary" size="small" @click="handleConfirm">
            保存
          </NButton>
        </NSpace>
      </div>
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

.form-icon-info {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 15%);
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
