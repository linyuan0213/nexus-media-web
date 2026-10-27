<script lang="ts" setup>
import type { MediaApi } from '#/api/modules/media';

import { computed, ref, watch } from 'vue';

import {
  NAlert,
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NEmpty,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  useMessage,
} from 'naive-ui';

import { syncMediaLibrariesApi } from '#/api/modules/media';

const props = defineProps<{
  show: boolean;
  servers: MediaApi.MediaServerOption[];
  sections: MediaApi.LibrarySection[];
  initialServerId?: null | number;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const message = useMessage();
const serverId = ref<null | number>(null);
const selectedLibraries = ref<string[]>([]);
const submitting = ref(false);

const serverOptions = computed(() =>
  props.servers.map((server) => ({
    label: `${server.name}（${server.type}）`,
    value: server.id,
  })),
);
const currentSection = computed(() =>
  props.sections.find((section) => section.server_id === serverId.value),
);
const libraries = computed(() => currentSection.value?.librarys || []);
const allSelected = computed(
  () =>
    libraries.value.length > 0 &&
    selectedLibraries.value.length === libraries.value.length,
);

watch(
  () => [props.show, props.initialServerId, props.sections],
  () => {
    if (!props.show) return;
    const candidates = props.sections.filter(
      (section) => section.server_success,
    );
    serverId.value =
      props.initialServerId &&
      candidates.some((section) => section.server_id === props.initialServerId)
        ? props.initialServerId
        : candidates[0]?.server_id || props.servers[0]?.id || null;
    selectedLibraries.value = [];
  },
  { immediate: true },
);

watch(serverId, () => {
  selectedLibraries.value = [];
});

function toggleAll(checked: boolean) {
  selectedLibraries.value = checked
    ? libraries.value.map((library) => String(library.id))
    : [];
}

async function submit() {
  if (!serverId.value || selectedLibraries.value.length === 0) return;
  submitting.value = true;
  try {
    await syncMediaLibrariesApi({
      server_id: serverId.value,
      librarys: selectedLibraries.value,
    });
    message.success('媒体库同步已提交，请稍后查看同步状态');
    emit('update:show', false);
  } catch (error: any) {
    message.error(
      error?.response?.data?.detail || error?.message || '同步提交失败',
    );
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    title="同步媒体库"
    preset="card"
    :style="{ width: '600px', maxWidth: 'calc(100vw - 32px)' }"
    @update:show="emit('update:show', $event)"
  >
    <NSpin :show="submitting">
      <div class="sync-form">
        <div>
          <div class="field-label">目标服务器</div>
          <NSelect
            v-model:value="serverId"
            :options="serverOptions"
            placeholder="选择媒体服务器实例"
          />
        </div>

        <NAlert
          v-if="currentSection && !currentSection.server_success"
          type="warning"
          :bordered="false"
        >
          当前实例连接失败，无法提交同步。
        </NAlert>

        <div v-if="libraries.length" class="library-selection">
          <div class="selection-toolbar">
            <NCheckbox :checked="allSelected" @update:checked="toggleAll">
              全选媒体库
            </NCheckbox>
            <span
              >已选 {{ selectedLibraries.length }} /
              {{ libraries.length }}</span
            >
          </div>
          <NCheckboxGroup v-model:value="selectedLibraries">
            <div class="library-options">
              <NCheckbox
                v-for="library in libraries"
                :key="library.id"
                :value="String(library.id)"
                :label="library.name"
              />
            </div>
          </NCheckboxGroup>
        </div>
        <NEmpty v-else description="当前实例暂无可同步媒体库" />
      </div>
    </NSpin>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton
          type="primary"
          :loading="submitting"
          :disabled="
            !serverId ||
            selectedLibraries.length === 0 ||
            !currentSection?.server_success
          "
          @click="submit"
        >
          开始同步
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.sync-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field-label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
}

.selection-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.library-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  max-height: 40vh;
  padding-top: 14px;
  overflow-y: auto;
}

@media (max-width: 640px) {
  .library-options {
    grid-template-columns: 1fr;
  }
}
</style>
