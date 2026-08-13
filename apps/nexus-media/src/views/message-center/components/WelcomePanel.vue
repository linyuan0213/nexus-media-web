<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton } from 'naive-ui';

const props = defineProps<{
  agentEnabled: boolean;
  providerName?: string;
}>();

const emit = defineEmits<{
  prompt: [text: string];
}>();

const quickPrompts = computed(() =>
  props.agentEnabled
    ? [
        { icon: 'lucide:activity', text: '当前系统状态怎么样？' },
        { icon: 'lucide:download', text: '我在下载什么？' },
        { icon: 'lucide:heart', text: '怎么配置刷流规则？' },
      ]
    : [
        { icon: 'lucide:download', text: '下载 流浪地球' },
        { icon: 'lucide:heart', text: '订阅 权力的游戏 第2季' },
        { icon: 'lucide:search', text: '搜索 漫长的季节' },
      ],
);
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center py-10">
    <div
      class="flex size-14 items-center justify-center rounded-2xl"
      :style="{
        background: 'hsl(var(--primary) / 0.1)',
        color: 'hsl(var(--primary))',
      }"
    >
      <IconifyIcon icon="lucide:bot" class="size-7" />
    </div>
    <div
      class="mt-4 text-base font-semibold"
      :style="{ color: 'hsl(var(--foreground))' }"
    >
      {{ agentEnabled ? 'AI 对话助手' : '消息中心' }}
    </div>
    <div
      class="mt-1 text-center text-xs"
      :style="{ color: 'hsl(var(--muted-foreground))' }"
    >
      <template v-if="agentEnabled">
        已连接
        {{ providerName || 'LLM' }}，支持对话、搜索、下载、订阅与知识库问答
      </template>
      <template v-else>
        支持命令式交互（订阅 / 下载 / 搜索）与事件通知；配置 LLM 后解锁 AI 对话
      </template>
    </div>
    <div class="mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-3">
      <button
        v-for="p in quickPrompts"
        :key="p.text"
        class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors"
        :style="{
          borderColor: 'hsl(var(--border))',
          color: 'hsl(var(--card-foreground))',
          background: 'hsl(var(--card))',
        }"
        @click="emit('prompt', p.text)"
      >
        <IconifyIcon
          :icon="p.icon"
          class="size-4 shrink-0"
          :style="{ color: 'hsl(var(--primary))' }"
        />
        <span>{{ p.text }}</span>
      </button>
    </div>
    <NButton
      v-if="!agentEnabled"
      class="mt-4"
      size="small"
      text
      tag="a"
      href="#/system/basic"
      :style="{ color: 'hsl(var(--primary))' }"
    >
      <template #icon>
        <IconifyIcon icon="lucide:settings" class="size-3.5" />
      </template>
      前往配置 AI 服务
    </NButton>
  </div>
</template>
