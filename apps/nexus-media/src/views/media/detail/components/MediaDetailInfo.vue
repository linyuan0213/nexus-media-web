<script lang="ts" setup>
import { computed, type CSSProperties, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NTag } from 'naive-ui';

import CastList from './CastList.vue';
import FactPanel from './FactPanel.vue';

interface ActorProfile {
  image_url?: string;
  name: string;
}

interface Props {
  actorProfiles?: ActorProfile[];
  actors?: string[];
  detail: Record<string, any>;
  genres?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  actors: () => [],
  actorProfiles: () => [],
  genres: () => [],
});

const displayActors = computed<ActorProfile[]>(() => {
  if (props.actorProfiles.length > 0) return props.actorProfiles;
  return props.actors.map((name) => ({ name }));
});

const overviewExpanded = ref(false);
const overviewLong = computed(
  () => String(props.detail.overview || '').length > 320,
);
const overviewStyle = computed(() =>
  !overviewExpanded.value && overviewLong.value
    ? ({
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 6,
        overflow: 'hidden',
      } as CSSProperties)
    : ({} as CSSProperties),
);
</script>

<template>
  <div class="space-y-6">
    <section
      v-if="detail.overview"
      class="rounded-2xl border p-5"
      style="background: hsl(var(--card)); border-color: hsl(var(--border))"
    >
      <div class="mb-4 flex items-center gap-2">
        <IconifyIcon
          icon="lucide:align-left"
          class="size-5"
          style="color: hsl(var(--primary))"
        />
        <h2
          class="text-lg font-semibold"
          style="color: hsl(var(--card-foreground))"
        >
          简介
        </h2>
      </div>
      <p
        class="whitespace-pre-wrap text-sm leading-7"
        :style="[{ color: 'hsl(var(--muted-foreground))' }, overviewStyle]"
      >
        {{ detail.overview }}
      </p>
      <NButton
        v-if="overviewLong"
        text
        size="small"
        class="mt-2"
        style="color: hsl(var(--primary))"
        @click="overviewExpanded = !overviewExpanded"
      >
        {{ overviewExpanded ? '收起' : '展开' }}
      </NButton>
    </section>

    <section
      v-if="actors.length > 0 || genres.length > 0"
      class="rounded-2xl border p-5"
      style="background: hsl(var(--card)); border-color: hsl(var(--border))"
    >
      <div v-if="actors.length > 0" class="mb-4">
        <div class="mb-2 flex items-center gap-2">
          <IconifyIcon
            icon="lucide:users"
            class="size-4"
            style="color: hsl(var(--primary))"
          />
          <div
            class="text-sm font-medium"
            style="color: hsl(var(--card-foreground))"
          >
            演员
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="actor in displayActors"
            :key="actor.name"
            class="flex min-w-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1"
            style="
              background: hsl(var(--card));
              border-color: hsl(var(--border));
            "
          >
            <img
              v-if="actor.image_url"
              :src="actor.image_url"
              :alt="actor.name"
              class="size-9 shrink-0 rounded-full object-cover"
              loading="lazy"
            />
            <div
              v-else
              class="flex size-9 shrink-0 items-center justify-center rounded-full"
              style="background: hsl(var(--muted))"
              aria-hidden="true"
            >
              <IconifyIcon
                icon="lucide:user"
                class="size-4"
                style="color: hsl(var(--muted-foreground))"
              />
            </div>
            <span
              class="truncate text-sm"
              style="color: hsl(var(--card-foreground))"
              :title="actor.name"
            >
              {{ actor.name }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="genres.length > 0">
        <div class="mb-2 flex items-center gap-2">
          <IconifyIcon
            icon="lucide:tags"
            class="size-4"
            style="color: hsl(var(--primary))"
          />
          <div
            class="text-sm font-medium"
            style="color: hsl(var(--card-foreground))"
          >
            标签
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <NTag
            v-for="name in genres"
            :key="name"
            size="small"
            :bordered="false"
          >
            {{ name }}
          </NTag>
        </div>
      </div>
    </section>

    <CastList
      v-if="detail.crews && detail.crews.length > 0"
      :crews="detail.crews"
    />
    <FactPanel
      v-if="detail.fact && detail.fact.length > 0"
      :facts="detail.fact"
    />
  </div>
</template>
