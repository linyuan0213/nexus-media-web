<script lang="ts">
import { ref } from 'vue';

// 全局状态：移动端激活的卡片（null = 无弹窗）
const activeGroup = ref<null | string>(null);
let outsideListenerInstalled = false;

function ensureOutsideListener() {
  if (typeof document === 'undefined' || outsideListenerInstalled) return;
  outsideListenerInstalled = true;
  document.addEventListener('click', (e) => {
    if (activeGroup.value === null) return;
    const el = e.target as Element | null;
    if (el && el.closest('.sgc')) return;
    activeGroup.value = null;
  });
}
</script>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { getImgUrl } from '#/utils/image';
import { formatPix, formatRestype } from '#/utils/subscribe';

interface Props {
  groupKey: string;
  name: string;
  year?: string;
  season?: string;
  image?: string;
  vote?: number | string;
  items: Record<string, any>[];
  type: 'movie' | 'tv';
}

const props = withDefaults(defineProps<Props>(), {
  year: '',
  season: '',
  image: '',
  vote: '',
});

const emit = defineEmits<{
  (
    e: 'click' | 'delete' | 'edit' | 'refresh' | 'search',
    item: Record<string, any>,
  ): void;
}>();

const stateMetaMap: Record<string, { dot: string; label: string }> = {
  C: { dot: 'sgc-dot--done', label: '已完成' },
  D: { dot: 'sgc-dot--wait', label: '待处理' },
  E: { dot: 'sgc-dot--error', label: '错误' },
  N: { dot: 'sgc-dot--idle', label: '已取消' },
  R: { dot: 'sgc-dot--run', label: '监控中' },
  S: { dot: 'sgc-dot--wait', label: '搜索中' },
};

function stateMeta(item: Record<string, any>) {
  return (
    stateMetaMap[item.state || ''] || {
      dot: 'sgc-dot--idle',
      label: item.state || '未知',
    }
  );
}

const seasonLabel = computed(() => {
  const s = props.season;
  return s && s !== 'S00' ? String(s) : '';
});

const voteText = computed(() => {
  const n = Number(props.vote);
  return n > 0 ? n.toFixed(1) : '';
});

const captionTitle = computed(() => {
  let text = props.name || '';
  if (props.type === 'tv' && seasonLabel.value) text += ` ${seasonLabel.value}`;
  if (props.year) text += `（${props.year}）`;
  return text;
});

const subscriberCount = computed(() => props.items.length);

function usernameOf(item: Record<string, any>): string {
  return item.username || (item.user_id ? `用户#${item.user_id}` : '系统');
}

function initialOf(item: Record<string, any>): string {
  return (usernameOf(item) || '?').slice(0, 1).toUpperCase();
}

// 头像配色：按用户名哈希从主题色板取色，同一用户颜色稳定
const AVATAR_HUES = [262, 185, 160, 340, 35, 215, 145];

function avatarHue(item: Record<string, any>): number {
  const name = usernameOf(item);
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  return AVATAR_HUES[h % AVATAR_HUES.length] ?? 262;
}

// 海报底部叠放头像：最多 4 个 + 计数
const MAX_AVATARS = 4;

// 面板订阅行折叠：超过 3 行默认折叠
const MAX_ROWS = 3;
const rowsExpanded = ref(false);
const visibleItems = computed(() =>
  rowsExpanded.value ? props.items : props.items.slice(0, MAX_ROWS),
);
const rowOverflow = computed(() => Math.max(0, props.items.length - MAX_ROWS));
const avatarItems = computed(() => props.items.slice(0, MAX_AVATARS));
const avatarOverflow = computed(() =>
  Math.max(0, props.items.length - MAX_AVATARS),
);

// 卡片角标聚合状态：优先级 错误 > 搜索中/待处理 > 监控中 > 已完成
const aggregateState = computed(() => {
  for (const p of ['E', 'S', 'D', 'R', 'C', 'N']) {
    if (props.items.some((i) => i.state === p)) return stateMetaMap[p];
  }
  return { dot: 'sgc-dot--idle', label: '未知' };
});

function itemProgress(item: Record<string, any>) {
  if (props.type !== 'tv') return null;
  const total = Number(item.total) || 0;
  if (!total) return null;
  const lack = Number(item.lack) || 0;
  return {
    percent: Math.round(((total - lack) / total) * 100),
    text: `${total - lack}/${total}`,
  };
}

function itemQuality(item: Record<string, any>) {
  const tags: string[] = [];
  if (item.filter_pix) tags.push(formatPix(item.filter_pix));
  if (item.filter_restype) tags.push(formatRestype(item.filter_restype));
  const v = item.over_edition;
  if (v === true || v === 1 || String(v) === '1') tags.push('洗版');
  return tags;
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = '/static/img/no-image.png';
}

// 移动端点击激活（与 hover 面板共用 DOM）
const isPopup = computed(() => activeGroup.value === props.groupKey);

function isTouchMode() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    !window.matchMedia('(hover: hover)').matches
  );
}

// 靠近右边缘时面板翻转左侧展开
const flipLeft = ref(false);
const POSTER_WIDTH = 180;
const PANEL_WIDTH = 360;

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
    if (props.items[0]) emit('click', props.items[0]);
    return;
  }
  activeGroup.value = isPopup.value ? null : props.groupKey;
}

function closePopover() {
  activeGroup.value = null;
}

onMounted(ensureOutsideListener);
</script>

<template>
  <div
    class="sgc"
    :class="{ 'is-expanded': isPopup, 'sgc--flip-left': flipLeft }"
    @mouseenter="onCardEnter"
  >
    <!-- 移动端浮层遮罩 -->
    <Teleport to="body">
      <div v-if="isPopup" class="sgc-backdrop" @click="closePopover"></div>
    </Teleport>

    <!-- 海报 -->
    <div class="sgc-poster" @click="onPosterClick">
      <img
        :src="getImgUrl(image)"
        class="sgc-poster-img"
        alt=""
        @error="onImgError"
      />

      <!-- 聚合状态角标 -->
      <div class="sgc-state-badge">
        <span
          class="inline-block w-1.5 h-1.5 rounded-full"
          :class="aggregateState?.dot"
        ></span>
        {{ aggregateState?.label }}
      </div>

      <!-- 评分角标 -->
      <div v-if="voteText" class="sgc-vote-badge">
        <IconifyIcon icon="lucide:star" class="sgc-vote-icon" />
        {{ voteText }}
      </div>

      <!-- 底部渐变：标题 + 订阅者头像 -->
      <div class="sgc-poster-caption">
        <div class="sgc-poster-title" :title="captionTitle">
          {{ captionTitle }}
        </div>
        <div class="sgc-subscribers">
          <div class="sgc-avatars">
            <span
              v-for="item in avatarItems"
              :key="item.id"
              class="sgc-avatar"
              :style="{ '--avatar-hue': avatarHue(item) }"
              :title="usernameOf(item)"
            >
              {{ initialOf(item) }}
            </span>
            <span v-if="avatarOverflow > 0" class="sgc-avatar sgc-avatar-more">
              +{{ avatarOverflow }}
            </span>
          </div>
          <span class="sgc-sub-count">{{ subscriberCount }} 人订阅</span>
        </div>
      </div>
    </div>

    <!-- 订阅者面板（桌面 hover / 移动端浮窗） -->
    <div class="sgc-panel" :class="{ 'sgc-panel--popup': isPopup }">
      <div class="sgc-panel-body">
        <h3 class="sgc-title" :title="name">{{ name }}</h3>
        <div class="sgc-meta">
          <span v-if="year">{{ year }}</span>
          <span class="sgc-dot-sep">·</span>
          <span>{{ type === 'movie' ? '电影' : '剧集' }}</span>
          <template v-if="seasonLabel">
            <span class="sgc-dot-sep">·</span>
            <span>{{ seasonLabel }}</span>
          </template>
        </div>

        <div class="sgc-section-label">订阅用户（{{ subscriberCount }}）</div>
        <div class="sgc-sub-rows">
          <div v-for="item in visibleItems" :key="item.id" class="sgc-sub-row">
            <div class="sgc-sub-user">
              <span
                class="sgc-avatar sgc-avatar--row"
                :style="{ '--avatar-hue': avatarHue(item) }"
              >
                {{ initialOf(item) }}
              </span>
              <div class="sgc-sub-user-text">
                <span class="sgc-username" :title="usernameOf(item)">
                  {{ usernameOf(item) }}
                </span>
                <span class="sgc-sub-state">
                  <span
                    class="inline-block w-1.5 h-1.5 rounded-full"
                    :class="stateMeta(item).dot"
                  ></span>
                  {{ stateMeta(item).label }}
                  <template v-if="itemProgress(item)">
                    · {{ itemProgress(item)!.text }}
                  </template>
                </span>
              </div>
            </div>

            <div class="sgc-sub-right">
              <div v-if="itemQuality(item).length > 0" class="sgc-sub-tags">
                <span
                  v-for="tag in itemQuality(item)"
                  :key="tag"
                  class="sgc-tag"
                >
                  {{ tag }}
                </span>
              </div>
              <div class="sgc-sub-actions">
                <button
                  type="button"
                  class="sgc-icon-btn"
                  title="搜索资源"
                  @click.stop="emit('search', item)"
                >
                  <IconifyIcon icon="lucide:search" class="sgc-btn-icon" />
                </button>
                <button
                  type="button"
                  class="sgc-icon-btn"
                  title="编辑"
                  @click.stop="emit('edit', item)"
                >
                  <IconifyIcon icon="lucide:pencil" class="sgc-btn-icon" />
                </button>
                <button
                  type="button"
                  class="sgc-icon-btn"
                  title="刷新"
                  @click.stop="emit('refresh', item)"
                >
                  <IconifyIcon icon="lucide:refresh-cw" class="sgc-btn-icon" />
                </button>
                <button
                  type="button"
                  class="sgc-icon-btn sgc-icon-btn-danger"
                  title="取消该用户订阅"
                  @click.stop="emit('delete', item)"
                >
                  <IconifyIcon icon="lucide:trash-2" class="sgc-btn-icon" />
                </button>
              </div>
            </div>

            <div
              v-if="itemProgress(item)"
              class="sgc-progress-track sgc-sub-progress-bar"
            >
              <div
                class="sgc-progress-fill"
                :style="{ width: `${itemProgress(item)!.percent}%` }"
              ></div>
            </div>
          </div>
          <button
            v-if="rowOverflow > 0 || rowsExpanded"
            type="button"
            class="sgc-rows-toggle"
            @click.stop="rowsExpanded = !rowsExpanded"
          >
            {{ rowsExpanded ? '收起' : `展开其余 ${rowOverflow} 人` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sgc {
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

/* 海报区（与平铺卡片一致） */
.sgc-poster {
  position: relative;
  flex-shrink: 0;
  width: 180px;
  height: 270px;
  overflow: hidden;
  border-radius: 0.5rem;
}

.sgc-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sgc-state-badge {
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

.sgc-vote-badge {
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

.sgc-vote-icon {
  width: 11px;
  height: 11px;
  fill: currentcolor;
}

.sgc-poster-caption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 1.75rem 0.6rem 0.6rem;
  color: hsl(0deg 0% 100%);
  background: linear-gradient(transparent, hsl(0deg 0% 0% / 82%));
  transition: opacity 0.2s ease-out;
}

.sgc-poster-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  white-space: nowrap;
}

/* 订阅者头像叠放 */
.sgc-subscribers {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  justify-content: center;
  margin-top: 0.4rem;
}

.sgc-avatars {
  display: flex;
  align-items: center;
}

.sgc-avatar {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: -6px;
  font-size: 10px;
  font-weight: 700;
  color: hsl(0deg 0% 100%);
  background: hsl(var(--avatar-hue, 262) 70% 55%);
  border: 1.5px solid hsl(0deg 0% 100% / 85%);
  border-radius: 9999px;
}

.sgc-avatar:first-child {
  margin-left: 0;
}

.sgc-avatar-more {
  background: hsl(0deg 0% 100% / 25%);
  backdrop-filter: blur(2px);
}

.sgc-sub-count {
  font-size: 10px;
  color: hsl(0deg 0% 100% / 85%);
  white-space: nowrap;
}

/* 订阅者面板（绝对定位覆盖到右侧，与平铺卡片同构） */
.sgc-panel {
  position: absolute;
  top: 0;
  left: 180px;
  box-sizing: border-box;
  display: flex;
  visibility: hidden;
  flex-direction: column;
  width: 360px;
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

.sgc-panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden auto;
}

.sgc-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  color: hsl(var(--card-foreground));
  -webkit-box-orient: vertical;
}

.sgc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  margin-top: 0.3rem;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.sgc-dot-sep {
  opacity: 0.5;
}

.sgc-section-label {
  margin-top: 0.7rem;
  margin-bottom: 0.35rem;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--foreground) / 55%);
}

/* 用户订阅行 */
.sgc-sub-rows {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.sgc-sub-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.5rem;
  align-items: center;
  padding: 0.45rem 0.55rem;
  background: hsl(var(--muted) / 16%);
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 0.45rem;
}

.sgc-sub-user {
  display: flex;
  flex-shrink: 0;
  gap: 0.45rem;
  align-items: center;
  min-width: 0;
}

.sgc-avatar--row {
  width: 24px;
  height: 24px;
  margin-left: 0;
  font-size: 11px;
  border-color: hsl(var(--card));
}

.sgc-sub-user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.sgc-username {
  max-width: 8.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.sgc-sub-state {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

.sgc-sub-right {
  display: flex;
  flex: 1;
  gap: 0.4rem;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.sgc-sub-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  justify-content: flex-end;
}

.sgc-tag {
  padding: 0 6px;
  font-size: 10px;
  font-weight: 500;
  line-height: 16px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  background: hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 9999px;
}

.sgc-sub-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.3rem;
  align-items: center;
}

.sgc-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
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

.sgc-icon-btn:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
}

.sgc-icon-btn-danger:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 8%);
  border-color: hsl(var(--destructive));
}

.sgc-btn-icon {
  width: 13px;
  height: 13px;
}

.sgc-sub-progress-bar {
  flex-basis: 100%;
}

.sgc-rows-toggle {
  align-self: center;
  padding: 0.15rem 0.6rem;
  font-size: 11px;
  color: hsl(var(--primary));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 9999px;
}

.sgc-rows-toggle:hover {
  background: hsl(var(--primary) / 8%);
}

.sgc-progress-track {
  height: 4px;
  overflow: hidden;
  background: hsl(var(--muted) / 35%);
  border-radius: 2px;
}

.sgc-progress-fill {
  height: 100%;
  background: hsl(var(--success) / 80%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* 状态点配色 */
.sgc-dot--run {
  background: hsl(var(--success));
}

.sgc-dot--done {
  background: hsl(var(--primary));
}

.sgc-dot--wait {
  background: hsl(var(--warning));
}

.sgc-dot--error {
  background: hsl(var(--destructive));
}

.sgc-dot--idle {
  background: hsl(var(--muted-foreground) / 50%);
}

/* 悬停展开（与平铺卡片同构） */
@media (hover: hover) {
  .sgc:hover {
    z-index: 50;
    overflow: visible;
    box-shadow: 0 12px 32px hsl(var(--foreground) / 22%);
  }

  .sgc:hover .sgc-panel {
    visibility: visible;
    opacity: 1;
    transform: none;
  }

  .sgc--flip-left .sgc-panel {
    right: 180px;
    left: auto;
    border-right: none;
    border-left: 1px solid hsl(var(--border));
    border-radius: 0.5rem 0 0 0.5rem;
    box-shadow: -12px 0 32px hsl(var(--foreground) / 18%);
    transform: translateX(-8px);
  }

  .sgc--flip-left:hover .sgc-panel {
    transform: none;
  }
}

/* 移动端/触屏：点击弹出屏幕居中浮层 */
.sgc-backdrop {
  display: none;
}

@media (hover: none) {
  .sgc {
    width: 100%;
    min-width: 0;
    max-width: none;
  }

  .sgc-poster {
    width: 100%;
    height: auto;
    aspect-ratio: 2 / 3;
  }

  .sgc-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: block;
    background: hsl(0deg 0% 0% / 55%);
  }
}

.sgc-panel--popup {
  position: fixed;
  inset: 50% auto auto 50%;
  z-index: 1000;
  display: flex;
  visibility: visible;
  flex: none;
  flex-direction: column;
  width: min(88vw, 400px);
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
}

.sgc-panel--popup .sgc-panel-body {
  flex: 0 1 auto;
}
</style>
