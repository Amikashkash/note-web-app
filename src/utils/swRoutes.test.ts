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
    // v1.44.2: the consent screen, in any letter case
    '/connect',
    '/connect?req=abc',
    '/connect/?req=abc',
    '/Connect?req=abc',
    '/CONNECT',
  ])('%s goes straight to the network', (path) => {
    expect(denied(path)).toBe(true);
  });

  it.each(['/', '/settings', '/mcp-notes', '/category/oauth', '/connected', '/category/connect'])('%s is still handled', (path) => {
    expect(denied(path)).toBe(false);
  });
});
