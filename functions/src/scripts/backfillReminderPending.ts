/**
 * מילוי חד-פעמי של השדה `reminderPending` בפתקים קיימים
 *
 * למה צריך את זה: השאילתה שמאתרת תזכורות שהגיע מועדן מסננת לפי
 * `reminderPending == true`. ב-Firestore, שאילתה על שדה לא מחזירה מסמכים
 * שהשדה כלל לא קיים בהם - ולכן כל פתק שנוצר לפני השינוי הזה יהיה בלתי
 * נראה לפונקציה. הסקריפט נותן לכל הפתקים ערך מפורש.
 *
 * תזכורות שמועדן כבר חלף מסומנות `false` בכוונה. הן הוחמצו ממילא בגלל
 * הבאג הישן, וחימוש שלהן היה מציף את המשתמש בבליץ של התראות ישנות.
 *
 * הרצה:
 *   gcloud auth application-default login
 *   cd functions && npm run backfill
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });

const db = getFirestore();

/** Firestore מגביל כתיבה מרובה ל-500 פעולות ל-batch */
const BATCH_SIZE = 400;

const backfill = async (): Promise<void> => {
  const snapshot = await db.collection('notes').get();
  const now = Timestamp.now();

  let armed = 0;
  let cleared = 0;
  let skipped = 0;
  let batch = db.batch();
  let pendingWrites = 0;

  for (const doc of snapshot.docs) {
    if (doc.get('reminderPending') !== undefined) {
      skipped += 1;
      continue;
    }

    const enabled = doc.get('reminderEnabled') === true;
    const reminderTime = doc.get('reminderTime') as Timestamp | null | undefined;
    const shouldArm = enabled && reminderTime instanceof Timestamp && reminderTime > now;

    batch.update(doc.ref, { reminderPending: shouldArm });
    pendingWrites += 1;

    if (shouldArm) {
      armed += 1;
    } else {
      cleared += 1;
    }

    if (pendingWrites >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }

  console.log(
    `Backfill complete: ${armed} armed, ${cleared} cleared, ${skipped} already had the field.`
  );
};

backfill().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
