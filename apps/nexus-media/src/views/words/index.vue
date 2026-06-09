<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTooltip,
  useMessage,
} from 'naive-ui';

import {
  addWordGroupApi,
  analyseImportCodeApi,
  deleteWordApi,
  deleteWordGroupApi,
  exportWordsApi,
  getWordGroupsApi,
  importWordsApi,
  saveWordApi,
  toggleWordsApi,
} from '#/api';
import PageHeader from '#/components/page/PageHeader.vue';

interface WordItem {
  id: number;
  replaced: string;
  replace: string;
  front: string;
  back: string;
  offset: string;
  type: string;
  group_id: string;
  season: number;
  enabled: number;
  regex: number;
  help: string;
}

interface WordGroup {
  id: string;
  name: string;
  type?: string;
  seasons?: string;
  link?: string;
  words?: WordItem[];
}

const message = useMessage();
const groups = ref<WordGroup[]>([]);
const loading = ref(false);

const editingIds = ref<Set<string>>(new Set());
const editForms = ref<Record<string, any>>({});
const addingIds = ref<Set<string>>(new Set());
const addForms = ref<Record<string, any>>({});

const groupModal = ref(false);
const groupForm = ref({ tmdb_id: '', tmdb_type: 'tv' });

const importModal = ref(false);
const importCode = ref('');
const importPreview = ref<WordGroup[]>([]);
const importNote = ref('');
const selectedImportIds = ref<string[]>([]);

const exportModal = ref(false);
const exportCode = ref('');

const collapsedGroups = ref<Set<string>>(new Set());

const typeOptions = [
  { label: '屏蔽', value: '1' },
  { label: '替换', value: '2' },
  { label: '替换偏移', value: '3' },
  { label: '偏移', value: '4' },
];

const typeLabelMap: Record<string, string> = {
  '1': '屏蔽',
  '2': '替换',
  '3': '替换偏移',
  '4': '偏移',
};

const typeStyleMap: Record<string, { bg: string; color: string }> = {
  '1': {
    bg: 'hsl(var(--destructive) / 0.1)',
    color: 'hsl(var(--destructive))',
  },
  '2': { bg: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' },
  '3': { bg: 'hsl(var(--warning) / 0.1)', color: 'hsl(var(--warning))' },
  '4': { bg: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))' },
};

function getWordTypeLabel(type: number | string) {
  return typeLabelMap[String(type)] || String(type);
}

function getWordTypeStyle(type: number | string) {
  return (
    typeStyleMap[String(type)] || {
      bg: 'hsl(var(--muted))',
      color: 'hsl(var(--foreground))',
    }
  );
}

async function fetchData() {
  loading.value = true;
  try {
    const res: any = await getWordGroupsApi();
    groups.value = res || [];
    editingIds.value.clear();
    addingIds.value.clear();
    editForms.value = {};
    addForms.value = {};
  } catch (error: any) {
    message.error(error?.message || '获取识别词失败');
  } finally {
    loading.value = false;
  }
}

function showAddGroup() {
  groupForm.value = { tmdb_id: '', tmdb_type: 'tv' };
  groupModal.value = true;
}

async function handleAddGroup() {
  const id = Number.parseInt(groupForm.value.tmdb_id);
  if (!id || Number.isNaN(id)) {
    message.error('请输入有效的 TMDB ID');
    return;
  }
  try {
    await addWordGroupApi(id, groupForm.value.tmdb_type);
    groupModal.value = false;
    message.success('添加成功');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '添加失败');
  }
}

async function handleDeleteGroup(gid: string) {
  if (gid === '-1') {
    message.error('通用词组不能删除');
    return;
  }
  try {
    await deleteWordGroupApi(Number.parseInt(gid));
    message.success('删除成功');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '删除失败');
  }
}

function startEdit(word: WordItem) {
  const key = `${word.group_id}_${word.id}`;
  editingIds.value.add(key);
  editForms.value[key] = { ...word, type: String(word.type) };
}

function cancelEdit(groupId: string, wordId: number) {
  const key = `${groupId}_${wordId}`;
  editingIds.value.delete(key);
  delete editForms.value[key];
}

async function handleSaveEdit(groupId: string, wordId: number) {
  const key = `${groupId}_${wordId}`;
  const f = editForms.value[key];
  if (!f) return;

  try {
    await saveWordApi({
      id: wordId,
      gid: Number.parseInt(groupId),
      group_type: groups.value.find((g) => g.id === groupId)?.type || '1',
      new_replaced: f.replaced || '',
      new_replace: f.replace || '',
      new_front: f.front || '',
      new_back: f.back || '',
      new_offset: f.offset || '',
      new_help: f.help || '',
      type: String(f.type || '2'),
      season: f.season ?? -2,
      enabled: f.enabled ?? 1,
      regex: f.regex ?? 0,
    });
    editingIds.value.delete(key);
    delete editForms.value[key];
    message.success('保存成功');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '保存失败');
  }
}

function startAdd(group: WordGroup) {
  const tempId = `new_${Date.now()}`;
  addingIds.value.add(tempId);
  addForms.value[tempId] = {
    gid: Number.parseInt(group.id),
    group_id: group.id,
    replaced: '',
    replace: '',
    front: '',
    back: '',
    offset: '',
    help: '',
    type: '2',
    season: group.type === '2' ? 1 : -2,
    enabled: 1,
    regex: 0,
  };
}

function cancelAdd(tempId: string) {
  addingIds.value.delete(tempId);
  delete addForms.value[tempId];
}

async function handleSaveAdd(tempId: string) {
  const f = addForms.value[tempId];
  if (!f) return;

  if (!f.replaced && !f.front) {
    message.error('被替换词或前定位词至少填写一项');
    return;
  }

  try {
    await saveWordApi({
      gid: f.gid || 0,
      group_type: groups.value.find((g) => g.id === f.group_id)?.type || '1',
      new_replaced: f.replaced || '',
      new_replace: f.replace || '',
      new_front: f.front || '',
      new_back: f.back || '',
      new_offset: f.offset || '',
      new_help: f.help || '',
      type: String(f.type || '2'),
      season: f.season ?? -2,
      enabled: f.enabled ?? 1,
      regex: f.regex ?? 0,
    });
    addingIds.value.delete(tempId);
    delete addForms.value[tempId];
    message.success('添加成功');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '添加失败');
  }
}

async function handleToggleWord(word: WordItem) {
  const flag = word.enabled === 1 ? 'disable' : 'enable';
  const idInfo = `${word.group_id}_${word.id}`;
  try {
    await toggleWordsApi([idInfo], flag);
    message.success(flag === 'enable' ? '已启用' : '已停用');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '操作失败');
  }
}

async function handleDeleteWord(word: WordItem) {
  try {
    await deleteWordApi([`${word.group_id}_${word.id}`]);
    message.success('删除成功');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '删除失败');
  }
}

async function handleAnalyseImport() {
  if (!importCode.value.trim()) {
    message.error('请输入导入码');
    return;
  }
  try {
    const res: any = await analyseImportCodeApi(importCode.value.trim());
    const data = res?.data ?? res;
    importPreview.value = data.groups || [];
    importNote.value = data.note_string || '';
    selectedImportIds.value = [];
  } catch (error: any) {
    message.error(error?.message || '解析失败');
  }
}

async function handleImport() {
  if (!importCode.value.trim()) {
    message.error('请输入导入码');
    return;
  }
  try {
    await importWordsApi(
      importCode.value.trim(),
      selectedImportIds.value.join('@'),
    );
    importModal.value = false;
    message.success('导入成功');
    await fetchData();
  } catch (error: any) {
    message.error(error?.message || '导入失败');
  }
}

async function handleExport(group: WordGroup) {
  if (!group.words?.length) {
    message.error('该词组没有识别词');
    return;
  }
  const idsInfo = group.words.map((w) => `${group.id}_${w.id}`).join('@');
  try {
    const res: any = await exportWordsApi(idsInfo);
    exportCode.value = res?.data ?? res;
    exportModal.value = true;
  } catch (error: any) {
    message.error(error?.message || '导出失败');
  }
}

function copyExportCode() {
  navigator.clipboard.writeText(exportCode.value);
  message.success('已复制到剪贴板');
}

function toggleCollapse(gid: string) {
  if (collapsedGroups.value.has(gid)) {
    collapsedGroups.value.delete(gid);
  } else {
    collapsedGroups.value.add(gid);
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="p-5" style="background: hsl(var(--background))">
    <PageHeader title="自定义识别词">
      <template #actions>
        <NSpace>
          <NButton type="primary" @click="showAddGroup">
            <template #icon>
              <IconifyIcon icon="lucide:plus" class="size-4" />
            </template>
            新增词组
          </NButton>
          <NButton @click="importModal = true">
            <template #icon>
              <IconifyIcon icon="lucide:upload" class="size-4" />
            </template>
            导入
          </NButton>
        </NSpace>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="groups.length > 0" class="space-y-4 mt-5">
        <div
          v-for="group in groups"
          :key="group.id"
          class="rounded-xl border overflow-hidden"
          style="background: hsl(var(--card)); border-color: hsl(var(--border))"
        >
          <!-- 词组头部 -->
          <div
            class="flex items-center justify-between px-5 py-4 border-b cursor-pointer select-none"
            style="border-color: hsl(var(--border))"
            @click="toggleCollapse(group.id)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <IconifyIcon
                :icon="
                  collapsedGroups.has(group.id)
                    ? 'lucide:chevron-right'
                    : 'lucide:chevron-down'
                "
                class="size-5 flex-shrink-0"
                style="color: hsl(var(--muted-foreground))"
              />
              <a
                v-if="group.link"
                :href="group.link"
                target="_blank"
                class="font-semibold text-sm hover:underline truncate"
                style="color: hsl(var(--primary))"
                @click.stop
              >
                {{ group.name }}
              </a>
              <span
                v-else
                class="font-semibold text-sm truncate"
                style="color: hsl(var(--foreground))"
              >
                {{ group.name }}
              </span>
              <div
                v-if="group.seasons"
                class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                style="
                  color: hsl(var(--info));
                  background: hsl(var(--info) / 10%);
                "
              >
                {{ group.seasons }} 季
              </div>
            </div>

            <div class="flex items-center gap-1 flex-shrink-0">
              <NTooltip>
                <template #trigger>
                  <NButton text size="tiny" @click.stop="startAdd(group)">
                    <template #icon>
                      <IconifyIcon
                        icon="lucide:plus"
                        class="size-4"
                        style="color: hsl(var(--primary))"
                      />
                    </template>
                  </NButton>
                </template>
                添加识别词
              </NTooltip>
              <NTooltip>
                <template #trigger>
                  <NButton text size="tiny" @click.stop="handleExport(group)">
                    <template #icon>
                      <IconifyIcon
                        icon="lucide:download"
                        class="size-4"
                        style="color: hsl(var(--muted-foreground))"
                      />
                    </template>
                  </NButton>
                </template>
                导出
              </NTooltip>
              <NTooltip v-if="group.id !== '-1'">
                <template #trigger>
                  <NButton
                    text
                    size="tiny"
                    type="error"
                    @click.stop="handleDeleteGroup(group.id)"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:trash-2" class="size-4" />
                    </template>
                  </NButton>
                </template>
                删除词组
              </NTooltip>
            </div>
          </div>

          <!-- 识别词列表 -->
          <div v-if="!collapsedGroups.has(group.id)">
            <!-- 桌面端表格 -->
            <div class="hidden md:block px-4 pb-4">
              <div
                class="grid gap-2 px-3 py-2 text-xs font-medium border-b"
                style="
                  grid-template-columns: 70px 1fr 1fr 60px 70px 70px 44px 44px 72px;
                  border-color: hsl(var(--border));
                "
              >
                <span style="color: hsl(var(--muted-foreground))">类型</span>
                <span style="color: hsl(var(--muted-foreground))"
                  >被替换词</span
                >
                <span style="color: hsl(var(--muted-foreground))">替换词</span>
                <span style="color: hsl(var(--muted-foreground))">偏移</span>
                <span style="color: hsl(var(--muted-foreground))">前定位</span>
                <span style="color: hsl(var(--muted-foreground))">后定位</span>
                <span
                  class="text-center"
                  style="color: hsl(var(--muted-foreground))"
                  >正则</span
                >
                <span
                  class="text-center"
                  style="color: hsl(var(--muted-foreground))"
                  >状态</span
                >
                <span
                  class="text-center"
                  style="color: hsl(var(--muted-foreground))"
                  >操作</span
                >
              </div>

              <!-- 现有词 -->
              <div
                v-for="word in group.words"
                :key="word.id"
                class="rounded-lg transition-colors"
                :class="
                  editingIds.has(`${group.id}_${word.id}`)
                    ? ''
                    : 'hover:bg-muted/50'
                "
                :style="
                  editingIds.has(`${group.id}_${word.id}`)
                    ? 'background: hsl(var(--accent) / 0.3); box-shadow: inset 0 0 0 1px hsl(var(--border))'
                    : ''
                "
              >
                <!-- 展示模式 -->
                <div
                  v-if="!editingIds.has(`${group.id}_${word.id}`)"
                  class="grid gap-2 px-3 py-2 items-center text-sm"
                  style="
                    grid-template-columns: 70px 1fr 1fr 60px 70px 70px 44px 44px 72px;
                  "
                >
                  <div
                    class="flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :style="{
                      background: getWordTypeStyle(word.type).bg,
                      color: getWordTypeStyle(word.type).color,
                    }"
                  >
                    {{ getWordTypeLabel(word.type) }}
                  </div>
                  <span
                    class="truncate"
                    :title="word.replaced"
                    style="color: hsl(var(--foreground))"
                    >{{ word.replaced || '-' }}</span
                  >
                  <span
                    class="truncate"
                    :title="word.replace"
                    style="color: hsl(var(--foreground))"
                    >{{ word.replace || '-' }}</span
                  >
                  <span
                    class="truncate"
                    style="color: hsl(var(--muted-foreground))"
                    >{{ word.offset || '-' }}</span
                  >
                  <span
                    class="truncate"
                    style="color: hsl(var(--muted-foreground))"
                    >{{ word.front || '-' }}</span
                  >
                  <span
                    class="truncate"
                    style="color: hsl(var(--muted-foreground))"
                    >{{ word.back || '-' }}</span
                  >
                  <div class="text-center">
                    <span
                      v-if="word.regex === 1"
                      class="text-xs font-medium"
                      style="color: hsl(var(--warning))"
                      >是</span
                    >
                    <span
                      v-else
                      class="text-xs"
                      style="color: hsl(var(--muted-foreground) / 50%)"
                      >-</span
                    >
                  </div>
                  <div class="flex justify-center">
                    <NSwitch
                      :value="word.enabled === 1"
                      size="small"
                      @update:value="() => handleToggleWord(word)"
                    />
                  </div>
                  <div class="flex items-center justify-center gap-1">
                    <NTooltip>
                      <template #trigger>
                        <NButton text size="tiny" @click="startEdit(word)">
                          <template #icon>
                            <IconifyIcon
                              icon="lucide:pencil"
                              class="size-3.5"
                              style="color: hsl(var(--primary))"
                            />
                          </template>
                        </NButton>
                      </template>
                      编辑
                    </NTooltip>
                    <NTooltip>
                      <template #trigger>
                        <NButton
                          text
                          size="tiny"
                          type="error"
                          @click="handleDeleteWord(word)"
                        >
                          <template #icon>
                            <IconifyIcon
                              icon="lucide:trash-2"
                              class="size-3.5"
                            />
                          </template>
                        </NButton>
                      </template>
                      删除
                    </NTooltip>
                  </div>
                </div>

                <!-- 编辑模式 -->
                <div
                  v-else
                  class="grid gap-2 px-3 py-2 items-center"
                  style="
                    grid-template-columns: 70px 1fr 1fr 60px 70px 70px 44px 44px 72px;
                  "
                >
                  <NSelect
                    v-model:value="editForms[`${group.id}_${word.id}`].type"
                    size="small"
                    :options="typeOptions"
                    style="min-width: 70px"
                  />
                  <NInput
                    v-model:value="editForms[`${group.id}_${word.id}`].replaced"
                    size="small"
                    placeholder="被替换词"
                  />
                  <NInput
                    v-model:value="editForms[`${group.id}_${word.id}`].replace"
                    size="small"
                    placeholder="替换词"
                  />
                  <NInput
                    v-model:value="editForms[`${group.id}_${word.id}`].offset"
                    size="small"
                    placeholder="偏移"
                  />
                  <NInput
                    v-model:value="editForms[`${group.id}_${word.id}`].front"
                    size="small"
                    placeholder="前定位"
                  />
                  <NInput
                    v-model:value="editForms[`${group.id}_${word.id}`].back"
                    size="small"
                    placeholder="后定位"
                  />
                  <div class="text-center">
                    <NSwitch
                      v-model:value="editForms[`${group.id}_${word.id}`].regex"
                      size="small"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </div>
                  <div class="flex justify-center">
                    <NSwitch
                      v-model:value="
                        editForms[`${group.id}_${word.id}`].enabled
                      "
                      size="small"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </div>
                  <div class="flex items-center justify-center gap-1">
                    <NButton
                      text
                      size="tiny"
                      type="primary"
                      @click="handleSaveEdit(group.id, word.id)"
                    >
                      <IconifyIcon icon="lucide:check" class="size-3.5" />
                    </NButton>
                    <NButton
                      text
                      size="tiny"
                      @click="cancelEdit(group.id, word.id)"
                    >
                      <IconifyIcon icon="lucide:x" class="size-3.5" />
                    </NButton>
                  </div>
                </div>
              </div>

              <!-- 新增行 -->
              <div
                v-for="tempId in Array.from(addingIds).filter(
                  (id) => addForms[id]?.group_id === group.id,
                )"
                :key="tempId"
                class="grid gap-2 px-3 py-2 items-center rounded-lg"
                style="
                  grid-template-columns: 70px 1fr 1fr 60px 70px 70px 44px 44px 72px;
                  background: hsl(var(--accent) / 30%);
                  box-shadow: inset 0 0 0 1px hsl(var(--border));
                "
              >
                <NSelect
                  v-model:value="addForms[tempId].type"
                  size="small"
                  :options="typeOptions"
                  style="min-width: 70px"
                />
                <NInput
                  v-model:value="addForms[tempId].replaced"
                  size="small"
                  placeholder="被替换词"
                />
                <NInput
                  v-model:value="addForms[tempId].replace"
                  size="small"
                  placeholder="替换词"
                />
                <NInput
                  v-model:value="addForms[tempId].offset"
                  size="small"
                  placeholder="偏移"
                />
                <NInput
                  v-model:value="addForms[tempId].front"
                  size="small"
                  placeholder="前定位"
                />
                <NInput
                  v-model:value="addForms[tempId].back"
                  size="small"
                  placeholder="后定位"
                />
                <div class="text-center">
                  <NSwitch
                    v-model:value="addForms[tempId].regex"
                    size="small"
                    :checked-value="1"
                    :unchecked-value="0"
                  />
                </div>
                <div class="flex justify-center">
                  <NSwitch
                    v-model:value="addForms[tempId].enabled"
                    size="small"
                    :checked-value="1"
                    :unchecked-value="0"
                  />
                </div>
                <div class="flex items-center justify-center gap-1">
                  <NButton
                    text
                    size="tiny"
                    type="primary"
                    @click="handleSaveAdd(tempId)"
                  >
                    <IconifyIcon icon="lucide:check" class="size-3.5" />
                  </NButton>
                  <NButton text size="tiny" @click="cancelAdd(tempId)">
                    <IconifyIcon icon="lucide:x" class="size-3.5" />
                  </NButton>
                </div>
              </div>

              <!-- 空提示 -->
              <div
                v-if="
                  !group.words?.length &&
                  !Array.from(addingIds).some(
                    (id) => addForms[id]?.group_id === group.id,
                  )
                "
                class="text-center py-6 text-sm"
                style="color: hsl(var(--muted-foreground))"
              >
                暂无识别词，点击"添加识别词"新增
              </div>
            </div>

            <!-- 移动端卡片 -->
            <div class="md:hidden p-4 space-y-3">
              <!-- 现有词卡片 -->
              <div
                v-for="word in group.words"
                :key="word.id"
                class="rounded-lg border p-3 space-y-2"
                :style="{
                  background: editingIds.has(`${group.id}_${word.id}`)
                    ? 'hsl(var(--accent) / 0.3)'
                    : 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                }"
              >
                <!-- 展示模式 -->
                <div v-if="!editingIds.has(`${group.id}_${word.id}`)">
                  <div class="flex items-center justify-between">
                    <div
                      class="px-2.5 py-0.5 rounded-full text-xs font-medium"
                      :style="{
                        background: getWordTypeStyle(word.type).bg,
                        color: getWordTypeStyle(word.type).color,
                      }"
                    >
                      {{ getWordTypeLabel(word.type) }}
                    </div>
                    <div class="flex items-center gap-2">
                      <NSwitch
                        :value="word.enabled === 1"
                        size="small"
                        @update:value="() => handleToggleWord(word)"
                      />
                      <NButton text size="tiny" @click="startEdit(word)">
                        <template #icon>
                          <IconifyIcon
                            icon="lucide:pencil"
                            class="size-3.5"
                            style="color: hsl(var(--primary))"
                          />
                        </template>
                      </NButton>
                      <NButton
                        text
                        size="tiny"
                        type="error"
                        @click="handleDeleteWord(word)"
                      >
                        <template #icon>
                          <IconifyIcon icon="lucide:trash-2" class="size-3.5" />
                        </template>
                      </NButton>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span
                        class="text-xs"
                        style="color: hsl(var(--muted-foreground))"
                        >被替换:
                      </span>
                      <span style="color: hsl(var(--foreground))">{{
                        word.replaced || '-'
                      }}</span>
                    </div>
                    <div>
                      <span
                        class="text-xs"
                        style="color: hsl(var(--muted-foreground))"
                        >替换:
                      </span>
                      <span style="color: hsl(var(--foreground))">{{
                        word.replace || '-'
                      }}</span>
                    </div>
                    <div>
                      <span
                        class="text-xs"
                        style="color: hsl(var(--muted-foreground))"
                        >偏移:
                      </span>
                      <span style="color: hsl(var(--foreground))">{{
                        word.offset || '-'
                      }}</span>
                    </div>
                    <div>
                      <span
                        class="text-xs"
                        style="color: hsl(var(--muted-foreground))"
                        >正则:
                      </span>
                      <span
                        :style="
                          word.regex === 1
                            ? { color: 'hsl(var(--warning))' }
                            : { color: 'hsl(var(--muted-foreground))' }
                        "
                        >{{ word.regex === 1 ? '是' : '-' }}</span
                      >
                    </div>
                    <div class="col-span-2">
                      <span
                        class="text-xs"
                        style="color: hsl(var(--muted-foreground))"
                        >定位:
                      </span>
                      <span style="color: hsl(var(--foreground))"
                        >{{ word.front || '-' }} / {{ word.back || '-' }}</span
                      >
                    </div>
                  </div>
                </div>

                <!-- 编辑模式 -->
                <div v-else class="space-y-2">
                  <NSelect
                    v-model:value="editForms[`${group.id}_${word.id}`].type"
                    size="small"
                    :options="typeOptions"
                  />
                  <div class="grid grid-cols-2 gap-2">
                    <NInput
                      v-model:value="
                        editForms[`${group.id}_${word.id}`].replaced
                      "
                      size="small"
                      placeholder="被替换词"
                    />
                    <NInput
                      v-model:value="
                        editForms[`${group.id}_${word.id}`].replace
                      "
                      size="small"
                      placeholder="替换词"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <NInput
                      v-model:value="editForms[`${group.id}_${word.id}`].offset"
                      size="small"
                      placeholder="偏移"
                    />
                    <div class="flex items-center justify-center gap-2">
                      <span
                        class="text-xs"
                        style="color: hsl(var(--muted-foreground))"
                        >正则</span
                      >
                      <NSwitch
                        v-model:value="
                          editForms[`${group.id}_${word.id}`].regex
                        "
                        size="small"
                        :checked-value="1"
                        :unchecked-value="0"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <NInput
                      v-model:value="editForms[`${group.id}_${word.id}`].front"
                      size="small"
                      placeholder="前定位"
                    />
                    <NInput
                      v-model:value="editForms[`${group.id}_${word.id}`].back"
                      size="small"
                      placeholder="后定位"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-xs"
                        style="color: hsl(var(--muted-foreground))"
                        >启用</span
                      >
                      <NSwitch
                        v-model:value="
                          editForms[`${group.id}_${word.id}`].enabled
                        "
                        size="small"
                        :checked-value="1"
                        :unchecked-value="0"
                      />
                    </div>
                    <div class="flex items-center gap-1">
                      <NButton
                        text
                        size="tiny"
                        type="primary"
                        @click="handleSaveEdit(group.id, word.id)"
                      >
                        <IconifyIcon icon="lucide:check" class="size-3.5" />
                      </NButton>
                      <NButton
                        text
                        size="tiny"
                        @click="cancelEdit(group.id, word.id)"
                      >
                        <IconifyIcon icon="lucide:x" class="size-3.5" />
                      </NButton>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 新增卡片 -->
              <div
                v-for="tempId in Array.from(addingIds).filter(
                  (id) => addForms[id]?.group_id === group.id,
                )"
                :key="tempId"
                class="rounded-lg border p-3 space-y-2"
                style="
                  background: hsl(var(--accent) / 30%);
                  border-color: hsl(var(--border));
                "
              >
                <NSelect
                  v-model:value="addForms[tempId].type"
                  size="small"
                  :options="typeOptions"
                />
                <div class="grid grid-cols-2 gap-2">
                  <NInput
                    v-model:value="addForms[tempId].replaced"
                    size="small"
                    placeholder="被替换词"
                  />
                  <NInput
                    v-model:value="addForms[tempId].replace"
                    size="small"
                    placeholder="替换词"
                  />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <NInput
                    v-model:value="addForms[tempId].offset"
                    size="small"
                    placeholder="偏移"
                  />
                  <div class="flex items-center justify-center gap-2">
                    <span
                      class="text-xs"
                      style="color: hsl(var(--muted-foreground))"
                      >正则</span
                    >
                    <NSwitch
                      v-model:value="addForms[tempId].regex"
                      size="small"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <NInput
                    v-model:value="addForms[tempId].front"
                    size="small"
                    placeholder="前定位"
                  />
                  <NInput
                    v-model:value="addForms[tempId].back"
                    size="small"
                    placeholder="后定位"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-xs"
                      style="color: hsl(var(--muted-foreground))"
                      >启用</span
                    >
                    <NSwitch
                      v-model:value="addForms[tempId].enabled"
                      size="small"
                      :checked-value="1"
                      :unchecked-value="0"
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <NButton
                      text
                      size="tiny"
                      type="primary"
                      @click="handleSaveAdd(tempId)"
                    >
                      <IconifyIcon icon="lucide:check" class="size-3.5" />
                    </NButton>
                    <NButton text size="tiny" @click="cancelAdd(tempId)">
                      <IconifyIcon icon="lucide:x" class="size-3.5" />
                    </NButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-else
        class="rounded-xl border flex flex-col items-center justify-center py-20 mt-5"
        style="background: hsl(var(--card)); border-color: hsl(var(--border))"
      >
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style="background: hsl(var(--muted))"
        >
          <IconifyIcon
            icon="lucide:file-text"
            class="size-8"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
        <p class="text-sm" style="color: hsl(var(--muted-foreground))">
          暂无识别词
        </p>
        <p
          class="text-xs mt-1 mb-4"
          style="color: hsl(var(--muted-foreground) / 70%)"
        >
          点击上方按钮新增词组或导入识别词
        </p>
        <NButton type="primary" @click="showAddGroup">
          <template #icon>
            <IconifyIcon icon="lucide:plus" class="size-4" />
          </template>
          新增词组
        </NButton>
      </div>
    </NSpin>

    <!-- 新增词组弹窗 -->
    <NModal
      v-model:show="groupModal"
      title="新增识别词组"
      preset="card"
      :style="{ width: '420px', maxWidth: '92vw' }"
    >
      <NFormItem label="TMDB ID" required>
        <NInput v-model:value="groupForm.tmdb_id" placeholder="输入 TMDB ID" />
      </NFormItem>
      <NFormItem label="类型" required>
        <NSelect
          v-model:value="groupForm.tmdb_type"
          :options="[
            { label: '电视剧', value: 'tv' },
            { label: '电影', value: 'movie' },
          ]"
        />
      </NFormItem>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="groupModal = false">取消</NButton>
          <NButton type="primary" @click="handleAddGroup">添加</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 导入弹窗 -->
    <NModal
      v-model:show="importModal"
      title="导入识别词"
      preset="card"
      :style="{ width: '600px', maxWidth: '92vw' }"
    >
      <NFormItem label="导入码">
        <NInput
          v-model:value="importCode"
          type="textarea"
          :rows="4"
          placeholder="粘贴识别词导入码"
        />
      </NFormItem>
      <NButton type="primary" @click="handleAnalyseImport">解析</NButton>

      <div v-if="importPreview.length > 0" class="mt-4">
        <div
          v-if="importNote"
          class="mb-2 text-sm"
          style="color: hsl(var(--muted-foreground))"
        >
          备注: {{ importNote }}
        </div>
        <div
          class="rounded-lg border overflow-hidden"
          style="border-color: hsl(var(--border))"
        >
          <div
            class="grid grid-cols-[40px_1fr_80px_100px] gap-2 px-3 py-2 text-xs font-medium border-b"
            style="
              background: hsl(var(--muted) / 40%);
              border-color: hsl(var(--border));
            "
          >
            <span
              ><input
                type="checkbox"
                :checked="selectedImportIds.length === importPreview.length"
                @change="
                  (e) => {
                    selectedImportIds = (e.target as HTMLInputElement).checked
                      ? importPreview.map((g) => g.id)
                      : [];
                  }
                "
            /></span>
            <span style="color: hsl(var(--foreground))">词组</span>
            <span style="color: hsl(var(--foreground))">类型</span>
            <span style="color: hsl(var(--foreground))">识别词数</span>
          </div>
          <div
            v-for="g in importPreview"
            :key="g.id"
            class="grid grid-cols-[40px_1fr_80px_100px] gap-2 px-3 py-2 text-sm border-b items-center"
            style="border-color: hsl(var(--border))"
          >
            <span
              ><input
                type="checkbox"
                :value="g.id"
                :checked="selectedImportIds.includes(g.id)"
                @change="
                  (e) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    if (checked) {
                      if (!selectedImportIds.includes(g.id))
                        selectedImportIds.push(g.id);
                    } else {
                      selectedImportIds = selectedImportIds.filter(
                        (id) => id !== g.id,
                      );
                    }
                  }
                "
            /></span>
            <span style="color: hsl(var(--foreground))">{{ g.name }}</span>
            <span style="color: hsl(var(--muted-foreground))">{{
              g.type === '1' ? '电影' : '电视剧'
            }}</span>
            <span style="color: hsl(var(--muted-foreground))">{{
              Object.keys(g.words || {}).length
            }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="importModal = false">取消</NButton>
          <NButton
            type="primary"
            :disabled="selectedImportIds.length === 0"
            @click="handleImport"
          >
            导入
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 导出弹窗 -->
    <NModal
      v-model:show="exportModal"
      title="导出识别词"
      preset="card"
      :style="{ width: '520px', maxWidth: '92vw' }"
    >
      <NFormItem label="导出码">
        <NInput v-model:value="exportCode" type="textarea" :rows="4" readonly />
      </NFormItem>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="exportModal = false">关闭</NButton>
          <NButton type="primary" @click="copyExportCode">
            <template #icon>
              <IconifyIcon icon="lucide:copy" class="size-4" />
            </template>
            复制
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
