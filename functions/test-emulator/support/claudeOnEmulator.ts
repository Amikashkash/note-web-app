/**
 * עריכה אמיתית של Claude (`UserScope.editNote`, Admin SDK) מול ה-emulator, לבדיקות
 * שרצות מחוץ ל-functions: `tests/rules` בודק שם את העורך הפתוח באפליקציה
 * (ה-SDK של הלקוח וה-rules) מול כתיבה של Claude באותו מסד. כאן ולא שם,
 * כי `firebase-admin` מותקן רק ב-functions.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentData } from 'firebase-admin/firestore';

export { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { UserScope } from '../../src/notesCore/store';
import { mintVerifiedIdentity } from '../../src/notesCore/identity';
import { buildChecklistItemEdit } from '../../src/mcp/editNote';
import { handleNoteWritten } from '../../src/noteWritten';

const app = initializeApp({ projectId: 'demo-notes-4-me' }, 'claude-on-emulator');
export const adminDb = getFirestore(app);

const ACTOR = { grantId: 'g-test', clientId: 'test-client', clientName: 'Claude', tool: 'update_checklist_item' };

/** Claude מסמן משימה כבוצעה, בדיוק כמו `update_checklist_item` */
export const claudeMarksDone = (uid: string, noteId: string, itemId: string) =>
  UserScope.for(mintVerifiedIdentity(uid), adminDb).editNote(
    noteId,
    buildChecklistItemEdit({ itemId, completed: true }, new Date()),
    ACTOR,
    Date.now()
  );

/** הטריגר (`onNoteWritten`) על השינוי האחרון: כאן - בשביל היסטוריית הגרסאות */
export const runNoteTrigger = async (noteId: string, before: DocumentData) => {
  const after = (await adminDb.doc(`notes/${noteId}`).get()).data();
  await handleNoteWritten({ db: adminDb, noteId, before, after });
};
