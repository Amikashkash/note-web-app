/**
 * הסנכרון מול persistence (v1.35.0, צעד 4 בסבב 2):
 * - שרשרת `baseSaveId`: כל שמירה נושאת את ה-saveId של מה שהיא נשענת עליו.
 * - בסיס לא מאושר: העורך נפתח על כתיבה ממתינה (מסשן קודם / לשונית אחרת).
 *   תוכן מאושר אחר לא מאומץ בשקט ולא ממוזג - בחירה.
 */

import { describe, expect, it } from 'vitest';
import { editDraft, initialSync, markSent, onSnapshot, type NoteSnapshot } from './noteSync';

const snap = (overrides: Partial<NoteSnapshot> = {}): NoteSnapshot => ({
  title: 'קניות',
  content: 'חלב',
  revision: 5,
  saveId: 'S5',
  templateType: 'plain',
  pending: false,
  ...overrides,
});

describe('baseSaveId chain', () => {
  it('two saves before any confirmation: the first names the server version, the second names the first', () => {
    let state = editDraft(initialSync(snap()), { content: 'חלב וביצים' });
    const first = markSent(state, 'A6');
    expect(first).toMatchObject({ revision: 6, saveId: 'A6', baseSaveId: 'S5' });
    state = editDraft(first.state, { content: 'חלב, ביצים ולחם' });
    const second = markSent(state, 'A7');
    expect(second).toMatchObject({ revision: 7, saveId: 'A7', baseSaveId: 'A6' });
  });

  it('the confirmation of the first, while the second is still out, does not move the base back', () => {
    let state = editDraft(initialSync(snap()), { content: 'א' });
    state = markSent(state, 'A6').state;
    state = editDraft(state, { content: 'אב' });
    state = markSent(state, 'A7').state;
    state = onSnapshot(state, snap({ content: 'א', revision: 6, saveId: 'A6' }), false).state;
    state = editDraft(state, { content: 'אבג' });
    expect(markSent(state, 'A8')).toMatchObject({ revision: 8, baseSaveId: 'A7' });
  });

  it('after adopting a remote version, the next save names it', () => {
    let state = initialSync(snap());
    state = onSnapshot(state, snap({ content: 'לחם', revision: 6, saveId: 'B6' }), false).state;
    state = editDraft(state, { content: 'לחם וחלב' });
    expect(markSent(state, 'A7')).toMatchObject({ revision: 7, baseSaveId: 'B6' });
  });

  it('after a merge, the merged save names the remote version, not our rejected ones', () => {
    const list = (items: Array<[string, string]>) => JSON.stringify(items.map(([id, text]) => ({ id, text, completed: false })));
    const base = snap({ templateType: 'checklist', content: list([['a', 'חלב'], ['b', 'לחם']]) });
    let state = editDraft(initialSync(base), { content: list([['a', 'חלב סויה'], ['b', 'לחם']]) });
    state = markSent(state, 'A6').state;
    const remote = snap({ templateType: 'checklist', revision: 6, saveId: 'B6', content: list([['a', 'חלב'], ['b', 'לחם מלא']]) });
    const { state: merged, action } = onSnapshot(state, remote, false);
    expect(action.kind).toBe('merged');
    expect(markSent(merged, 'A7')).toMatchObject({ revision: 7, baseSaveId: 'B6' });
  });

  it('a note without saveId (old, or written only by the server) chains from null', () => {
    const state = editDraft(initialSync(snap({ saveId: null })), { content: 'x' });
    expect(markSent(state, 'A6').baseSaveId).toBeNull();
  });
});

describe('opening from the cache on a write still pending from a previous session', () => {
  /** העורך נפתח מהרשימה (שכוללת את הכתיבה הממתינה), ואז מגיע ה-snapshot הממתין */
  const openOnPending = () => {
    const opened = initialSync(snap({ content: 'נכתב offline', revision: 6, saveId: 'A6' }));
    const { state, action } = onSnapshot(opened, snap({ content: 'נכתב offline', revision: 6, saveId: 'A6', pending: true }), false);
    expect(action.kind).toBe('none');
    expect(state.unconfirmedBase).toBe(true);
    return state;
  };

  it('the pending write lands: nothing to decide, and the flag clears', () => {
    const { state, action } = onSnapshot(openOnPending(), snap({ content: 'נכתב offline', revision: 6, saveId: 'A6' }), false);
    expect(action.kind).toBe('none');
    expect(state.unconfirmedBase).toBe(false);
  });

  it('the pending write was rejected (another device wrote first): a choice, never a silent adopt', () => {
    // לפני v1.35.0 זה היה אימוץ שקט: אין עריכה מקומית, והטקסט מה-offline נעלם
    const { state, action } = onSnapshot(openOnPending(), snap({ content: 'ממכשיר אחר', revision: 6, saveId: 'B6' }), false);
    expect(action).toEqual({ kind: 'conflict', why: { reason: 'unconfirmed', fields: [] } });
    expect(state.conflict?.local.content).toBe('נכתב offline');
  });

  it('rejected while the user kept editing: a choice, with everything the user wrote', () => {
    let state = editDraft(openOnPending(), { content: 'נכתב offline ועוד' });
    const sent = markSent(state, 'A7');
    // הבסיס שלה הוא הכתיבה הממתינה - אם זו נדחתה, ה-rules ידחו גם אותה
    expect(sent.baseSaveId).toBe('A6');
    state = sent.state;
    const result = onSnapshot(state, snap({ content: 'ממכשיר אחר', revision: 6, saveId: 'B6' }), false);
    expect(result.action.kind).toBe('conflict');
    expect(result.state.conflict?.local.content).toBe('נכתב offline ועוד');
  });

  it('a list is not merged on an unconfirmed base either (the real base is unknown)', () => {
    const list = (texts: string[]) => JSON.stringify(texts.map((text, i) => ({ id: `i${i}`, text, completed: false })));
    const opened = initialSync(snap({ templateType: 'checklist', content: list(['offline', 'ב']), revision: 6, saveId: 'A6' }));
    let state = onSnapshot(opened, snap({ templateType: 'checklist', content: list(['offline', 'ב']), revision: 6, saveId: 'A6', pending: true }), false).state;
    state = editDraft(state, { content: list(['offline', 'ב', 'חדש']) });
    const remote = snap({ templateType: 'checklist', content: list(['א', 'ב שונה']), revision: 6, saveId: 'B6' });
    expect(onSnapshot(state, remote, true).action.kind).toBe('conflict');
  });

  it('our later write landed: the earlier one must have landed too (baseSaveId), the flag clears', () => {
    let state = editDraft(openOnPending(), { content: 'נכתב offline ועוד' });
    state = markSent(state, 'A7').state;
    const { state: after, action } = onSnapshot(state, snap({ content: 'נכתב offline ועוד', revision: 7, saveId: 'A7' }), false);
    expect(action.kind).toBe('none');
    expect(after.unconfirmedBase).toBe(false);
    expect(markSent(after, 'A8')).toMatchObject({ revision: 8, baseSaveId: 'A7' });
  });

  it('a pending echo of our own save in this session does not mark the base unconfirmed', () => {
    let state = editDraft(initialSync(snap()), { content: 'חלב וביצים' });
    state = markSent(state, 'A6').state;
    const echo = onSnapshot(state, snap({ content: 'חלב וביצים', revision: 6, saveId: 'A6', pending: true }), false);
    expect(echo.state.unconfirmedBase).toBe(false);
  });
});

describe('two tabs on the same note', () => {
  it("the other tab's pending write is ignored until confirmed, then adopted", () => {
    const state = initialSync(snap());
    const pendingOther = onSnapshot(state, snap({ content: 'מהלשונית השנייה', revision: 6, saveId: 'T6', pending: true }), false);
    expect(pendingOther.action.kind).toBe('none');
    expect(pendingOther.state.unconfirmedBase).toBe(false);
    const confirmed = onSnapshot(pendingOther.state, snap({ content: 'מהלשונית השנייה', revision: 6, saveId: 'T6' }), false);
    expect(confirmed.action.kind).toBe('adopted');
  });

  it('a tab opened while the other tab has a pending write treats it as unconfirmed', () => {
    const opened = initialSync(snap({ content: 'מהלשונית השנייה', revision: 6, saveId: 'T6' }));
    const { state } = onSnapshot(opened, snap({ content: 'מהלשונית השנייה', revision: 6, saveId: 'T6', pending: true }), false);
    expect(state.unconfirmedBase).toBe(true);
    // ומשהגיע האישור - רגיל
    expect(onSnapshot(state, snap({ content: 'מהלשונית השנייה', revision: 6, saveId: 'T6' }), false).state.unconfirmedBase).toBe(false);
  });

  it('both tabs saved from the same base: the second gets a conflict or a merge, not an overwrite', () => {
    // לשונית ב' שלחה 6 על בסיס S5; לשונית א' כבר כתבה 6 (T6). ה-rules דוחים את של ב'
    let state = editDraft(initialSync(snap()), { content: 'מלשונית ב' });
    state = markSent(state, 'B6').state;
    const { action } = onSnapshot(state, snap({ content: 'מלשונית א', revision: 6, saveId: 'T6' }), false);
    expect(action).toEqual({ kind: 'conflict', why: { reason: 'text', fields: [] } });
  });
});
