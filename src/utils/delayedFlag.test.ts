import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDelayedFlag } from './delayedFlag';

describe('createDelayedFlag ("waiting for connection")', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const changes: boolean[] = [];
    const flag = createDelayedFlag({
      delayMs: 2500,
      onChange: (on) => changes.push(on),
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });
    return { flag, changes };
  };

  it('a normal save (pending for a moment) never shows', () => {
    const { flag, changes } = setup();
    flag.set(true);
    vi.advanceTimersByTime(300);
    flag.set(false);
    vi.advanceTimersByTime(10_000);
    expect(changes).toEqual([]);
  });

  it('pending past the delay shows; confirmed hides at once', () => {
    const { flag, changes } = setup();
    flag.set(true);
    vi.advanceTimersByTime(2499);
    expect(changes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(changes).toEqual([true]);
    flag.set(false);
    expect(changes).toEqual([true, false]);
  });

  it('repeated pending updates do not restart the delay or show twice', () => {
    const { flag, changes } = setup();
    flag.set(true);
    vi.advanceTimersByTime(2000);
    flag.set(true);
    vi.advanceTimersByTime(500);
    flag.set(true);
    vi.advanceTimersByTime(5000);
    expect(changes).toEqual([true]);
  });

  it('stop cancels a pending show', () => {
    const { flag, changes } = setup();
    flag.set(true);
    flag.stop();
    vi.advanceTimersByTime(5000);
    expect(changes).toEqual([]);
  });
});
