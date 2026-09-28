import { describe, expect, it } from 'vitest';
import { activeOthers, deviceLabel, presenceMessage, PRESENCE_TTL_MS, type PresenceEntry } from './presence';

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
