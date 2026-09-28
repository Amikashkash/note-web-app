/**
 * סנכרון פתק פתוח מול השרת, בלי לדרוס (C-1). טהור - בלי React ובלי Firebase.
 *
 * הבעיה: פתק פתוח שמר טיוטה מקומית שנטענה פעם אחת, וכל שמירה כתבה את
 * כל התוכן ממנה. שינוי שנעשה בינתיים במכשיר אחר (או ע"י Claude) נמחק.
 *
 * המצב:
 * - `base` - הגרסה האחרונה **שהשרת אישר** (snapshot בלי כתיבות ממתינות)
 *   שהטיוטה נשענת עליה.
 * - `draft` - מה שמוצג ונערך.
 * - `sent` - כתיבות שיצאו מהמכשיר ועוד לא אושרו, לפי ה-`revision` שכל
 *   אחת נשאה. כך מזהים שאישור שמגיע הוא של הכתיבה שלנו ולא של מישהו אחר.
 *
 * snapshot שמגיע:
 * - **ממתין** (hasPendingWrites): ההד המקומי של הכתיבה שלנו. לא משנה כלום.
 * - **מאושר וזהה לטיוטה**: מסונכרנים.
 * - **מאושר, של כתיבה שלנו** (אותו revision ואותו תוכן כמו שנשלח): מתקדמים.
 * - **מאושר ושונה - שינוי מרחוק:**
 *   - אין שינויים מקומיים שלא נשמרו → מאמצים בשקט.
 *   - יש, ואפשר למזג בבטחה (פריטים שונים ברשימה) → ממזגים ושומרים.
 *   - אחרת → **התנגשות**: עוצרים את השמירה, הטקסט של המשתמש נשאר, והוא בוחר.
 *
 * `revision`: כל כותב מעלה אותו ב-1 (לקוח חדש שולח `base + 1` מפורש,
 * שה-rules בודקים; השרת בתוך transaction). לקוח ישן שלא שולח - עדיין
 * מזוהה, כי ההשוואה היא גם על התוכן.
 */

import { mergeNote, type NoteText } from './noteMerge';

export interface NoteSnapshot extends NoteText {
  revision: number;
  templateType: string;
  /** hasPendingWrites: ההד המקומי של כתיבה שעוד לא אושרה */
  pending: boolean;
}

export interface Conflict {
  /** הגרסה שבשרת */
  remote: NoteSnapshot;
  /** מה שהמשתמש כתב ועוד לא נשמר */
  local: NoteText;
}

export interface SyncState {
  base: NoteText & { revision: number };
  draft: NoteText;
  /** כתיבות שנשלחו ועוד לא אושרו: revision → מה שנשלח */
  sent: Record<number, NoteText>;
  /** ה-revision האחרון שנשלח (או של `base`, אם אין) */
  lastSentRevision: number;
  conflict: Conflict | null;
}

export type SyncAction =
  | { kind: 'none' }
  /** הטיוטה הוחלפה בגרסה מהשרת (לא היו שינויים מקומיים) */
  | { kind: 'adopted' }
  /** השינויים מוזגו. הטיוטה החדשה צריכה להישמר */
  | { kind: 'merged' }
  /** התנגשות: לבטל שמירה ממתינה ולהציג בחירה */
  | { kind: 'conflict' };

export const initialSync = (snapshot: NoteSnapshot): SyncState => ({
  base: { title: snapshot.title, content: snapshot.content, revision: snapshot.revision },
  draft: { title: snapshot.title, content: snapshot.content },
  sent: {},
  lastSentRevision: snapshot.revision,
  conflict: null,
});

const sameText = (a: NoteText, b: NoteText) => a.title === b.title && a.content === b.content;

/** יש שינויים שלא אושרו: טיוטה ששונה מהבסיס, או כתיבה שיצאה ולא אושרה */
export const hasUnconfirmedEdits = (state: SyncState, pendingLocalPatch: boolean): boolean =>
  pendingLocalPatch || !sameText(state.draft, state.base) || state.lastSentRevision > state.base.revision;

/** המשתמש ערך. בזמן התנגשות אין עריכה - הקורא חוסם אותה */
export const editDraft = (state: SyncState, patch: Partial<NoteText>): SyncState => ({
  ...state,
  draft: { ...state.draft, ...patch },
});

/**
 * כתיבה יוצאת. מחזיר את ה-revision שהיא נושאת: `lastSentRevision + 1`,
 * כך ששתי כתיבות רצופות לפני אישור נושאות 6 ואחריה 7 - בדיוק מה שה-rules מצפים.
 */
export const markSent = (state: SyncState): { state: SyncState; revision: number } => {
  const revision = state.lastSentRevision + 1;
  return {
    revision,
    state: { ...state, sent: { ...state.sent, [revision]: { ...state.draft } }, lastSentRevision: revision },
  };
};

/** מתקדמים לבסיס חדש מאושר, ושוכחים כתיבות שכבר לא רלוונטיות */
const confirm = (state: SyncState, snapshot: NoteSnapshot, draft: NoteText): SyncState => {
  const sent = Object.fromEntries(
    Object.entries(state.sent).filter(([revision]) => Number(revision) > snapshot.revision)
  );
  return {
    ...state,
    base: { title: snapshot.title, content: snapshot.content, revision: snapshot.revision },
    draft,
    sent,
    lastSentRevision: Math.max(state.lastSentRevision, snapshot.revision),
  };
};

export const onSnapshot = (
  state: SyncState,
  snapshot: NoteSnapshot,
  pendingLocalPatch: boolean
): { state: SyncState; action: SyncAction } => {
  // ההד המקומי של כתיבה שלנו: לא נוגעים
  if (snapshot.pending) return { state, action: { kind: 'none' } };

  // התנגשות שעוד לא הוכרעה: רק מעדכנים מה יש בשרת, כדי ש"טען" יטען את העדכני
  if (state.conflict) {
    return { state: { ...state, conflict: { ...state.conflict, remote: snapshot } }, action: { kind: 'none' } };
  }

  // כלום לא השתנה בתוכן (למשל שינוי הצמדה)
  if (snapshot.revision === state.base.revision && sameText(snapshot, state.base)) {
    return { state, action: { kind: 'none' } };
  }

  // השרת מחזיק בדיוק את מה שמוצג
  if (sameText(snapshot, state.draft)) {
    return { state: confirm(state, snapshot, state.draft), action: { kind: 'none' } };
  }

  // אישור של כתיבה שלנו, כשבינתיים המשתמש כבר המשיך לכתוב
  const ours = state.sent[snapshot.revision];
  if (ours && sameText(ours, snapshot)) {
    return { state: confirm(state, snapshot, state.draft), action: { kind: 'none' } };
  }

  // שינוי מרחוק
  if (!hasUnconfirmedEdits(state, pendingLocalPatch)) {
    const remote = { title: snapshot.title, content: snapshot.content };
    return { state: { ...confirm(state, snapshot, remote), sent: {}, lastSentRevision: snapshot.revision }, action: { kind: 'adopted' } };
  }

  const merged = mergeNote(state.base, state.draft, snapshot, snapshot.templateType);
  if (merged) {
    // הכתיבות שיצאו על בסיס ישן יידחו ע"י ה-rules - שוכחים אותן ושולחים מחדש מהבסיס החדש
    return {
      state: { ...confirm(state, snapshot, merged), sent: {}, lastSentRevision: snapshot.revision },
      action: { kind: sameText(merged, snapshot) ? 'adopted' : 'merged' },
    };
  }

  return {
    state: { ...state, conflict: { remote: snapshot, local: { ...state.draft } } },
    action: { kind: 'conflict' },
  };
};

/**
 * "טען את הגרסה העדכנית": הטיוטה מתחלפת בגרסה מהשרת. הטקסט של המשתמש
 * חוזר לקורא, כדי להמשיך להציג אותו (להעתקה) עד שהמשתמש סוגר.
 */
export const takeRemote = (state: SyncState): { state: SyncState; discarded: NoteText | null } => {
  if (!state.conflict) return { state, discarded: null };
  const { remote, local } = state.conflict;
  const text = { title: remote.title, content: remote.content };
  return {
    discarded: local,
    state: {
      base: { ...text, revision: remote.revision },
      draft: text,
      sent: {},
      lastSentRevision: remote.revision,
      conflict: null,
    },
  };
};
