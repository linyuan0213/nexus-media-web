<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  id: number | string;
  title: string;
  poster?: string;
  year?: string;
  type?: 'movie' | 'tv';
  rating?: number;
  overview?: string;
  progress?: number;
  status?: string;
  extra?: string;
}

const props = defineProps<Props>();

const typeLabel = computed(() => {
  if (props.type === 'movie') return '电影';
  if (props.type === 'tv') return '剧集';
  return '';
});

const typeColor = computed(() => {
  if (props.type === 'movie') return 'bg-lime-500';
  if (props.type === 'tv') return 'bg-blue-500';
  return 'bg-gray-500';
});

const fallbackImage = '/static/img/no-image.png';

function handleImageError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.src = fallbackImage;
}
</script>

<template>
  <div class="media-card overflow-hidden rounded cursor-pointer tbl-card tbl-card-hover">
    <div class="relative">
      <img
        :src="poster || fallbackImage"
        class="w-full object-cover"
        style="aspect-ratio: 2/3"
        :alt="title"
        @error="handleImageError"
      />
      <span
        v-if="year"
        class="absolute top-2 left-2 px-2 py-0.5 text-xs rounded-full text-white bg-purple-500"
      >
        {{ year }}
      </span>
      <span
        v-if="typeLabel"
        class="absolute top-2 right-2 px-2 py-0.5 text-xs rounded-full text-white"
        :class="typeColor"
      >
        {{ typeLabel }}
      </span>
      <div
        v-if="progress !== undefined && progress >= 0"
        class="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1"
      >
        <div class="progress-bar-tblr">
          <div
            class="progress-bar-tblr-fill"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
    </div>
    <div class="p-2 text-center">
      <div class="text-sm font-semibold truncate" :title="title">{{ title }}</div>
      <div v-if="overview" class="text-xs text-gray-500 mt-1 line-clamp-2">{{ overview }}</div>
      <div v-if="extra" class="text-xs text-gray-500 mt-1">{{ extra }}</div>
      <div v-if="status" class="text-xs mt-1">
        <span
          class="inline-block w-2 h-2 rounded-full mr-1"
          :class="status === 'active' ? 'bg-green-500' : 'bg-gray-400'"
        />
        {{ status }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-card {
  transition: all 0.2s ease;
}
</style>
