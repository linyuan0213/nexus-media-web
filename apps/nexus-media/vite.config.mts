import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
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
