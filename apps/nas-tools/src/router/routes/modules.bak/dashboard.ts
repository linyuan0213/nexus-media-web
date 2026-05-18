import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-dashboard',
      order: 0,
      title: '首页',
    },
    name: 'DashboardHome',
    path: '/dashboard/home',
    component: () => import('#/views/dashboard/home/index.vue'),
  },
];

export default routes;
