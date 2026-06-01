<script lang="ts" setup>
import { ref, onMounted, onActivated, onUnmounted, computed } from 'vue';
import {
  NCalendar,
  NSpin,
  NModal,
  NEmpty,
  NSpace,
  NTag,
} from 'naive-ui';
import { getMovieSubscriptionItemsApi, getTvSubscriptionItemsApi } from '#/api/modules/subscription';
import { getMovieCalendarApi, getTvCalendarApi } from '#/api/modules/media';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  type: string;
  poster: string;
  vote_average: string | number;
  year: string;
  rssid: string;
}

const loading = ref(false);
const allEvents = ref<CalendarEvent[]>([]);
const calendarValue = ref(Date.now());
const calendarKey = ref(0);
const detailModalShow = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);

let resizeTimer: ReturnType<typeof setTimeout> | null = null;

function handleResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    calendarKey.value++;
  }, 200);
}

const eventsByDate = computed(() => {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of allEvents.value) {
    const list = map.get(event.start) || [];
    list.push(event);
    map.set(event.start, list);
  }
  return map;
});

function getDayEvents(year: number, month: number, date: number) {
  const key = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  return eventsByDate.value.get(key) || [];
}

function getImgUrl(src?: string) {
  if (!src) return '/static/img/no-image.png';
  return `/img?url=${encodeURIComponent(src)}`;
}

function handleEventClick(event: CalendarEvent) {
  selectedEvent.value = event;
  detailModalShow.value = true;
}

async function loadCalendarEvents() {
  loading.value = true;
  try {
    const [movieItemsRes, tvItemsRes] = await Promise.all([
      getMovieSubscriptionItemsApi(),
      getTvSubscriptionItemsApi(),
    ]);
    const movieItems = (movieItemsRes || []) as Array<{
      id: string;
      rssid: string;
    }>;
    const tvItems = (tvItemsRes || []) as Array<{
      id: string;
      rssid: string;
      season?: string;
      name?: string;
    }>;

    const eventPromises: Promise<CalendarEvent[]>[] = [];

    for (const item of movieItems) {
      eventPromises.push(
        getMovieCalendarApi({
          id: String(item.id),
          rssid: String(item.rssid),
        })
          .then((d: any) => {
            if (!d) return [];
            return [
              {
                id: String(d.id || ''),
                title: d.title || '',
                start: d.start,
                type: d.type || '',
                poster: d.poster || '',
                vote_average: d.vote_average ?? '',
                year: d.year || '',
                rssid: String(d.rssid || ''),
              },
            ];
          })
          .catch(() => []),
      );
    }

    for (const item of tvItems) {
      eventPromises.push(
        getTvCalendarApi({
          id: String(item.id),
          rssid: String(item.rssid),
          season: String(item.season || '1'),
          name: String(item.name || ''),
        })
          .then((events: any[]) => {
            if (!Array.isArray(events)) return [];
            return events.map((evt: any) => ({
              id: String(evt.id || ''),
              title: evt.title || '',
              start: evt.start,
              type: evt.type || '',
              poster: evt.poster || '',
              vote_average: evt.vote_average ?? '',
              year: evt.year || '',
              rssid: String(evt.rssid || ''),
            }));
          })
          .catch(() => []),
      );
    }

    const results = await Promise.all(eventPromises);
    const events: CalendarEvent[] = [];
    for (const arr of results) {
      for (const evt of arr) {
        if (evt.start) events.push(evt);
      }
    }
    allEvents.value = events;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadCalendarEvents();
  window.addEventListener('resize', handleResize);
});

onActivated(() => {
  loadCalendarEvents();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (resizeTimer) clearTimeout(resizeTimer);
});
</script>

<template>
  <div>
    <div class="calendar-page">
      <NSpin :show="loading">
        <div class="calendar-wrapper">
          <NCalendar :key="calendarKey" v-model:value="calendarValue">
            <template #default="{ year, month, date }">
              <div class="calendar-events">
                <template v-if="getDayEvents(year, month, date).length > 0">
                  <div
                    v-for="(event, idx) in getDayEvents(year, month, date).slice(0, 3)"
                    :key="`${event.id}-${event.start}-${idx}`"
                    class="calendar-event"
                    :class="{
                      'event-movie': event.type === '电影',
                      'event-tv': event.type !== '电影',
                    }"
                    @click.stop="handleEventClick(event)"
                  >
                    <div
                      class="event-poster"
                      :style="{ backgroundImage: `url(${getImgUrl(event.poster)})` }"
                    />
                    <div class="event-info">
                      <div class="event-title">{{ event.title }}</div>
                      <div class="event-meta">
                        {{ event.type }}
                        <span
                          v-if="
                            event.vote_average !== '' &&
                            event.vote_average !== undefined
                          "
                        >
                          评分: {{ event.vote_average }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="getDayEvents(year, month, date).length > 3"
                    class="more-events"
                  >
                    +{{ getDayEvents(year, month, date).length - 3 }}
                  </div>
                </template>
              </div>
            </template>
          </NCalendar>
        </div>
      </NSpin>
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
            :style="{ backgroundImage: `url(${getImgUrl(selectedEvent.poster)})` }"
          />
        </div>
        <div class="detail-right">
          <h3 class="detail-title">{{ selectedEvent.title }}</h3>
          <NSpace size="small" class="detail-tags">
            <NTag
              size="small"
              :type="selectedEvent.type === '电影' ? 'success' : 'primary'"
            >
              {{ selectedEvent.type }}
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
          <div class="detail-date">上映日期: {{ selectedEvent.start }}</div>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.empty-wrap {
  padding: 80px 0;
}
.calendar-page {
  padding: 16px;
}
.calendar-wrapper {
  background: var(--n-card-color);
  border-radius: var(--n-border-radius);
  overflow: hidden;
}
.calendar-events {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.calendar-event {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  border-left: 3px solid transparent;
}
.calendar-event:hover {
  background: var(--n-action-color);
}
.event-movie {
  border-left-color: hsl(var(--success));
}
.event-tv {
  border-left-color: hsl(var(--primary));
}
.event-poster {
  width: 30px;
  height: 40px;
  background-size: cover;
  background-position: center;
  border-radius: 3px;
  flex-shrink: 0;
}
.event-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.event-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.event-meta {
  font-size: 11px;
  color: var(--n-text-color-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.more-events {
  font-size: 11px;
  color: var(--n-text-color-3);
  text-align: center;
  padding: 2px 0;
}
.detail-content {
  display: flex;
  gap: 16px;
}
.detail-left {
  flex-shrink: 0;
}
.detail-poster {
  width: 120px;
  height: 160px;
  background-size: cover;
  background-position: center;
  border-radius: 6px;
}
.detail-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.detail-tags {
  margin-bottom: 4px;
}
.detail-date {
  font-size: 14px;
  color: var(--n-text-color-2);
}
</style>
