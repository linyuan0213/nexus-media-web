<script lang="ts" setup>
interface Props {
  connected: boolean;
}

defineProps<Props>();
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
      :style="{
        background: connected
          ? 'hsl(var(--success) / 8%)'
          : 'hsl(var(--destructive) / 8%)',
        borderColor: connected
          ? 'hsl(var(--success) / 25%)'
          : 'hsl(var(--destructive) / 25%)',
        color: connected ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
      }"
    >
      <span class="relative flex h-2 w-2">
        <span
          v-if="connected"
          class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style="background: hsl(var(--success))"
        ></span>
        <span
          class="relative inline-flex h-2 w-2 rounded-full"
          :style="{
            background: connected
              ? 'hsl(var(--success))'
              : 'hsl(var(--destructive))',
          }"
        ></span>
      </span>
      {{ connected ? '媒体服务器在线' : '媒体服务器离线' }}
    </div>
    <span
      v-if="connected"
      class="text-sm"
      style="color: hsl(var(--muted-foreground))"
    >
      数据已同步
    </span>
    <span v-else class="text-sm" style="color: hsl(var(--muted-foreground))">
      请检查 Emby / Jellyfin / Plex 配置
    </span>
  </div>
</template>
