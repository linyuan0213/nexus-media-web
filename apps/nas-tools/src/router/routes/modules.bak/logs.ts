import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'Logs',
    path: '/logs',
    component: () => import('#/views/system/logs/index.vue'),
    meta: {
      icon: 'lucide:scroll-text',
      order: 11,
      title: '日志',
    },
  },
];

export default routes;
