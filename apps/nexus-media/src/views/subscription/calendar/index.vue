<script lang="ts" setup>
import { computed, onActivated, onMounted, onUnmounted, ref } from 'vue';

import {
  NButton,
  NCalendar,
  NInput,
  NModal,
  NSpace,
  NSpin,
  NTag,
  useNotification,
} from 'naive-ui';

import { getMovieCalendarApi, getTvCalendarApi } from '#/api/modules/media';
import {
  downloadSubscriptionCalendarIcsApi,
  getMovieSubscriptionItemsApi,
  getSubscriptionCalendarWebcalUrlApi,
  getTvSubscriptionItemsApi,
} from '#/api/modules/subscription';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  type: string;
  poster: string;
  vote_average: number | string;
  year: string;
  rssid: string;
}

const loading = ref(false);
const allEvents = ref<CalendarEvent[]>([]);
const calendarValue = ref(Date.now());
const calendarKey = ref(0);
const detailModalShow = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);
const notification = useNotification();
const webcalLink = ref('');
const httpCalLink = ref('');
const webcalLoading = ref(false);
const calServerHost = ref(
  localStorage.getItem('nexus-media-calendar-host') || window.location.host,
);
const webcalSettingShow = ref(false);

let resizeTimer: null | ReturnType<typeof setTimeout> = null;

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
    notification.error({
      content: '导出失败',
      description: error?.message || '',
    });
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
      notification.error({ content: '获取订阅 Token 失败' });
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
    notification.error({
      content: '获取订阅链接失败',
      description: error?.message || '',
    });
  } finally {
    webcalLoading.value = false;
  }
}

function openWebcal() {
  ensureCalendarLinks().then(() => {
    if (webcalLink.value) {
      window.open(webcalLink.value, '_blank');
    }
  });
}

async function openWebcalSetting() {
  await ensureCalendarLinks();
  if (httpCalLink.value) {
    webcalSettingShow.value = true;
  }
}

async function copyHttpCalLink() {
  await ensureCalendarLinks();
  if (!httpCalLink.value) return;
  try {
    await navigator.clipboard.writeText(httpCalLink.value);
    notification.success({ content: '已复制 HTTP 订阅链接' });
  } catch {
    notification.error({ content: '复制失败' });
  }
}

function clearCalendarLinks() {
  httpCalLink.value = '';
  webcalLink.value = '';
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
      name?: string;
      rssid: string;
      season?: string;
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
      <div class="calendar-header">
        <h2 class="calendar-title">订阅日历</h2>
        <NSpace>
          <NButton type="primary" size="small" @click="openWebcal">
            订阅到系统日历
          </NButton>
          <NButton
            size="small"
            :loading="webcalLoading"
            @click="openWebcalSetting"
          >
            订阅设置
          </NButton>
          <NButton size="small" @click="exportCalendar"> 导出 ICS </NButton>
        </NSpace>
      </div>
      <NSpin :show="loading">
        <div class="calendar-wrapper">
          <NCalendar :key="calendarKey" v-model:value="calendarValue">
            <template #default="{ year, month, date }">
              <div class="calendar-events">
                <template v-if="getDayEvents(year, month, date).length > 0">
                  <div
                    v-for="(event, idx) in getDayEvents(
                      year,
                      month,
                      date,
                    ).slice(0, 3)"
                    :key="`${event.id}-${event.start}-${idx}`"
                    class="calendar-event"
                    :class="{
                      'event-movie': event.type === 'movie',
                      'event-tv': event.type !== 'movie',
                    }"
                    @click.stop="handleEventClick(event)"
                  >
                    <div
                      class="event-poster"
                      :style="{
                        backgroundImage: `url(${getImgUrl(event.poster)})`,
                      }"
                    ></div>
                    <div class="event-info">
                      <div class="event-title">{{ event.title }}</div>
                      <div class="event-meta">
                        {{ event.type === 'movie' ? '电影' : '电视剧' }}
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
            :style="{
              backgroundImage: `url(${getImgUrl(selectedEvent.poster)})`,
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
              {{ selectedEvent.type === 'movie' ? '电影' : '电视剧' }}
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
.empty-wrap {
  padding: 80px 0;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.calendar-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.calendar-page {
  padding: 16px;
}

.calendar-wrapper {
  overflow: hidden;
  background: var(--n-card-color);
  border-radius: var(--n-border-radius);
}

.calendar-events {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.calendar-event {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 6px;
  cursor: pointer;
  border-left: 3px solid transparent;
  border-radius: 4px;
  transition: background 0.2s;
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
  flex-shrink: 0;
  width: 30px;
  height: 40px;
  background-position: center;
  background-size: cover;
  border-radius: 3px;
}

.event-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.event-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color);
  white-space: nowrap;
}

.event-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--n-text-color-3);
  white-space: nowrap;
}

.more-events {
  padding: 2px 0;
  font-size: 11px;
  color: var(--n-text-color-3);
  text-align: center;
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
  background-position: center;
  background-size: cover;
  border-radius: 6px;
}

.detail-right {
  display: flex;
  flex: 1;
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
