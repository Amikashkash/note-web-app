import { describe, expect, it } from 'vitest';
import { loginRedirectState, safeReturnPath } from './returnTo';

describe('safeReturnPath', () => {
  it('returns to the shared content the user was opening', () => {
    const state = loginRedirectState({ pathname: '/share', search: '?shareId=share-123-abc' });
    expect(safeReturnPath(state)).toBe('/share?shareId=share-123-abc');
  });

  it('keeps the hash and a deep link from a notification', () => {
    const state = loginRedirectState({ pathname: '/category/c1', search: '?note=n1', hash: '#x' });
    expect(safeReturnPath(state)).toBe('/category/c1?note=n1#x');
  });

  it.each([
    ['no state', undefined],
    ['null state', null],
    ['state without from', { other: 1 }],
    ['from that is not an object', { from: '/share' }],
    ['a pathname that is not a string', { from: { pathname: 42 } }],
  ])('falls back to home for %s', (_label, state) => {
    expect(safeReturnPath(state)).toBe('/');
  });

  it.each([
    ['a protocol-relative URL', '//evil.example.com/steal'],
    ['a backslash host', '/\\evil.example.com'],
    ['an absolute URL', 'https://evil.example.com'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'share'],
  ])('refuses %s (open redirect)', (_label, pathname) => {
    expect(safeReturnPath({ from: { pathname, search: '', hash: '' } })).toBe('/');
  });

  it('does not send the user back to the login page itself', () => {
    expect(safeReturnPath(loginRedirectState({ pathname: '/login' }))).toBe('/');
  });
});
