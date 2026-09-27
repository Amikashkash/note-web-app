import { describe, expect, it } from 'vitest';
import { SW_NAVIGATION_DENYLIST } from './swRoutes';

/** Workbox בודק את ה-denylist מול pathname + search */
const denied = (path: string) => SW_NAVIGATION_DENYLIST.some((pattern) => pattern.test(path));

describe('service worker navigation denylist', () => {
  it.each([
    '/mcp',
    '/oauth/authorize?client_id=x&state=y',
    '/oauth/decision',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource/mcp',
  ])('%s goes straight to the network', (path) => {
    expect(denied(path)).toBe(true);
  });

  it.each(['/', '/connect?req=abc', '/settings', '/mcp-notes', '/category/oauth'])('%s is still handled', (path) => {
    expect(denied(path)).toBe(false);
  });
});
