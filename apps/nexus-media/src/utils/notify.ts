/**
 * 全局通知工具
 * 统一通知显示时长，避免各处重复设置 duration。
 */
import { useNotification } from 'naive-ui';

const DEFAULT_DURATION = 3000;

export function useAppNotification() {
  const notification = useNotification();

  function success(content: string, options?: { description?: string }) {
    notification.success({
      content,
      description: options?.description,
      duration: DEFAULT_DURATION,
    });
  }

  function error(content: string, options?: { description?: string }) {
    notification.error({
      content,
      description: options?.description,
      duration: DEFAULT_DURATION,
    });
  }

  function warning(content: string, options?: { description?: string }) {
    notification.warning({
      content,
      description: options?.description,
      duration: DEFAULT_DURATION,
    });
  }

  function info(content: string, options?: { description?: string }) {
    notification.info({
      content,
      description: options?.description,
      duration: DEFAULT_DURATION,
    });
  }

  return {
    error,
    info,
    success,
    warning,
  };
}
