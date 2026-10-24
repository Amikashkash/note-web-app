import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertWritesAllowed, WritesBlockedError, WRITES_BLOCKED_MESSAGE } from '@/services/api/writeGate';
import { getErrorMessage, wrapError } from '@/utils/errors';
import { useAppVersionStore, writesBlocked } from './appVersionStore';

describe('minClientVersion: the store and the write gate', () => {
  beforeEach(() => {
    vi.stubGlobal('__APP_VERSION__', '1.33.0');
    useAppVersionStore.setState({ minClientVersion: null, writesBlocked: false, unsaved: {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a higher minimum blocks writes; equal, lower or missing does not', () => {
    const { setMinClientVersion } = useAppVersionStore.getState();
    setMinClientVersion('1.34.0');
    expect(writesBlocked()).toBe(true);
    expect(() => assertWritesAllowed()).toThrow(WritesBlockedError);

    for (const value of ['1.33.0', '1.20.0', undefined, 'garbage']) {
      setMinClientVersion(value);
      expect(writesBlocked()).toBe(false);
      expect(() => assertWritesAllowed()).not.toThrow();
    }
  });

  it('the block message reaches the user as is, not wrapped in a generic error', () => {
    useAppVersionStore.getState().setMinClientVersion('9.0.0');
    try {
      assertWritesAllowed();
    } catch (error) {
      expect(getErrorMessage(wrapError('שגיאה בעדכון הפתק', error))).toBe(WRITES_BLOCKED_MESSAGE);
    }
    expect(getErrorMessage(wrapError('שגיאה בעדכון הפתק', new Error('x')))).toBe('שגיאה בעדכון הפתק');
  });

  it('unsaved text is kept per note, the latest version of each', () => {
    const { holdUnsaved } = useAppVersionStore.getState();
    holdUnsaved({ noteId: 'a', title: 'א', content: 'ראשון' });
    holdUnsaved({ noteId: 'b', title: 'ב', content: 'שני' });
    holdUnsaved({ noteId: 'a', title: 'א', content: 'ראשון, מעודכן' });
    expect(Object.values(useAppVersionStore.getState().unsaved).map((text) => text.content)).toEqual([
      'ראשון, מעודכן',
      'שני',
    ]);
  });
});
