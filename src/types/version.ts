/**
 * גרסה קודמת של פתק - נכתבת ע"י הטריגר בענן (`functions/src/versions.ts`)
 *
 * כל גרסה היא מצב הפתק **לפני** שינוי. `authoredBy`/`authoredAt` הם מי
 * כתב את המצב הזה ומתי - זה מה שמוצג בהיסטוריה.
 */

import { Timestamp } from 'firebase/firestore';
import type { TemplateType } from './note';

export type VersionReason = 'archive' | 'template' | 'move' | 'restore' | 'writer' | 'time';

export interface NoteVersion {
  id: string;
  title: string;
  content: string;
  templateType: TemplateType;
  tags: string[];
  color: string | null;
  categoryId: string;
  isArchived: boolean;
  /** מי כתב את המצב השמור; `null` בפתקים מלפני שהשדה נרשם */
  authoredBy: string | null;
  authoredAt: Timestamp | null;
  /** מי החליף אותו */
  replacedBy: string | null;
  reason: VersionReason;
  capturedAt: Timestamp;
}
