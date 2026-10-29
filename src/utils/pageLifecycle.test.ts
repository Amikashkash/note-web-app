import { describe, expect, it, vi } from 'vitest';
import { onPageHidden } from './pageLifecycle';

const fakeDocument = () => Object.assign(new EventTarget(), { visibilityState: 'visible' });

describe('onPageHidden (save before the phone puts the app away)', () => {
  it('fires when the page becomes hidden (lock screen, switch app), not when it becomes visible', () => {
    const doc = fakeDocument();
    const callback = vi.fn();
    onPageHidden(callback, doc, new EventTarget());

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(callback).toHaveBeenCalledTimes(1);

    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires on pagehide (close, navigate) and on freeze', () => {
    const doc = fakeDocument();
    const win = new EventTarget();
    const callback = vi.fn();
    onPageHidden(callback, doc, win);

    win.dispatchEvent(new Event('pagehide'));
    doc.dispatchEvent(new Event('freeze'));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('stops listening when unsubscribed', () => {
    const doc = fakeDocument();
    const win = new EventTarget();
    const callback = vi.fn();
    const stop = onPageHidden(callback, doc, win);
    stop();

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('pagehide'));
    doc.dispatchEvent(new Event('freeze'));
    expect(callback).not.toHaveBeenCalled();
  });
});
