# Nexus Media Web

Nexus Media 前端项目，基于 [Vben Admin](https://github.com/vbenjs/vue-vben-admin) v5.7.0 构建。

## 技术栈

- Vue 3.5 + Vite 6 + TypeScript
- Naive UI + Tailwind CSS
- Pinia + Vue Router

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build
```

开发服务器默认运行在 `http://localhost:5555`，代理到后端 `http://localhost:3000`。

## 项目结构

```
apps/nexus-media/
├── src/
│   ├── api/          # API 接口
│   ├── components/   # 公共组件
│   ├── views/        # 页面视图
│   ├── router/       # 路由配置
│   ├── store/        # 状态管理
│   └── plugin-framework/  # 插件系统
```

## 后端配套

后端仓库：[nexus-media](https://github.com/linyuan0213/nexus-media)

## License

MIT
