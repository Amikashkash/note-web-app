/**
 * שורת המצב של העורך (צעד 6): "נשמר" רק כשהשרת אישר את מה שמוצג.
 */

import { describe, expect, it } from 'vitest';
import { saveStatus, type SaveStatusInput } from './saveStatus';

const input = (overrides: Partial<SaveStatusInput> = {}): SaveStatusInput => ({
  unconfirmed: false,
  conflict: false,
  writesBlocked: false,
  failed: false,
  offline: false,
  slow: false,
  notOnDevice: false,
  ...overrides,
});

describe('saveStatus', () => {
  it('nothing unconfirmed: saved', () => {
    expect(saveStatus(input())).toMatchObject({ kind: 'saved', label: 'נשמר' });
  });

  it('typing or a save on its way, online: saving', () => {
    expect(saveStatus(input({ unconfirmed: true }))).toMatchObject({ kind: 'saving', label: 'שומר…' });
  });

  it('offline: waiting for connection, saved on the device', () => {
    const status = saveStatus(input({ unconfirmed: true, offline: true }));
    expect(status).toMatchObject({ kind: 'offline', label: 'ממתין לחיבור' });
    expect(status.detail).toContain('שמורים במכשיר');
  });

  it('a save not confirmed for a few seconds, even if the browser says online: waiting for connection', () => {
    expect(saveStatus(input({ unconfirmed: true, slow: true })).kind).toBe('offline');
  });

  it('offline and the device could not store it: says so, never "saved on the device"', () => {
    const status = saveStatus(input({ unconfirmed: true, offline: true, notOnDevice: true }));
    expect(status.kind).toBe('offline');
    expect(status.detail).toContain('לא נשמרו במכשיר');
  });

  it('offline but nothing unconfirmed: saved (reading offline is fine)', () => {
    expect(saveStatus(input({ offline: true })).kind).toBe('saved');
  });

  it('a conflict, a blocked version or a failed save: not saved - even if nothing looks unconfirmed', () => {
    for (const flag of ['conflict', 'writesBlocked', 'failed'] as const) {
      expect(saveStatus(input({ [flag]: true })).kind).toBe('unsaved');
      expect(saveStatus(input({ [flag]: true, unconfirmed: true, offline: true })).kind).toBe('unsaved');
    }
  });

  it('each "not saved" says why', () => {
    expect(saveStatus(input({ conflict: true })).detail).toContain('בחרו');
    expect(saveStatus(input({ writesBlocked: true })).detail).toContain('רעננו');
    expect(saveStatus(input({ failed: true })).detail).toContain('נכשלה');
  });

  it('"saved" appears only when nothing is in doubt - exhaustively', () => {
    const flags = ['unconfirmed', 'conflict', 'writesBlocked', 'failed', 'offline', 'slow', 'notOnDevice'] as const;
    for (let mask = 0; mask < 1 << flags.length; mask++) {
      const value = input(Object.fromEntries(flags.map((flag, i) => [flag, Boolean(mask & (1 << i))])));
      const doubt = value.unconfirmed || value.conflict || value.writesBlocked || value.failed;
      expect(saveStatus(value).kind === 'saved').toBe(!doubt);
    }
  });
});
