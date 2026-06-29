<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const items: NavItem[] = [
  { id: 'basic_system', label: '系统', icon: 'lucide:monitor' },
  { id: 'basic_log', label: '日志', icon: 'lucide:log-in' },
  { id: 'basic_media', label: '媒体', icon: 'lucide:database' },
  { id: 'basic_ai', label: 'Agent', icon: 'lucide:cpu' },
  { id: 'basic_service', label: '服务', icon: 'lucide:settings' },
  { id: 'basic_laboratory', label: '实验室', icon: 'lucide:flask-conical' },
];

const activeId = defineModel<string>('activeId');

function scrollTo(id: string) {
  activeId.value = id;
  const el = document.querySelector(`#${id}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
</script>

<template>
  <div
    class="rounded-2xl border p-2"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div
      v-for="item in items"
      :key="item.id"
      class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
      :class="activeId === item.id ? 'shadow-sm' : 'hover:bg-accent/60'"
      :style="{
        background:
          activeId === item.id ? 'hsl(var(--primary))' : 'transparent',
        color:
          activeId === item.id
            ? 'hsl(var(--primary-foreground))'
            : 'hsl(var(--muted-foreground))',
      }"
      @click="scrollTo(item.id)"
    >
      <IconifyIcon :icon="item.icon" class="size-4" />
      {{ item.label }}
    </div>
  </div>
</template>
