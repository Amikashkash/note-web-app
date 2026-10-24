/**
 * הרצה חד-פעמית: 🔴 בתחילת משימה -> `priority: 'urgent'`, בפתקים של משתמש אחד.
 * הכללים עצמם: `emojiPriority.ts`.
 *
 * **לא להריץ על נתונים אמיתיים בלי אישור מפורש של הבעלים** (CLAUDE_GUIDELINES,
 * "Real User Data") - גם לא את ה-dry run, שקורא את הפתקים.
 *
 * - ברירת מחדל: dry run. רק סופר ומדפיס מספרים - לא תוכן, לא כותרות.
 * - `--apply`: כותב. כל פתק ב-transaction משלו, על הגרסה העדכנית שלו:
 *   `revision + 1` (עורך פתוח יזהה את השינוי וימזג), ו-`updatedBy`
 *   `migration:priority` - כותב אחר, ולכן היסטוריית הגרסאות שומרת את המצב
 *   שלפני, ואפשר לשחזר כל פתק משם.
 * - פתק שפתוח עכשיו באפליקציה מדולג ונספר. מריצים שוב אחר כך.
 *
 * הרצה (מ-`functions/`, אחרי `npm run build`):
 *   gcloud auth application-default login
 *   node lib/scripts/migrateEmojiPriority.js --uid <uid>            # dry run
 *   node lib/scripts/migrateEmojiPriority.js --uid <uid> --apply
 */

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { checklistRows } from '../mcp/editNote';
import { migrateEmojiPriority } from './emojiPriority';

/** כמו ב-`UserScope.editNote`: סימון נוכחות שרוענן בדקה האחרונה */
const PRESENCE_TTL_MS = 60_000;

const argValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const run = async (): Promise<void> => {
  const uid = argValue('--uid');
  if (!uid) throw new Error('Give --uid <the owner uid>');
  const apply = process.argv.includes('--apply');

  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  const snapshot = await db.collection('notes').where('userId', '==', uid).where('templateType', '==', 'checklist').get();

  const totals = { notes: 0, tasks: 0, skippedTasks: 0, openInApp: 0, unreadable: 0 };
  for (const doc of snapshot.docs) {
    const rows = checklistRows(String(doc.get('content') ?? ''));
    if (!rows) {
      totals.unreadable += 1;
      continue;
    }
    const preview = migrateEmojiPriority(rows);
    totals.skippedTasks += preview.skipped;
    if (preview.migrated === 0) continue;
    if (!apply) {
      totals.notes += 1;
      totals.tasks += preview.migrated;
      continue;
    }

    const now = Date.now();
    const written = await db.runTransaction(async (tx) => {
      const [fresh, presence] = await Promise.all([tx.get(doc.ref), tx.get(doc.ref.collection('presence'))]);
      const open = presence.docs.some((marker) => {
        const refreshedAt = marker.get('refreshedAt') as Timestamp | undefined;
        return refreshedAt instanceof Timestamp && now - refreshedAt.toMillis() < PRESENCE_TTL_MS;
      });
      if (open) return 'open' as const;
      const freshRows = checklistRows(String(fresh.get('content') ?? ''));
      const result = freshRows ? migrateEmojiPriority(freshRows) : null;
      if (!result || result.migrated === 0) return 0;
      tx.update(doc.ref, {
        content: JSON.stringify(result.rows),
        revision: Number(fresh.get('revision') ?? 0) + 1,
        updatedAt: Timestamp.fromMillis(now),
        updatedBy: 'migration:priority',
      });
      return result.migrated;
    });
    if (written === 'open') totals.openInApp += 1;
    else if (written > 0) {
      totals.notes += 1;
      totals.tasks += written;
    }
  }

  // מספרים בלבד - בלי תוכן, בלי כותרות
  console.log(
    `${apply ? 'Migrated' : 'Dry run - would migrate'}: ${totals.tasks} tasks in ${totals.notes} notes ` +
      `(of ${snapshot.size} checklists). Left as they are: ${totals.skippedTasks} tasks (already have a priority, or only the emoji). ` +
      `Open in the app, skipped: ${totals.openInApp}. Unreadable content: ${totals.unreadable}.`
  );
};

run().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
