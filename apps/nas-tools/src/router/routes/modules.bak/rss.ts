import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:rss',
      order: 4,
      title: '订阅管理',
    },
    name: 'Rss',
    path: '/rss',
    children: [
      {
        name: 'MovieRss',
        path: '/rss/movie',
        component: () => import('#/views/rss/movie/index.vue'),
        meta: {
          icon: 'lucide:film',
          title: '电影订阅',
        },
      },
      {
        name: 'TvRss',
        path: '/rss/tv',
        component: () => import('#/views/rss/tv/index.vue'),
        meta: {
          icon: 'lucide:tv',
          title: '电视剧订阅',
        },
      },
      {
        name: 'RssHistory',
        path: '/rss/history',
        component: () => import('#/views/rss/history/index.vue'),
        meta: {
          icon: 'lucide:history',
          title: '订阅历史',
        },
      },
      {
        name: 'RssCalendar',
        path: '/rss/calendar',
        component: () => import('#/views/rss/calendar/index.vue'),
        meta: {
          icon: 'lucide:calendar-days',
          title: '订阅日历',
        },
      },
      {
        name: 'UserRss',
        path: '/rss/user',
        component: () => import('#/views/rss/user/index.vue'),
        meta: {
          icon: 'lucide:file-text',
          title: '自定义订阅',
        },
      },
    ],
  },
];

export default routes;
