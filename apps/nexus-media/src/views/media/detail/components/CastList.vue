<script lang="ts" setup>
import { IconifyIcon } from '@vben/icons';

interface ActorProfile {
  aliases?: string[];
  image_url?: string;
  name: string;
}

interface Props {
  actors?: ActorProfile[];
  crews?: any[];
}

withDefaults(defineProps<Props>(), {
  actors: () => [],
  crews: () => [],
});

function getKey(item: any): string {
  return item && Object.keys(item)[0];
}

function getValue(item: any): string {
  return item && Object.values(item)[0];
}
</script>

<template>
  <div
    class="rounded-2xl border p-5"
    style="background: hsl(var(--card)); border-color: hsl(var(--border))"
  >
    <div class="mb-4 flex items-center gap-2">
      <IconifyIcon
        icon="lucide:users"
        class="size-5"
        style="color: hsl(var(--primary))"
      />
      <h2
        class="text-lg font-semibold"
        style="color: hsl(var(--card-foreground))"
      >
        演职人员
      </h2>
    </div>

    <div
      v-if="actors.length > 0"
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="actor in actors"
        :key="actor.name"
        class="flex min-w-0 items-center gap-3 rounded-xl border p-3"
        style="border-color: hsl(var(--border))"
      >
        <img
          v-if="actor.image_url"
          :src="actor.image_url"
          :alt="actor.name"
          class="size-10 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
        <div
          v-else
          class="flex size-10 shrink-0 items-center justify-center rounded-full"
          style="background: hsl(var(--muted))"
          aria-hidden="true"
        >
          <IconifyIcon
            icon="lucide:user"
            class="size-4"
            style="color: hsl(var(--muted-foreground))"
          />
        </div>
        <div class="min-w-0">
          <div
            class="truncate font-medium"
            style="color: hsl(var(--card-foreground))"
            :title="actor.name"
          >
            {{ actor.name }}
          </div>
          <div
            v-if="actor.aliases && actor.aliases.length > 0"
            class="truncate text-xs"
            style="color: hsl(var(--muted-foreground))"
            :title="actor.aliases.join(' / ')"
          >
            别名：{{ actor.aliases.join(' / ') }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="(item, idx) in crews"
        :key="idx"
        class="rounded-xl border p-3"
        style="border-color: hsl(var(--border))"
      >
        <div class="font-medium" style="color: hsl(var(--card-foreground))">
          {{ getKey(item) }}
        </div>
        <div class="mt-0.5 text-sm" style="color: hsl(var(--muted-foreground))">
          {{ getValue(item) }}
        </div>
      </div>
    </div>
  </div>
</template>
