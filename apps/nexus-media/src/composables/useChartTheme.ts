import { computed, onMounted, onUnmounted, ref } from 'vue';

const isDark = ref(false);

function update() {
  isDark.value = document.documentElement.classList.contains('dark');
}

let observer: MutationObserver | null = null;

if (typeof document !== 'undefined') {
  update();
  observer = new MutationObserver(update);
  observer.observe(document.documentElement, {
    attributeFilter: ['class'],
    attributes: true,
  });
}

export function useChartTheme() {
  onMounted(update);
  if (observer) {
    onUnmounted(() => observer?.disconnect());
  }

  return {
    /** 图表文字主色 */
    textColor: computed(() => cls(isDark.value, '#e0e0e0', '#1a1a1a')),
    mutedColor: computed(() => cls(isDark.value, '#888', '#666')),
    borderColor: computed(() => cls(isDark.value, '#3a3a3a', '#d4d4d4')),
    legendColor: computed(() => cls(isDark.value, '#888', '#666')),
    titleColor: computed(() => cls(isDark.value, '#e0e0e0', '#1a1a1a')),
    /** 是否暗色模式 */
    isDark: computed(() => isDark.value),
  };
}

function cls(dark: boolean, darkColor: string, lightColor: string): string {
  return dark ? darkColor : lightColor;
}
