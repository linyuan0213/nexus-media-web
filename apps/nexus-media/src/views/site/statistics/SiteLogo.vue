<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  src: string;
  fallback: string;
  name: string;
  url?: string;
}>();

const failed = ref(false);

function handleClick() {
  if (props.url) {
    window.open(props.url, '_blank');
  }
}
</script>

<template>
  <div
    class="site-logo"
    :class="{ 'cursor-pointer': !!props.url }"
    @click="handleClick"
  >
    <img
      v-show="!failed"
      :src="props.src || props.fallback"
      :alt="props.name"
      class="site-logo-img"
      @error="failed = true"
    />
    <div v-show="failed" class="site-logo-placeholder">
      {{ props.name.charAt(0).toUpperCase() }}
    </div>
  </div>
</template>

<style scoped>
.site-logo {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  overflow: hidden;
  flex-shrink: 0;
  background-color: hsl(var(--accent));
  display: flex;
  align-items: center;
  justify-content: center;
}

.site-logo.cursor-pointer {
  cursor: pointer;
  transition: opacity 0.2s;
}

.site-logo.cursor-pointer:hover {
  opacity: 0.8;
}

.site-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.site-logo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  color: hsl(var(--primary));
}
</style>
