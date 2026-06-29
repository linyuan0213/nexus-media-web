<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NSelect,
  NSwitch,
} from 'naive-ui';

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

const tmdbDomains = ['api.themoviedb.org', 'api.tmdb.org'];

const matchModes = [
  { label: '正常模式', value: 'normal' },
  { label: '严格模式', value: 'strict' },
];

const languages = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
];

const downloadOrders = [
  { label: '默认', value: '' },
  { label: '站点优先', value: 'site' },
  { label: '做种数优先', value: 'seeder' },
];

const rmtModes = [
  { label: '硬链接', value: 'link' },
  { label: '移动', value: 'move' },
  { label: '复制', value: 'copy' },
];
</script>

<template>
  <NCard
    id="basic_media"
    size="small"
    class="mb-6 overflow-hidden"
    style="
      background: hsl(var(--card));
      border-color: hsl(var(--border));
      border-left-color: hsl(var(--primary));
      border-left-width: 4px;
    "
  >
    <template #header>
      <div class="flex items-center gap-2">
        <IconifyIcon
          icon="lucide:database"
          class="size-4"
          style="color: hsl(var(--primary))"
        />
        <span class="font-semibold" style="color: hsl(var(--card-foreground))"
          >媒体</span
        >
      </div>
    </template>
    <NForm label-placement="top">
      <NGrid cols="1 s:1 m:2 l:2" :x-gap="16" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="TMDB API Key">
            <NInput
              :value="config['app.rmt_tmdbkey']"
              placeholder="必填"
              @update:value="(v) => emit('updateConfig', 'app.rmt_tmdbkey', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="TMDB API Url">
            <NSelect
              :value="config['app.tmdb_domain']"
              :options="tmdbDomains.map((d) => ({ label: d, value: d }))"
              @update:value="(v) => emit('updateConfig', 'app.tmdb_domain', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="TMDB匹配模式">
            <NSelect
              :value="config['app.rmt_match_mode']"
              :options="matchModes"
              @update:value="
                (v) => emit('updateConfig', 'app.rmt_match_mode', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="TMDB语言">
            <NSelect
              :value="config['media.tmdb_language']"
              :options="languages"
              @update:value="
                (v) => emit('updateConfig', 'media.tmdb_language', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="TMDB图片代理">
            <NInput
              :value="config['app.tmdb_image_url']"
              placeholder="https://image.tmdb.org"
              @update:value="
                (v) => emit('updateConfig', 'app.tmdb_image_url', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="下载优先规则">
            <NSelect
              :value="config['pt.download_order']"
              :options="downloadOrders"
              @update:value="
                (v) => emit('updateConfig', 'pt.download_order', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="默认文件转移方式">
            <NSelect
              :value="config['media.default_rmt_mode']"
              :options="rmtModes"
              @update:value="
                (v) => emit('updateConfig', 'media.default_rmt_mode', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="转移最小文件大小(MB)">
            <NInput
              :value="config['media.min_filesize']"
              placeholder="200"
              @update:value="
                (v) => emit('updateConfig', 'media.min_filesize', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="文件管理默认路径">
            <NInput
              :value="config['media.media_default_path']"
              placeholder="/"
              @update:value="
                (v) => emit('updateConfig', 'media.media_default_path', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="文件路径转移忽略词">
            <NInput
              :value="config['media.ignored_paths']"
              placeholder="支持正则，使用;分隔"
              @update:value="
                (v) => emit('updateConfig', 'media.ignored_paths', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="文件名转移忽略词">
            <NInput
              :value="config['media.ignored_files']"
              placeholder="支持正则，使用;分隔"
              @update:value="
                (v) => emit('updateConfig', 'media.ignored_files', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1 s:1 m:2 l:2">
          <NFormItem label="电影重命名格式">
            <NInput
              :value="config['media.movie_name_format']"
              placeholder="{title} ({year})/{title}-{part} ({year}) - {videoFormat}"
              @update:value="
                (v) => emit('updateConfig', 'media.movie_name_format', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1 s:1 m:2 l:2">
          <NFormItem label="电视剧重命名格式">
            <NInput
              :value="config['media.tv_name_format']"
              placeholder="{title} ({year})/Season {season}/{title}-{part} - {season_episode} - 第 {episode} 集"
              @update:value="
                (v) => emit('updateConfig', 'media.tv_name_format', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="高质量文件覆盖">
            <NSwitch
              :value="config['media.filesize_cover']"
              @update:value="
                (v) => emit('updateConfig', 'media.filesize_cover', v)
              "
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="刮削元数据及图片">
            <NSwitch
              :value="config['media.nfo_poster']"
              @update:value="(v) => emit('updateConfig', 'media.nfo_poster', v)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem span="1">
          <NFormItem label="启用集数映射">
            <NSwitch
              :value="config['media.episode_mapping_enabled']"
              @update:value="
                (v) => emit('updateConfig', 'media.episode_mapping_enabled', v)
              "
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </NForm>
    <template #footer>
      <div class="flex justify-end">
        <NButton
          type="primary"
          size="small"
          :loading="saving"
          @click="emit('save')"
        >
          保存
        </NButton>
      </div>
    </template>
  </NCard>
</template>
