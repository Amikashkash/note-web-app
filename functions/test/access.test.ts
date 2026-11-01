import { describe, expect, it } from 'vitest';
import { accessRequestPayload } from '../src/oauth/accessPush';
import { ACCESS_REQUEST_LIMITS, isAdmin } from '../src/oauth/access';

describe('accessRequestPayload (the contract with src/sw.ts)', () => {
  it('says who asked, and is all strings (FCM data)', () => {
    const payload = accessRequestPayload({ name: 'דנה', email: 'dana@example.com' });
    expect(payload).toEqual({
      kind: 'mcp_access_request',
      title: 'דנה ביקש גישה ל-Claude',
      body: 'dana@example.com · לאישור בהגדרות',
      url: '/settings#claude-access',
    });
    expect(Object.values(payload).every((value) => typeof value === 'string')).toBe(true);
  });

  it('has no noteId, so an older service worker ignores it instead of opening a broken note', () => {
    expect(accessRequestPayload({ name: 'a', email: 'b' })).not.toHaveProperty('noteId');
  });

  it('falls back to the email, then to a generic word', () => {
    expect(accessRequestPayload({ name: '', email: 'x@example.com' }).title).toBe('x@example.com ביקש גישה ל-Claude');
    expect(accessRequestPayload({ name: 'x@example.com', email: 'x@example.com' }).body).toBe('לאישור בהגדרות');
    expect(accessRequestPayload({ name: '', email: '' }).title).toBe('משתמש ביקש גישה ל-Claude');
  });
});

describe('isAdmin', () => {
  const config = { allowedUids: ['a', 'b'], adminUids: ['a'], openToAll: true };

  it('is only adminUids: allowedUids or openToAll never make an admin', () => {
    expect(isAdmin(config, 'a')).toBe(true);
    expect(isAdmin(config, 'b')).toBe(false);
    expect(isAdmin(config, 'c')).toBe(false);
  });
});

describe('ACCESS_REQUEST_LIMITS', () => {
  it('allows one new request a minute and a few a day', () => {
    expect(ACCESS_REQUEST_LIMITS.find((window) => window.name === 'minute')?.max).toBe(1);
    expect(ACCESS_REQUEST_LIMITS.find((window) => window.name === 'day')?.max).toBeLessThanOrEqual(5);
  });
});
