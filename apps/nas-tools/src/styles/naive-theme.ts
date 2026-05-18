import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * Tabler 风格 Naive UI 主题覆盖
 */
export const tablerThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#206bc4',
    primaryColorHover: '#1b5aa0',
    primaryColorPressed: '#164a82',
    primaryColorSuppl: '#206bc4',
    borderRadius: '4px',
    borderRadiusSmall: '4px',
  },
  Card: {
    borderRadius: '4px',
    borderColor: 'rgba(98, 105, 118, 0.16)',
  },
  Button: {
    borderRadius: '4px',
    borderRadiusSmall: '4px',
  },
  Input: {
    borderRadius: '4px',
  },
  Select: {
    borderRadius: '4px',
  },
  Table: {
    borderRadius: '4px',
  },
  Modal: {
    borderRadius: '4px',
  },
  Dialog: {
    borderRadius: '4px',
  },
  Tag: {
    borderRadius: '4px',
  },
  Pagination: {
    borderRadius: '4px',
    itemBorderRadius: '4px',
  },
};
