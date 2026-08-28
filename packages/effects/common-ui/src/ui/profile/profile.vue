<script setup lang="ts">
import type { Props } from './types';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import { preferences } from '@vben-core/preferences';
import {
  Card,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  VbenAvatar,
} from '@vben-core/shadcn-ui';

import { Page } from '../../components';

defineOptions({
  name: 'ProfileUI',
});

withDefaults(defineProps<Props>(), {
  title: '关于项目',
  tabs: () => [],
});

const tabsValue = defineModel<string>('modelValue');
const { smaller } = useBreakpoints(breakpointsTailwind);
const isMobile = smaller('md');
</script>
<template>
  <Page auto-content-height>
    <div class="flex size-full flex-col md:flex-row">
      <Card class="w-full flex-none md:w-1/6">
        <div
          class="flex items-center gap-3 px-4 py-4 md:mt-4 md:h-40 md:flex-col md:justify-center md:gap-4 md:px-0 md:py-0"
        >
          <div class="profile-avatar-wrapper shrink-0">
            <VbenAvatar
              :src="userInfo?.avatar ?? preferences.app.defaultAvatar"
              class="size-16 md:size-20"
            />
            <label class="profile-avatar-upload">
              <slot name="avatar-upload">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
                  />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </slot>
            </label>
          </div>
          <div class="min-w-0 flex-1 md:text-center">
            <span class="block truncate text-base font-semibold md:text-lg">
              {{ userInfo?.realName ?? '' }}
            </span>
            <span class="block truncate text-sm text-foreground/80">
              {{ userInfo?.username ?? '' }}
            </span>
          </div>
        </div>
        <Separator class="my-2 hidden md:my-4 md:block" />
        <Tabs
          v-model="tabsValue"
          :orientation="isMobile ? 'horizontal' : 'vertical'"
          class="p-2 md:m-4"
        >
          <TabsList class="grid w-full grid-cols-3 bg-card md:grid-cols-1">
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              class="h-11 justify-center md:h-12 md:justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>
      <Card class="mt-4 w-full flex-auto p-4 md:ml-4 md:mt-0 md:w-5/6 md:p-8">
        <slot name="content"></slot>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.profile-avatar-wrapper {
  position: relative;
  display: inline-block;
}

.profile-avatar-upload {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--card));
  border: 2px solid hsl(var(--border));
  border-radius: 50%;
  transition: all 0.15s ease;
}

.profile-avatar-upload:hover {
  background: hsl(var(--accent));
  transform: scale(1.1);
}
</style>
