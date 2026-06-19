import type { DownloadEvent } from '#/api';

import { ref } from 'vue';

import { useMessage } from 'naive-ui';

import { subscribeDownloadEventsApi } from '#/api';

export function useDownloadEventStream(onCompleted?: () => void) {
  const sseAbortController = ref<AbortController | null>(null);
  const connected = ref(false);
  const message = useMessage();

  function stop() {
    if (sseAbortController.value) {
      sseAbortController.value.abort();
      sseAbortController.value = null;
      connected.value = false;
    }
  }

  function start() {
    stop();
    sseAbortController.value = new AbortController();

    subscribeDownloadEventsApi(
      {
        onEnd: () => {
          connected.value = false;
          setTimeout(start, 3000);
        },
        onEvent: (event: DownloadEvent) => {
          switch (event.event) {
            case 'download.completed': {
              connected.value = true;
              message.success(
                `下载完成: ${event.data.name || event.data.task_id || ''}`,
              );
              onCompleted?.();
              break;
            }
            case 'download.failed': {
              connected.value = true;
              message.error(
                `下载失败: ${event.data.title || ''} — ${event.data.reason || ''}`,
              );
              break;
            }
            case 'download.started': {
              connected.value = true;
              message.success(
                `下载开始: ${event.data.title || ''} (${event.data.download_id || ''})`,
              );
              break;
            }
            default: {
              break;
            }
          }
        },
      },
      sseAbortController.value.signal,
    ).catch(() => {
      connected.value = false;
    });
  }

  return { connected, start, stop };
}
