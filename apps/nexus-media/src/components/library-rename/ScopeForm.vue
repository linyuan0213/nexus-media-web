<script lang="ts" setup>
import type { LibraryRenameApi } from '#/api/modules/library_rename';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
} from 'naive-ui';

import { getLibraryPathsApi, getLibraryServersApi } from '#/api/modules/media';
import PathPickerModal from '#/components/media/PathPickerModal.vue';

const props = defineProps<{
  loading: boolean;
  modelValue: LibraryRenameApi.RenameScope;
}>();

const emit = defineEmits<{
  (e: 'reset'): void;
  (e: 'submit'): void;
  (e: 'update:modelValue', value: LibraryRenameApi.RenameScope): void;
}>();

const scope = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const mediaTypeOptions = [
  { label: '电影', value: 'movie' },
  { label: '电视剧', value: 'tv' },
  { label: '动漫', value: 'anime' },
];

const categoryMode = computed<'default' | 'preserve' | 'reorganize'>({
  get: () => {
    if (scope.value.reorganize_category) return 'reorganize';
    return scope.value.preserve_current_category ? 'preserve' : 'default';
  },
  set: (value) => {
    scope.value.reorganize_category = value === 'reorganize';
    scope.value.preserve_current_category = value === 'preserve';
  },
});

const categoryModeOptions = [
  { label: '保留当前分类/精选目录（推荐）', value: 'preserve' },
  { label: '按当前规则重新分类', value: 'reorganize' },
  { label: '按当前规则（不使用分类目录）', value: 'default' },
];

const libraryOptions = ref<{ label: string; value: string }[]>([]);
const serverOptions = ref([{ label: '默认实例', value: '' }]);
const librariesLoading = ref(false);
const pathPickerShow = ref(false);

async function loadLibraries() {
  librariesLoading.value = true;
  try {
    const result = (await getLibraryPathsApi()) as Record<string, any>;
    const libraries = result?.libraries || result?.library_paths || [];
    libraryOptions.value = libraries.map((item: any) => ({
      label: `${item.library_type_label || item.library_type || item.type} · ${item.path}`,
      value: item.path,
    }));
  } catch {
    libraryOptions.value = [];
  } finally {
    librariesLoading.value = false;
  }
}

onMounted(() => {
  void loadLibraries();
  void loadServers();
});

async function loadServers() {
  try {
    const servers = await getLibraryServersApi();
    serverOptions.value = [
      { label: '默认实例', value: '' },
      ...servers.map((server) => ({
        label: `${server.name}（${server.type}）`,
        value: String(server.id),
      })),
    ];
  } catch {
    serverOptions.value = [{ label: '默认实例', value: '' }];
  }
}

function addRoot() {
  pathPickerShow.value = true;
}

function onPathPicked(path: string) {
  if (!path || scope.value.roots.includes(path)) return;
  scope.value.roots.push(path);
}

function removeRoot(path: string) {
  scope.value.roots = scope.value.roots.filter((item) => item !== path);
}
</script>

<template>
  <NCard class="rename-settings" :bordered="false" title="重命名范围">
    <NSpin :show="librariesLoading">
      <NForm label-placement="top" size="small">
        <NFormItem label="媒体库路径">
          <NSelect
            v-model:value="scope.roots"
            :options="libraryOptions"
            :placeholder="
              libraryOptions.length
                ? '默认扫描全部已配置媒体库'
                : '尚未配置媒体库路径'
            "
            multiple
            clearable
            filterable
          />
          <div class="root-actions">
            <NButton dashed size="small" @click="addRoot">
              <template #icon>
                <IconifyIcon icon="lucide:folder-plus" class="size-4" />
              </template>
              自定义目录
            </NButton>
            <NTag
              v-for="root in scope.roots.filter(
                (root) => !libraryOptions.some((item) => item.value === root),
              )"
              :key="root"
              closable
              size="small"
              @close="removeRoot(root)"
            >
              {{ root }}
            </NTag>
          </div>
        </NFormItem>

        <NFormItem label="媒体类型">
          <NCheckboxGroup v-model:value="scope.media_types">
            <NCheckbox
              v-for="option in mediaTypeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </NCheckbox>
          </NCheckboxGroup>
        </NFormItem>

        <NFormItem v-if="scope.use_mediaserver_metadata" label="媒体服务器">
          <NSelect
            :value="scope.server_id ? String(scope.server_id) : ''"
            :options="serverOptions"
            @update:value="scope.server_id = $event ? Number($event) : null"
          />
          <div class="form-hint">
            选择用于读取元数据的实例，重命名后的刷新也使用该实例。
          </div>
        </NFormItem>

        <NCollapse class="rename-advanced">
          <NCollapseItem name="advanced" title="高级选项">
            <NFormItem label="布局方式">
              <NRadioGroup v-model:value="scope.layout_mode">
                <NRadioButton value="full">完整重布局</NRadioButton>
                <NRadioButton value="filename_only">仅文件名</NRadioButton>
              </NRadioGroup>
              <div class="form-hint">
                「完整重布局」会同时调整目录层级；「仅文件名」保持当前目录不动。
              </div>
            </NFormItem>

            <NFormItem label="分类目录策略">
              <NSelect
                v-model:value="categoryMode"
                :options="categoryModeOptions"
              />
            </NFormItem>

            <NFormItem label="元数据来源">
              <div class="switch-list">
                <div class="switch-item">
                  <NSwitch v-model:value="scope.use_mediaserver_metadata" />
                  <div>
                    <div class="switch-label">使用媒体服务器元数据</div>
                    <div class="form-hint">
                      从 Emby/Jellyfin/Plex 按路径识别，不访问 TMDB
                    </div>
                  </div>
                </div>
                <div class="switch-item">
                  <NSwitch v-model:value="scope.allow_online_metadata" />
                  <div>
                    <div class="switch-label">联网补全（TMDB）</div>
                    <div class="form-hint">
                      为已有 TMDB ID 的文件补全英文标题、集标题等
                    </div>
                  </div>
                </div>
                <div class="switch-item">
                  <NSwitch v-model:value="scope.reidentify_no_metadata" />
                  <div>
                    <div class="switch-label">重新识别无元数据文件</div>
                    <div class="form-hint">
                      对既无历史也无 NFO 的文件尝试在线识别
                    </div>
                  </div>
                </div>
              </div>
            </NFormItem>

            <NFormItem label="单次计划上限">
              <NInputNumber
                v-model:value="scope.limit"
                :max="20000"
                :min="1"
                :show-button="false"
                class="full-width"
              />
            </NFormItem>
          </NCollapseItem>
        </NCollapse>
      </NForm>
    </NSpin>

    <PathPickerModal
      v-model:show="pathPickerShow"
      title="选择目录"
      @confirm="onPathPicked"
    />
  </NCard>
</template>

<style scoped>
.rename-settings {
  background: hsl(var(--card));
  border-radius: var(--radius);
}

.form-hint {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.root-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.switch-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.switch-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.switch-label {
  font-size: 0.875rem;
  color: hsl(var(--card-foreground));
}

.full-width {
  width: 100%;
}

.rename-advanced {
  margin-top: 0.25rem;
}
</style>
