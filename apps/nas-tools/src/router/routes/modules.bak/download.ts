import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:download',
      order: 5,
      title: '下载管理',
    },
    name: 'Download',
    path: '/download',
    children: [
      {
        name: 'Downloading',
        path: '/download/downloading',
        component: () => import('#/views/download/downloading/index.vue'),
        meta: {
          icon: 'lucide:loader',
          title: '正在下载',
        },
      },
      {
        name: 'DownloadHistory',
        path: '/download/history',
        component: () => import('#/views/download/history/index.vue'),
        meta: {
          icon: 'lucide:clock',
          title: '近期下载',
        },
      },
      {
        name: 'TorrentRemove',
        path: '/download/torrent-remove',
        component: () => import('#/views/download/torrent-remove/index.vue'),
        meta: {
          icon: 'lucide:trash-2',
          title: '自动删种',
        },
      },
      {
        name: 'DownloadSettings',
        path: '/download/settings',
        component: () => import('#/views/download/settings/index.vue'),
        meta: {
          icon: 'lucide:sliders-horizontal',
          title: '下载设置',
        },
      },
    ],
  },
];

export default routes;
