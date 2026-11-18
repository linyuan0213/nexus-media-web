import type { SystemApi } from '#/api/modules/system';

import { ref } from 'vue';

import { getAppBackgroundApi } from '#/api/modules/system';
import { getImgUrl } from '#/utils/image';

const CACHE_KEY = 'nexus-app-background-urls';
const BLUR_KEY = 'nexus-app-background-blur';
const LEGACY_CACHE_KEY = 'nexus-app-background-url';

function readStoredBlur() {
  try {
    const value = Number(localStorage.getItem(BLUR_KEY));
    return Number.isFinite(value) ? Math.min(30, Math.max(0, value)) : 12;
  } catch {
    return 12;
  }
}

function emptySlot(): SystemApi.AppearanceBackgroundSlot {
  return { url: null, source: null, updated_at: null };
}

function normalizeSlot(
  value?: null | Partial<SystemApi.AppearanceBackgroundSlot>,
): SystemApi.AppearanceBackgroundSlot {
  if (!value?.url) return emptySlot();
  return {
    url: value.url,
    source: value.source || 'url',
    updated_at: value.updated_at || null,
  };
}

function normalizeBackground(
  value?: Partial<SystemApi.AppearanceBackground> &
    Partial<SystemApi.AppearanceBackgroundSlot>,
): SystemApi.AppearanceBackground {
  if (value?.url) {
    return { desktop: normalizeSlot(value), mobile: emptySlot() };
  }
  return {
    desktop: normalizeSlot(value?.desktop),
    mobile: normalizeSlot(value?.mobile),
  };
}

const background = ref<SystemApi.AppearanceBackground>(normalizeBackground());
const backgroundBlur = ref(readStoredBlur());
const backgroundUrls = ref({ desktop: '', mobile: '' });
let initialized = false;
let pending: null | Promise<SystemApi.AppearanceBackground> = null;

export function resolveAppBackgroundUrl(url?: null | string) {
  if (!url) return '';
  if (
    url.startsWith('/static/') ||
    url.startsWith('/img/') ||
    url.startsWith('/api/system/appearance/background/file/')
  ) {
    return url;
  }
  return getImgUrl(url);
}

function applyBackground(
  value: SystemApi.AppearanceBackground,
  persist: boolean,
) {
  background.value = value;
  backgroundUrls.value = {
    desktop: resolveAppBackgroundUrl(value.desktop.url),
    mobile: resolveAppBackgroundUrl(value.mobile.url),
  };
  if (!persist) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {}
}

export function setAppBackground(
  value: Partial<SystemApi.AppearanceBackground> &
    Partial<SystemApi.AppearanceBackgroundSlot>,
) {
  applyBackground(normalizeBackground(value), true);
  initialized = true;
}

function restoreCachedBackground() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      applyBackground(normalizeBackground(JSON.parse(cached)), false);
      return;
    }
    const legacy = localStorage.getItem(LEGACY_CACHE_KEY);
    if (legacy) {
      applyBackground(
        normalizeBackground({ url: legacy, source: 'url', updated_at: null }),
        false,
      );
    }
  } catch {}
}

export function setAppBackgroundBlur(value: number) {
  const next = Math.min(30, Math.max(0, Math.round(value)));
  backgroundBlur.value = next;
  try {
    localStorage.setItem(BLUR_KEY, String(next));
  } catch {}
}

export function useAppBackground() {
  async function loadAppBackground(force = false) {
    if (pending) return pending;
    if (initialized && !force) return background.value;
    if (!initialized) restoreCachedBackground();

    pending = (async () => {
      try {
        const result = await getAppBackgroundApi();
        setAppBackground(result || normalizeBackground());
      } catch {
        setAppBackground(normalizeBackground());
      }
      return background.value;
    })();

    try {
      return await pending;
    } finally {
      initialized = true;
      pending = null;
    }
  }

  return {
    background,
    backgroundBlur,
    backgroundUrls,
    loadAppBackground,
    setAppBackground,
    setAppBackgroundBlur,
  };
}
