/**
 * חלון "המשתמש מקליד" (v1.39.0) זהה באפליקציה ובשרת. האפליקציה כותבת את
 * הסימון לכל היותר כל 15 שניות, והשרת חוסם 75 שניות ממנו - כך שחסום לפחות
 * 60 שניות אחרי ההקלדה האחרונה. אם אחד משתנה בלי השני, זה כבר לא נכון.
 */

import { describe, expect, it } from 'vitest';
import { TYPING_SIGNAL_EVERY_MS, TYPING_WINDOW_MS as clientWindow } from '@/utils/presence';
import { TYPING_WINDOW_MS as serverWindow } from '../../functions/src/notesCore/typing';

describe('typing window, app vs server', () => {
  it('the same window on both sides', () => {
    expect(serverWindow).toBe(clientWindow);
  });

  it('the window covers 60 seconds after the last keystroke, even right before the next signal write', () => {
    expect(serverWindow - TYPING_SIGNAL_EVERY_MS).toBeGreaterThanOrEqual(60_000);
  });
});
