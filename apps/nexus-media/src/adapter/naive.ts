import { computed } from 'vue';

import { preferences } from '@vben/preferences';
import '@vben/styles';

import { createDiscreteApi, darkTheme, lightTheme } from 'naive-ui';

const themeOverridesProviderProps = computed(() => ({
  themeOverrides: preferences.theme.mode === 'light' ? lightTheme : darkTheme,
}));

const notificationProviderProps = computed(() => ({
  ...themeOverridesProviderProps.value,
  duration: 3000,
}));

const themeProviderProps = computed(() => ({
  theme: preferences.theme.mode === 'light' ? lightTheme : darkTheme,
}));

export const { dialog, loadingBar, message, modal, notification } =
  createDiscreteApi(
    ['message', 'dialog', 'notification', 'loadingBar', 'modal'],
    {
      configProviderProps: themeProviderProps,
      loadingBarProviderProps: themeOverridesProviderProps,
      messageProviderProps: themeOverridesProviderProps,
      notificationProviderProps,
    },
  );
