<script lang="ts" setup>
import { NButton, NModal } from 'naive-ui';

interface Props {
  confirmText?: string;
  description: string;
  loading?: boolean;
  paths?: string[];
  show: boolean;
  title: string;
}

withDefaults(defineProps<Props>(), {
  confirmText: '确认',
  loading: false,
  paths: () => [],
});
const emit = defineEmits<{
  'update:show': [value: boolean];
  confirm: [];
}>();
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    style="width: min(460px, 94vw)"
    :mask-closable="!loading"
    @update:show="emit('update:show', $event)"
  >
    <p class="dialog-desc">{{ description }}</p>

    <div v-if="paths.length > 0" class="dialog-paths">
      <code v-for="path in paths" :key="path">{{ path }}</code>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <NButton :disabled="loading" @click="emit('update:show', false)">
          取消
        </NButton>
        <NButton type="error" :loading="loading" @click="emit('confirm')">
          {{ confirmText }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.dialog-desc {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.dialog-paths {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 180px;
  padding: 8px 10px;
  margin-top: 12px;
  overflow-y: auto;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.dialog-paths code {
  font-family: var(--font-mono, monospace);
  font-size: 0.69rem;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.dialog-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
