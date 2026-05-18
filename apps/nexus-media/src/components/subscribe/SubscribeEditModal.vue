<script lang="ts" setup>
import { ref, watch, computed } from 'vue';
import {
  NButton,
  NCard,
  NCheckbox,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
} from 'naive-ui';

import { getSitesApi } from '#/api/modules/site';
import { getFilterRulesApi } from '#/api/modules/filter';
import { getDownloadSettingsApi, getDownloadDirsApi, getIndexersApi } from '#/api/modules/download';

export interface SubscribeEditItem {
  rssid?: string;
  name: string;
  year?: string;
  type: 'MOV' | 'TV';
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
  total_ep?: string | number;
  current_ep?: string | number;
  rss_sites?: string[];
  search_sites?: string[];
}

const props = defineProps<{
  show: boolean;
  item: SubscribeEditItem | null;
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

const seasonOptions = Array.from({ length: 51 }, (_, i) =>
  i === 0 ? { label: '请选择', value: '' } : { label: `第${i}季`, value: String(i) }
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
  type: 'TV',
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

const isTv = computed(() => form.value.type === 'TV');

watch(() => props.show, async (visible) => {
  if (visible && props.item) {
    form.value = {
      name: props.item.name,
      year: props.item.year || '',
      type: props.item.type || 'TV',
      season: props.item.season || '',
      tmdbid: props.item.tmdbid || '',
      image: props.item.image || '',
      keyword: props.item.keyword || '',
      fuzzy_match: props.item.fuzzy_match ?? false,
      over_edition: props.item.over_edition ?? false,
      filter_restype: props.item.filter_restype || '',
      filter_pix: props.item.filter_pix || '',
      filter_team: props.item.filter_team || '',
      filter_rule: props.item.filter_rule != null && String(props.item.filter_rule) !== '0' ? String(props.item.filter_rule) : '',
      filter_include: props.item.filter_include || '',
      filter_exclude: props.item.filter_exclude || '',
      download_setting: props.item.download_setting != null ? String(props.item.download_setting) : '',
      save_path: props.item.save_path || '',
      total_ep: props.item.total_ep != null ? String(props.item.total_ep) : '',
      current_ep: props.item.current_ep != null ? String(props.item.current_ep) : '',
      rss_sites: Array.isArray(props.item.rss_sites) ? [...props.item.rss_sites] : [],
      search_sites: Array.isArray(props.item.search_sites) ? [...props.item.search_sites] : [],
    };
    await loadOptions();
    if (props.item.download_setting != null) {
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
    const sites = Array.isArray(sitesRes) ? sitesRes : (sitesRes?.data || []);
    rssSites.value = sites.filter((s: any) => s.rss).map((s: any) => ({ label: s.name, value: s.name }));
    searchSites.value = (Array.isArray(idxRes) ? idxRes : (idxRes?.data || [])).map((i: any) => ({ label: i.name, value: i.name }));
    const rules = Array.isArray(rulesRes) ? rulesRes : (rulesRes?.data || []);
    filterRules.value = [{ label: '站点规则', value: '' }, ...rules.map((r: any) => ({ label: r.name || r.id, value: String(r.id) }))];
    const ds = Array.isArray(dsRes) ? dsRes : (dsRes?.data || []);
    downloadSettings.value = [{ label: '站点设置', value: '' }, ...ds.map((d: any) => ({ label: d.name || d.id, value: String(d.id) }))];
  } finally {
    loading.value = false;
  }
}

async function fetchDownloadDirs() {
  try {
    const sid = form.value.download_setting || undefined;
    const res: any = await getDownloadDirsApi(sid);
    const dirs = Array.isArray(res) ? res : (res?.data || []);
    downloadDirs.value = [{ label: '请选择', value: '' }, ...dirs.map((d: any) => ({ label: d.name || d, value: d.path || d }))];
  } catch { /* ignore */ }
}

function isAllSelected(type: string) {
  const arr = type === 'rss' ? form.value.rss_sites : form.value.search_sites;
  const all = type === 'rss' ? rssSites.value : searchSites.value;
  return all.length > 0 && all.every((s: any) => arr.includes(s.value));
}

function toggleAllSites(type: string, checked: boolean) {
  const all = type === 'rss' ? rssSites.value.map(s => s.value) : searchSites.value.map(s => s.value);
  if (type === 'rss') {
    form.value.rss_sites = checked ? [...all] : [];
  } else {
    form.value.search_sites = checked ? [...all] : [];
  }
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
    data.total_ep = form.value.total_ep ? Number(form.value.total_ep) : undefined;
    data.current_ep = form.value.current_ep ? Number(form.value.current_ep) : undefined;
  }
  if (isEdit.value && props.item?.rssid) {
    data.rssid = props.item.rssid;
  }
  emit('confirm', data);
  emit('update:show', false);
}

function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return `/img?url=${encodeURIComponent(src)}`;
}
</script>

<template>
  <NModal
    :show="props.show"
    @update:show="(v) => emit('update:show', v)"
    preset="card"
    :title="`${isEdit ? '编辑' : '新增'}订阅 - ${item?.name || ''}`"
    style="width: 720px; max-width: 90vw; max-height: 90vh;"
    :bordered="false"
  >
    <div v-if="item" class="space-y-4">
      <!-- 顶部信息栏 -->
      <div class="flex items-center gap-4 mb-5 pb-4 border-b border-gray-100">
        <img :src="getImgUrl(item.image)" class="rounded-lg shadow" style="width: 60px; aspect-ratio: 2/3; object-fit: cover; flex-shrink: 0" alt="" />
        <div class="min-w-0">
          <h4 class="font-bold text-base truncate">{{ form.name }}</h4>
          <p class="text-gray-400 text-sm mt-0.5">{{ form.year }}</p>
        </div>
      </div>

      <NForm label-placement="left" label-width="90" size="small">
        <NFormItem label="自定义搜索词">
          <NInput v-model:value="form.keyword" placeholder="留空使用TMDB数据" />
        </NFormItem>
        <div class="grid grid-cols-3 gap-3">
          <NFormItem v-if="isTv" label="季"><NSelect v-model:value="form.season" :options="seasonOptions" /></NFormItem>
          <NFormItem v-if="isTv" label="总集数"><NInput v-model:value="form.total_ep" placeholder="可留空" /></NFormItem>
          <NFormItem v-if="isTv" label="开始集数"><NInput v-model:value="form.current_ep" placeholder="开始订阅集数" /></NFormItem>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <NFormItem label="模糊匹配"><NCheckbox v-model:checked="form.fuzzy_match">开启</NCheckbox></NFormItem>
          <NFormItem label="洗版"><NCheckbox v-model:checked="form.over_edition">开启</NCheckbox></NFormItem>
          <NFormItem />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <NFormItem label="质量"><NSelect v-model:value="form.filter_restype" :options="restypeOptions" /></NFormItem>
          <NFormItem label="分辨率"><NSelect v-model:value="form.filter_pix" :options="pixOptions" /></NFormItem>
          <NFormItem label="制作组"><NInput v-model:value="form.filter_team" placeholder="支持正则" /></NFormItem>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="包含"><NInput v-model:value="form.filter_include" placeholder="关键字或正则" /></NFormItem>
          <NFormItem label="排除"><NInput v-model:value="form.filter_exclude" placeholder="关键字或正则" /></NFormItem>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <NFormItem label="过滤规则"><NSelect v-model:value="form.filter_rule" :options="filterRules" /></NFormItem>
          <NFormItem label="下载设置"><NSelect v-model:value="form.download_setting" :options="downloadSettings" @update:value="fetchDownloadDirs" /></NFormItem>
        </div>
        <NFormItem label="保存路径"><NSelect v-model:value="form.save_path" :options="downloadDirs" /></NFormItem>
        <NFormItem label="订阅站点">
          <NCard size="small" :bordered="true" class="site-card">
            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <NCheckbox :checked="isAllSelected('rss')" @update:checked="v => toggleAllSites('rss', v)">全选</NCheckbox>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              <NCheckbox v-for="site in rssSites" :key="site.value" :checked="form.rss_sites.includes(site.value)" @update:checked="(v: boolean) => { const set = new Set(form.rss_sites); if (v) set.add(site.value); else set.delete(site.value); form.rss_sites = Array.from(set); }">{{ site.label }}</NCheckbox>
            </div>
          </NCard>
        </NFormItem>
        <NFormItem label="搜索站点">
          <NCard size="small" :bordered="true" class="site-card">
            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <NCheckbox :checked="isAllSelected('search')" @update:checked="v => toggleAllSites('search', v)">全选</NCheckbox>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              <NCheckbox v-for="site in searchSites" :key="site.value" :checked="form.search_sites.includes(site.value)" @update:checked="(v: boolean) => { const set = new Set(form.search_sites); if (v) set.add(site.value); else set.delete(site.value); form.search_sites = Array.from(set); }">{{ site.label }}</NCheckbox>
            </div>
          </NCard>
        </NFormItem>
      </NForm>

      <div class="flex justify-end">
        <NSpace>
          <NButton size="small" @click="emit('update:show', false)">取消</NButton>
          <NButton type="primary" size="small" @click="handleConfirm">保存</NButton>
        </NSpace>
      </div>
    </div>
  </NModal>
</template>
