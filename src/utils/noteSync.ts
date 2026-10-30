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
 * - `unconfirmedBase` - הבסיס הוא בעצם כתיבה **ממתינה** שלא יצאה מהעורך
 *   הזה: מסשן קודם (persistence, v1.35.0) או מלשונית אחרת. ראו למטה.
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
 *
 * `baseSaveId` (v1.35.0): כל שמירה נושאת את ה-`saveId` של הגרסה שהיא נשענת
 * עליה - של השרת, או של השמירה הקודמת שלנו שעוד לא אושרה. ה-rules דוחים
 * שמירה שהבסיס שלה אינו מה שבשרת. בלי זה: שתי שמירות בתור (offline) נושאות
 * 6 ו-7; מכשיר אחר כתב 6 קודם; 6 שלנו נדחית - אבל 7 עוברת (6 + 1) ודורסת
 * אותו. עם persistence התור שורד גם סגירה של האפליקציה, ולכן זה דחוף.
 *
 * בסיס לא מאושר: העורך נפתח על תוכן שכולל כתיבה ממתינה (ה-cache מחזיק
 * אותה כאילו נשמרה). אם היא תידחה בשרת, ה-snapshot המאושר יחזיר משהו
 * אחר - ולא נדע מה היה הבסיס האמיתי. מיזוג או אימוץ שקט היו מוחקים אותה.
 * לכן: כל עוד הבסיס לא אושר, תוכן מאושר שונה = **התנגשות**, תמיד.
 */

import { mergeNote, type MergeConflict, type NoteText } from './noteMerge';

export interface NoteSnapshot extends NoteText {
  revision: number;
  /** ה-`saveId` שבמסמך (של השמירה האחרונה של עורך), `null` כשאין */
  saveId: string | null;
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
  base: NoteText & { revision: number; saveId: string | null };
  draft: NoteText;
  /** כתיבות שנשלחו ועוד לא אושרו: revision → מה שנשלח */
  sent: Record<number, NoteText>;
  /** ה-revision האחרון שנשלח (או של `base`, אם אין) */
  lastSentRevision: number;
  /** ה-`saveId` של השמירה האחרונה שנשלחה (או של `base`): הבסיס של הבאה */
  lastSentSaveId: string | null;
  /** הבסיס הוא כתיבה ממתינה שלא יצאה מכאן (ראו למעלה) */
  unconfirmedBase: boolean;
  conflict: Conflict | null;
}

export type SyncAction =
  | { kind: 'none' }
  /** הטיוטה הוחלפה בגרסה מהשרת (לא היו שינויים מקומיים) */
  | { kind: 'adopted' }
  /** השינויים מוזגו. הטיוטה החדשה צריכה להישמר */
  | { kind: 'merged' }
  /** התנגשות: לבטל שמירה ממתינה ולהציג בחירה. `why` - למדידה, בלי תוכן */
  | { kind: 'conflict'; why: MergeConflict };

export const initialSync = (snapshot: NoteSnapshot): SyncState => ({
  base: { title: snapshot.title, content: snapshot.content, revision: snapshot.revision, saveId: snapshot.saveId },
  draft: { title: snapshot.title, content: snapshot.content },
  sent: {},
  lastSentRevision: snapshot.revision,
  lastSentSaveId: snapshot.saveId,
  unconfirmedBase: snapshot.pending,
  conflict: null,
});

const sameText = (a: NoteText, b: NoteText) => a.title === b.title && a.content === b.content;

/** יש שינויים שלא אושרו: טיוטה ששונה מהבסיס, או כתיבה שיצאה ולא אושרה */
export const hasUnconfirmedEdits = (state: SyncState, pendingLocalPatch: boolean): boolean =>
  pendingLocalPatch || !sameText(state.draft, state.base) || state.lastSentRevision > state.base.revision;

/**
 * יש משהו שהשרת עוד לא אישר, לשורת המצב: שינויים שלא אושרו, **או** בסיס
 * שהוא בעצמו כתיבה ממתינה (מסשן קודם או מלשונית אחרת) - גם אם לא נגעו בכלום.
 */
export const awaitingServer = (state: SyncState): boolean =>
  hasUnconfirmedEdits(state, false) || state.unconfirmedBase;

/** המשתמש ערך. בזמן התנגשות אין עריכה - הקורא חוסם אותה */
export const editDraft = (state: SyncState, patch: Partial<NoteText>): SyncState => ({
  ...state,
  draft: { ...state.draft, ...patch },
});

/**
 * כתיבה יוצאת. מחזיר את ה-revision שהיא נושאת (`lastSentRevision + 1`, כך
 * ששתי כתיבות רצופות לפני אישור נושאות 6 ואחריה 7 - בדיוק מה שה-rules
 * מצפים), את ה-`saveId` החדש שלה, ואת `baseSaveId` - של מה שהיא נשענת עליו.
 */
export const markSent = (
  state: SyncState,
  saveId: string = crypto.randomUUID()
): { state: SyncState; revision: number; saveId: string; baseSaveId: string | null } => {
  const revision = state.lastSentRevision + 1;
  return {
    revision,
    saveId,
    baseSaveId: state.lastSentSaveId,
    state: {
      ...state,
      sent: { ...state.sent, [revision]: { ...state.draft } },
      lastSentRevision: revision,
      lastSentSaveId: saveId,
    },
  };
};

/** מתקדמים לבסיס חדש מאושר, ושוכחים כתיבות שכבר לא רלוונטיות */
const confirm = (state: SyncState, snapshot: NoteSnapshot, draft: NoteText): SyncState => {
  const sent = Object.fromEntries(
    Object.entries(state.sent).filter(([revision]) => Number(revision) > snapshot.revision)
  );
  // השרת הגיע לשמירה האחרונה שלנו (או עבר אותה): הבאה נשענת עליו
  const caughtUp = snapshot.revision >= state.lastSentRevision;
  return {
    ...state,
    base: { title: snapshot.title, content: snapshot.content, revision: snapshot.revision, saveId: snapshot.saveId },
    draft,
    sent,
    lastSentRevision: Math.max(state.lastSentRevision, snapshot.revision),
    lastSentSaveId: caughtUp ? snapshot.saveId : state.lastSentSaveId,
    unconfirmedBase: false,
  };
};

/** מתחילים מחדש מגרסת השרת: שום כתיבה שלנו כבר לא בדרך */
const restartFrom = (state: SyncState, snapshot: NoteSnapshot, draft: NoteText): SyncState => ({
  ...confirm(state, snapshot, draft),
  sent: {},
  lastSentRevision: snapshot.revision,
  lastSentSaveId: snapshot.saveId,
});

const toConflict = (state: SyncState, snapshot: NoteSnapshot, why: MergeConflict) => ({
  state: { ...state, conflict: { remote: snapshot, local: { ...state.draft } } },
  action: { kind: 'conflict', why } as SyncAction,
});

export const onSnapshot = (
  state: SyncState,
  snapshot: NoteSnapshot,
  pendingLocalPatch: boolean
): { state: SyncState; action: SyncAction } => {
  if (snapshot.pending) {
    // הבסיס שקיבלנו הוא בעצם כתיבה ממתינה שלא יצאה מכאן: מסשן קודם או
    // מלשונית אחרת. מעכשיו לא סומכים עליו עד שהשרת יאשר
    const nothingSentHere = Object.keys(state.sent).length === 0 && state.lastSentRevision === state.base.revision;
    if (!state.unconfirmedBase && !state.conflict && nothingSentHere && sameText(snapshot, state.base)) {
      return { state: { ...state, unconfirmedBase: true }, action: { kind: 'none' } };
    }
    // ההד המקומי של כתיבה שלנו: לא נוגעים
    return { state, action: { kind: 'none' } };
  }

  // התנגשות שעוד לא הוכרעה: רק מעדכנים מה יש בשרת, כדי ש"טען" יטען את העדכני
  if (state.conflict) {
    return { state: { ...state, conflict: { ...state.conflict, remote: snapshot } }, action: { kind: 'none' } };
  }

  if (state.unconfirmedBase) {
    // השרת אישר בדיוק את הבסיס: הכתיבה הממתינה הגיעה
    if (snapshot.revision === state.base.revision && sameText(snapshot, state.base)) {
      return { state: { ...state, unconfirmedBase: false, base: { ...state.base, saveId: snapshot.saveId } }, action: { kind: 'none' } };
    }
    // השרת מחזיק את מה שמוצג, או כתיבה שלנו מאוחרת יותר הגיעה - ובגלל
    // `baseSaveId` היא לא הייתה עוברת אילו הבסיס נדחה
    const ours = state.sent[snapshot.revision];
    if (sameText(snapshot, state.draft) || (ours && sameText(ours, snapshot))) {
      return { state: confirm(state, snapshot, state.draft), action: { kind: 'none' } };
    }
    // משהו אחר: אולי הכתיבה הממתינה נדחתה. בלי בסיס אמין - בחירה
    return toConflict(state, snapshot, { reason: 'unconfirmed', fields: [] });
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
    return { state: restartFrom(state, snapshot, remote), action: { kind: 'adopted' } };
  }

  const result = mergeNote(state.base, state.draft, snapshot, snapshot.templateType);
  if ('merged' in result) {
    const { merged } = result;
    // הכתיבות שיצאו על בסיס ישן יידחו ע"י ה-rules - שוכחים אותן ושולחים מחדש מהבסיס החדש
    return {
      state: restartFrom(state, snapshot, merged),
      action: { kind: sameText(merged, snapshot) ? 'adopted' : 'merged' },
    };
  }

  return toConflict(state, snapshot, result.conflict);
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
      base: { ...text, revision: remote.revision, saveId: remote.saveId },
      draft: text,
      sent: {},
      lastSentRevision: remote.revision,
      lastSentSaveId: remote.saveId,
      unconfirmedBase: false,
      conflict: null,
    },
  };
};
