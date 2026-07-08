<script lang="ts">
import { ref } from 'vue';

// 全局状态：移动端激活的卡片（null = 无弹窗）
const activeItem = ref<any>(null);
let outsideListenerInstalled = false;

function ensureOutsideListener() {
  if (typeof document === 'undefined' || outsideListenerInstalled) return;
  outsideListenerInstalled = true;
  document.addEventListener('click', (e) => {
    if (activeItem.value === null) return;
    const el = e.target as Element | null;
    // 点击到任意卡片内部时交由卡片自身逻辑处理，仅空白处收起弹窗
    if (el && el.closest('.shc')) return;
    activeItem.value = null;
  });
}
</script>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NTag } from 'naive-ui';

import { getImgUrl } from '#/utils/image';
import { formatPix, formatRestype } from '#/utils/subscribe';

interface Props {
  item: Record<string, any>;
  type: 'movie' | 'tv';
  filterRuleMap?: Record<string, string>;
  downloadSettingMap?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  filterRuleMap: () => ({}),
  downloadSettingMap: () => ({}),
});

const emit = defineEmits<{
  (
    e: 'click' | 'delete' | 'edit' | 'refresh' | 'search',
    item: Record<string, any>,
  ): void;
}>();

const stateDotMap: Record<string, string> = {
  D: 'bg-yellow-500',
  S: 'bg-yellow-500',
  R: 'bg-green-500',
  C: 'bg-blue-500',
  E: 'bg-red-500',
  N: 'bg-gray-400',
};

const stateLabelMap: Record<string, string> = {
  D: '待处理',
  S: '搜索中',
  R: '监控中',
  C: '已完成',
  E: '错误',
  N: '已取消',
};

const stateDot = computed(
  () => stateDotMap[props.item.state || ''] || 'bg-gray-400',
);
const stateLabel = computed(
  () => stateLabelMap[props.item.state || ''] || props.item.state || '未知',
);

const typeLabel = computed(() => (props.type === 'movie' ? '电影' : '剧集'));

const voteText = computed(() => {
  const v = props.item.vote;
  if (v == null || v === '') return '';
  const n = Number(v);
  if (!n || n <= 0) return '';
  return n.toFixed(1);
});

const seasonLabel = computed(() => {
  const s = props.item.season;
  return s && s !== 'S00' ? String(s) : '';
});

const captionTitle = computed(() => {
  let text = props.item.name || '';
  if (props.type === 'tv' && seasonLabel.value) {
    text += ` ${seasonLabel.value}`;
  }
  if (props.item.year) {
    text += `（${props.item.year}）`;
  }
  return text;
});

const showProgress = computed(
  () => props.type === 'tv' && props.item.total && props.item.total > 0,
);

const progressPercent = computed(() => {
  if (!showProgress.value) return 0;
  const total = props.item.total || 0;
  const lack = props.item.lack || 0;
  return Math.round(((total - lack) / total) * 100);
});

const progressText = computed(() => {
  const total = props.item.total || 0;
  const lack = props.item.lack || 0;
  return `${total - lack} / ${total}`;
});

const overviewText = computed(() => {
  const ov = props.item?.overview;
  if (typeof ov === 'string' && ov.trim() && !ov.trim().startsWith('{')) {
    return ov.trim();
  }
  return '';
});

function filterRuleLabel(val: any): string {
  if (val == null) return '';
  const s = String(val).trim();
  if (s === '' || s === '0') return '';
  return props.filterRuleMap[s] || s;
}

const ruleLabel = computed(() => filterRuleLabel(props.item.filter_rule));
const restypeLabel = computed(() =>
  props.item.filter_restype ? formatRestype(props.item.filter_restype) : '',
);
const pixLabel = computed(() =>
  props.item.filter_pix ? formatPix(props.item.filter_pix) : '',
);

const downloadLabel = computed(() => {
  const v = props.item.download_setting;
  if (v == null || v === '' || String(v) === '-1') return '';
  return props.downloadSettingMap[String(v)] || '';
});

const keyword = computed(() =>
  props.item.keyword ? String(props.item.keyword) : '',
);

const freeOnly = computed(() => {
  const v = props.item.filter_free;
  return v === true || v === 1 || String(v) === '1';
});

const overEdition = computed(() => {
  const v = props.item.over_edition;
  return v === true || v === 1 || String(v) === '1';
});

const hasFilterInfo = computed(
  () =>
    !!ruleLabel.value ||
    overEdition.value ||
    !!restypeLabel.value ||
    !!pixLabel.value ||
    !!props.item.filter_team ||
    !!props.item.filter_include ||
    !!props.item.filter_exclude ||
    !!downloadLabel.value ||
    !!keyword.value ||
    freeOnly.value,
);

const MAX_SITES = 4;
const sitesExpanded = ref(false);

const rssSites = computed<string[]>(() =>
  Array.isArray(props.item.rss_sites)
    ? props.item.rss_sites.filter(Boolean).map(String)
    : [],
);
const searchSites = computed<string[]>(() =>
  Array.isArray(props.item.search_sites)
    ? props.item.search_sites.filter(Boolean).map(String)
    : [],
);

const hasSites = computed(
  () => rssSites.value.length > 0 || searchSites.value.length > 0,
);

const canFold = computed(
  () =>
    rssSites.value.length > MAX_SITES || searchSites.value.length > MAX_SITES,
);

const rssVisible = computed(() =>
  sitesExpanded.value ? rssSites.value : rssSites.value.slice(0, MAX_SITES),
);
const searchVisible = computed(() =>
  sitesExpanded.value
    ? searchSites.value
    : searchSites.value.slice(0, MAX_SITES),
);
const rssOverflow = computed(() =>
  sitesExpanded.value ? 0 : Math.max(0, rssSites.value.length - MAX_SITES),
);
const searchOverflow = computed(() =>
  sitesExpanded.value ? 0 : Math.max(0, searchSites.value.length - MAX_SITES),
);

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = '/static/img/no-image.png';
}

// 当前卡片是否在移动端被激活（与 activeItem 引用相等）
const isPopup = computed(() => activeItem.value === props.item);

function isTouchMode() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    !window.matchMedia('(hover: hover)').matches
  );
}

// 靠近右边缘时，信息面板翻转到左侧展开，避免被视口截断
const flipLeft = ref(false);
const POSTER_WIDTH = 180;
const PANEL_WIDTH = 340;

function onCardEnter(e: MouseEvent) {
  if (isTouchMode()) return;
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  flipLeft.value =
    rect.left + POSTER_WIDTH + PANEL_WIDTH + 16 > window.innerWidth;
}

function onPosterClick() {
  if (!isTouchMode()) {
    emit('click', props.item);
    return;
  }
  activeItem.value = isPopup.value ? null : props.item;
}

function closePopover() {
  activeItem.value = null;
}

onMounted(ensureOutsideListener);
</script>

<template>
  <div
    class="shc"
    :class="{ 'is-expanded': isPopup, 'shc--flip-left': flipLeft }"
    @mouseenter="onCardEnter"
  >
    <!-- 移动端浮层遮罩 -->
    <Teleport to="body">
      <div v-if="isPopup" class="shc-backdrop" @click="closePopover"></div>
    </Teleport>

    <!-- 海报（桌面点击进详情 / 移动端点击展开） -->
    <div class="shc-poster" @click="onPosterClick">
      <img
        :src="getImgUrl(item.image || item.poster)"
        class="shc-poster-img"
        alt=""
        @error="onImgError"
      />

      <!-- 状态角标 -->
      <div class="shc-state-badge">
        <span
          class="inline-block w-1.5 h-1.5 rounded-full"
          :class="stateDot"
        ></span>
        {{ stateLabel }}
      </div>

      <!-- 评分角标 -->
      <div v-if="voteText" class="shc-vote-badge">
        <IconifyIcon icon="lucide:star" class="shc-vote-icon" />
        {{ voteText }}
      </div>

      <!-- 默认态：底部渐变标题（展开时隐藏） -->
      <div class="shc-poster-caption">
        <div class="shc-poster-title" :title="captionTitle">
          {{ captionTitle }}
        </div>
        <div v-if="showProgress" class="shc-poster-progress">
          <div class="shc-progress-track">
            <div
              class="shc-progress-fill"
              :style="{ width: `${progressPercent}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 信息面板（桌面 hover / 移动端浮窗，均为同一 DOM） -->
    <div class="shc-info" :class="{ 'shc-info--popup': isPopup }">
      <div class="shc-info-body">
        <!-- 标题 + 基础信息 -->
        <h3 class="shc-title" :title="item.name" @click="emit('click', item)">
          {{ item.name }}
        </h3>
        <div class="shc-meta">
          <span v-if="item.year">{{ item.year }}</span>
          <span class="shc-dot">·</span>
          <span>{{ typeLabel }}</span>
          <template v-if="seasonLabel">
            <span class="shc-dot">·</span>
            <span>{{ seasonLabel }}</span>
          </template>
        </div>

        <!-- 集数进度 -->
        <div v-if="showProgress" class="shc-progress-row">
          <span class="shc-progress-num">已下载 {{ progressText }}</span>
          <div class="shc-progress-track flex-1">
            <div
              class="shc-progress-fill"
              :style="{ width: `${progressPercent}%` }"
            ></div>
          </div>
        </div>

        <!-- 简介 -->
        <p v-if="overviewText" class="shc-overview">{{ overviewText }}</p>

        <!-- 过滤设置 -->
        <div v-if="hasFilterInfo" class="shc-section">
          <div class="shc-section-label">过滤设置</div>
          <div class="shc-tags">
            <NTag v-if="ruleLabel" size="tiny" class="tag-rule">
              {{ ruleLabel }}
            </NTag>
            <NTag v-if="overEdition" size="tiny" class="tag-over-edition">
              洗版
            </NTag>
            <NTag v-if="freeOnly" size="tiny" class="tag-free"> 仅免费 </NTag>
            <NTag
              v-if="restypeLabel"
              size="tiny"
              class="tag-quality"
              :title="restypeLabel"
            >
              {{ restypeLabel }}
            </NTag>
            <NTag
              v-if="pixLabel"
              size="tiny"
              class="tag-resolution"
              :title="pixLabel"
            >
              {{ pixLabel }}
            </NTag>
            <NTag v-if="item.filter_team" size="tiny" class="tag-team">
              {{ item.filter_team }}
            </NTag>
            <NTag
              v-if="item.filter_include"
              size="tiny"
              class="tag-include"
              :title="item.filter_include"
            >
              包含: {{ item.filter_include }}
            </NTag>
            <NTag
              v-if="item.filter_exclude"
              size="tiny"
              class="tag-exclude"
              :title="item.filter_exclude"
            >
              排除: {{ item.filter_exclude }}
            </NTag>
            <NTag v-if="downloadLabel" size="tiny" class="tag-download">
              {{ downloadLabel }}
            </NTag>
            <NTag
              v-if="keyword"
              size="tiny"
              class="tag-keyword"
              :title="keyword"
            >
              关键词: {{ keyword }}
            </NTag>
          </div>
        </div>

        <!-- 站点：显示名称，过多可折叠 -->
        <div v-if="hasSites" class="shc-section">
          <div v-if="rssSites.length > 0" class="shc-site-row">
            <span class="shc-site-label">订阅站点</span>
            <div class="shc-site-tags">
              <NTag
                v-for="s in rssVisible"
                :key="`rss-${s}`"
                size="tiny"
                class="tag-rss-site"
              >
                {{ s }}
              </NTag>
              <NTag
                v-if="rssOverflow > 0"
                size="tiny"
                class="tag-more"
                :title="rssSites.join('、')"
                @click.stop="sitesExpanded = true"
              >
                +{{ rssOverflow }}
              </NTag>
            </div>
          </div>
          <div v-if="searchSites.length > 0" class="shc-site-row">
            <span class="shc-site-label">搜索站点</span>
            <div class="shc-site-tags">
              <NTag
                v-for="s in searchVisible"
                :key="`search-${s}`"
                size="tiny"
                class="tag-search-site"
              >
                {{ s }}
              </NTag>
              <NTag
                v-if="searchOverflow > 0"
                size="tiny"
                class="tag-more"
                :title="searchSites.join('、')"
                @click.stop="sitesExpanded = true"
              >
                +{{ searchOverflow }}
              </NTag>
            </div>
          </div>
          <button
            v-if="canFold"
            type="button"
            class="shc-site-toggle"
            @click.stop="sitesExpanded = !sitesExpanded"
          >
            {{ sitesExpanded ? '收起' : '展开全部' }}
          </button>
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="shc-actions">
        <button
          type="button"
          class="shc-btn-primary"
          @click.stop="emit('search', item)"
        >
          <IconifyIcon icon="lucide:search" class="shc-btn-icon" />
          <span>搜索资源</span>
        </button>
        <div class="shc-action-icons">
          <button
            type="button"
            class="shc-icon-btn"
            title="编辑"
            @click.stop="emit('edit', item)"
          >
            <IconifyIcon icon="lucide:pencil" class="shc-btn-icon" />
          </button>
          <button
            type="button"
            class="shc-icon-btn"
            title="刷新"
            @click.stop="emit('refresh', item)"
          >
            <IconifyIcon icon="lucide:refresh-cw" class="shc-btn-icon" />
          </button>
          <button
            type="button"
            class="shc-icon-btn shc-icon-btn-danger"
            title="取消订阅"
            @click.stop="emit('delete', item)"
          >
            <IconifyIcon icon="lucide:trash-2" class="shc-btn-icon" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shc {
  position: relative;
  display: flex;
  flex: none;
  align-items: flex-start;
  width: 180px;
  height: auto;
  overflow: hidden;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px hsl(var(--foreground) / 8%);
  transition:
    width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.3s ease-out;
}

/* 海报区 */
.shc-poster {
  position: relative;
  flex-shrink: 0;
  width: 180px;
  height: 270px;
  overflow: hidden;
  border-radius: 0.5rem 0 0 0.5rem;
}

.shc-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shc-state-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  display: flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.1rem 0.4rem;
  font-size: 10px;
  font-weight: 500;
  color: hsl(0deg 0% 100% / 95%);
  background: hsl(0deg 0% 0% / 50%);
  border-radius: 0.25rem;
  backdrop-filter: blur(4px);
}

.shc-vote-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.15rem;
  align-items: center;
  padding: 0.1rem 0.4rem;
  font-size: 11px;
  font-weight: 700;
  color: hsl(0deg 0% 100%);
  background: hsl(262deg 72% 55%);
  border-radius: 0.25rem;
}

.shc-vote-icon {
  width: 11px;
  height: 11px;
  fill: currentcolor;
}

.shc-poster-caption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 1.5rem 0.6rem 0.9rem;
  color: hsl(0deg 0% 100%);
  background: linear-gradient(transparent, hsl(0deg 0% 0% / 82%));
  transition: opacity 0.2s ease-out;
}

.shc-poster-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  white-space: nowrap;
}

.shc-poster-progress {
  margin-top: 0.35rem;
}

/* 信息面板：绝对定位覆盖到右侧，hover 时不改变卡片在流中的宽度，避免多行换行时的回流闪烁 */
.shc-info {
  position: absolute;
  top: 0;
  left: 180px;
  box-sizing: border-box;
  display: flex;
  visibility: hidden;
  flex-direction: column;
  width: 340px;
  min-width: 0;
  height: 100%;
  padding: 0.85rem 0.9rem;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-left: none;
  border-radius: 0 0.5rem 0.5rem 0;
  box-shadow: 12px 0 32px hsl(var(--foreground) / 18%);
  opacity: 0;
  transform: translateX(8px);
  transition:
    opacity 0.25s ease,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0.25s;
  transition-delay: 0.05s;
}

.shc-info-body {
  flex: 1;
  min-height: 0;
  overflow: hidden auto;
}

.shc-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  color: hsl(var(--card-foreground));
  -webkit-box-orient: vertical;
}

.shc-title:hover {
  color: hsl(var(--primary));
}

.shc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  margin-top: 0.35rem;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.shc-dot {
  opacity: 0.5;
}

.shc-progress-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.55rem;
}

.shc-progress-num {
  flex-shrink: 0;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.shc-overview {
  display: -webkit-box;
  margin-top: 0.6rem;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.shc-section {
  margin-top: 0.7rem;
}

.shc-section-label {
  margin-bottom: 0.3rem;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--foreground) / 55%);
}

.shc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.shc-site-row {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  margin-top: 0.3rem;
}

.shc-site-label {
  flex-shrink: 0;
  padding-top: 1px;
  font-size: 11px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
}

.shc-site-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  min-width: 0;
}

.shc-site-toggle {
  margin-top: 0.4rem;
  font-size: 11px;
  color: hsl(var(--primary));
  cursor: pointer;
  background: transparent;
  border: none;
}

.shc-site-toggle:hover {
  text-decoration: underline;
}

/* 操作栏 */
.shc-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
  align-items: center;
  padding-top: 0.7rem;
  margin-top: 0.7rem;
  border-top: 1px solid hsl(var(--border));
}

.shc-btn-primary {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 0.9rem;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  background: hsl(var(--primary));
  border: 1.5px solid hsl(var(--primary));
  border-radius: 9999px;
  transition:
    opacity 0.15s ease,
    background 0.15s ease;
}

.shc-btn-primary:hover {
  background: hsl(var(--primary) / 90%);
}

.shc-action-icons {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin-left: auto;
}

.shc-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 1.5px solid hsl(var(--border));
  border-radius: 9999px;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.shc-icon-btn:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
}

.shc-icon-btn-danger:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
  border-color: hsl(var(--destructive));
}

.shc-btn-icon {
  width: 15px;
  height: 15px;
}

/* 进度条 */
.shc-progress-track {
  height: 4px;
  overflow: hidden;
  background: hsl(var(--muted) / 35%);
  border-radius: 2px;
}

.shc-progress-fill {
  height: 100%;
  background: hsl(var(--success) / 80%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* 标签配色 */
.shc :deep(.n-tag) {
  --n-height: 18px !important;
  --n-font-size: 10px !important;

  max-width: 160px;
  padding: 0 6px !important;
}

.shc :deep(.n-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.tag-rule) {
  --n-color: hsl(340deg 75% 95%) !important;
  --n-text-color: hsl(340deg 75% 50%) !important;
  --n-border: 1px solid hsl(340deg 75% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-over-edition) {
  --n-color: hsl(35deg 90% 93%) !important;
  --n-text-color: hsl(35deg 90% 45%) !important;
  --n-border: 1px solid hsl(35deg 90% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-free) {
  --n-color: hsl(145deg 70% 94%) !important;
  --n-text-color: hsl(145deg 70% 35%) !important;
  --n-border: 1px solid hsl(145deg 60% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-quality) {
  --n-color: hsl(255deg 85% 95%) !important;
  --n-text-color: hsl(255deg 75% 55%) !important;
  --n-border: 1px solid hsl(255deg 75% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-resolution) {
  --n-color: hsl(185deg 80% 93%) !important;
  --n-text-color: hsl(185deg 80% 35%) !important;
  --n-border: 1px solid hsl(185deg 70% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-team) {
  --n-color: hsl(160deg 70% 94%) !important;
  --n-text-color: hsl(160deg 70% 35%) !important;
  --n-border: 1px solid hsl(160deg 60% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-include) {
  --n-color: hsl(145deg 70% 94%) !important;
  --n-text-color: hsl(145deg 70% 35%) !important;
  --n-border: 1px solid hsl(145deg 60% 80%) !important;

  border-radius: 9999px;
}

:deep(.tag-exclude) {
  --n-color: hsl(340deg 75% 95%) !important;
  --n-text-color: hsl(340deg 75% 50%) !important;
  --n-border: 1px solid hsl(340deg 75% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-download) {
  --n-color: hsl(215deg 20% 95%) !important;
  --n-text-color: hsl(215deg 20% 45%) !important;
  --n-border: 1px solid hsl(215deg 20% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-keyword) {
  --n-color: hsl(var(--muted) / 40%) !important;
  --n-text-color: hsl(var(--muted-foreground)) !important;
  --n-border: 1px solid hsl(var(--border)) !important;

  border-radius: 9999px;
}

:deep(.tag-rss-site) {
  --n-color: hsl(220deg 70% 95%) !important;
  --n-text-color: hsl(220deg 70% 50%) !important;
  --n-border: 1px solid hsl(220deg 70% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-search-site) {
  --n-color: hsl(215deg 20% 95%) !important;
  --n-text-color: hsl(215deg 20% 45%) !important;
  --n-border: 1px solid hsl(215deg 20% 85%) !important;

  border-radius: 9999px;
}

:deep(.tag-more) {
  --n-color: hsl(var(--muted) / 40%) !important;
  --n-text-color: hsl(var(--primary)) !important;
  --n-border: 1px solid hsl(var(--border)) !important;

  cursor: pointer;
  border-radius: 9999px;
}

/* 悬停展开：信息面板以覆盖层浮出，卡片在流中的尺寸保持不变，避免回流闪烁 */
@media (hover: hover) {
  .shc:hover {
    z-index: 50;
    overflow: visible;
    box-shadow: 0 12px 32px hsl(var(--foreground) / 22%);
  }

  .shc:hover .shc-poster {
    align-self: flex-start;
    width: 180px;
  }

  .shc:hover .shc-poster-caption {
    opacity: 0;
  }

  .shc:hover .shc-info {
    visibility: visible;
    opacity: 1;
    transform: none;
  }

  /* 靠近右边缘：面板翻转到海报左侧展开 */
  .shc--flip-left .shc-info {
    right: 180px;
    left: auto;
    border-right: none;
    border-left: 1px solid hsl(var(--border));
    border-radius: 0.5rem 0 0 0.5rem;
    box-shadow: -12px 0 32px hsl(var(--foreground) / 18%);
    transform: translateX(-8px);
  }

  .shc--flip-left:hover .shc-info {
    transform: none;
  }
}

/* 移动端/触屏：点击弹出屏幕居中纯信息浮层（Teleport 到 body） */
.shc-backdrop {
  display: none;
}

@media (hover: none) {
  .shc {
    width: 100%;
    min-width: 0;
    max-width: none;
  }

  .shc-poster {
    width: 100%;
    height: auto;
    aspect-ratio: 2 / 3;
  }

  .shc-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: block;
    background: hsl(0deg 0% 0% / 55%);
  }
}

/* 弹窗样式（信息面板被 Teleport 到 body 后使用，屏幕居中） */
.shc-info--popup {
  position: fixed;
  inset: 50% auto auto 50%;
  z-index: 1000;
  display: flex;
  visibility: visible;
  flex: none;
  flex-direction: column;
  width: min(88vw, 380px);
  height: auto;
  max-height: 80vh;
  padding: 1rem;
  overflow: hidden auto;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  box-shadow: 0 24px 60px hsl(0deg 0% 0% / 50%);
  opacity: 1;
  transform: translate(-50%, -50%);
  transition: opacity 0.2s ease;
}

.shc-info--popup .shc-info-body {
  flex: 0 1 auto;
}

.shc-info--popup .shc-actions {
  display: flex;
}

/* 小屏适配：紧凑排版（布局与浮出由 hover:none 处理） */
@media (max-width: 640px) {
  .shc-info {
    padding: 0.6rem 0.65rem;
  }

  .shc-title {
    font-size: 14px;
  }

  .shc-meta {
    margin-top: 0.25rem;
    font-size: 11px;
  }

  .shc-overview {
    margin-top: 0.45rem;
    -webkit-line-clamp: 3;
    font-size: 11px;
  }

  .shc-section {
    margin-top: 0.5rem;
  }

  .shc-section-label {
    font-size: 10px;
  }

  .shc :deep(.n-tag) {
    max-width: 108px;
  }

  .shc-site-label {
    font-size: 10px;
  }

  .shc-actions {
    flex-wrap: nowrap;
    gap: 0.4rem;
    padding-top: 0.55rem;
    margin-top: 0.55rem;
  }

  .shc-btn-primary {
    flex: 0 1 auto;
    height: 30px;
    padding: 0 0.6rem;
    font-size: 12px;
  }

  .shc-action-icons {
    gap: 0.3rem;
    margin-left: auto;
  }

  .shc-icon-btn {
    width: 30px;
    height: 30px;
  }
}
</style>
