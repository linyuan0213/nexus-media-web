<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import {
  NButton,
  NCard,
  NCheckbox,
  NModal,
  NSpace,
  NSpin,
} from 'naive-ui';
import { getTvSeasonListApi } from '#/api/modules/media';

export interface SubscribeConfirmItem {
  id: string;
  tmdbid?: string;
  title: string;
  year?: string;
  type: string; // MOV/TV
  image?: string;
  overview?: string;
}

const props = defineProps<{
  show: boolean;
  item: SubscribeConfirmItem | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void;
  (e: 'confirm', seasons: number[], autoMode: boolean): void;
  (e: 'edit'): void;
}>();

const loading = ref(false);
const seasons = ref<Array<{ season_number: number; name?: string; episode_count?: number; poster_path?: string }>>([]);
const selectedSeasons = ref<number[]>([]);
const isTv = computed(() => props.item?.type === 'TV');

watch(() => props.show, async (visible) => {
  if (visible && props.item) {
    selectedSeasons.value = [];
    seasons.value = [];
    const tmdbId = props.item.tmdbid || props.item.id;
    if (isTv.value && tmdbId) {
      loading.value = true;
      try {
        const res: any = await getTvSeasonListApi(tmdbId, props.item.title);
        const list = Array.isArray(res) ? res : (res?.data || []);
        // 兼容后端两种字段格式：{num,text} 和 {season_number,name,episode_count}
        seasons.value = list
          .map((s: any) => ({
            season_number: Number(s.num ?? s.season_number ?? 0),
            name: s.text || s.name,
            episode_count: s.episode_count,
          }))
          .filter((s: any) => s.season_number > 0)
          .sort((a: any, b: any) => a.season_number - b.season_number);
      } catch { /* ignore */ }
    }
    // 未获取到季信息时（豆瓣无TMDB映射或接口失败），默认提供第一季
    if (isTv.value && seasons.value.length === 0) {
      seasons.value = [{ season_number: 1, name: '第一季' }];
    }
    if (isTv.value && seasons.value.length > 0) {
      selectedSeasons.value = [seasons.value[0]!.season_number];
    }
    loading.value = false;
  }
});

function handleConfirm(autoMode: boolean) {
  if (isTv.value && selectedSeasons.value.length === 0) {
    return;
  }
  emit('confirm', selectedSeasons.value, autoMode);
  emit('update:show', false);
}

function handleEdit() {
  emit('edit');
  emit('update:show', false);
}

function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return src;
}

function toggleSeason(num: number) {
  const idx = selectedSeasons.value.indexOf(num);
  if (idx >= 0) {
    selectedSeasons.value.splice(idx, 1);
  } else {
    selectedSeasons.value.push(num);
  }
}
</script>

<template>
  <NModal
    :show="props.show"
    @update:show="(v) => emit('update:show', v)"
    preset="card"
    :title="`订阅确认 - ${item?.title || ''}`"
    style="width: 480px; max-width: 90vw;"
    :bordered="false"
  >
    <div v-if="item" class="space-y-4">
      <!-- 基本信息 -->
      <div class="flex gap-3">
        <img
          :src="getImgUrl(item.image)"
          class="rounded-lg object-cover flex-shrink-0"
          style="width: 80px; aspect-ratio: 2/3;"
          alt=""
        />
        <div class="min-w-0 flex-1">
          <h4 class="font-bold truncate">{{ item.title }}</h4>
          <p v-if="item.year" class="text-gray-500 text-sm mt-0.5">{{ item.year }}</p>
          <p v-if="item.overview" class="text-gray-500 text-sm mt-1 line-clamp-2">{{ item.overview }}</p>
          <div class="mt-2">
            <span
              class="text-xs px-2 py-0.5 rounded"
              :class="item.type === 'MOV' ? 'bg-lime-100 text-lime-700' : 'bg-blue-100 text-blue-700'"
            >
              {{ item.type === 'MOV' ? '电影' : '剧集' }}
            </span>
          </div>
        </div>
      </div>

      <!-- TV 多季选择 -->
      <div v-if="isTv" class="border-t pt-3">
        <div class="text-sm font-medium mb-2">选择订阅季</div>
        <NSpin :show="loading">
          <div v-if="seasons.length > 0" class="flex flex-wrap gap-2">
            <NCard
              v-for="s in seasons"
              :key="s.season_number"
              size="small"
              :class="[
                'cursor-pointer transition w-[calc(50%-4px)]',
                selectedSeasons.includes(s.season_number) ? 'ring-2 ring-blue-500' : 'hover:border-gray-300'
              ]"
              @click="toggleSeason(s.season_number)"
            >
              <div class="flex items-center gap-2">
                <div @click.stop>
                  <NCheckbox :checked="selectedSeasons.includes(s.season_number)" @update:checked="() => toggleSeason(s.season_number)" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium truncate">第{{ s.season_number }}季</div>
                  <div v-if="s.episode_count" class="text-xs text-gray-500">{{ s.episode_count }}集</div>
                </div>
              </div>
            </NCard>
          </div>
          <div v-else class="text-gray-400 text-sm py-4 text-center">未获取到季信息</div>
        </NSpin>
      </div>

      <!-- 操作按钮 -->
      <div class="border-t pt-4 flex justify-between items-center">
        <NButton quaternary size="small" @click="handleEdit">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </template>
          编辑
        </NButton>
        <NSpace>
          <NButton size="small" @click="emit('update:show', false)">取消</NButton>
          <NButton
            type="primary"
            size="small"
            :disabled="isTv && selectedSeasons.length === 0"
            @click="handleConfirm(true)"
          >
            确定订阅
          </NButton>
        </NSpace>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
