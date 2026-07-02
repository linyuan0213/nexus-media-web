import { defineConfig } from '@vben/vite-config';

import pkg from './package.json';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
      },
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            // 直接代理到 FastAPI 后端，不 rewrite（后端路由本身以 /api 开头）
            target: 'http://localhost:3000',
            ws: true,
          },
          '/img': {
            changeOrigin: true,
            target: 'http://localhost:3000',
          },
        },
      },
    },
  };
});
