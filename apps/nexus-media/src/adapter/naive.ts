import { computed } from 'vue';

import { preferences } from '@vben/preferences';
import '@vben/styles';

import { createDiscreteApi, darkTheme, lightTheme } from 'naive-ui';

// 解析实际生效的暗色模式：dark 或 auto（跟随系统深色），与 CSS 变量切换保持一致
const isDark = computed(() => {
  const mode = preferences.theme.mode;
  if (mode === 'dark') {
    return true;
  }
  if (mode === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
});

const themeOverridesProviderProps = computed(() => ({
  themeOverrides: isDark.value ? darkTheme : lightTheme,
}));

const notificationProviderProps = computed(() => ({
  ...themeOverridesProviderProps.value,
}));

const themeProviderProps = computed(() => ({
  theme: isDark.value ? darkTheme : lightTheme,
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
