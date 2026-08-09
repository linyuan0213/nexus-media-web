<script lang="ts" setup>
import type { FormatChip, FormatVariable } from '#/types/rename';

import { computed, onMounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton } from 'naive-ui';

import { previewNameFormatApi } from '#/api';

// ============ Props / Emits ============

interface Props {
  modelValue: string;
  mediaType?: 'movie' | 'tv';
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  mediaType: 'tv',
  saving: false,
});

const emit = defineEmits<{
  save: [];
  'update:modelValue': [value: string];
}>();

// ============ 精选变量（与参考一致，使用后端真实字段 key） ============

const CURATED: FormatVariable[] = [
  { key: 'title', label: '标题', example: '怪奇物语' },
  {
    key: 'en_title',
    label: '英文名',
    example: 'Stranger Things',
    requiresMs: true,
  },
  { key: 'original_title', label: '原题', example: 'Stranger.Things' },
  { key: 'year', label: '年份', example: '2016' },
  { key: 'season', label: '季', example: '4' },
  { key: 'episode', label: '集', example: '01' },
  { key: 'season_episode', label: 'SxE', example: 'S04E01' },
  {
    key: 'episode_title',
    label: '集标题',
    example: '地狱火俱乐部',
    requiresMs: true,
  },
  { key: 'part', label: '分集', example: '' },
  { key: 'videoFormat', label: '分辨率', example: '2160p' },
  { key: 'videoCodec', label: '视频编码', example: 'H.265' },
  { key: 'audioCodec', label: '音频编码', example: 'Atmos' },
  { key: 'source', label: '片源', example: 'WEB-DL' },
  { key: 'releaseGroup', label: '发布组', example: 'NTb' },
  { key: 'edition', label: '版本', example: '' },
  { key: 'tmdbid', label: 'TMDB ID', example: '66732' },
  { key: 'imdbid', label: 'IMDB ID', example: 'tt4574334' },
];

// ============ 示例值（电视剧 / 电影分开） ============

const TV_SAMPLE: Record<string, string> = {
  title: '怪奇物语',
  en_title: 'Stranger Things',
  year: '2016',
  season: '4',
  episode: '01',
  season_episode: 'S04E01',
  episode_title: '地狱火俱乐部',
  videoFormat: '2160p',
  source: 'WEB-DL',
  videoCodec: 'H.265',
  audioCodec: 'Atmos',
  releaseGroup: 'NTb',
  edition: '',
  tmdbid: '66732',
  imdbid: 'tt4574334',
  part: '',
  original_title: 'Stranger.Things.S04E01',
  rev_name: 'Stranger.Things',
  original_name: 'Stranger.Things',
  name: 'Stranger Things',
};

const MOVIE_SAMPLE: Record<string, string> = {
  title: '盗梦空间',
  en_title: 'Inception',
  year: '2010',
  videoFormat: '2160p',
  source: 'BluRay',
  videoCodec: 'H.264',
  audioCodec: 'DTS',
  releaseGroup: 'FraMeSToR',
  edition: '',
  tmdbid: '27205',
  imdbid: 'tt1375666',
  part: '',
  original_title: 'Inception.2010',
  rev_name: 'Inception.2010',
  original_name: 'Inception.2010',
  name: 'Inception',
  season: '',
  episode: '',
  season_episode: '',
  episode_title: '',
};

const samples = computed(() =>
  props.mediaType === 'movie' ? MOVIE_SAMPLE : TV_SAMPLE,
);

// ============ 字段目录（精选集合） ============

const PRESETS: Array<{ format: string; name: string }> = [
  {
    name: '标准剧集',
    format: '{title} ({year})/Season {season}/{title} - {season_episode}',
  },
  {
    name: '带集标题',
    format:
      '{title} ({year})/Season {season}/{title} - {season_episode} - {episode_title}',
  },
  {
    name: '动漫（按集）',
    format: '{title} ({year})/{title} - 第 {episode} 集',
  },
  {
    name: '电影',
    format: '{title} ({year})/{title} ({year}) - {videoFormat}',
  },
];

// ============ 字段目录（精选集合，非全量） ============

const variables = computed<FormatVariable[]>(() =>
  CURATED.filter((v) => {
    if (props.mediaType !== 'movie') return true;
    return !['episode', 'episode_title', 'season', 'season_episode'].includes(
      v.key,
    );
  }),
);

// ============ 芯片解析 / 序列化 ============

let idCounter = 0;

function tokenize(fmt: string): FormatChip[] {
  const re = /\{([a-zA-Z0-9_]+)\}/g;
  const out: FormatChip[] = [];
  let last = 0;
  let m: null | RegExpExecArray;
  while ((m = re.exec(fmt))) {
    const text = fmt.slice(last, m.index);
    if (text) out.push({ id: idCounter++, type: 'static', text });
    out.push({ id: idCounter++, type: 'variable', key: m[1] });
    last = m.index + m[0].length;
  }
  const tail = fmt.slice(last);
  if (tail) out.push({ id: idCounter++, type: 'static', text: tail });
  return out;
}

function serialize(chips: FormatChip[]): string {
  return chips
    .map((c) => (c.type === 'variable' ? `{${c.key}}` : (c.text ?? '')))
    .join('');
}

// ============ 状态 ============

const chips = ref<FormatChip[]>(tokenize(props.modelValue || ''));
const separator = ref(' - ');
const editingId = ref<null | number>(null);
const editingText = ref('');

const outputString = computed(() => serialize(chips.value));

const outputText = ref(outputString.value);
watch(outputString, (v) => {
  if (outputText.value !== v) outputText.value = v;
});

function onOutputEdit(val: string) {
  outputText.value = val;
  chips.value = tokenize(val);
  pushChange();
}

// ============ 实时预览（调用后端，处理空值 \t 哨兵） ============

const preview = ref<null | Record<string, string>>(null);
let previewTimer: null | ReturnType<typeof setTimeout> = null;

function refreshPreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const fmt = outputString.value;
    if (!fmt) {
      preview.value = null;
      return;
    }
    try {
      const res = await previewNameFormatApi({
        format: fmt,
        media_type: props.mediaType,
        values: { ...samples.value },
      });
      preview.value = res.segments;
    } catch {
      preview.value = null;
    }
  }, 300);
}

const previewPath = computed(() => {
  if (!preview.value) return '';
  const { dir, season, file } = preview.value;
  if (props.mediaType === 'movie') return [dir, file].filter(Boolean).join('/');
  return [dir, season, file].filter(Boolean).join('/');
});

function pushChange() {
  emit('update:modelValue', outputString.value);
  refreshPreview();
}

// ============ 操作 ============

function addVariable(key: string, atIndex?: number) {
  const chip: FormatChip = { id: idCounter++, type: 'variable', key };
  if (atIndex !== undefined) {
    const parts: FormatChip[] = [];
    if (atIndex > 0)
      parts.push({ id: idCounter++, type: 'static', text: separator.value });
    parts.push(chip);
    if (atIndex < chips.value.length)
      parts.push({ id: idCounter++, type: 'static', text: separator.value });
    chips.value.splice(atIndex, 0, ...parts);
  } else if (chips.value.length > 0) {
    chips.value.push(
      { id: idCounter++, type: 'static', text: separator.value },
      chip,
    );
  } else {
    chips.value.push(chip);
  }
  pushChange();
}

function addStatic() {
  chips.value.push({ id: idCounter++, type: 'static', text: separator.value });
  pushChange();
}

function removeChip(id: number) {
  const idx = chips.value.findIndex((c) => c.id === id);
  if (idx === -1) return;
  chips.value.splice(idx, 1);
  pushChange();
}

function loadPreset(fmt: string) {
  chips.value = tokenize(fmt);
  pushChange();
}

function reset() {
  chips.value = [];
  separator.value = ' - ';
  pushChange();
}

function beginEdit(chip: FormatChip) {
  if (chip.type !== 'static') return;
  editingId.value = chip.id;
  editingText.value = chip.text ?? '';
}

function commitEdit() {
  if (editingId.value !== null) {
    const c = chips.value.find((ch) => ch.id === editingId.value);
    if (c) c.text = editingText.value;
    pushChange();
  }
  editingId.value = null;
}

function varLabel(key: string): string {
  return variables.value.find((v) => v.key === key)?.label ?? key;
}

// ============ 拖拽排序 ============

const dragId = ref<null | number>(null);
const dragKey = ref<null | string>(null);

function onDragStart(e: DragEvent, id: number) {
  dragId.value = id;
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onPoolDragStart(e: DragEvent, key: string) {
  dragKey.value = key;
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'link';
}

function onDrop(targetIdx: number) {
  if (dragId.value !== null) {
    const from = chips.value.findIndex((c) => c.id === dragId.value);
    if (from !== -1 && from !== targetIdx) {
      const item = chips.value.splice(from, 1)[0];
      if (item) chips.value.splice(targetIdx, 0, item);
    }
    dragId.value = null;
  }
  if (dragKey.value !== null) {
    addVariable(dragKey.value, targetIdx);
    dragKey.value = null;
    return;
  }
}

// ============ 双向同步 ============

watch(
  () => props.modelValue,
  (v) => {
    if (v !== outputString.value) chips.value = tokenize(v || '');
  },
);

watch(
  () => props.mediaType,
  () => {
    chips.value = tokenize(props.modelValue || '');
    refreshPreview();
  },
);

onMounted(() => refreshPreview());
</script>

<template>
  <div class="rename-builder">
    <!-- 预设 -->
    <div class="section">
      <div class="label">预设模板</div>
      <div class="presets">
        <button
          v-for="p in PRESETS"
          :key="p.name"
          class="preset-btn"
          @click="loadPreset(p.format)"
        >
          {{ p.name }}
        </button>
      </div>
    </div>

    <!-- 变量池 -->
    <div class="section">
      <div class="label">可用变量 <span class="hint">点击添加</span></div>
      <div class="pool">
        <span
          v-for="v in variables"
          :key="v.key"
          class="tag"
          :title="v.requiresMs ? '需媒体服务（TMDB）' : undefined"
          draggable="true"
          @click="addVariable(v.key)"
          @dragstart="onPoolDragStart($event, v.key)"
        >
          <span class="brace">{</span><span class="brace">{{ v.key }}</span
          ><span class="brace">}</span>&nbsp;{{ v.label }}
        </span>
      </div>
    </div>

    <!-- 分隔符 -->
    <div class="section row">
      <div class="label mb-0">分隔符 / 固定文本</div>
      <input v-model="separator" class="sep-input" maxlength="6" />
      <button class="preset-btn" @click="addStatic">插入</button>
      <span class="hint">变量之间的连接符；点击"插入"追加文本块</span>
    </div>

    <!-- 构建画布 -->
    <div class="section">
      <div class="row">
        <div class="label mb-0">构建格式</div>
        <span class="hint">拖拽排序，悬停删除，双击固定文本可编辑</span>
      </div>
      <div
        class="canvas"
        :class="{ empty: chips.length === 0 }"
        @dragover.prevent
        @drop.prevent="onDrop(chips.length)"
      >
        <TransitionGroup name="chip">
          <div
            v-for="(chip, idx) in chips"
            :key="chip.id"
            class="chip"
            :class="{ 'static-chip': chip.type === 'static' }"
            draggable="true"
            @dragstart="onDragStart($event, chip.id)"
            @drop.prevent="onDrop(idx)"
            @dragover.prevent
          >
            <template v-if="chip.type === 'variable'">
              <IconifyIcon icon="lucide:grip-vertical" class="grip-icon" />
              <span class="brace">{</span
              ><span class="brace">{{ chip.key }}</span
              ><span class="brace">}</span>
              <span class="chip-label">{{ varLabel(chip.key ?? '') }}</span>
            </template>
            <template v-else>
              <IconifyIcon icon="lucide:type" class="grip-icon" />
              <input
                v-if="editingId === chip.id"
                v-model="editingText"
                class="static-edit"
                @blur="commitEdit"
                @keydown.enter.prevent="commitEdit"
              />
              <span v-else class="static-text" @dblclick="beginEdit(chip)">{{
                chip.text
              }}</span>
            </template>
            <span class="del" @click.stop="removeChip(chip.id)">
              <IconifyIcon icon="lucide:x" class="del-svg" />
            </span>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <!-- 实时预览 -->
    <div class="section">
      <div class="label">实时预览</div>
      <div class="preview-box">
        <template v-if="previewPath">
          {{ previewPath }}
        </template>
        <span v-else class="ph">等待构建…</span>
      </div>
    </div>

    <!-- 输出串（可编辑，改动同步到画布） -->
    <div class="section">
      <div class="label">
        生成的格式字符串 <span class="hint">可直接编辑</span>
      </div>
      <textarea
        :value="outputText"
        class="edit-output"
        rows="2"
        spellcheck="false"
        @input="onOutputEdit(($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </div>

    <div class="flex justify-end gap-3">
      <NButton @click="reset">重置</NButton>
      <NButton type="primary" :loading="saving" @click="emit('save')">
        保存格式
      </NButton>
    </div>
  </div>
</template>

<style scoped>
/* ====== 参考样式原样迁移，仅颜色变量映射到 Vben 主题 ====== */

.rename-builder {
  --builder-text-primary: hsl(var(--card-foreground));
  --builder-text-secondary: hsl(var(--muted-foreground));
  --builder-text-tertiary: hsl(var(--muted-foreground) / 65%);
  --builder-text-quaternary: hsl(var(--muted-foreground) / 40%);
  --builder-border: hsl(var(--border));
  --builder-surface: hsl(var(--card));
  --builder-surface-muted: hsl(var(--muted));
  --builder-surface-raised: hsl(var(--muted) / 70%);
  --builder-accent: hsl(var(--primary));
  --builder-danger: hsl(var(--destructive));

  font-family: inherit;
  color: var(--builder-text-primary);
}

.section {
  margin-bottom: 20px;
}

.section .label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--builder-text-secondary);
}

.hint {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--builder-text-quaternary);
}

/* 预设 */
.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-btn {
  padding: 5px 12px;
  font-size: 12px;
  color: var(--builder-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--builder-border);
  border-radius: 6px;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  color: var(--builder-text-primary);
  background: var(--builder-surface-muted);
  border-color: hsl(var(--muted-foreground));
}

/* 变量池 */
.pool {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  background: var(--builder-surface-muted);
  border: 1px solid var(--builder-border);
  border-radius: 6px;
  transition: all 0.15s ease;
}

.tag:hover {
  background: var(--builder-surface-raised);
  border-color: hsl(var(--muted-foreground));
}

.tag:active {
  transform: scale(0.96);
}

.brace {
  color: var(--builder-text-tertiary);
}

.chip-label {
  font-size: 12px;
  color: var(--builder-text-tertiary);
}

/* 画布 */
.canvas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-height: 56px;
  padding: 12px;
  border: 2px dashed var(--builder-border);
  border-radius: 10px;
  transition: all 0.15s ease;
}

.canvas.empty::after {
  width: 100%;
  font-size: 13px;
  color: var(--builder-text-quaternary);
  text-align: center;
  pointer-events: none;
  content: '点击上方变量，或拖拽排序';
}

/* 芯片 */
.chip {
  position: relative;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 6px 10px;
  font-size: 13px;
  cursor: grab;
  background: var(--builder-surface);
  border: 1px solid var(--builder-border);
  border-radius: 6px;
  transition: all 0.15s ease;
}

.static-chip {
  background: color-mix(in srgb, var(--builder-accent) 8%, transparent);
}

.grip-icon {
  width: 14px;
  height: 14px;
  color: var(--builder-text-quaternary);
}

.static-text {
  cursor: text;
}

.static-edit {
  width: 72px;
  padding: 0 4px;
  font-size: 13px;
  color: var(--builder-text-primary);
  outline: none;
  background: var(--builder-surface);
  border: 1px solid var(--builder-border);
  border-radius: 4px;
}

.static-edit:focus {
  border-color: var(--builder-accent);
}

/* 删除 */
.del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--builder-text-quaternary);
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.del-svg {
  width: 12px;
  height: 12px;
}

.chip:hover .del {
  opacity: 1;
}

.del:hover {
  color: var(--builder-danger);
  background: color-mix(in srgb, var(--builder-danger) 12%, transparent);
}

/* 分隔符输入 */
.sep-input {
  width: 48px;
  padding: 6px 8px;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: var(--builder-text-primary);
  text-align: center;
  background: var(--builder-surface);
  border: 1px solid var(--builder-border);
  border-radius: 8px;
}

.sep-input:focus {
  outline: none;
  border-color: var(--builder-text-primary);
}

/* 预览 */
.preview-box {
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
  background: var(--builder-surface-muted);
  border: 1px solid var(--builder-border);
  border-radius: 10px;
}

.preview-box.mono {
  font-family: ui-monospace, monospace;
}

.ph {
  font-style: italic;
  color: var(--builder-text-tertiary);
}

.lit {
  color: var(--builder-accent);
}

.edit-output {
  width: 100%;
  padding: 10px 14px;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--builder-text-primary);
  resize: vertical;
  outline: none;
  background: var(--builder-surface-muted);
  border: 1px solid var(--builder-border);
  border-radius: 10px;
}

.edit-output:focus {
  border-color: var(--builder-accent);
  box-shadow: 0 0 0 2px
    color-mix(in srgb, var(--builder-accent) 20%, transparent);
}

/* 动画 */
.chip-enter-active,
.chip-leave-active {
  transition: all 0.2s ease;
}

.chip-enter-from,
.chip-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.row .label {
  margin-bottom: 0;
}
</style>
