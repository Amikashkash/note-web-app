import { describe, expect, it } from 'vitest';
import { isFramed, parseConnectRequest, problemFrom, requestsWrite, safeRedirect, scopeLabel } from './mcpConnect';

describe('safeRedirect', () => {
  const CALLBACK = 'https://claude.ai/api/mcp/auth_callback?code=abc&state=s&iss=x';

  it('passes a redirect to exactly the host that was shown', () => {
    expect(safeRedirect(CALLBACK, 'claude.ai')).toBe(CALLBACK);
  });

  it.each([
    ['another host', 'https://evil.example.com/cb?code=abc'],
    ['a look-alike host', 'https://claude.ai.evil.com/cb'],
    ['plain http', 'http://claude.ai/api/mcp/auth_callback'],
    ['credentials in the URL', 'https://user:pw@claude.ai/api/mcp/auth_callback'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['not a URL', 'claude.ai'],
    ['not a string', 42],
  ])('refuses %s', (_label, value) => {
    expect(safeRedirect(value, 'claude.ai')).toBeNull();
  });
});

describe('parseConnectRequest', () => {
  const valid = {
    clientName: 'Claude',
    redirectHost: 'claude.ai',
    scopes: ['notes.read'],
    nonce: 'n',
    expiresAt: '2026-09-27T10:00:00.000Z',
  };

  it('accepts the server answer', () => {
    expect(parseConnectRequest(valid)).toEqual(valid);
  });

  it.each([
    ['missing host', { ...valid, redirectHost: '' }],
    ['scopes that are not strings', { ...valid, scopes: [1] }],
    ['no nonce', { ...valid, nonce: undefined }],
    ['null', null],
  ])('refuses %s', (_label, value) => {
    expect(parseConnectRequest(value)).toBeNull();
  });
});

describe('problemFrom', () => {
  it.each([
    [403, { error: 'access_denied' }, 'not_allowed'],
    [401, { error: 'login_required' }, 'login_required'],
    [401, { error: 'invalid_token' }, 'login_required'],
    [400, { error: 'invalid_request' }, 'expired'],
    [500, { error: 'server_error' }, 'unavailable'],
    [404, null, 'unavailable'],
  ])('%i %j → %s', (status, body, problem) => {
    expect(problemFrom(status, body)).toBe(problem);
  });
});

describe('isFramed', () => {
  it('is false at the top level and true inside a frame', () => {
    const top = {} as Window;
    expect(isFramed({ self: top, top } as Window)).toBe(false);
    expect(isFramed({ self: {} as Window, top } as Window)).toBe(true);
  });

  it('treats a blocked access to top as framed', () => {
    const win = {
      self: {} as Window,
      get top(): Window {
        throw new Error('cross-origin');
      },
    };
    expect(isFramed(win as Window)).toBe(true);
  });
});

it('labels scopes in Hebrew, and shows an unknown scope as is', () => {
  expect(scopeLabel('notes.read')).toContain('קריאת');
  expect(scopeLabel('something')).toBe('something');
});

describe('write access on the consent screen', () => {
  it('is flagged only when notes.write is requested', () => {
    expect(requestsWrite(['notes.read', 'notes.write', 'offline_access'])).toBe(true);
    expect(requestsWrite(['notes.read', 'offline_access'])).toBe(false);
  });

  it('says what write access allows, and that it happens only on request', () => {
    expect(scopeLabel('notes.write')).toContain('יצירת פתקים');
    expect(scopeLabel('notes.write')).toContain('תכניות עבודה');
    expect(scopeLabel('notes.write')).toContain('לפי בקשה שלך');
  });
});
