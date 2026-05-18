import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:layout-grid',
      order: 7,
      title: '服务',
    },
    name: 'Service',
    path: '/service',
    children: [
      {
        name: 'ServicePanel',
        path: '/service/panel',
        component: () => import('#/views/service/panel/index.vue'),
        meta: {
          icon: 'lucide:layout-grid',
          title: '服务面板',
        },
      },
      {
        name: 'SchedulerJobs',
        path: '/service/scheduler',
        component: () => import('#/views/scheduler/jobs/index.vue'),
        meta: {
          icon: 'lucide:clock',
          title: '调度任务',
        },
      },
    ],
  },
];

export default routes;
