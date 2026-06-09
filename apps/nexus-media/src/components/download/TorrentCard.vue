<script setup lang="ts">
interface Props {
  id: string;
  name: string;
  progress: number;
  speed?: string;
  size?: string;
  status: string;
  image?: string;
  noprogress?: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: 'start', id: string): void;
  (e: 'stop', id: string): void;
  (e: 'delete', id: string): void;
}>();

const fallbackImage = '/static/img/no-image.png';

function handleImageError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.src = fallbackImage;
}
</script>

<template>
  <div class="torrent-card tbl-card p-3">
    <div class="flex items-center gap-3">
      <div v-if="image" class="flex-shrink-0">
        <img
          :src="image"
          class="rounded"
          style="width: 80px; height: 100px; object-fit: cover"
          alt=""
          @error="handleImageError"
        />
      </div>
      <div class="flex-grow min-w-0">
        <h3 class="text-base font-medium truncate mb-1" :title="name">
          {{ name }}
        </h3>
        <div class="text-sm text-gray-500">{{ speed }}</div>
        <div v-if="!noprogress" class="mt-3">
          <div class="flex items-center gap-2">
            <div class="text-sm font-medium">{{ progress }}%</div>
            <div class="flex-grow">
              <div class="progress-bar-tblr">
                <div
                  class="progress-bar-tblr-fill"
                  :style="{ width: `${progress}%` }"
                ></div>
              </div>
            </div>
            <div v-if="size" class="text-xs text-gray-500">{{ size }}</div>
          </div>
        </div>
      </div>
      <div class="flex-shrink-0 flex gap-1">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.torrent-card {
  transition: all 0.2s ease;
}

.torrent-card:hover {
  box-shadow: 0 0.25rem 0.5rem rgb(0 0 0 / 10%);
}
</style>
