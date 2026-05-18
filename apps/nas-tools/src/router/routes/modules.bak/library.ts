import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:home',
      order: 0,
      title: '我的媒体库',
    },
    name: 'Dashboard',
    path: '/index',
    component: () => import('#/views/media/library/index.vue'),
  },
];

export default routes;
