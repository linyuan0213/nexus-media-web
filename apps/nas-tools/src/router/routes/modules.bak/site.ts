import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:server',
      order: 3,
      title: '站点管理',
    },
    name: 'Site',
    path: '/site',
    children: [
      {
        name: 'SiteMaintenance',
        path: '/site/list',
        component: () => import('#/views/site/list/index.vue'),
        meta: {
          icon: 'lucide:server',
          title: '站点维护',
        },
      },
      {
        name: 'SiteStatistics',
        path: '/site/statistics',
        component: () => import('#/views/site/statistics/index.vue'),
        meta: {
          icon: 'lucide:clock',
          title: '数据统计',
        },
      },
      {
        name: 'BrushTask',
        path: '/brush',
        component: () => import('#/views/brush/index.vue'),
        meta: {
          icon: 'lucide:menu',
          title: '刷流任务',
        },
      },
      {
        name: 'SiteResources',
        path: '/site/resources',
        component: () => import('#/views/site/resources/index.vue'),
        meta: {
          icon: 'lucide:database',
          title: '站点资源',
        },
      },
    ],
  },
];

export default routes;
