import { describe, expect, it } from 'vitest';
import { activeOthers, deviceLabel, presenceMessage, PRESENCE_TTL_MS, type PresenceEntry, createTypingSignal, TYPING_SIGNAL_EVERY_MS, TYPING_WINDOW_MS } from './presence';

const NOW = Date.parse('2026-09-28T10:00:00Z');

const entry = (overrides: Partial<PresenceEntry> = {}): PresenceEntry => ({
  sessionId: 's-other',
  uid: 'me',
  device: 'iPhone',
  refreshedAt: new Date(NOW - 10_000),
  ...overrides,
});

describe('activeOthers', () => {
  it('ignores my own session', () => {
    expect(activeOthers([entry({ sessionId: 'mine' })], 'mine', NOW)).toEqual([]);
  });

  it('keeps a marker refreshed recently', () => {
    expect(activeOthers([entry()], 'mine', NOW)).toHaveLength(1);
  });

  it('drops a marker that was not refreshed for a minute, even if it was never deleted', () => {
    expect(activeOthers([entry({ refreshedAt: new Date(NOW - PRESENCE_TTL_MS - 1) })], 'mine', NOW)).toEqual([]);
  });

  it('ignores a marker the server has not confirmed yet', () => {
    expect(activeOthers([entry({ refreshedAt: null })], 'mine', NOW)).toEqual([]);
  });
});

describe('presenceMessage', () => {
  it('names my other device', () => {
    expect(presenceMessage([entry()], 'me')).toBe('הפתק פתוח גם בiPhone שלך.');
  });

  it('says when another user has it open', () => {
    expect(presenceMessage([entry({ uid: 'partner' })], 'me')).toBe('הפתק פתוח גם אצל משתמש אחר שהוא משותף איתו.');
  });

  it('is empty when nobody else has it open', () => {
    expect(presenceMessage([], 'me')).toBeNull();
  });
});

describe('deviceLabel', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile', 'טלפון Android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'מחשב Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 'Mac'],
  ])('%s', (userAgent, label) => {
    expect(deviceLabel(userAgent)).toBe(label);
  });
});

describe('typing signal (narrowed Claude block, v1.39.0)', () => {
  const setup = () => {
    let clock = 0;
    const sent: number[] = [];
    const signal = createTypingSignal({ everyMs: TYPING_SIGNAL_EVERY_MS, now: () => clock, send: () => sent.push(clock) });
    return { signal, sent, at: (ms: number) => (clock = ms) };
  };

  it('the first keystroke writes at once', () => {
    const { signal, sent } = setup();
    signal.typed();
    expect(sent).toEqual([0]);
  });

  it('a minute of continuous typing writes at most every 15 seconds', () => {
    const { signal, sent, at } = setup();
    for (let ms = 0; ms <= 60_000; ms += 200) {
      at(ms);
      signal.typed();
    }
    expect(sent).toEqual([0, 15_000, 30_000, 45_000, 60_000]);
  });

  it('no typing, no writes', () => {
    expect(setup().sent).toEqual([]);
  });

  it('the server window covers at least 60 seconds after the LAST keystroke, whatever its timing', () => {
    const { signal, sent, at } = setup();
    // ההקלדה האחרונה מעט לפני שהייתה כותבת שוב: הרגע הגרוע ביותר
    for (const ms of [0, 5_000, 14_999]) {
      at(ms);
      signal.typed();
    }
    const lastWrite = sent[sent.length - 1];
    const lastKeystroke = 14_999;
    expect(lastWrite + TYPING_WINDOW_MS - lastKeystroke).toBeGreaterThanOrEqual(60_000);
    expect(TYPING_WINDOW_MS).toBeLessThanOrEqual(75_000);
  });
});

