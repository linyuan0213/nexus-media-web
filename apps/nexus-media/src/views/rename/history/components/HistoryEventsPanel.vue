<script lang="ts" setup>
import type { HistoryItem } from '../types';

import { computed } from 'vue';

import { NEmpty } from 'naive-ui';

import { formatDate, statusText } from '../types';

interface Props {
  item: HistoryItem;
}

const props = defineProps<Props>();

const events = computed(() => {
  const result: Array<{
    danger?: boolean;
    desc: string;
    time: string;
    title: string;
  }> = [];

  if (props.item.DATE) {
    result.push({
      time: props.item.DATE,
      title: '识别记录创建',
      desc: `${props.item.TITLE || '媒体'} 完成识别并写入转移历史`,
    });
  }
  if (props.item.SOURCE_DELETED_AT) {
    result.push({
      time: props.item.SOURCE_DELETED_AT,
      title: '源文件已删除',
      desc: '通过识别历史删除源文件，识别记录保留',
      danger: true,
    });
  }
  if (props.item.DEST_DELETED_AT) {
    result.push({
      time: props.item.DEST_DELETED_AT,
      title: '媒体库文件已删除',
      desc: '通过识别历史删除媒体库文件，识别记录保留',
      danger: true,
    });
  }
  return result.sort((a, b) => a.time.localeCompare(b.time));
});
</script>

<template>
  <div>
    <h2 class="section-title">事件时间线</h2>

    <NEmpty
      v-if="events.length === 0"
      description="暂无事件记录"
      size="small"
    />

    <div v-else class="timeline">
      <div
        v-for="event in events"
        :key="`${event.time}-${event.title}`"
        class="tl-item"
        :class="{ 'is-danger': event.danger }"
      >
        <span class="tl-dot"></span>
        <div class="tl-title">
          {{ event.title }}
          <span class="tl-time">{{ formatDate(event.time) }}</span>
        </div>
        <div class="tl-desc">{{ event.desc }}</div>
      </div>
    </div>

    <div class="current-state">
      <span>当前记录状态</span>
      <strong>{{ statusText(item) }}</strong>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 12px;
  font-size: 0.74rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.02em;
}

.timeline {
  position: relative;
  padding-left: 27px;
  margin-top: 4px;
}

.timeline::before {
  position: absolute;
  top: 5px;
  bottom: 8px;
  left: 7px;
  content: '';
  border-left: 1.5px dashed hsl(var(--border));
}

.tl-item {
  position: relative;
  padding-bottom: 18px;
}

.tl-item:last-child {
  padding-bottom: 0;
}

.tl-dot {
  position: absolute;
  top: 2px;
  left: -27px;
  width: 15px;
  height: 15px;
  background: hsl(var(--primary));
  border: 3px solid hsl(var(--card));
  border-radius: 50%;
  box-shadow: 0 0 0 1px hsl(var(--primary) / 35%);
}

.tl-item.is-danger .tl-dot {
  background: hsl(var(--destructive));
  box-shadow: 0 0 0 1px hsl(var(--destructive) / 35%);
}

.tl-title {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  font-size: 0.82rem;
  font-weight: 600;
}

.tl-time {
  font-size: 0.68rem;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.tl-desc {
  margin-top: 3px;
  font-size: 0.73rem;
  line-height: 1.55;
  color: hsl(var(--muted-foreground));
}

.current-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin-top: 18px;
  font-size: 0.73rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
}

.current-state strong {
  font-weight: 550;
  color: hsl(var(--foreground));
}
</style>
