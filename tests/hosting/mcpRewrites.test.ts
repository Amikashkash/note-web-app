/**
 * Hosting מפנה את שרת ה-MCP וה-OAuth לפונקציית `mcp`, באזור הנכון, לפני
 * ה-rewrite הכללי של ה-SPA. אחרת `/oauth/authorize` היה מחזיר את
 * `index.html`, ו-Claude לא היה מוצא את ה-metadata.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Rewrite {
  source: string;
  destination?: string;
  function?: { functionId: string; region?: string };
}

const { hosting } = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8')) as {
  hosting: { rewrites: Rewrite[] };
};

/** glob של Hosting, במידה שה-rewrites כאן צריכים: `**` וטקסט מדויק */
const matches = (source: string, path: string): boolean =>
  new RegExp(`^${source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*')}$`).test(path);

/** ה-rewrite הראשון שתואם - כמו ש-Hosting בוחר */
const rewriteFor = (path: string) => hosting.rewrites.find((rewrite) => matches(rewrite.source, path));

describe('MCP hosting rewrites', () => {
  it.each([
    '/mcp',
    '/oauth/authorize',
    '/oauth/token',
    '/oauth/register',
    '/oauth/revoke',
    '/oauth/decision',
    '/oauth/grants/revoke',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
  ])('%s goes to the mcp function in europe-west1', (path) => {
    expect(rewriteFor(path)?.function).toEqual({ functionId: 'mcp', region: 'europe-west1' });
  });

  it.each(['/', '/connect', '/settings', '/category/abc', '/mcp-notes'])('%s stays in the SPA', (path) => {
    expect(rewriteFor(path)).toEqual({ source: '**', destination: '/index.html' });
  });

  it('the SPA catch-all is last', () => {
    expect(hosting.rewrites.at(-1)).toEqual({ source: '**', destination: '/index.html' });
  });
});
