import { ref } from 'vue';

import { subscribeSearchProgressApi } from '#/api/modules/media';

export function useSearchProgress() {
  const pct = ref(0);
  const text = ref('');
  const aborter = ref<AbortController | null>(null);

  function stop() {
    if (aborter.value) {
      aborter.value.abort();
      aborter.value = null;
    }
  }

  function start(sessionId: string, onCompleted?: () => void) {
    stop();
    pct.value = 0;
    text.value = '正在处理...';
    const ctrl = new AbortController();
    aborter.value = ctrl;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      stop();
      onCompleted?.();
    };

    subscribeSearchProgressApi(
      sessionId,
      {
        onProgress: (newPct: number, newText: string) => {
          pct.value = Math.min(newPct, 100);
          if (newText) text.value = newText;
          if (pct.value >= 100) {
            settle();
          }
        },
        onEnd: () => {
          // 非主动断开（如后端超时关闭）→ 兜底结束，避免进度条卡死
          if (!ctrl.signal.aborted) settle();
        },
      },
      ctrl.signal,
    ).catch(() => {
      if (!ctrl.signal.aborted) settle();
    });
  }

  return { pct, text, start, stop };
}
