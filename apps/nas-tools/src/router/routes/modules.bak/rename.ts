import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:file-text',
      order: 6,
      title: '媒体整理',
    },
    name: 'Rename',
    path: '/rename',
    children: [
      {
        name: 'RenameHistory',
        path: '/rename/history',
        component: () => import('#/views/rename/history/index.vue'),
        meta: {
          icon: 'lucide:history',
          title: '识别历史',
        },
      },
      {
        name: 'RenameMediafile',
        path: '/rename/mediafile',
        component: () => import('#/views/rename/mediafile/index.vue'),
        meta: {
          icon: 'lucide:folder-open',
          title: '文件管理',
        },
      },
      {
        name: 'RenameUnidentification',
        path: '/rename/unidentification',
        component: () => import('#/views/rename/unidentification/index.vue'),
        meta: {
          icon: 'lucide:help-circle',
          title: '未识别列表',
        },
      },
      {
        name: 'RenameBlacklist',
        path: '/rename/blacklist',
        component: () => import('#/views/rename/blacklist/index.vue'),
        meta: {
          icon: 'lucide:shield-ban',
          title: 'TMDB 黑名单',
        },
      },
    ],
  },
];

export default routes;
