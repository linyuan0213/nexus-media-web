import type { SiteApi } from '#/api/modules/site';

export type StatisticsItem = SiteApi.SiteStatisticsItem & { url?: string };

export function useSiteStats() {
  function parseSize(sizeInput: number | string): number {
    if (sizeInput == null) return 0;
    if (typeof sizeInput === 'number') return sizeInput;
    const match = String(sizeInput).match(
      /^(\d+(?:\.\d+)?)\s*(TB|GB|MB|KB|B)/i,
    );
    if (!match) return 0;
    const val = Number.parseFloat(match[1]!);
    const unit = match[2]!.toUpperCase();
    const units: Record<string, number> = {
      TB: 1024 ** 4,
      GB: 1024 ** 3,
      MB: 1024 ** 2,
      KB: 1024,
      B: 1,
    };
    return val * (units[unit] || 1);
  }

  function formatSize(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );
    return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
  }

  function formatCompactSize(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );
    const value = bytes / 1024 ** i;
    return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[i]}`;
  }

  function parseNumber(val: number | string): number {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const n = Number.parseFloat(val);
    return Number.isNaN(n) ? 0 : n;
  }

  function getThemeColor(varName: string): string {
    if (typeof document === 'undefined') return '';
    const root = document.documentElement;
    const val = getComputedStyle(root).getPropertyValue(varName).trim();
    return val ? `hsl(${val})` : '';
  }

  function getThemeColors(): {
    border: string;
    card: string;
    cardForeground: string;
    destructive: string;
    foreground: string;
    mutedForeground: string;
    primary: string;
    success: string;
    warning: string;
  } {
    return {
      border: getThemeColor('--border'),
      card: getThemeColor('--card'),
      cardForeground: getThemeColor('--card-foreground'),
      destructive: getThemeColor('--destructive'),
      foreground: getThemeColor('--foreground'),
      mutedForeground: getThemeColor('--muted-foreground'),
      primary: getThemeColor('--primary'),
      success: getThemeColor('--success'),
      warning: getThemeColor('--warning'),
    };
  }

  function parseHsl(hslString: string): { h: number; l: number; s: number } {
    const match = hslString.match(
      /hsl\(\s*([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/,
    );
    if (!match) return { h: 220, l: 50, s: 80 };
    return {
      h: Number.parseFloat(match[1]!),
      l: Number.parseFloat(match[3]!),
      s: Number.parseFloat(match[2]!),
    };
  }

  function generateChartColor(index: number, total: number): string {
    const primary = parseHsl(getThemeColor('--primary'));
    const hueStep = 360 / Math.max(total, 1);
    const hue = Math.round((primary.h + index * hueStep) % 360);
    const saturation = Math.max(55, Math.min(90, primary.s));
    const lightness = Math.max(40, Math.min(60, primary.l));
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  function getChartPalette(count: number): string[] {
    return Array.from({ length: count }, (_, i) =>
      generateChartColor(i, Math.max(count, 1)),
    );
  }

  return {
    formatCompactSize,
    formatSize,
    generateChartColor,
    getChartPalette,
    getThemeColor,
    getThemeColors,
    parseNumber,
    parseSize,
  };
}
