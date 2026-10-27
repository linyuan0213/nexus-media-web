<script lang="ts" setup>
/**
 * 插件菜单路由宿主页。
 * 菜单只声明路径，具体组件由插件前端加载器按路径动态解析。
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { getPluginComponentByPath } from '#/plugin-framework';

const route = useRoute();
const component = computed(() => getPluginComponentByPath(route.path));
</script>

<template>
  <component :is="component" v-if="component" />
  <div
    v-else
    class="flex-center text-muted-foreground"
    style="min-height: 50vh"
  >
    插件页面尚未加载，请刷新或重新登录
  </div>
</template>
