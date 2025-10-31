/**
 * טיפוסים הקשורים לפתקים
 */

import { Timestamp } from 'firebase/firestore';

export type TemplateType = 'plain' | 'checklist' | 'recipe' | 'shopping' | 'workplan' | 'accounting' | 'aisummary';

export interface Note {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  templateType: TemplateType;
  tags: string[];
  color: string | null;
  order: number;
  userId: string;
  sharedWith: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPinned: boolean;
  isArchived: boolean;
  archivedAt?: Timestamp;
}

export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'archivedAt'>;
