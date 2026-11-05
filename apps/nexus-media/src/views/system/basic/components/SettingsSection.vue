<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

import { NButton, NCard, NTag } from 'naive-ui';

interface Props {
  description: string;
  dirty?: boolean;
  domId: string;
  icon: string;
  invalid?: boolean;
  saved?: boolean;
  saving?: boolean;
  title: string;
}

withDefaults(defineProps<Props>(), {
  dirty: false,
  invalid: false,
  saved: false,
  saving: false,
});

const emit = defineEmits<{
  reset: [];
  save: [];
}>();
</script>

<template>
  <NCard :id="domId" size="small" class="settings-section">
    <template #header>
      <div class="section-heading">
        <div class="section-icon" aria-hidden="true">
          <IconifyIcon :icon="icon" class="size-5" />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="section-title">{{ title }}</h2>
            <NTag v-if="dirty" size="small" type="warning" :bordered="false">
              未保存
            </NTag>
            <NTag
              v-else-if="saved"
              size="small"
              type="success"
              :bordered="false"
            >
              已保存
            </NTag>
          </div>
          <p class="section-description">{{ description }}</p>
        </div>
      </div>
    </template>

    <div class="settings-section-content">
      <slot name="before"></slot>
      <slot></slot>
    </div>

    <template #footer>
      <div class="section-footer">
        <div class="save-status" role="status" aria-live="polite">
          <IconifyIcon
            :icon="
              invalid
                ? 'lucide:circle-alert'
                : dirty
                  ? 'lucide:info'
                  : 'lucide:circle-check'
            "
            class="size-4 shrink-0"
          />
          <span v-if="invalid">请先修正无效的数字字段</span>
          <span v-else-if="dirty">更改尚未保存，可恢复上次保存的内容</span>
          <span v-else>当前分区没有未保存的更改</span>
        </div>
        <div class="section-actions">
          <NButton :disabled="!dirty || saving" @click="emit('reset')">
            <template #icon>
              <IconifyIcon icon="lucide:undo-2" class="size-4" />
            </template>
            恢复上次保存
          </NButton>
          <NButton
            type="primary"
            :disabled="!dirty || invalid"
            :loading="saving"
            @click="emit('save')"
          >
            <template v-if="!saving" #icon>
              <IconifyIcon icon="lucide:save" class="size-4" />
            </template>
            {{ saving ? '正在保存' : '保存本分区' }}
          </NButton>
        </div>
      </div>
    </template>
  </NCard>
</template>

<style scoped>
.settings-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 4%);
}

.section-heading {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.section-icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: calc(var(--radius) - 2px);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5;
  color: hsl(var(--card-foreground));
}

.section-description {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

.section-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.save-status {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  min-width: 0;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.section-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
  margin-left: auto;
}

.settings-section :deep(.n-card-header) {
  padding: 1.25rem 1.5rem 1rem;
}

.settings-section :deep(.n-card__content) {
  padding: 0 1.5rem 1.5rem;
}

.settings-section :deep(.n-card__footer) {
  padding: 0.875rem 1.5rem;
  background: hsl(var(--muted) / 30%);
}

@media (max-width: 640px) {
  .settings-section :deep(.n-card-header) {
    padding: 1rem 1rem 0.875rem;
  }

  .settings-section :deep(.n-card__content) {
    padding: 0 1rem 1rem;
  }

  .settings-section :deep(.n-card__footer) {
    padding: 0.875rem 1rem;
  }

  .section-footer {
    align-items: stretch;
  }

  .save-status {
    width: 100%;
  }

  .section-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    margin-left: 0;
  }
}
</style>
