<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NSpace,
  NSpin,
  NTag,
} from 'naive-ui';

import { IconifyIcon } from '@vben/icons';

import { getSystemInfoApi } from '#/api/modules/system';
import PageHeader from '#/components/page/PageHeader.vue';

const loading = ref(false);
const systemInfo = ref<any>({});
const logoUrl = '/static/img/logo/logo-web-apple-180-light.png';

async function fetchSystemInfo() {
  loading.value = true;
  try {
    const res = await getSystemInfoApi();
    if (res) {
      systemInfo.value = res;
    }
  } finally {
    loading.value = false;
  }
}

function formatUptime(seconds: number) {
  if (!seconds) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}天`);
  if (h) parts.push(`${h}小时`);
  if (m) parts.push(`${m}分钟`);
  return parts.join(' ') || '< 1分钟';
}

const techStack = [
  { name: 'Python', icon: 'lucide:terminal', desc: '后端核心' },
  { name: 'FastAPI', icon: 'lucide:zap', desc: 'Web 框架' },
  { name: 'Vue 3', icon: 'lucide:component', desc: '前端框架' },
  { name: 'Vite', icon: 'lucide:rocket', desc: '构建工具' },
  { name: 'Naive UI', icon: 'lucide:layout-dashboard', desc: 'UI 组件库' },
  { name: 'Tailwind CSS', icon: 'lucide:wind', desc: 'CSS 框架' },
  { name: 'SQLAlchemy', icon: 'lucide:database', desc: 'ORM' },
  { name: 'Alembic', icon: 'lucide:git-commit', desc: '数据库迁移' },
];

onMounted(fetchSystemInfo);
</script>

<template>
  <div class="p-4">
    <PageHeader title="关于项目" subtitle="Nexus Media 媒体自动化工具" />

    <NSpin :show="loading" class="mt-4">
      <NSpace vertical size="large">
        <!-- 项目信息 -->
        <NCard :bordered="false" class="about-card"
          :style="{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }"
        >
          <div class="flex items-start gap-4">
            <img
              :src="logoUrl"
              alt="Nexus Media"
              class="size-16 shrink-0 rounded-xl object-contain"
              onerror="this.style.display='none'"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="text-xl font-bold" style="color: hsl(var(--card-foreground))"
                  >Nexus Media</span
                >
                <NTag size="small" type="primary" round>
                  {{ systemInfo.version || 'v3.7.0' }}
                </NTag>
              </div>
              <p class="mt-2 text-sm" style="color: hsl(var(--muted-foreground))"
                >
                NAS 自动化工具，用于媒体管理、种子索引和下载编排。支持电影、电视剧、动漫的自动识别、重命名、硬链接和刮削。
              </p>
              <div class="mt-3 flex gap-2">
                <NButton
                  size="tiny"
                  tag="a"
                  href="https://github.com/linyuan0213/nexus-media"
                  target="_blank"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:github" class="size-4" />
                  </template>
                  GitHub
                </NButton>
                <NButton
                  size="tiny"
                  tag="a"
                  href="https://github.com/linyuan0213/nexus-media/blob/main/README.md"
                  target="_blank"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:book-open" class="size-4" />
                  </template>
                  文档
                </NButton>
              </div>
            </div>
          </div>
        </NCard>

        <!-- 系统信息 -->
        <NCard
          title="系统信息"
          size="small"
          :bordered="false"
          class="about-card"
          :style="{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }"
        >
          <NDescriptions :column="2" label-placement="left" label-align="right" label-width="100">
            <NDescriptionsItem label="系统版本">
              <span style="color: hsl(var(--card-foreground))">{{ systemInfo.version || '-' }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="Python 版本">
              <span style="color: hsl(var(--card-foreground))">{{ systemInfo.python_version || '-' }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="运行平台">
              <span style="color: hsl(var(--card-foreground))">{{ systemInfo.platform || '-' }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="运行时间">
              <span style="color: hsl(var(--card-foreground))">{{ formatUptime(systemInfo.uptime_seconds) }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="启动时间">
              <span style="color: hsl(var(--card-foreground))">{{ systemInfo.start_time || '-' }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="内存占用">
              <span style="color: hsl(var(--card-foreground))">{{ systemInfo.memory_mb ? `${systemInfo.memory_mb} MB` : '-' }}</span>
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>

        <!-- 技术栈 -->
        <NCard
          title="技术栈"
          size="small"
          :bordered="false"
          class="about-card"
          :style="{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }"
        >
          <div class="tech-grid">
            <div
              v-for="item in techStack"
              :key="item.name"
              class="tech-item"
              :style="{ border: '1px solid hsl(var(--border))' }"
            >
              <IconifyIcon :icon="item.icon" class="size-6" style="color: hsl(var(--primary))" />
              <div class="tech-name">{{ item.name }}</div>
              <div class="tech-desc">{{ item.desc }}</div>
            </div>
          </div>
        </NCard>

        <!-- 开源协议 -->
        <NCard
          title="开源协议"
          size="small"
          :bordered="false"
          class="about-card"
          :style="{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }"
        >
          <div class="flex items-center gap-2 text-sm" style="color: hsl(var(--muted-foreground))">
            <IconifyIcon icon="lucide:scale" class="size-4" />
            <span>本项目基于 MIT 协议开源</span>
          </div>
        </NCard>
      </NSpace>
    </NSpin>
  </div>
</template>

<style scoped>
.about-card {
  transition: box-shadow 0.2s, border-color 0.2s;
}

.about-card:hover {
  box-shadow: 0 4px 16px hsl(var(--foreground) / 0.08);
  border-color: hsl(var(--primary) / 0.2) !important;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.tech-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.875rem;
  border-radius: 0.5rem;
  background-color: hsl(var(--muted) / 0.3);
  transition: background-color 0.2s;
}

.tech-item:hover {
  background-color: hsl(var(--accent) / 0.5);
}

.tech-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.tech-desc {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .tech-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
