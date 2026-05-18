import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:search',
      order: 1,
      title: '资源搜索',
    },
    name: 'MediaSearch',
    path: '/media/search',
    component: () => import('#/views/media/search/index.vue'),
  },
  {
    name: 'MediaDetail',
    path: '/media/detail',
    component: () => import('#/views/media/detail/index.vue'),
    meta: {
      hideInMenu: true,
      title: '媒体详情',
    },
  },
  {
    meta: {
      icon: 'lucide:compass',
      order: 2,
      title: '探索',
    },
    name: 'Discovery',
    path: '/discovery',
    children: [
      {
        name: 'Ranking',
        path: '/discovery/ranking',
        component: () => import('#/views/media/discovery/index.vue'),
        meta: {
          icon: 'lucide:trophy',
          title: '排行榜',
        },
      },
      {
        name: 'DoubanMovie',
        path: '/discovery/douban-movie',
        component: () => import('#/views/media/discovery/index.vue'),
        meta: {
          icon: 'lucide:film',
          title: '豆瓣电影',
        },
      },
      {
        name: 'DoubanTv',
        path: '/discovery/douban-tv',
        component: () => import('#/views/media/discovery/index.vue'),
        meta: {
          icon: 'lucide:tv',
          title: '豆瓣电视剧',
        },
      },
      {
        name: 'TmdbMovie',
        path: '/discovery/tmdb-movie',
        component: () => import('#/views/media/discovery/index.vue'),
        meta: {
          icon: 'lucide:clapperboard',
          title: 'TMDB电影',
        },
      },
      {
        name: 'TmdbTv',
        path: '/discovery/tmdb-tv',
        component: () => import('#/views/media/discovery/index.vue'),
        meta: {
          icon: 'lucide:monitor-play',
          title: 'TMDB电视剧',
        },
      },
      {
        name: 'Bangumi',
        path: '/discovery/bangumi',
        component: () => import('#/views/media/discovery/index.vue'),
        meta: {
          icon: 'lucide:calendar-days',
          title: 'Bangumi',
        },
      },
      {
        name: 'DiscoveryRecommend',
        path: '/discovery/recommend',
        component: () => import('#/views/media/discovery/recommend.vue'),
        meta: {
          hideInMenu: true,
          title: '更多推荐',
        },
      },
    ],
  },
];

export default routes;
