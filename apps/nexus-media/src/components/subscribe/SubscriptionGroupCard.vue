<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NTag } from 'naive-ui';

import { getImgUrl } from '#/utils/image';
import { formatPix, formatRestype } from '#/utils/subscribe';

interface Props {
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

const subscriberCount = computed(() => props.items.length);

const usernames = computed(() => {
  const names = props.items.map(
    (i) => i.username || (i.user_id ? `用户#${i.user_id}` : '系统'),
  );
  return [...new Set(names)];
});

// 卡片角标聚合状态：优先级 错误 > 搜索中/待处理 > 监控中 > 已完成
const aggregateState = computed(() => {
  const priority = ['E', 'S', 'D', 'R', 'C', 'N'];
  for (const p of priority) {
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
</script>

<template>
  <div class="sgc">
    <!-- 海报 -->
    <div v-if="items[0]" class="sgc-poster" @click="emit('click', items[0])">
      <img
        :src="getImgUrl(image)"
        class="sgc-poster-img"
        alt=""
        @error="onImgError"
      />
      <div class="sgc-state-badge">
        <span
          class="inline-block w-1.5 h-1.5 rounded-full"
          :class="aggregateState?.dot"
        ></span>
        {{ aggregateState?.label }}
      </div>
      <div v-if="voteText" class="sgc-vote-badge">
        <IconifyIcon icon="lucide:star" class="sgc-vote-icon" />
        {{ voteText }}
      </div>
    </div>

    <!-- 内容 -->
    <div class="sgc-body">
      <div class="sgc-head">
        <div class="sgc-title-wrap">
          <h3 class="sgc-title" :title="name">{{ name }}</h3>
          <div class="sgc-meta">
            <span v-if="year">{{ year }}</span>
            <template v-if="seasonLabel">
              <span class="sgc-dot-sep">·</span>
              <span>{{ seasonLabel }}</span>
            </template>
            <span class="sgc-dot-sep">·</span>
            <span>{{ type === 'movie' ? '电影' : '剧集' }}</span>
          </div>
        </div>
        <div class="sgc-count-badge" :title="usernames.join('、')">
          <IconifyIcon icon="lucide:users" class="sgc-count-icon" />
          {{ subscriberCount }} 人订阅
        </div>
      </div>

      <!-- 各用户订阅行 -->
      <div class="sgc-subs">
        <div v-for="item in items" :key="item.id" class="sgc-sub-row">
          <div class="sgc-sub-user">
            <span
              class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              :class="stateMeta(item).dot"
            ></span>
            <span
              class="sgc-username"
              :title="item.username || `用户#${item.user_id}`"
            >
              {{
                item.username ||
                (item.user_id ? `用户#${item.user_id}` : '系统')
              }}
            </span>
            <span class="sgc-sub-state">{{ stateMeta(item).label }}</span>
          </div>

          <div
            v-if="itemProgress(item) || itemQuality(item).length > 0"
            class="sgc-sub-info"
          >
            <div v-if="itemProgress(item)" class="sgc-sub-progress">
              <div class="sgc-progress-track">
                <div
                  class="sgc-progress-fill"
                  :style="{ width: `${itemProgress(item)!.percent}%` }"
                ></div>
              </div>
              <span class="sgc-progress-text">{{
                itemProgress(item)!.text
              }}</span>
            </div>
            <NTag
              v-for="tag in itemQuality(item)"
              :key="tag"
              size="tiny"
              class="sgc-tag"
            >
              {{ tag }}
            </NTag>
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.sgc {
  display: flex;
  gap: 0.9rem;
  width: 100%;
  min-width: 0;
  padding: 0.75rem;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px hsl(var(--foreground) / 8%);
  transition:
    box-shadow 0.3s ease-out,
    border-color 0.2s ease;
}

.sgc:hover {
  border-color: hsl(var(--primary) / 40%);
  box-shadow: 0 6px 20px hsl(var(--foreground) / 12%);
}

/* 海报 */
.sgc-poster {
  position: relative;
  flex-shrink: 0;
  width: 84px;
  height: 126px;
  overflow: hidden;
  cursor: pointer;
  border-radius: 0.4rem;
}

.sgc-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sgc-state-badge {
  position: absolute;
  top: 0.35rem;
  left: 0.35rem;
  display: flex;
  gap: 0.2rem;
  align-items: center;
  padding: 0.05rem 0.35rem;
  font-size: 10px;
  font-weight: 500;
  color: hsl(0deg 0% 100% / 95%);
  background: hsl(0deg 0% 0% / 50%);
  border-radius: 0.25rem;
  backdrop-filter: blur(4px);
}

.sgc-vote-badge {
  position: absolute;
  right: 0.35rem;
  bottom: 0.35rem;
  display: flex;
  gap: 0.15rem;
  align-items: center;
  padding: 0.05rem 0.3rem;
  font-size: 10px;
  font-weight: 700;
  color: hsl(0deg 0% 100%);
  background: hsl(262deg 72% 55%);
  border-radius: 0.25rem;
}

.sgc-vote-icon {
  width: 10px;
  height: 10px;
  fill: currentcolor;
}

/* 内容区 */
.sgc-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.sgc-head {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  justify-content: space-between;
}

.sgc-title-wrap {
  min-width: 0;
}

.sgc-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.sgc-meta {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  margin-top: 0.15rem;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.sgc-dot-sep {
  opacity: 0.5;
}

.sgc-count-badge {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.3rem;
  align-items: center;
  padding: 0.15rem 0.55rem;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--primary));
  white-space: nowrap;
  background: hsl(var(--primary) / 10%);
  border-radius: 9999px;
}

.sgc-count-icon {
  width: 12px;
  height: 12px;
}

/* 订阅行 */
.sgc-subs {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.sgc-sub-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  padding: 0.4rem 0.55rem;
  background: hsl(var(--muted) / 18%);
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 0.4rem;
}

.sgc-sub-user {
  display: flex;
  flex-shrink: 0;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
}

.sgc-username {
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.sgc-sub-state {
  flex-shrink: 0;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.sgc-sub-info {
  display: flex;
  flex: 1;
  gap: 0.3rem;
  align-items: center;
  min-width: 0;
}

.sgc-sub-progress {
  display: flex;
  flex: 0 1 140px;
  gap: 0.35rem;
  align-items: center;
  min-width: 90px;
}

.sgc-progress-track {
  flex: 1;
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

.sgc-progress-text {
  flex-shrink: 0;
  font-size: 10px;
  color: hsl(var(--muted-foreground));
}

.sgc :deep(.sgc-tag) {
  --n-height: 16px !important;
  --n-font-size: 10px !important;

  padding: 0 5px !important;
  border-radius: 9999px;
}

.sgc-sub-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.3rem;
  align-items: center;
  margin-left: auto;
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

/* 小屏适配 */
@media (max-width: 640px) {
  .sgc {
    gap: 0.6rem;
    padding: 0.6rem;
  }

  .sgc-poster {
    width: 64px;
    height: 96px;
  }

  .sgc-title {
    font-size: 13px;
  }

  .sgc-sub-row {
    align-items: flex-start;
  }

  .sgc-sub-actions {
    width: 100%;
    margin-left: 0;
  }
}
</style>
