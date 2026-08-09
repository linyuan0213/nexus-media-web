<script lang="ts" setup>
import { ref } from 'vue';

import { NRadioButton, NRadioGroup } from 'naive-ui';

import RenameFormatBuilder from './RenameFormatBuilder.vue';

interface Props {
  config: Record<string, any>;
  saving?: boolean;
}

withDefaults(defineProps<Props>(), {
  saving: false,
});

const emit = defineEmits<{
  save: [];
  updateConfig: [key: string, value: any];
}>();

const mediaType = ref<'movie' | 'tv'>('tv');

const activeKey = () =>
  mediaType.value === 'movie'
    ? 'media.movie_name_format'
    : 'media.tv_name_format';
</script>

<template>
  <div class="w-full">
    <div class="mb-4">
      <NRadioGroup v-model:value="mediaType" size="small">
        <NRadioButton value="tv">电视剧</NRadioButton>
        <NRadioButton value="movie">电影</NRadioButton>
      </NRadioGroup>
    </div>

    <RenameFormatBuilder
      :key="mediaType"
      :model-value="config[activeKey()] || ''"
      :media-type="mediaType"
      :saving="saving"
      @update:model-value="(v) => emit('updateConfig', activeKey(), v)"
      @save="emit('save')"
    />
  </div>
</template>
