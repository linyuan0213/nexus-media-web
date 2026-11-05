<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NSpace, NTag } from 'naive-ui';

interface Props {
  local?: string;
  remote?: string;
  needsUpdate?: boolean;
  reloading?: boolean;
  updating?: boolean;
}

withDefaults(defineProps<Props>(), {
  local: '',
  needsUpdate: false,
  reloading: false,
  remote: '',
  updating: false,
});

const emit = defineEmits<{
  reload: [];
  update: [];
}>();
</script>

<template>
  <NCard size="small" class="site-config-card">
    <div class="site-config-row">
      <div class="site-config-heading">
        <span class="site-config-icon" aria-hidden="true">
          <IconifyIcon icon="lucide:globe" class="size-4" />
        </span>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="site-config-title">站点配置</span>
            <NTag
              v-if="needsUpdate"
              size="small"
              type="warning"
              :bordered="false"
            >
              有新版本
            </NTag>
          </div>
          <p class="site-config-version">
            <span v-if="local">当前版本 {{ local }}</span>
            <span v-if="remote && remote !== 'unknown'">
              · 远程版本 {{ remote }}
            </span>
            <span v-if="!local && (!remote || remote === 'unknown')">
              尚未获取版本信息
            </span>
          </p>
        </div>
      </div>

      <NSpace :size="8">
        <NButton size="small" :loading="reloading" @click="emit('reload')">
          <template #icon>
            <IconifyIcon icon="lucide:activity" class="size-4" />
          </template>
          重载配置
        </NButton>
        <NButton
          size="small"
          :loading="updating"
          :type="needsUpdate ? 'primary' : 'default'"
          @click="emit('update')"
        >
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="size-4" />
          </template>
          {{ needsUpdate ? '更新站点配置' : '检查更新' }}
        </NButton>
      </NSpace>
    </div>
  </NCard>
</template>

<style scoped>
.site-config-card {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.site-config-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.site-config-heading {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  min-width: 0;
}

.site-config-icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: calc(var(--radius) - 2px);
}

.site-config-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--card-foreground));
}

.site-config-version {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 640px) {
  .site-config-row {
    align-items: stretch;
  }
}
</style>
