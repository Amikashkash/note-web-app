/**
 * `findUserByEmail`: מה מוחזר, למי, וכמה פעמים
 *
 * רץ מול Auth Emulator ו-Firestore Emulator (`npm run test:functions:emulator`).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { LOOKUP_LIMITS, lookupUserByEmail } from '../src/userLookup';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - emulator hosts are not set');
}

const app = initializeApp({ projectId: 'demo-notes-4-me' }, 'find-user-emulator-test');
const db = getFirestore(app);
const auth = getAuth(app);

const RUN = Date.now();
const email = (name: string) => `${name}-${RUN}@example.com`;
const T0 = Date.parse('2026-09-27T08:00:00Z');
const MINUTE = 60 * 1000;

let verifiedUid = '';

beforeAll(async () => {
  verifiedUid = (
    await auth.createUser({ email: email('verified'), emailVerified: true, displayName: 'דנה' })
  ).uid;
  await auth.createUser({ email: email('unverified'), emailVerified: false, displayName: 'לא מאומת' });
  await auth.createUser({ email: email('disabled'), emailVerified: true, disabled: true });
});

afterAll(async () => {
  await deleteApp(app);
});

let callerCounter = 0;
/** כל בדיקה עם מבקש משלה, כדי שהגבלת הקצב לא תזלוג בין בדיקות */
const lookup = (value: unknown, callerUid = `caller-${RUN}-${callerCounter++}`, now = T0) =>
  lookupUserByEmail({ db, auth, callerUid, email: value, now });

describe('what is returned', () => {
  it('finds a verified account and returns only uid and display name', async () => {
    const result = await lookup(email('verified'));
    expect(result).toEqual({ found: true, uid: verifiedUid, displayName: 'דנה' });
  });

  it('normalizes case and surrounding spaces', async () => {
    const result = await lookup(`  ${email('verified').toUpperCase()} `);
    expect(result).toMatchObject({ found: true, uid: verifiedUid });
  });

  it.each([
    ['an account that does not exist', 'nobody'],
    ['an account whose email is not verified', 'unverified'],
    ['a disabled account', 'disabled'],
  ])('returns exactly { found: false } for %s', async (_label, name) => {
    expect(await lookup(email(name))).toEqual({ found: false });
  });

  it.each([
    ['a number', 42],
    ['an empty string', '   '],
    ['no @', 'not-an-email'],
    ['a string that is too long', `${'a'.repeat(250)}@example.com`],
  ])('rejects %s as invalid-argument', async (_label, value) => {
    await expect(lookup(value)).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('rate limit per caller', () => {
  const perMinute = LOOKUP_LIMITS.find((limit) => limit.name === 'minute')!.max;
  const perDay = LOOKUP_LIMITS.find((limit) => limit.name === 'day')!.max;

  it(`allows ${perMinute} lookups a minute, then refuses with resource-exhausted`, async () => {
    const caller = `burst-${RUN}`;
    for (let index = 0; index < perMinute; index += 1) {
      await lookup(email('nobody'), caller, T0 + index);
    }

    const blocked = lookup(email('verified'), caller, T0 + perMinute);
    await expect(blocked).rejects.toBeInstanceOf(HttpsError);
    await expect(lookup(email('verified'), caller, T0 + perMinute)).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('counts every lookup, found or not, and the next minute is allowed again', async () => {
    const caller = `window-${RUN}`;
    for (let index = 0; index < perMinute; index += 1) {
      await lookup(email(index % 2 ? 'verified' : 'nobody'), caller, T0);
    }
    await expect(lookup(email('verified'), caller, T0 + 30 * 1000)).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
    await expect(lookup(email('verified'), caller, T0 + MINUTE)).resolves.toMatchObject({ found: true });
  });

  it(`caps a caller at ${perDay} lookups a day even when spread across minutes`, async () => {
    const caller = `daily-${RUN}`;
    for (let index = 0; index < perDay; index += 1) {
      await lookup(email('nobody'), caller, T0 + index * MINUTE);
    }
    await expect(lookup(email('verified'), caller, T0 + perDay * MINUTE)).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
    // יממה אחרי תחילת החלון - מותר שוב
    await expect(lookup(email('verified'), caller, T0 + 24 * 60 * MINUTE)).resolves.toMatchObject({
      found: true,
    });
  });

  it('does not let one caller exhaust another', async () => {
    const noisy = `noisy-${RUN}`;
    for (let index = 0; index < perMinute; index += 1) {
      await lookup(email('nobody'), noisy, T0);
    }
    await expect(lookup(email('verified'), `quiet-${RUN}`, T0)).resolves.toMatchObject({ found: true });
  });

  it('does not count invalid input against the limit', async () => {
    const caller = `invalid-${RUN}`;
    for (let index = 0; index < perMinute + 3; index += 1) {
      await expect(lookup('not-an-email', caller, T0)).rejects.toMatchObject({ code: 'invalid-argument' });
    }
    await expect(lookup(email('verified'), caller, T0)).resolves.toMatchObject({ found: true });
  });
});
