import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:puzzle',
      order: 10,
      title: $t('page.plugin.title'),
    },
    name: 'Plugin',
    path: '/plugin',
    children: [
      {
        name: 'PluginMarket',
        path: '/plugin/market',
        component: () => import('#/views/plugin/market/index.vue'),
        meta: {
          icon: 'lucide:store',
          title: $t('page.plugin.market'),
        },
      },
      {
        name: 'PluginInstalled',
        path: '/plugin/installed',
        component: () => import('#/views/plugin/installed/index.vue'),
        meta: {
          icon: 'lucide:box',
          title: $t('page.plugin.installed'),
        },
      },
    ],
  },
];

export default routes;
