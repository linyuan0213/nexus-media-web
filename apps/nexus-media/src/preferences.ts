import { defineOverridesPreferences } from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    name: import.meta.env.VITE_APP_TITLE,
    accessMode: 'mixed',
    defaultHomePath: '/dashboard/home',
    enableRefreshToken: true,
    preferencesButtonPosition: 'header',
  },
  logo: {
    enable: true,
    fit: 'contain',
    source: '/static/img/logo/logo-web-apple-180-transparent.png',
    sourceDark: '/static/img/logo/logo-web-apple-180-transparent.png', // 可选：暗色主题logo
  },
  theme: {
    mode: 'light',
  },
  widget: {
    languageToggle: false,
    timezone: false,
  },
  copyright: {
    companyName: 'Nexus Media',
    companySiteLink: 'https://github.com/linyuan0213/nexus-media',
    date: '2026',
    enable: true,
    icp: '',
    icpLink: '',
    settingShow: true,
  },
});
