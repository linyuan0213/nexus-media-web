<script lang="ts" setup>
import {
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NInput,
  NSelect,
  NSwitch,
} from 'naive-ui';

import SettingsGroup from './SettingsGroup.vue';

interface Props {
  config: Record<string, any>;
}

defineProps<Props>();

const emit = defineEmits<{
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

const metadataPolicies = [
  { label: 'TMDB 优先', value: 'tmdb_primary' },
  { label: '豆瓣优先', value: 'douban_primary' },
  { label: 'Bangumi 优先', value: 'bangumi_primary' },
];

const downloadOrders = [
  { label: '默认', value: '' },
  { label: '站点优先', value: 'site' },
  { label: '做种数优先', value: 'seeder' },
];
</script>

<template>
  <NForm label-placement="top">
    <SettingsGroup
      title="元数据来源"
      description="TMDB 接口、语言与默认元数据策略。"
      icon="lucide:database"
    >
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
        <NGridItem span="1">
          <NFormItem label="TMDB API Key">
            <NInput
              :value="config['app.rmt_tmdbkey']"
              type="password"
              show-password-on="click"
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
          <NFormItem label="默认元数据策略">
            <NSelect
              :value="config['media.metadata_default_policy']"
              :options="metadataPolicies"
              @update:value="
                (v) => emit('updateConfig', 'media.metadata_default_policy', v)
              "
            />
            <template #feedback>
              未显式指定策略时使用；订阅自身策略优先
            </template>
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
      </NGrid>
    </SettingsGroup>

    <SettingsGroup
      title="下载与整理"
      description="资源选择偏好、转移大小下限和默认落盘路径。"
      icon="lucide:download"
    >
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
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
      </NGrid>
    </SettingsGroup>

    <SettingsGroup
      title="文件过滤与刮削"
      description="控制转移时忽略的文件，以及刮削和分集行为。"
      icon="lucide:file-cog"
    >
      <NGrid cols="1 s:1 m:2 l:3" :x-gap="12" :y-gap="8" responsive="screen">
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
    </SettingsGroup>
  </NForm>
</template>
