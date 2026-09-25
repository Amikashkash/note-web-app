import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPatchDebouncer } from './patchDebouncer';

interface NoteUpdates {
  title?: string;
  content?: string;
}

describe('createPatchDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('merges a title change and a content change made within the delay (A1 / C-4)', () => {
    const save = vi.fn();
    const debouncer = createPatchDebouncer<NoteUpdates>(save, 600);

    debouncer.call({ title: 'כותרת חדשה' });
    vi.advanceTimersByTime(300);
    debouncer.call({ content: '[{"id":"1","completed":true}]' });
    vi.advanceTimersByTime(600);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      title: 'כותרת חדשה',
      content: '[{"id":"1","completed":true}]',
    });
  });

  it('keeps the last value of a field that changed twice', () => {
    const save = vi.fn();
    const debouncer = createPatchDebouncer<NoteUpdates>(save, 600);

    debouncer.call({ title: 'a' });
    debouncer.call({ content: 'x' });
    debouncer.call({ title: 'b' });
    vi.advanceTimersByTime(600);

    expect(save).toHaveBeenCalledWith({ title: 'b', content: 'x' });
  });

  it('restarts the delay on every call', () => {
    const save = vi.fn();
    const debouncer = createPatchDebouncer<NoteUpdates>(save, 600);

    debouncer.call({ title: 'a' });
    vi.advanceTimersByTime(500);
    debouncer.call({ title: 'ab' });
    vi.advanceTimersByTime(500);

    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(save).toHaveBeenCalledWith({ title: 'ab' });
  });

  it('flush sends the merged patch immediately and only once', () => {
    const save = vi.fn();
    const debouncer = createPatchDebouncer<NoteUpdates>(save, 600);

    debouncer.call({ title: 'a' });
    debouncer.call({ content: 'x' });
    debouncer.flush();
    vi.advanceTimersByTime(1000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: 'a', content: 'x' });
  });

  it('flush with nothing pending does not save', () => {
    const save = vi.fn();
    createPatchDebouncer<NoteUpdates>(save, 600).flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('cancel drops the pending patch', () => {
    const save = vi.fn();
    const debouncer = createPatchDebouncer<NoteUpdates>(save, 600);

    debouncer.call({ title: 'gone' });
    debouncer.cancel();
    debouncer.flush();
    vi.advanceTimersByTime(1000);

    expect(save).not.toHaveBeenCalled();
  });

  it('starts a fresh patch after a save', () => {
    const save = vi.fn();
    const debouncer = createPatchDebouncer<NoteUpdates>(save, 600);

    debouncer.call({ title: 'a' });
    debouncer.flush();
    debouncer.call({ content: 'x' });
    debouncer.flush();

    expect(save).toHaveBeenNthCalledWith(2, { content: 'x' });
  });

  it('setSave replaces the callback without losing what is pending', () => {
    const first = vi.fn();
    const second = vi.fn();
    const debouncer = createPatchDebouncer<NoteUpdates>(first, 600);

    debouncer.call({ title: 'a' });
    debouncer.setSave(second);
    vi.advanceTimersByTime(600);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ title: 'a' });
  });
});
