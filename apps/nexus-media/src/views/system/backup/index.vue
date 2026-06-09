<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const title = computed(() => (route.meta.title as string) || '页面');
const description = computed(() => '该页面正在开发中，敬请期待...');
</script>

<template>
  <div class="p-4">
    <h1 class="text-xl font-semibold mb-4">{{ title }}</h1>
    <n-card>
      <p>{{ description }}</p>
    </n-card>
  </div>
</template>
