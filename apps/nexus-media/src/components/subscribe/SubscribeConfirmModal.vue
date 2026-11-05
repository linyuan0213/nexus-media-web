<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NCheckbox,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTag,
} from 'naive-ui';

import {
  getMediaDetailByRefApi,
  getTvSeasonListApi,
} from '#/api/modules/media';
import { getVisibleSitesApi } from '#/api/modules/site';
import {
  getDefaultSubscriptionSettingApi,
  getSubscribedSeasonsApi,
} from '#/api/modules/subscription';
import MediaPoster from '#/components/media/MediaPoster.vue';
import {
  getContentProfileForSource,
  getContentProfileLabel,
} from '#/plugin-framework';

export interface SubscribeConfirmItem {
  id: string;
  mediaid?: string;
  anchor_provider?: string;
  anchor_external_id?: string;
  tmdbid?: string;
  title: string;
  year?: string;
  type: string; // MOV/TV
  image?: string;
  overview?: string;
  content_profile?: string;
  metadata_ref?: string;
  provider?: string;
}

const props = defineProps<{
  item: null | SubscribeConfirmItem;
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (
    e: 'confirm',
    payload: {
      add: number[];
      autoMode: boolean;
      policy: string;
      remove: number[];
      selected: number[];
    },
  ): void;
  (e: 'edit'): void;
}>();

const CN_SEASON: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseTitleSeason(title: string): number {
  const text = String(title || '');
  const cn = text.match(/第\s*([一二两三四五六七八九十]|\d{1,2})\s*季/);
  if (cn) {
    const raw = cn[1]!;
    return CN_SEASON[raw] || Number.parseInt(raw, 10) || 0;
  }
  const en = text.match(/(?:\bS|Season\s*)(\d{1,2})\b/i);
  return en ? Number.parseInt(en[1]!, 10) || 0 : 0;
}

const effectiveProfile = computed(() => {
  if (!props.item) return '';
  const profile = String(props.item.content_profile || '').trim();
  if (profile && profile !== 'default') return profile;
  const source = String(
    props.item.provider ||
      props.item.anchor_provider ||
      String(props.item.metadata_ref || '').split(':')[0] ||
      '',
  );
  return getContentProfileForSource(source);
});

const typeLabel = computed(() => {
  if (!props.item) return '';
  const profile = effectiveProfile.value;
  if (profile && profile !== 'default') {
    return getContentProfileLabel(profile) || profile.toUpperCase();
  }
  if (props.item.type === 'movie') return '电影';
  if (props.item.type === 'anime') return '动漫';
  return '剧集';
});

const loading = ref(false);
const seasons = ref<
  Array<{
    episode_count?: number;
    name?: string;
    poster_path?: string;
    season_number: number;
  }>
>([]);
const selectedSeasons = ref<number[]>([]);
const policy = ref('auto');
const policyOptions = [
  { label: '跟随来源（推荐）', value: 'auto' },
  { label: '豆瓣为主', value: 'douban_primary' },
  { label: 'TMDB 为主', value: 'tmdb_primary' },
  { label: 'Bangumi 为主', value: 'bangumi_primary' },
];
const subscribedSeasons = ref<number[]>([]);
// 优先展示默认订阅配置；未配置时才回退全部已授权站点
const siteSummary = ref<{ rss: number; search: number }>({ rss: 0, search: 0 });
const usingDefaultSites = ref(false);

async function loadSiteSummary() {
  try {
    const res: any = await getVisibleSitesApi();
    const list = Array.isArray(res) ? res : res?.data || [];
    const allSearch = list.filter((i: any) =>
      (i.permissions || []).includes('search'),
    ).length;
    const allRss = list.filter((i: any) =>
      (i.permissions || []).includes('rss'),
    ).length;
    let search = allSearch;
    let rss = allRss;
    usingDefaultSites.value = false;
    if (props.item) {
      const mtype = props.item.type === 'movie' ? 'movie' : 'tv';
      const defaults: any = await getDefaultSubscriptionSettingApi(
        mtype,
        effectiveProfile.value || undefined,
      );
      const setting = defaults?.data || defaults || {};
      const defaultSearch = Array.isArray(setting.search_sites)
        ? setting.search_sites
        : [];
      const defaultRss = Array.isArray(setting.rss_sites)
        ? setting.rss_sites
        : [];
      if (defaultSearch.length > 0 || defaultRss.length > 0) {
        usingDefaultSites.value = true;
        search = defaultSearch.length || allSearch;
        rss = defaultRss.length || allRss;
      }
    }
    siteSummary.value = { search, rss };
  } catch {
    siteSummary.value = { rss: 0, search: 0 };
  }
}
// 动漫与电视剧共用季/集模型，仅电影走单片流程
const isTv = computed(() => props.item?.type !== 'movie');

watch(
  () => props.show,
  async (visible) => {
    if (visible && props.item) {
      selectedSeasons.value = [];
      policy.value = (props.item as any).metadata_policy || 'auto';
      seasons.value = [];
      subscribedSeasons.value = [];
      loadSiteSummary();
      // 只有 TMDB（或缺省来源）才用 tmdbid 拉季列表；豆瓣/Bangumi/content_id
      // 的 mediaid 不是 TMDB ID，不能拿数字 ID 去查 TMDB。
      const provider = String(props.item.anchor_provider || '').trim();
      const tmdbId =
        provider && provider !== 'tmdb'
          ? ''
          : String(props.item.tmdbid || props.item.id || '');
      if (isTv.value) {
        loading.value = true;
        try {
          const subRes = await getSubscribedSeasonsApi({
            name: props.item.title,
            year: props.item.year,
            anchor_provider: props.item.anchor_provider,
            anchor_external_id: props.item.anchor_external_id,
          }).catch(() => ({ seasons: [] }));
          const subList = Array.isArray((subRes as any)?.seasons)
            ? (subRes as any).seasons
            : [];
          subscribedSeasons.value = subList.map(Number);
          if (tmdbId) {
            const seasonRes = await getTvSeasonListApi(
              tmdbId,
              props.item.title,
            );
            const list = Array.isArray(seasonRes)
              ? seasonRes
              : (seasonRes as any)?.data || [];
            // 兼容后端两种字段格式：{num,text} 和 {season_number,name,episode_count}
            seasons.value = list
              .map((s: any) => ({
                season_number: Number(s.num ?? s.season_number ?? 0),
                name: s.text || s.name,
                episode_count: s.episode_count,
              }))
              .filter((s: any) => s.season_number > 0)
              .toSorted((a: any, b: any) => a.season_number - b.season_number);
          } else if (provider && props.item.anchor_external_id) {
            const detail: any = await getMediaDetailByRefApi(
              provider,
              String(props.item.anchor_external_id),
              'tv',
              props.item.content_profile,
              props.item.id,
              props.item.title,
              props.item.year,
            );
            const list = Array.isArray(detail?.seasons) ? detail.seasons : [];
            seasons.value = list
              .map((s: any) => ({
                season_number: Number(s.season_number ?? s.num ?? 0),
                name: s.name || s.text,
                episode_count: s.episode_count,
              }))
              .filter((s: any) => s.season_number > 0)
              .toSorted((a: any, b: any) => a.season_number - b.season_number);
          }
        } catch {
          /* ignore */
        }
      }
      // 未获取到季信息时（非 TMDB 来源或接口失败），默认提供第一季
      const parsedTitleSeason = parseTitleSeason(
        String(props.item?.title || ''),
      );
      if (isTv.value && parsedTitleSeason > 0) {
        const fallbackEpisodeCount = seasons.value.find(
          (s: any) => Number(s.episode_count) > 0,
        )?.episode_count;
        const onlyFirstSeason =
          seasons.value.length === 0 ||
          seasons.value.every((s: any) => Number(s.season_number) === 1);
        if (parsedTitleSeason > 1 && onlyFirstSeason) {
          // 豆瓣单季条目：来源只返回 S1，标题写的是第二/三季，直接替换，
          // 不能再同时显示一个假的 S1。
          seasons.value = [
            {
              name: `第${parsedTitleSeason}季`,
              season_number: parsedTitleSeason,
              episode_count: fallbackEpisodeCount,
            },
          ];
        } else if (
          !seasons.value.some(
            (s: any) => Number(s.season_number) === parsedTitleSeason,
          )
        ) {
          seasons.value.push({
            name: `第${parsedTitleSeason}季`,
            season_number: parsedTitleSeason,
            episode_count: fallbackEpisodeCount,
          });
          seasons.value.sort(
            (a: any, b: any) => a.season_number - b.season_number,
          );
        }
        if (
          selectedSeasons.value.length === 0 ||
          (selectedSeasons.value.length === 1 &&
            Number(selectedSeasons.value[0]) === 1 &&
            parsedTitleSeason > 1)
        ) {
          selectedSeasons.value = [parsedTitleSeason];
        }
      }
      if (isTv.value && seasons.value.length === 0) {
        seasons.value = [{ season_number: 1, name: '第一季' }];
      }
      if (isTv.value && seasons.value.length > 0) {
        // 已有订阅：预选中已订阅季（可取消或追加）；
        // 无订阅：标题写了第二/三季时优先选中该季，否则选第一季。
        const titleSeasonExists =
          parsedTitleSeason > 0 &&
          seasons.value.some(
            (s: any) => Number(s.season_number) === parsedTitleSeason,
          );
        selectedSeasons.value =
          subscribedSeasons.value.length > 0
            ? [...subscribedSeasons.value]
            : [
                titleSeasonExists
                  ? parsedTitleSeason
                  : seasons.value[0]!.season_number,
              ];
      }
      loading.value = false;
    }
  },
);

function isSubscribed(num: number): boolean {
  return subscribedSeasons.value.includes(num);
}

const addSeasons = computed(() =>
  selectedSeasons.value.filter((s) => !subscribedSeasons.value.includes(s)),
);
const removeSeasons = computed(() =>
  subscribedSeasons.value.filter((s) => !selectedSeasons.value.includes(s)),
);
const hasChanges = computed(
  () => addSeasons.value.length > 0 || removeSeasons.value.length > 0,
);

function handleConfirm(autoMode: boolean) {
  if (isTv.value && !hasChanges.value) {
    return;
  }
  emit('confirm', {
    add: addSeasons.value,
    remove: removeSeasons.value,
    selected: [...selectedSeasons.value],
    autoMode,
    policy: policy.value,
  });
  emit('update:show', false);
}

function handleEdit() {
  emit('edit');
  emit('update:show', false);
}

function toggleSeason(num: number) {
  const idx = selectedSeasons.value.indexOf(num);
  if (idx === -1) {
    selectedSeasons.value.push(num);
  } else {
    selectedSeasons.value.splice(idx, 1);
  }
}
</script>

<template>
  <NModal
    :show="props.show"
    @update:show="(v) => emit('update:show', v)"
    preset="card"
    :title="`订阅确认 - ${item?.title || ''}`"
    style="width: 480px; max-width: 90vw"
    :bordered="false"
  >
    <div v-if="item" class="space-y-4">
      <!-- 元数据策略 -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500 flex-shrink-0">元数据策略</span>
        <NSelect
          v-model:value="policy"
          :options="policyOptions"
          size="small"
          class="flex-1"
        />
      </div>

      <!-- 基本信息 -->
      <div class="flex gap-3">
        <MediaPoster
          :src="item.image"
          :content-profile="item.content_profile"
          class="rounded-lg flex-shrink-0"
          style="width: 80px; aspect-ratio: 2/3"
          alt=""
        />
        <div class="min-w-0 flex-1">
          <h4 class="font-bold truncate">{{ item.title }}</h4>
          <p v-if="item.year" class="text-gray-500 text-sm mt-0.5">
            {{ item.year }}
          </p>
          <p
            v-if="item.overview"
            class="text-gray-500 text-sm mt-1 line-clamp-2"
          >
            {{ item.overview }}
          </p>
          <div class="mt-2">
            <span
              class="text-xs px-2 py-0.5 rounded"
              :class="
                item.type === 'movie'
                  ? 'bg-lime-100 text-lime-700'
                  : 'bg-blue-100 text-blue-700'
              "
            >
              {{ typeLabel }}
            </span>
          </div>
        </div>
      </div>

      <!-- TV 多季选择 -->
      <div v-if="isTv" class="border-t pt-3">
        <div class="text-sm font-medium mb-2">
          选择订阅季
          <span class="text-xs text-gray-400 font-normal">
            （勾选=订阅，取消勾选已订阅季=退订）
          </span>
        </div>
        <NSpin :show="loading">
          <div
            v-if="seasons.length > 0"
            class="grid gap-2"
            style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr))"
          >
            <NCard
              v-for="s in seasons"
              :key="s.season_number"
              size="small"
              class="cursor-pointer transition"
              :class="[
                selectedSeasons.includes(s.season_number)
                  ? 'ring-2 ring-blue-500'
                  : 'hover:border-gray-300',
              ]"
              @click="toggleSeason(s.season_number)"
            >
              <div class="flex items-center gap-2">
                <div @click.stop>
                  <NCheckbox
                    :checked="selectedSeasons.includes(s.season_number)"
                    @update:checked="() => toggleSeason(s.season_number)"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-medium truncate">
                      第{{ s.season_number }}季
                    </span>
                    <NTag
                      v-if="isSubscribed(s.season_number)"
                      type="warning"
                      size="tiny"
                      :bordered="false"
                    >
                      已订阅
                    </NTag>
                  </div>
                  <div v-if="s.episode_count" class="text-xs text-gray-500">
                    {{ s.episode_count }}集
                  </div>
                </div>
              </div>
            </NCard>
          </div>
          <div v-else class="text-gray-400 text-sm py-4 text-center">
            未获取到季信息
          </div>
        </NSpin>
      </div>

      <!-- 站点提示：未单独配置时使用全部已授权站点 -->
      <div class="site-hint">
        <IconifyIcon icon="lucide:globe" class="size-3.5" />
        <span v-if="siteSummary.search === 0">
          暂无可用站点，请联系管理员为你授权站点
        </span>
        <span v-else-if="usingDefaultSites">
          将使用默认订阅配置（搜索 {{ siteSummary.search }} 个 · RSS
          {{ siteSummary.rss }} 个），可在「修改配置」中调整
        </span>
        <span v-else>
          默认订阅未配置站点，将使用全部已授权站点（搜索
          {{ siteSummary.search }} 个 · RSS
          {{ siteSummary.rss }} 个），可在「修改配置」中指定
        </span>
      </div>

      <!-- 操作按钮 -->
      <div class="border-t pt-4 flex justify-between items-center">
        <NButton quaternary size="small" @click="handleEdit">
          <template #icon>
            <IconifyIcon icon="lucide:pencil" class="size-4" />
          </template>
          修改配置
        </NButton>
        <NSpace>
          <NButton size="small" @click="emit('update:show', false)">
            取消
          </NButton>
          <NButton
            type="primary"
            size="small"
            :disabled="isTv && !hasChanges"
            @click="handleConfirm(true)"
          >
            {{ isTv && removeSeasons.length > 0 ? '保存更改' : '确定订阅' }}
          </NButton>
        </NSpace>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.site-hint {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-top: 0.75rem;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.line-clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
