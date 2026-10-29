import type { App } from 'vue';

import { createApp, h } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import Notification from '../notification.vue';

let activeApp: App | undefined;

afterEach(() => {
  activeApp?.unmount();
  activeApp = undefined;
  document.body.innerHTML = '';
});

describe('notification popup', () => {
  it('renders the notification status indicator as a circle', () => {
    const host = document.createElement('div');
    document.body.append(host);

    activeApp = createApp({
      render: () => h(Notification, { dot: true }),
    });
    activeApp.mount(host);

    const indicator = host.querySelector<HTMLElement>('.bell-button > span');

    expect(indicator).not.toBeNull();
    expect(indicator?.classList).toContain('rounded-full');
    expect(indicator?.classList).not.toContain('rounded-sm');
  });

  it('emits click when a notification item is clicked', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onClick = vi.fn();

    activeApp = createApp({
      render: () =>
        h(Notification, {
          notifications: [
            {
              id: 1,
              avatar: '',
              date: '20:54',
              message: '测试通知',
              title: '新消息',
            },
          ],
          onClick,
        }),
    });
    activeApp.mount(host);

    host
      .querySelector<HTMLElement>('.bell-button')
      ?.closest('div')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const item = document.body.querySelector<HTMLElement>('li');
    expect(item).not.toBeNull();
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0]).toMatchObject({ id: 1 });
  });
});
