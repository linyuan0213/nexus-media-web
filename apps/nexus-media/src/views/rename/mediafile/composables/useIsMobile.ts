import { onBeforeUnmount, onMounted, ref } from 'vue';

const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile() {
  const isMobile = ref(false);
  let mql: MediaQueryList | null = null;

  function update(e?: MediaQueryListEvent) {
    isMobile.value = e ? e.matches : (mql?.matches ?? false);
  }

  onMounted(() => {
    mql = window.matchMedia(MOBILE_QUERY);
    update();
    mql.addEventListener('change', update);
  });

  onBeforeUnmount(() => {
    mql?.removeEventListener('change', update);
  });

  return { isMobile };
}
