/**
 * מסך ההסכמה לחיבור Claude (`/connect`) מוגש עם headers שאוסרים להציג
 * אותו בתוך frame (clickjacking, mcp-plan §1.3). ה-headers יושבים ב-
 * `firebase.json`, ולכן הבדיקה קוראת אותו ישירות.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface HeaderRule {
  source?: string;
  regex?: string;
  headers: { key: string; value: string }[];
}

const config = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8')) as {
  hosting: { headers?: HeaderRule[] };
};

/** הכללים שחלים על נתיב. רק `regex` בשימוש כאן; `source` (glob) לא נתמך בבדיקה */
const headersFor = (path: string): Record<string, string> =>
  Object.fromEntries(
    (config.hosting.headers ?? [])
      .filter((rule) => (rule.regex ? new RegExp(rule.regex).test(path) : rule.source === path))
      .flatMap((rule) => rule.headers.map(({ key, value }) => [key.toLowerCase(), value]))
  );

describe('/connect hosting headers', () => {
  it.each(['/connect', '/connect/'])('%s cannot be framed and is not cached', (path) => {
    const headers = headersFor(path);
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['cache-control']).toBe('no-store');
  });

  it('the rule does not spill over to other pages', () => {
    expect(headersFor('/connected-apps')).toEqual({});
    expect(headersFor('/')).toEqual({});
  });
});
