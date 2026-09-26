/**
 * היסטוריית גרסאות: מתי נוצרת גרסה, מה נשמר בה, וכמה נשמרות
 */

import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { handleNoteWritten } from '../src/noteWritten';
import { MAX_VERSIONS_PER_NOTE, VERSION_TTL_MS } from '../src/versions';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - FIRESTORE_EMULATOR_HOST is not set');
}

const app = initializeApp({ projectId: 'demo-notes-4-me' }, 'versions-emulator-test');
const db = getFirestore(app);

afterAll(async () => {
  await deleteApp(app);
});

const T0 = Date.parse('2026-09-25T08:00:00Z');
const MINUTE = 60 * 1000;

let counter = 0;
const newNoteId = () => `vnote-${Date.now()}-${counter++}`;

const note = (extra: DocumentData = {}): DocumentData => ({
  userId: 'owner',
  categoryId: 'cat-1',
  title: 'פתק',
  content: 'גרסה 1',
  templateType: 'plain',
  tags: [],
  color: null,
  isArchived: false,
  isPinned: false,
  order: 0,
  updatedBy: 'owner',
  updatedAt: Timestamp.fromMillis(T0 - MINUTE),
  ...extra,
});

const write = (noteId: string, before: DocumentData | undefined, after: DocumentData | undefined, now: number) =>
  handleNoteWritten({ db, noteId, before, after, now });

const versionsOf = async (noteId: string) =>
  (await db.collection(`notes/${noteId}/versions`).orderBy('capturedAt', 'asc').get()).docs.map((doc) => doc.data());

describe('when a version is created', () => {
  it('creates nothing when a note is created', async () => {
    const noteId = newNoteId();
    await write(noteId, undefined, note(), T0);
    expect(await versionsOf(noteId)).toHaveLength(0);
  });

  it('saves the state before the first edit, with who wrote it and who replaced it', async () => {
    const noteId = newNoteId();
    const v1 = note();
    await write(noteId, v1, note({ content: 'גרסה 2' }), T0);

    const [version] = await versionsOf(noteId);
    expect(version).toMatchObject({
      title: 'פתק',
      content: 'גרסה 1',
      templateType: 'plain',
      tags: [],
      categoryId: 'cat-1',
      isArchived: false,
      authoredBy: 'owner',
      replacedBy: 'owner',
      reason: 'time',
    });
    expect((version.authoredAt as Timestamp).toMillis()).toBe(T0 - MINUTE);
  });

  it('coalesces an editing session: one version per 10 minutes for the same writer', async () => {
    const noteId = newNoteId();
    await write(noteId, note({ content: 'a' }), note({ content: 'ab' }), T0);
    await write(noteId, note({ content: 'ab' }), note({ content: 'abc' }), T0 + 3 * MINUTE);
    await write(noteId, note({ content: 'abc' }), note({ content: 'abcd' }), T0 + 9 * MINUTE);
    expect(await versionsOf(noteId)).toHaveLength(1);

    await write(noteId, note({ content: 'abcd' }), note({ content: 'abcde' }), T0 + 11 * MINUTE);
    const versions = await versionsOf(noteId);
    expect(versions.map((version) => version.content)).toEqual(['a', 'abcd']);
  });

  it('creates a version immediately when another user edits', async () => {
    const noteId = newNoteId();
    await write(noteId, note({ content: 'a' }), note({ content: 'ab' }), T0);
    await write(
      noteId,
      note({ content: 'ab' }),
      note({ content: 'ab + shared', updatedBy: 'shared-user' }),
      T0 + MINUTE
    );

    const versions = await versionsOf(noteId);
    expect(versions).toHaveLength(2);
    expect(versions[1]).toMatchObject({ content: 'ab', authoredBy: 'owner', replacedBy: 'shared-user', reason: 'writer' });
  });

  it.each([
    ['archive', { isArchived: true }],
    ['template', { templateType: 'checklist' }],
    ['move', { categoryId: 'cat-2' }],
  ])('creates a version immediately on a structural change (%s)', async (reason, change) => {
    const noteId = newNoteId();
    await write(noteId, note({ content: 'a' }), note({ content: 'b' }), T0);
    await write(noteId, note({ content: 'b' }), note({ content: 'b', ...change }), T0 + MINUTE);

    const versions = await versionsOf(noteId);
    expect(versions).toHaveLength(2);
    expect(versions[1].reason).toBe(reason);
  });

  it('creates a version on every restore, even of the same version and within the window', async () => {
    const noteId = newNoteId();
    await write(noteId, note({ content: 'a' }), note({ content: 'b' }), T0);

    const restore1 = { restoredFrom: 'v1', restoredAt: Timestamp.fromMillis(T0 + MINUTE) };
    await write(noteId, note({ content: 'b' }), note({ content: 'a', ...restore1 }), T0 + MINUTE);

    const restore2 = { restoredFrom: 'v1', restoredAt: Timestamp.fromMillis(T0 + 2 * MINUTE) };
    await write(noteId, note({ content: 'c', ...restore1 }), note({ content: 'a', ...restore2 }), T0 + 2 * MINUTE);

    const versions = await versionsOf(noteId);
    expect(versions.map((version) => version.reason)).toEqual(['time', 'restore', 'restore']);
    expect(versions[1].content).toBe('b');
  });

  it.each([
    ['pinning', { isPinned: true }],
    ['reordering', { order: 5 }],
    ['a revision bump', { revision: 3 }],
  ])('creates nothing for %s only', async (_label, change) => {
    const noteId = newNoteId();
    await write(noteId, note(), note(change), T0);
    expect(await versionsOf(noteId)).toHaveLength(0);
  });

  it('treats a change to tags as a content change', async () => {
    const noteId = newNoteId();
    await write(noteId, note(), note({ tags: ['עבודה'] }), T0);
    expect(await versionsOf(noteId)).toHaveLength(1);
  });
});

describe('retention', () => {
  it('sets expiresAt 90 days after capture', async () => {
    const noteId = newNoteId();
    await write(noteId, note(), note({ content: 'x' }), T0);
    const [version] = await versionsOf(noteId);
    expect((version.expiresAt as Timestamp).toMillis() - (version.capturedAt as Timestamp).toMillis()).toBe(
      VERSION_TTL_MS
    );
  });

  it(`keeps only the last ${MAX_VERSIONS_PER_NOTE} versions`, async () => {
    const noteId = newNoteId();
    const total = MAX_VERSIONS_PER_NOTE + 5;

    for (let index = 0; index < total; index += 1) {
      await write(
        noteId,
        note({ content: `c${index}` }),
        note({ content: `c${index + 1}` }),
        T0 + index * 11 * MINUTE
      );
    }

    const versions = await versionsOf(noteId);
    expect(versions).toHaveLength(MAX_VERSIONS_PER_NOTE);
    expect(versions[0].content).toBe('c5');
    expect(versions.at(-1)!.content).toBe(`c${total - 1}`);
  });

  it('deletes the history when the note is permanently deleted', async () => {
    const noteId = newNoteId();
    await write(noteId, note(), note({ content: 'x' }), T0);
    expect(await versionsOf(noteId)).toHaveLength(1);

    await write(noteId, note({ content: 'x' }), undefined, T0 + MINUTE);
    expect(await versionsOf(noteId)).toHaveLength(0);
  });
});
