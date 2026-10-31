/**
 * "המשתמש מקליד בפתק" (v1.39.0): רק סימון הקלדה טרי חוסם את Claude.
 */

import { describe, expect, it } from 'vitest';
import { TYPING_WINDOW_MS, typingOn } from '../src/notesCore/typing';

const at = (ms: number) => ({ toMillis: () => ms });
const NOW = 1_000_000;

describe('typingOn', () => {
  it('a fresh typing signal blocks, and names the device', () => {
    expect(typingOn([{ typedAt: at(NOW - 10_000), device: 'iPhone' }], NOW)).toEqual(['iPhone']);
  });

  it('a note that is only open (no typing signal) does not block', () => {
    expect(typingOn([{ typedAt: null, device: 'iPhone' }], NOW)).toEqual([]);
  });

  it('the window is 75 seconds from the signal: at least 60 after the last keystroke', () => {
    expect(TYPING_WINDOW_MS).toBe(75_000);
    expect(typingOn([{ typedAt: at(NOW - 74_999), device: 'a' }], NOW)).toEqual(['a']);
    expect(typingOn([{ typedAt: at(NOW - 75_000), device: 'a' }], NOW)).toEqual([]);
  });

  it('several markers: only the typing ones count', () => {
    expect(
      typingOn(
        [
          { typedAt: at(NOW - 120_000), device: 'old tab' },
          { typedAt: null, device: 'open only' },
          { typedAt: at(NOW - 1_000), device: 'computer' },
        ],
        NOW
      )
    ).toEqual(['computer']);
  });
});
