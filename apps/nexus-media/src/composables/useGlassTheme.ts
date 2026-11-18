import { readonly, ref } from 'vue';

const STORAGE_KEY = 'nexus-theme-style';
const glassTheme = ref(false);
let initialized = false;

function applyGlassTheme(enabled: boolean) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('theme-glass', enabled);
  }
  glassTheme.value = enabled;
}

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTheme(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'glass' : 'tabler');
  } catch {}
}

function readPreviewTheme() {
  if (typeof window === 'undefined') return null;
  const theme = new URLSearchParams(window.location.search).get('theme');
  return theme === 'glass' || theme === 'tabler' ? theme : null;
}

export function initGlassTheme() {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  const previewTheme = readPreviewTheme();
  if (previewTheme) {
    const enabled = previewTheme === 'glass';
    storeTheme(enabled);
    applyGlassTheme(enabled);
    return;
  }

  const storedTheme = readStoredTheme();
  applyGlassTheme(
    storedTheme === null
      ? document.documentElement.classList.contains('theme-glass')
      : storedTheme === 'glass',
  );
}

export function useGlassTheme() {
  initGlassTheme();

  function toggleGlassTheme() {
    const next = !glassTheme.value;
    storeTheme(next);
    applyGlassTheme(next);
  }

  return {
    glassTheme: readonly(glassTheme),
    toggleGlassTheme,
  };
}
