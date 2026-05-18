import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:settings',
      order: 8,
      title: '系统设置',
    },
    name: 'System',
    path: '/system',
    children: [
      {
        name: 'SystemBasic',
        path: '/system/basic',
        component: () => import('#/views/system/basic/index.vue'),
        meta: {
          icon: 'lucide:sliders-horizontal',
          title: '基础设置',
        },
      },
      {
        name: 'SystemLibrary',
        path: '/system/library',
        component: () => import('#/views/system/library/index.vue'),
        meta: {
          icon: 'lucide:tv',
          title: '媒体库设置',
        },
      },
      {
        name: 'SystemSync',
        path: '/system/sync',
        component: () => import('#/views/sync/index.vue'),
        meta: {
          icon: 'lucide:refresh-cw',
          title: '目录同步',
        },
      },
      {
        name: 'SystemDownloader',
        path: '/system/downloader',
        component: () => import('#/views/download/downloader/index.vue'),
        meta: {
          icon: 'lucide:download',
          title: '下载器设置',
        },
      },
      {
        name: 'SystemIndexer',
        path: '/system/indexer',
        component: () => import('#/views/service/indexer/index.vue'),
        meta: {
          icon: 'lucide:search',
          title: '索引器设置',
        },
      },
      {
        name: 'SystemMediaserver',
        path: '/system/mediaserver',
        component: () => import('#/views/service/mediaserver/index.vue'),
        meta: {
          icon: 'lucide:server',
          title: '媒体服务器',
        },
      },
      {
        name: 'SystemNotification',
        path: '/system/notification',
        component: () => import('#/views/service/notification/index.vue'),
        meta: {
          icon: 'lucide:bell',
          title: '通知设置',
        },
      },
      {
        name: 'SystemWords',
        path: '/system/words',
        component: () => import('#/views/words/index.vue'),
        meta: {
          icon: 'lucide:file-text',
          title: '自定义识别词',
        },
      },
      {
        name: 'SystemFilter',
        path: '/system/filter',
        component: () => import('#/views/filter/rule/index.vue'),
        meta: {
          icon: 'lucide:funnel',
          title: '过滤规则',
        },
      },
      {
        name: 'SystemUsers',
        path: '/system/users',
        component: () => import('#/views/system/users/index.vue'),
        meta: {
          icon: 'lucide:users',
          title: '用户管理',
        },
      },
      {
        name: 'SystemRoles',
        path: '/system/roles',
        component: () => import('#/views/system/roles/index.vue'),
        meta: {
          icon: 'lucide:shield',
          title: '角色管理',
        },
      },
      {
        name: 'SystemMenus',
        path: '/system/menus',
        component: () => import('#/views/system/menus/index.vue'),
        meta: {
          icon: 'lucide:menu',
          title: '菜单管理',
        },
      },
    ],
  },
];

export default routes;
