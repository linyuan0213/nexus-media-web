<script lang="ts" setup>
import {
  computed,
  nextTick,
  onActivated,
  onMounted,
  onUnmounted,
  ref,
} from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NInput, NModal, NSpace, NSpin, NTag } from 'naive-ui';

import {
  downloadSubscriptionCalendarIcsApi,
  getSubscriptionCalendarEventsApi,
  getSubscriptionCalendarWebcalUrlApi,
} from '#/api/modules/subscription';
import PageHeader from '#/components/page/PageHeader.vue';
import {
  resolveMediaPoster,
  resolveMediaPosterPosition,
} from '#/utils/media-poster';
import { useAppNotification } from '#/utils/notify';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  type: string;
  poster: string;
  content_profile: string;
  source_label: string;
  date_source_label: string;
  vote_average: number | string;
  year: string;
  rssid: string;
  episode?: number | string;
  season?: number | string;
}

type CalendarView = 'list' | 'month' | 'week';
interface CalendarDay {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  key: string;
}

interface CalendarDayGroup {
  date: Date;
  events: CalendarEvent[];
  key: string;
}

const loading = ref(false);
const CALENDAR_CACHE_KEY = 'nexus.calendar.events.v2';
const allEvents = ref<CalendarEvent[]>([]);
const visibleMonth = ref(
  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
);
const selectedDate = ref(new Date());
const view = ref<CalendarView>('month');
const sourceFilter = ref('all');
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

const detailModalShow = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);
const popoverEvent = ref<CalendarEvent | null>(null);
const popoverPosition = ref({ left: '0px', top: '0px' });
const notification = useAppNotification();
const webcalLink = ref('');
const httpCalLink = ref('');
const webcalLoading = ref(false);
const calServerHost = ref(
  localStorage.getItem('nexus-media-calendar-host') || window.location.host,
);
const webcalSettingShow = ref(false);

function readCachedCalendarEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(CALENDAR_CACHE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Date.now() - Number(data?.savedAt || 0) > 86_400_000) return [];
    return Array.isArray(data?.events) ? data.events : [];
  } catch {
    return [];
  }
}

function cacheCalendarEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem(
      CALENDAR_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), events }),
    );
  } catch {
    // 本地缓存失败不影响主流程
  }
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const todayKey = toDateKey(new Date());

const sourceOptions = computed(() => {
  const labels = new Set<string>();
  for (const event of allEvents.value) {
    if (event.source_label) labels.add(event.source_label);
  }
  return [...labels].sort();
});

const filteredEvents = computed(() =>
  allEvents.value.filter(
    (event) =>
      sourceFilter.value === 'all' || event.source_label === sourceFilter.value,
  ),
);

const filteredEventsByDate = computed(() => {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of filteredEvents.value) {
    const list = map.get(event.start) || [];
    list.push(event);
    map.set(event.start, list);
  }
  return map;
});

const monthLabel = computed(
  () =>
    `${visibleMonth.value.getFullYear()} 年 ${visibleMonth.value.getMonth() + 1} 月`,
);

const monthPrefix = computed(() => {
  const year = visibleMonth.value.getFullYear();
  const month = String(visibleMonth.value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
});

const monthEvents = computed(() =>
  filteredEvents.value.filter((event) =>
    event.start.startsWith(monthPrefix.value),
  ),
);

const monthShows = computed(
  () =>
    new Set(
      allEvents.value
        .filter((event) => event.start.startsWith(monthPrefix.value))
        .map((event) => event.id),
    ).size,
);

const currentWeekCount = computed(() => {
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  return allEvents.value.filter(
    (event) => event.start >= startKey && event.start <= endKey,
  ).length;
});

const headerSubtitle = computed(
  () => `${monthShows.value} 部订阅 · 本周更新 ${currentWeekCount.value} 集`,
);

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function eventsForDay(date: Date): CalendarEvent[] {
  return filteredEventsByDate.value.get(toDateKey(date)) || [];
}

const calendarDays = computed<CalendarDay[]>(() => {
  const year = visibleMonth.value.getFullYear();
  const month = visibleMonth.value.getMonth();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const selectedKey = toDateKey(selectedDate.value);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - firstDayOffset + 1);
    const key = toDateKey(date);
    return {
      date,
      events: eventsForDay(date),
      isCurrentMonth: date.getMonth() === month,
      isSelected: key === selectedKey,
      isToday: key === todayKey,
      key,
    };
  });
});

const weekDays = computed<CalendarDay[]>(() => {
  const start = startOfWeek(selectedDate.value);
  const selectedKey = toDateKey(selectedDate.value);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      events: eventsForDay(date),
      isCurrentMonth: date.getMonth() === visibleMonth.value.getMonth(),
      isSelected: toDateKey(date) === selectedKey,
      isToday: toDateKey(date) === todayKey,
      key: toDateKey(date),
    };
  });
});

const listGroups = computed<CalendarDayGroup[]>(() => {
  const groups = new Map<string, CalendarDayGroup>();
  for (const event of monthEvents.value) {
    const date = new Date(`${event.start}T00:00:00`);
    const key = event.start;
    const group = groups.get(key) || { date, events: [], key };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
});

function eventPosterUrl(event: CalendarEvent): string {
  return resolveMediaPoster(event.poster, event.content_profile);
}

function eventPosterPosition(event: CalendarEvent): string {
  return resolveMediaPosterPosition(event.content_profile, 'center');
}

function eventEpisodeLabel(event: CalendarEvent): string {
  if (event.episode === '' || event.episode === undefined) return '';
  return `第${event.episode}集`;
}

function eventTypeLabel(type: string): string {
  if (type === 'movie') return '电影';
  if (type === 'anime') return '动漫';
  return '电视剧';
}

function eventTypeClass(type: string): string {
  if (type === 'movie') return 'event-movie';
  if (type === 'anime') return 'event-anime';
  return 'event-tv';
}

function formatDayLabel(date: Date): string {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 周${weekdays[(date.getDay() + 6) % 7]}`;
}

function formatWeekday(date: Date): string {
  return `周${weekdays[(date.getDay() + 6) % 7]}`;
}

function changeMonth(delta: number) {
  const next = new Date(
    visibleMonth.value.getFullYear(),
    visibleMonth.value.getMonth() + delta,
    1,
  );
  visibleMonth.value = next;
  if (view.value === 'week') {
    selectedDate.value = new Date(next);
  }
}

function goToToday() {
  const now = new Date();
  visibleMonth.value = new Date(now.getFullYear(), now.getMonth(), 1);
  selectedDate.value = now;
}

function clearFilters() {
  sourceFilter.value = 'all';
}

function selectDay(day: CalendarDay) {
  selectedDate.value = day.date;
  if (!day.isCurrentMonth) {
    visibleMonth.value = new Date(
      day.date.getFullYear(),
      day.date.getMonth(),
      1,
    );
  }
}

function openDayList(date: Date) {
  selectedDate.value = date;
  view.value = 'list';
}

function handleEventClick(event: CalendarEvent, mouseEvent?: MouseEvent) {
  popoverEvent.value = event;
  const target = mouseEvent?.currentTarget as HTMLElement | null;
  if (!target) return;
  nextTick(() => {
    const rect = target.getBoundingClientRect();
    const width = 264;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    const estimatedHeight = 236;
    let top = rect.bottom + 8;
    if (top + estimatedHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedHeight - 8);
    }
    popoverPosition.value = { left: `${left}px`, top: `${top}px` };
  });
}

function openEventDetail(event: CalendarEvent) {
  popoverEvent.value = null;
  selectedEvent.value = event;
  detailModalShow.value = true;
}

function closePopover() {
  popoverEvent.value = null;
}

function eventDateHint(event: CalendarEvent): string {
  if (
    event.date_source_label &&
    event.date_source_label !== event.source_label
  ) {
    return event.date_source_label;
  }
  return event.source_label || '订阅日历';
}

function openTmdb(event: CalendarEvent) {
  const id = String(event.id || '');
  if (!id || !/^\d+$/.test(id)) return;
  const type = event.type === 'movie' ? 'movie' : 'tv';
  window.open(`https://www.themoviedb.org/${type}/${id}`, '_blank', 'noopener');
}

async function exportCalendar() {
  try {
    const res: any = await downloadSubscriptionCalendarIcsApi();
    const ics = res?.data ?? res ?? '';
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-media-subscriptions.ics';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error: any) {
    notification.error('导出失败', { description: error?.message || '' });
  }
}

async function ensureCalendarLinks() {
  if (webcalLink.value && httpCalLink.value) return;
  webcalLoading.value = true;
  try {
    const res: any = await getSubscriptionCalendarWebcalUrlApi();
    const data = res?.data || res || {};
    const { token } = data;
    if (!token) {
      notification.error('获取订阅 Token 失败');
      return;
    }
    const host = calServerHost.value || window.location.host;
    localStorage.setItem('nexus-media-calendar-host', host);
    const apiUrl = import.meta.env.VITE_GLOB_API_URL || '/api';
    const base = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
    const absBase = base.startsWith('http') ? base : `http://${host}${base}`;
    httpCalLink.value = `${absBase}/subscription/calendar/ical/webcal?apikey=${token}`;
    webcalLink.value = httpCalLink.value.replace(/^https?:\/\//, 'webcal://');
  } catch (error: any) {
    notification.error('获取订阅链接失败', {
      description: error?.message || '',
    });
  } finally {
    webcalLoading.value = false;
  }
}

function openWebcal() {
  ensureCalendarLinks().then(() => {
    if (webcalLink.value) window.open(webcalLink.value, '_blank');
  });
}

async function openWebcalSetting() {
  await ensureCalendarLinks();
  if (httpCalLink.value) webcalSettingShow.value = true;
}

async function copyHttpCalLink() {
  await ensureCalendarLinks();
  if (!httpCalLink.value) return;
  try {
    await navigator.clipboard.writeText(httpCalLink.value);
    notification.success('已复制 HTTP 订阅链接');
  } catch {
    notification.error('复制失败');
  }
}

function clearCalendarLinks() {
  httpCalLink.value = '';
  webcalLink.value = '';
}

async function loadCalendarEvents() {
  if (allEvents.value.length === 0) {
    allEvents.value = readCachedCalendarEvents();
  }
  loading.value = allEvents.value.length === 0;
  try {
    const res: any = await getSubscriptionCalendarEventsApi();
    const list = Array.isArray(res) ? res : res?.data || [];
    const events = list
      .filter((evt: any) => evt?.start)
      .map((evt: any) => ({
        id: String(evt.id || ''),
        title: evt.title || '',
        start: evt.start,
        type: evt.type || '',
        poster: evt.poster || '',
        content_profile: evt.content_profile || 'default',
        source_label: evt.source_label || '',
        date_source_label: evt.date_source_label || '',
        vote_average: evt.vote_average ?? '',
        year: evt.year || '',
        rssid: String(evt.rssid || ''),
      }));
    if (events.length > 0) {
      allEvents.value = events;
      cacheCalendarEvents(events);
    } else if (allEvents.value.length === 0) {
      allEvents.value = events;
    } else {
      // 元数据源瞬时限流时后端可能返回空数组，保留最后一次本地完整结果。
      notification.warning('日历同步暂时不可用，正在显示缓存');
    }
  } catch (error: any) {
    notification.error('加载订阅日历失败', {
      description: error?.message || '',
    });
  } finally {
    loading.value = false;
  }
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (
    popoverEvent.value &&
    !target?.closest('.event-popover') &&
    !target?.closest('.event-chip, .week-event, .list-event')
  ) {
    closePopover();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closePopover();
}

onMounted(() => {
  loadCalendarEvents();
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeydown);
});

onActivated(loadCalendarEvents);

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="p-4">
    <PageHeader title="订阅日历" :subtitle="headerSubtitle">
      <template #actions>
        <div class="calendar-actions">
          <NButton type="primary" @click="openWebcal">
            <template #icon>
              <IconifyIcon icon="lucide:calendar-plus" />
            </template>
            订阅到系统日历
          </NButton>
          <NButton :loading="webcalLoading" @click="openWebcalSetting">
            <template #icon>
              <IconifyIcon icon="lucide:settings-2" />
            </template>
            订阅设置
          </NButton>
          <NButton @click="exportCalendar">
            <template #icon>
              <IconifyIcon icon="lucide:download" />
            </template>
            导出 ICS
          </NButton>
        </div>
      </template>
    </PageHeader>

    <div class="calendar-toolbar">
      <div class="month-nav">
        <NButton
          quaternary
          circle
          size="small"
          aria-label="上一月"
          @click="changeMonth(-1)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:chevron-left" />
          </template>
        </NButton>
        <h2>{{ monthLabel }}</h2>
        <NButton
          quaternary
          circle
          size="small"
          aria-label="下一月"
          @click="changeMonth(1)"
        >
          <template #icon>
            <IconifyIcon icon="lucide:chevron-right" />
          </template>
        </NButton>
        <NButton size="small" secondary @click="goToToday">今天</NButton>
      </div>

      <div class="tool-right">
        <div class="view-switch" role="group" aria-label="视图切换">
          <button
            v-for="item in [
              { key: 'month', label: '月' },
              { key: 'week', label: '周' },
              { key: 'list', label: '列表' },
            ]"
            :key="item.key"
            type="button"
            :aria-pressed="view === item.key"
            @click="view = item.key as CalendarView"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="filter-chips">
          <span class="filter-label">来源</span>
          <button
            type="button"
            :aria-pressed="sourceFilter === 'all'"
            @click="sourceFilter = 'all'"
          >
            全部
          </button>
          <button
            v-for="source in sourceOptions"
            :key="source"
            type="button"
            :aria-pressed="sourceFilter === source"
            @click="sourceFilter = source"
          >
            {{ source }}
          </button>
        </div>

        <div v-if="sourceFilter !== 'all'" class="filter-summary">
          当前只看「{{ sourceFilter }}」
          <button type="button" @click="sourceFilter = 'all'">显示全部</button>
        </div>
      </div>
    </div>

    <NSpin :show="loading">
      <div v-if="view === 'month'" class="month-board">
        <div class="weekday-row">
          <span v-for="weekday in weekdays" :key="weekday"
            >周{{ weekday }}</span
          >
        </div>
        <div class="month-grid">
          <div
            v-for="day in calendarDays"
            :key="day.key"
            class="month-cell"
            :class="{
              'is-outside': !day.isCurrentMonth,
              'is-today': day.isToday,
              'is-selected': day.isSelected,
            }"
            @click="selectDay(day)"
          >
            <span class="cell-date">{{ day.date.getDate() }}</span>
            <div class="cell-events">
              <button
                v-for="event in day.events.slice(0, 2)"
                :key="`${event.id}-${event.start}`"
                type="button"
                class="event-chip"
                :class="eventTypeClass(event.type)"
                :title="event.title"
                @click.stop="handleEventClick(event, $event)"
              >
                <span
                  class="chip-poster"
                  :style="{
                    backgroundImage: `url(${eventPosterUrl(event)})`,
                    backgroundPosition: eventPosterPosition(event),
                  }"
                >
                  <span v-if="event.source_label" class="chip-source">{{
                    event.source_label.slice(0, 1)
                  }}</span>
                </span>
                <span class="chip-copy">
                  <span class="chip-title">{{ event.title }}</span>
                  <span class="chip-meta">
                    <span class="chip-episode">{{
                      eventEpisodeLabel(event) || eventTypeLabel(event.type)
                    }}</span>
                    <span v-if="event.source_label">{{
                      event.source_label
                    }}</span>
                  </span>
                </span>
              </button>
              <button
                v-if="day.events.length > 2"
                type="button"
                class="more-events"
                @click.stop="openDayList(day.date)"
              >
                +{{ day.events.length - 2 }} 更多
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="view === 'week'" class="week-board">
        <div class="weekday-row">
          <span v-for="day in weekDays" :key="day.key">
            {{ formatWeekday(day.date) }}
          </span>
        </div>
        <div class="week-grid">
          <div
            v-for="day in weekDays"
            :key="day.key"
            class="week-column"
            :class="{ 'is-today': day.isToday, 'is-selected': day.isSelected }"
            @click="selectDay(day)"
          >
            <div class="week-column-head">
              <span>{{ day.date.getDate() }}</span>
              <small>{{ formatWeekday(day.date) }}</small>
            </div>
            <button
              v-for="event in day.events"
              :key="`${event.id}-${event.start}`"
              type="button"
              class="week-event"
              :class="eventTypeClass(event.type)"
              @click.stop="handleEventClick(event, $event)"
            >
              <span
                class="chip-poster"
                :style="{
                  backgroundImage: `url(${eventPosterUrl(event)})`,
                  backgroundPosition: eventPosterPosition(event),
                }"
              >
                <span v-if="event.source_label" class="chip-source">{{
                  event.source_label.slice(0, 1)
                }}</span>
              </span>
              <span class="week-event-copy">
                <span class="week-event-title">{{ event.title }}</span>
                <span class="week-event-meta"
                  >{{
                    eventEpisodeLabel(event) || eventTypeLabel(event.type)
                  }}
                  · {{ event.source_label || '订阅' }}</span
                >
              </span>
            </button>
            <span v-if="day.events.length === 0" class="week-empty"
              >无更新</span
            >
          </div>
        </div>
      </div>

      <div v-else class="list-board">
        <div v-if="listGroups.length === 0" class="empty-state">
          <IconifyIcon
            icon="lucide:calendar-x-2"
            class="empty-state-icon size-8"
          />
          <span class="empty-state-title">没有符合筛选条件的更新</span>
          <span class="empty-state-subtitle">切换来源或月份后再看。</span>
          <NButton size="small" secondary @click="clearFilters">
            清除筛选
          </NButton>
        </div>
        <section v-for="group in listGroups" :key="group.key" class="list-day">
          <header class="list-day-head">
            <strong>{{ formatDayLabel(group.date) }}</strong>
            <span>{{ group.events.length }} 部更新</span>
          </header>
          <button
            v-for="event in group.events"
            :key="`${event.id}-${event.start}`"
            type="button"
            class="list-event"
            :class="eventTypeClass(event.type)"
            @click="handleEventClick(event, $event)"
          >
            <span
              class="chip-poster"
              :style="{
                backgroundImage: `url(${eventPosterUrl(event)})`,
                backgroundPosition: eventPosterPosition(event),
              }"
            >
              <span v-if="event.source_label" class="chip-source">{{
                event.source_label.slice(0, 1)
              }}</span>
            </span>
            <span class="list-event-copy">
              <span class="list-event-title">{{ event.title }}</span>
              <span class="list-event-meta"
                >{{ eventEpisodeLabel(event) || eventTypeLabel(event.type)
                }}<template v-if="event.source_label">
                  · {{ event.source_label }}</template
                ></span
              >
            </span>
            <span class="list-event-action">
              查看详情
              <IconifyIcon icon="lucide:arrow-up-right" class="size-3.5" />
            </span>
          </button>
        </section>
      </div>
    </NSpin>

    <div
      v-if="popoverEvent"
      class="event-popover"
      :style="{ left: popoverPosition.left, top: popoverPosition.top }"
      @click.stop
    >
      <div class="popover-head">
        <span
          class="popover-poster"
          :style="{
            backgroundImage: `url(${eventPosterUrl(popoverEvent)})`,
            backgroundPosition: eventPosterPosition(popoverEvent),
          }"
        >
          <span v-if="popoverEvent.source_label" class="chip-source">{{
            popoverEvent.source_label.slice(0, 1)
          }}</span>
        </span>
        <div class="popover-heading">
          <strong>{{ popoverEvent.title }}</strong>
          <span
            >{{
              eventEpisodeLabel(popoverEvent) ||
              eventTypeLabel(popoverEvent.type)
            }}<template v-if="popoverEvent.year">
              · {{ popoverEvent.year }}</template
            ></span
          >
        </div>
      </div>
      <div class="popover-rows">
        <div class="popover-row">
          <span>播出日期</span><span>{{ popoverEvent.start }}</span>
        </div>
        <div class="popover-row">
          <span>来源</span
          ><span>{{ popoverEvent.source_label || '订阅日历' }}</span>
        </div>
        <div class="popover-row">
          <span>日期来源</span><span>{{ eventDateHint(popoverEvent) }}</span>
        </div>
      </div>
      <div class="popover-actions">
        <NButton
          type="primary"
          size="small"
          @click="openEventDetail(popoverEvent)"
        >
          媒体详情
        </NButton>
        <NButton
          v-if="popoverEvent.id && /^[0-9]+$/.test(popoverEvent.id)"
          size="small"
          @click="openTmdb(popoverEvent)"
        >
          TMDB
        </NButton>
      </div>
    </div>

    <NModal
      v-model:show="detailModalShow"
      preset="card"
      title="媒体信息"
      :style="{ width: '560px' }"
      :bordered="false"
      :closable="true"
    >
      <div v-if="selectedEvent" class="detail-content">
        <div class="detail-left">
          <div
            class="detail-poster"
            :style="{
              backgroundImage: `url(${eventPosterUrl(selectedEvent)})`,
              backgroundPosition: eventPosterPosition(selectedEvent),
            }"
          ></div>
        </div>
        <div class="detail-right">
          <h3 class="detail-title">{{ selectedEvent.title }}</h3>
          <NSpace size="small" class="detail-tags">
            <NTag
              size="small"
              :type="selectedEvent.type === 'movie' ? 'success' : 'primary'"
            >
              {{ eventTypeLabel(selectedEvent.type) }}
            </NTag>
            <NTag v-if="selectedEvent.source_label" size="small" type="info">
              订阅源：{{ selectedEvent.source_label }}
            </NTag>
            <NTag v-if="selectedEvent.year" size="small">
              {{ selectedEvent.year }}
            </NTag>
            <NTag
              v-if="
                selectedEvent.vote_average !== '' &&
                selectedEvent.vote_average !== undefined
              "
              size="small"
            >
              评分: {{ selectedEvent.vote_average }}
            </NTag>
          </NSpace>
          <div class="detail-date">
            播出/上映日期: {{ selectedEvent.start }}
          </div>
          <div>
            <NButton size="small" secondary @click="openTmdb(selectedEvent)">
              在 TMDB 查看
            </NButton>
          </div>
        </div>
      </div>
    </NModal>

    <NModal
      v-model:show="webcalSettingShow"
      title="订阅日历设置"
      preset="card"
      :style="{ width: '560px' }"
      :bordered="false"
    >
      <div class="flex flex-col gap-4">
        <div>
          <div class="text-sm font-medium mb-2">服务器地址</div>
          <NInput
            v-model:value="calServerHost"
            placeholder="如 localhost:5555 或 192.168.1.x:5555"
            @update:value="clearCalendarLinks"
          />
          <div class="text-xs text-muted-foreground mt-1">
            手机/外网订阅时，请填写可访问的 IP 或域名
          </div>
        </div>
        <div v-if="httpCalLink">
          <div class="text-sm font-medium mb-2">HTTP 订阅链接</div>
          <div class="p-2 rounded bg-muted text-xs break-all">
            {{ httpCalLink }}
          </div>
        </div>
        <div v-if="webcalLink">
          <div class="text-sm font-medium mb-2">Webcal 订阅链接</div>
          <div class="p-2 rounded bg-muted text-xs break-all">
            {{ webcalLink }}
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <NButton size="small" @click="webcalSettingShow = false">
            关闭
          </NButton>
          <NButton type="primary" size="small" @click="copyHttpCalLink">
            复制链接
          </NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.calendar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.calendar-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  margin-bottom: 0.875rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: var(--radius);
}

.month-nav,
.tool-right,
.view-switch,
.filter-chips {
  display: flex;
  align-items: center;
}

.month-nav {
  gap: 0.25rem;
}

.month-nav h2 {
  min-width: 8.5rem;
  margin: 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  text-align: center;
}

.tool-right {
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  width: 100%;
}

.view-switch {
  gap: 0.125rem;
  padding: 0.125rem;
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: 9999px;
}

.view-switch button {
  height: 1.625rem;
  padding: 0 0.875rem;
  font-size: 0.75rem;
  font-weight: 550;
  color: hsl(var(--muted-foreground));
  border-radius: 9999px;
}

.view-switch button[aria-pressed='true'] {
  color: hsl(var(--accent-foreground));
  background: hsl(var(--card));
  box-shadow: 0 1px 3px hsl(var(--foreground) / 12%);
}

.filter-chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.375rem;
  align-items: center;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  font-size: 0.75rem;
  scrollbar-width: none;
}

.filter-chips::-webkit-scrollbar {
  display: none;
}

.filter-label {
  flex: none;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.filter-chips button {
  flex: 0 0 auto;
  height: 1.625rem;
  padding: 0 0.625rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  border: 1px solid transparent;
  border-radius: 9999px;
}

.status-dot {
  display: inline-block;
  flex: none;
  width: 0.375rem;
  height: 0.375rem;
  margin-right: 0.25rem;
  border-radius: 9999px;
}

.filter-summary {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.filter-summary button {
  padding: 0;
  font-size: 0.75rem;
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.filter-chips button:hover {
  color: hsl(var(--card-foreground));
  background: hsl(var(--accent));
}

.filter-chips button[aria-pressed='true'] {
  color: hsl(var(--card-foreground));
  background: hsl(var(--card));
  border-color: hsl(var(--border));
}

.status-dot--primary {
  background: hsl(var(--primary));
}

.status-dot--success {
  background: hsl(var(--success));
}

.status-dot--warning {
  background: hsl(var(--warning));
}

.status-dot--muted {
  background: hsl(var(--muted-foreground) / 55%);
}

.month-board,
.week-board,
.list-board {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.625rem;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.weekday-row span {
  padding: 0.5625rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.1em;
  border-left: 1px solid hsl(var(--border));
}

.weekday-row span:first-child {
  border-left: 0;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.month-cell {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
  min-height: 7.625rem;
  padding: 0.5rem;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
  border-left: 1px solid hsl(var(--border));
}

.month-cell:nth-child(7n + 1) {
  border-left: 0;
}

.month-cell:nth-child(-n + 7) {
  border-top: 0;
}

.month-cell:hover {
  background: hsl(var(--accent) / 35%);
}

.month-cell.is-outside {
  background: hsl(var(--muted) / 35%);
}

.month-cell.is-outside .cell-date,
.month-cell.is-outside .cell-events {
  opacity: 0.42;
}

.month-cell.is-today {
  background: linear-gradient(
    to bottom,
    hsl(var(--primary) / 7%),
    transparent 48%
  );
}

.month-cell.is-selected {
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 55%);
}

.cell-date {
  display: grid;
  flex: none;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  border-radius: 9999px;
}

.month-cell.is-today .cell-date {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--foreground));
}

.cell-events {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
  min-width: 0;
}

.event-chip {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 0.25rem 0.375rem 0.25rem 0.25rem;
  text-align: left;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-left: 3px solid var(--event-accent);
  border-radius: calc(var(--radius) * 0.7);
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.event-chip:hover {
  box-shadow: 0 3px 10px hsl(var(--foreground) / 10%);
  transform: translateY(-1px);
}

.chip-poster {
  position: relative;
  display: block;
  flex: none;
  width: 1.6875rem;
  height: 2.3125rem;
  overflow: hidden;
  background-color: hsl(var(--muted));
  background-position: center;
  background-size: cover;
  border-radius: 0.25rem;
}

.chip-source {
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 0 0.1875rem;
  font-size: 0.5rem;
  font-weight: 700;
  line-height: 1.3;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--foreground) / 72%);
  border-top-left-radius: 0.25rem;
}

.chip-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.chip-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.75rem;
  font-weight: 550;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.chip-meta {
  display: flex;
  gap: 0.3125rem;
  overflow: hidden;
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.chip-episode {
  font-weight: 700;
  color: var(--event-accent);
}

.event-movie {
  --event-accent: hsl(var(--success));
}

.event-tv {
  --event-accent: hsl(var(--primary));
}

.event-anime {
  --event-accent: hsl(var(--warning));
}

.more-events {
  align-self: flex-start;
  padding: 0.0625rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  border-radius: 0.25rem;
}

.more-events:hover {
  color: hsl(var(--card-foreground));
  background: hsl(var(--accent));
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.week-column {
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
  min-height: 21rem;
  padding: 0.625rem;
  border-left: 1px solid hsl(var(--border));
}

.week-column:first-child {
  border-left: 0;
}

.week-column.is-selected {
  background: hsl(var(--accent) / 30%);
}

.week-column.is-today {
  box-shadow: inset 0 2px 0 hsl(var(--primary));
}

.week-column-head {
  display: flex;
  gap: 0.4375rem;
  align-items: baseline;
  margin-bottom: 0.125rem;
}

.week-column-head span {
  font-size: 1.1875rem;
  font-weight: 650;
  color: hsl(var(--card-foreground));
}

.week-column-head small {
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.week-event {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;
  padding: 0.3125rem 0.5rem 0.3125rem 0.3125rem;
  text-align: left;
  background: hsl(var(--muted) / 35%);
  border-left: 3px solid var(--event-accent);
  border-radius: calc(var(--radius) * 0.7);
}

.week-event-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.week-event-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.75rem;
  font-weight: 550;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.week-event-meta,
.week-empty {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.list-board {
  border-radius: 0.625rem;
}

.list-day + .list-day {
  border-top: 1px solid hsl(var(--border));
}

.list-day-head {
  display: flex;
  gap: 0.625rem;
  align-items: baseline;
  padding: 0.6875rem 1.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 28%);
}

.list-day-head strong {
  font-size: 0.875rem;
  color: hsl(var(--card-foreground));
}

.list-event {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  width: 100%;
  min-height: 3.75rem;
  padding: 0.625rem 1.125rem;
  font: inherit;
  color: hsl(var(--card-foreground));
  text-align: left;
  cursor: pointer;
  background: hsl(var(--card));
  border: 0;
  border-top: 1px solid hsl(var(--border) / 55%);
  border-left: 3px solid var(--event-accent);
  transition: background 0.15s ease;
}

.list-event:hover {
  background: hsl(var(--accent) / 35%);
}

.list-event:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: -2px;
}

.list-event .chip-poster {
  width: 2.125rem;
  height: 2.9375rem;
}

.list-event .phase-pill {
  margin-left: auto;
}

.list-event-action {
  display: inline-flex;
  flex: none;
  gap: 0.1875rem;
  align-items: center;
  height: 1.75rem;
  padding: 0 0.625rem;
  font-size: 0.75rem;
  font-weight: 550;
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 9999px;
}

.list-event:hover .list-event-action {
  color: hsl(var(--card-foreground));
  border-color: hsl(var(--muted-foreground) / 45%);
}

.list-event-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.list-event-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8438rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.list-event-meta {
  margin-top: 0.0625rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.phase-pill {
  display: inline-flex;
  align-items: center;
  height: 1.5rem;
  padding: 0 0.625rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 9999px;
}

.phase-past,
.status-done {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.phase-today,
.status-downloading {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.status-searching {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.phase-upcoming,
.status-upcoming {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 55%);
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  align-items: center;
  padding: 4rem 1rem;
  text-align: center;
}

.empty-state-icon {
  color: hsl(var(--muted-foreground));
}

.empty-state-title {
  font-size: 1.125rem;
  font-weight: 550;
  color: hsl(var(--card-foreground));
}

.empty-state-subtitle {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
}

.event-popover {
  position: fixed;
  z-index: 1000;
  width: 16.5rem;
  padding: 0.875rem;
  background: hsl(var(--popover, var(--card)));
  border: 1px solid hsl(var(--border));
  border-radius: 0.625rem;
  box-shadow:
    0 10px 30px hsl(var(--foreground) / 16%),
    0 2px 6px hsl(var(--foreground) / 8%);
}

.popover-head {
  display: flex;
  gap: 0.6875rem;
}

.popover-poster {
  position: relative;
  display: block;
  flex: none;
  width: 3rem;
  height: 4.125rem;
  overflow: hidden;
  background-color: hsl(var(--muted));
  background-position: center;
  background-size: cover;
  border-radius: 0.375rem;
}

.popover-heading {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
  min-width: 0;
}

.popover-heading strong {
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.35;
  color: hsl(var(--card-foreground));
}

.popover-heading span {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.popover-rows {
  margin: 0.75rem 0;
  border-top: 1px solid hsl(var(--border) / 55%);
}

.popover-row {
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  padding: 0.4rem 0;
  font-size: 0.75rem;
  border-bottom: 1px solid hsl(var(--border) / 55%);
}

.popover-row > span:first-child {
  color: hsl(var(--muted-foreground));
}

.popover-row > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--card-foreground));
  text-align: right;
  white-space: nowrap;
}

.popover-actions {
  display: flex;
  gap: 0.5rem;
}

.popover-actions > * {
  flex: 1;
}

.detail-content {
  display: flex;
  gap: 1rem;
}

.detail-left {
  flex-shrink: 0;
}

.detail-poster {
  width: 7.5rem;
  height: 10rem;
  background-color: hsl(var(--muted));
  background-position: center;
  background-size: cover;
  border-radius: 0.375rem;
}

.detail-right {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.625rem;
}

.detail-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.detail-date {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}

@media (min-width: 961px) {
  .calendar-toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .tool-right {
    flex-flow: row wrap;
    align-items: center;
    justify-content: flex-end;
    width: auto;
  }

  .filter-chips {
    flex-wrap: wrap;
    width: auto;
    overflow: visible;
  }
}

@media (max-width: 640px) {
  :deep(.page-header) {
    flex-direction: column;
    align-items: stretch;
  }

  :deep(.page-header-actions) {
    width: 100%;
  }

  .calendar-actions {
    gap: 0.4375rem;
    width: 100%;
  }

  .calendar-actions :deep(.n-button) {
    flex: 0 0 auto;
    width: auto;
    height: 2rem;
    padding: 0 0.6875rem;
    font-size: 0.75rem;
    white-space: nowrap;
    border-radius: 9999px;
  }
}

@media (max-width: 960px) {
  .tool-right {
    align-items: flex-start;
    width: 100%;
  }
}

@media (max-width: 720px) {
  .calendar-toolbar {
    align-items: flex-start;
  }

  .month-cell {
    gap: 0.1875rem;
    min-height: 4rem;
    padding: 0.3125rem;
  }

  .cell-events {
    flex-flow: row wrap;
    gap: 0.125rem;
  }

  .event-chip {
    width: auto;
    padding: 0;
    background: none;
    border: 0;
  }

  .event-chip .chip-poster,
  .event-chip .chip-copy {
    display: none;
  }

  .event-chip::before {
    width: 0.5rem;
    height: 0.5rem;
    content: '';
    background: var(--event-accent);
    border-radius: 9999px;
  }

  .more-events {
    padding: 0;
    font-size: 0.625rem;
  }

  .weekday-row span {
    padding: 0.5rem 0.25rem;
    text-align: center;
  }

  .week-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .week-column {
    min-height: 0;
    border-top: 1px solid hsl(var(--border));
    border-left: 0;
  }

  .week-column:first-child {
    border-top: 0;
  }

  .list-event {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .filter-chips {
    flex-wrap: nowrap;
    max-width: 100%;
    overflow-x: auto;
  }

  .filter-chips::-webkit-scrollbar {
    display: none;
  }
}
</style>
