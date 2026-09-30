/**
 * יומן הפעולות של Claude (mcp-plan §6).
 *
 * כל כתיבה דרך MCP נרשמת כאן, **באותו transaction** של הכתיבה: אם הרישום
 * נכשל, הכתיבה נכשלת. אין כתיבה בלי תיעוד.
 *
 * המסמך נקרא רק ע"י הבעלים ("פעילות Claude" בהגדרות) ונכתב רק בשרת.
 * הוא מחזיק את הכותרת ואת סוג הפתק - לא את התוכן - כדי לענות על "מה
 * Claude יצר" בלי לשכפל את הפתק.
 */

/** 180 יום (החלטה ב-mcp-plan §6), דרך TTL על `expiresAt` */
export const AUDIT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

/** מי כתב: המשתמש, דרך איזה חיבור ואיזה tool */
export interface WriteActor {
  uid: string;
  grantId: string;
  clientId: string;
  clientName: string;
  tool: string;
}

export interface NoteCreatedSummary {
  title: string;
  templateType: string;
  categoryId: string;
  categoryName: string;
  itemCount: number;
  reminderCount: number;
}

export type AuditAction =
  | 'note.create'
  | 'checklist_item.update'
  | 'note.append'
  | 'note.replace'
  | 'workplan_section.add'
  | 'workplan_section.append'
  | 'workplan_section.remove'
  | 'note.archive'
  | 'note.unarchive'
  | 'note.move'
  | 'checklist_item.add'
  | 'checklist_item.remove';

export interface AuditEntry {
  uid: string;
  /** למי שייך הפתק. היום זהה ל-`uid` (יצירה ועריכה רק בבעלות) */
  noteOwnerId: string;
  grantId: string;
  clientId: string;
  clientName: string;
  source: 'mcp';
  tool: string;
  action: AuditAction;
  target: { collection: 'notes'; id: string };
  summary: NoteCreatedSummary | NoteEditedSummary;
  /** בעריכה: החלק שהשתנה, לפני ואחרי (mcp-plan §6) */
  changes?: { before: unknown; after: unknown };
}

export interface NoteEditedSummary {
  title: string;
  templateType: string;
  categoryId: string;
  /** תיאור קצר של השינוי, לרשימת "פעילות Claude" */
  description: string;
  revisionBefore: number;
  revisionAfter: number;
}

export const noteEditedEntry = (
  actor: WriteActor,
  noteId: string,
  action: Exclude<AuditAction, 'note.create'>,
  summary: NoteEditedSummary,
  changes: { before: unknown; after: unknown }
): AuditEntry => ({
  uid: actor.uid,
  noteOwnerId: actor.uid,
  grantId: actor.grantId,
  clientId: actor.clientId,
  clientName: actor.clientName,
  source: 'mcp',
  tool: actor.tool,
  action,
  target: { collection: 'notes', id: noteId },
  summary,
  changes,
});

export const noteCreatedEntry = (actor: WriteActor, noteId: string, summary: NoteCreatedSummary): AuditEntry => ({
  uid: actor.uid,
  noteOwnerId: actor.uid,
  grantId: actor.grantId,
  clientId: actor.clientId,
  clientName: actor.clientName,
  source: 'mcp',
  tool: actor.tool,
  action: 'note.create',
  target: { collection: 'notes', id: noteId },
  summary,
});
