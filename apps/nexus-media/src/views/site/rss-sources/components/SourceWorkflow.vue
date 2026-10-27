<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

const steps = [
  { title: '接入来源', description: '粘贴地址，自动识别格式' },
  { title: '测试报文', description: '确认标题与下载链接' },
  { title: '用于订阅', description: '在 RSS 站点中勾选' },
];
</script>

<template>
  <section class="workflow" aria-label="RSS 使用步骤">
    <template v-for="(step, index) in steps" :key="step.title">
      <div class="workflow-step">
        <span class="step-index">0{{ index + 1 }}</span>
        <div>
          <div class="step-title">{{ step.title }}</div>
          <div class="step-description">{{ step.description }}</div>
        </div>
      </div>
      <IconifyIcon
        v-if="index < steps.length - 1"
        icon="lucide:arrow-right"
        class="workflow-arrow"
      />
    </template>
  </section>
</template>

<style scoped>
.workflow {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
}

.workflow-step {
  display: flex;
  flex: 1;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.step-index {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--primary));
  letter-spacing: 0.08em;
}

.step-title {
  font-size: 13px;
  font-weight: 600;
}

.step-description {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.workflow-arrow {
  flex-shrink: 0;
  width: 14px;
  color: hsl(var(--muted-foreground) / 55%);
}

@media (max-width: 640px) {
  .workflow {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .workflow-arrow {
    display: none;
  }
}
</style>
