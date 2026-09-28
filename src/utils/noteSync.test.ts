/**
 * סנכרון פתק פתוח (C-1): שלושת המקרים שהמשימה דורשת, ועוד.
 * - שינוי מרחוק כשאין עריכה מקומית → מאמצים בשקט.
 * - שינוי מרחוק כשיש עריכה מקומית → התנגשות, והטקסט של המשתמש נשמר.
 * - שני הצדדים ערכו פריטים שונים → מיזוג.
 */

import { describe, expect, it } from 'vitest';
import { mergeNote } from './noteMerge';
import { editDraft, initialSync, markSent, onSnapshot, takeRemote, type NoteSnapshot } from './noteSync';

const snap = (overrides: Partial<NoteSnapshot> = {}): NoteSnapshot => ({
  title: 'קניות',
  content: 'שורה ראשונה',
  revision: 5,
  templateType: 'plain',
  pending: false,
  ...overrides,
});

const checklist = (items: Array<{ id: string; text: string; completed?: boolean }>) =>
  JSON.stringify(items.map((item) => ({ completed: false, ...item })));

describe('remote change, no local edits', () => {
  it('is adopted silently', () => {
    const state = initialSync(snap());
    const { state: next, action } = onSnapshot(state, snap({ content: 'עודכן במכשיר אחר', revision: 6 }), false);
    expect(action.kind).toBe('adopted');
    expect(next.draft.content).toBe('עודכן במכשיר אחר');
    expect(next.base.revision).toBe(6);
  });

  it('a change of another field (same text) changes nothing', () => {
    const state = initialSync(snap());
    expect(onSnapshot(state, snap(), false).action.kind).toBe('none');
  });
});

describe('remote change with local edits', () => {
  it('a text note stops and keeps the user text: a conflict, never an overwrite', () => {
    const edited = editDraft(initialSync(snap()), { content: 'שורה ראשונה - שלי' });
    const { state, action } = onSnapshot(edited, snap({ content: 'שורה ראשונה - של Claude', revision: 6 }), true);
    expect(action.kind).toBe('conflict');
    expect(state.draft.content).toBe('שורה ראשונה - שלי');
    expect(state.conflict?.local.content).toBe('שורה ראשונה - שלי');
    expect(state.conflict?.remote.content).toBe('שורה ראשונה - של Claude');
  });

  it('counts a sent but unconfirmed write as a local edit', () => {
    const edited = editDraft(initialSync(snap()), { content: 'שלי' });
    const { state: sent } = markSent(edited);
    // אין patch ממתין, אבל הכתיבה עוד לא אושרה - והשרת מראה משהו אחר
    const { action } = onSnapshot(sent, snap({ content: 'של מישהו אחר', revision: 6 }), false);
    expect(action.kind).toBe('conflict');
  });

  it('the same item changed on both sides is a conflict', () => {
    const base = checklist([{ id: 'a', text: 'חלב' }]);
    const edited = editDraft(initialSync(snap({ templateType: 'checklist', content: base })), {
      content: checklist([{ id: 'a', text: 'חלב סויה' }]),
    });
    const remote = snap({ templateType: 'checklist', revision: 6, content: checklist([{ id: 'a', text: 'חלב 3%' }]) });
    expect(onSnapshot(edited, remote, true).action.kind).toBe('conflict');
  });

  it('while in conflict, a newer server version replaces the stored one, so reload loads the latest', () => {
    const edited = editDraft(initialSync(snap()), { content: 'שלי' });
    const { state: conflicted } = onSnapshot(edited, snap({ content: 'שלהם', revision: 6 }), true);
    const { state: updated } = onSnapshot(conflicted, snap({ content: 'שלהם 2', revision: 7 }), true);
    const { state: reloaded, discarded } = takeRemote(updated);
    expect(reloaded.draft.content).toBe('שלהם 2');
    expect(reloaded.base.revision).toBe(7);
    expect(discarded?.content).toBe('שלי');
  });
});

describe('both edited different items', () => {
  it('merges: the local and the remote change are both kept', () => {
    const base = checklist([
      { id: 'a', text: 'חלב' },
      { id: 'b', text: 'לחם' },
    ]);
    const start = initialSync(snap({ templateType: 'checklist', content: base }));
    // המשתמש מסמן את החלב; Claude מסמן את הלחם
    const edited = editDraft(start, {
      content: checklist([
        { id: 'a', text: 'חלב', completed: true },
        { id: 'b', text: 'לחם' },
      ]),
    });
    const remote = snap({
      templateType: 'checklist',
      revision: 6,
      content: checklist([
        { id: 'a', text: 'חלב' },
        { id: 'b', text: 'לחם', completed: true },
      ]),
    });
    const { state, action } = onSnapshot(edited, remote, true);
    expect(action.kind).toBe('merged');
    expect(JSON.parse(state.draft.content)).toEqual([
      { id: 'a', text: 'חלב', completed: true },
      { id: 'b', text: 'לחם', completed: true },
    ]);
    // השמירה הבאה נשענת על הגרסה המרוחקת
    expect(markSent(state).revision).toBe(7);
  });

  it('keeps an item the user added and one the other side added', () => {
    const base = checklist([{ id: 'a', text: 'חלב' }]);
    const merged = mergeNote(
      { title: 't', content: base },
      { title: 't', content: checklist([{ id: 'a', text: 'חלב' }, { id: 'mine', text: 'ביצים' }]) },
      { title: 't', content: checklist([{ id: 'a', text: 'חלב' }, { id: 'theirs', text: 'גבינה' }]) },
      'checklist'
    );
    expect(JSON.parse(merged!.content).map((row: { id: string }) => row.id)).toEqual(['a', 'mine', 'theirs']);
  });

  it('an item deleted on one side and untouched on the other stays deleted', () => {
    const base = checklist([{ id: 'a', text: 'חלב' }, { id: 'b', text: 'לחם' }]);
    const merged = mergeNote(
      { title: 't', content: base },
      { title: 't', content: checklist([{ id: 'a', text: 'חלב', completed: true }, { id: 'b', text: 'לחם' }]) },
      { title: 't', content: checklist([{ id: 'a', text: 'חלב' }]) },
      'checklist'
    );
    expect(JSON.parse(merged!.content)).toEqual([{ id: 'a', text: 'חלב', completed: true }]);
  });

  it('an item edited on one side and deleted on the other is a conflict', () => {
    const base = checklist([{ id: 'a', text: 'חלב' }]);
    expect(
      mergeNote(
        { title: 't', content: base },
        { title: 't', content: checklist([{ id: 'a', text: 'חלב סויה' }]) },
        { title: 't', content: checklist([]) },
        'checklist'
      )
    ).toBeNull();
  });

  it('does not merge items without stable ids', () => {
    const noIds = JSON.stringify([{ text: 'חלב', completed: false }]);
    expect(
      mergeNote(
        { title: 't', content: noIds },
        { title: 't', content: JSON.stringify([{ text: 'חלב', completed: true }]) },
        { title: 't', content: JSON.stringify([{ text: 'חלב 3%', completed: false }]) },
        'checklist'
      )
    ).toBeNull();
  });
});

describe('own writes are not mistaken for remote changes', () => {
  it('the confirmation of our own write, while the user keeps typing, is not a conflict', () => {
    const edited = editDraft(initialSync(snap()), { content: 'שלב 1' });
    const { state: sent } = markSent(edited);
    const typing = editDraft(sent, { content: 'שלב 1 ועוד' });
    // האישור של "שלב 1" מגיע עם revision 6 - בדיוק מה שנשלח
    const { state, action } = onSnapshot(typing, snap({ content: 'שלב 1', revision: 6 }), true);
    expect(action.kind).toBe('none');
    expect(state.base.content).toBe('שלב 1');
    expect(state.draft.content).toBe('שלב 1 ועוד');
  });

  it('the local echo of a pending write changes nothing', () => {
    const edited = editDraft(initialSync(snap()), { content: 'שלי' });
    expect(onSnapshot(edited, snap({ content: 'שלי', revision: 6, pending: true }), false).action.kind).toBe('none');
  });

  it('two writes before any confirmation carry consecutive revisions', () => {
    const first = markSent(editDraft(initialSync(snap()), { content: 'א' }));
    const second = markSent(editDraft(first.state, { content: 'אב' }));
    expect([first.revision, second.revision]).toEqual([6, 7]);
  });

  it('our write confirmed and Claude appended after it is adopted, not a conflict', () => {
    const { state: sent } = markSent(editDraft(initialSync(snap()), { content: 'שורה ראשונה, שלי' }));
    const remote = snap({ content: 'שורה ראשונה, שלי\nהוספה של Claude', revision: 7 });
    const { state, action } = onSnapshot(sent, remote, false);
    expect(action.kind).toBe('adopted');
    expect(state.draft.content).toBe(remote.content);
  });
});
