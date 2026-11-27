/**
 * מזין את נתוני הבדיקה הריאליסטיים (`tests/fixtures/realisticHebrew.ts`)
 * ל-emulator, כדי לבדוק כל PR ברוחב 390px על אותו תוכן ארוך (סבב 4).
 *
 * **רק emulator.** לפני כל דבר אחר `assertEmulatorOnly` בודק שהחיבור הוא
 * ל-emulator מקומי ולפרויקט `demo-`, ונכשל אחרת. `firebase-admin` נטען רק אחרי
 * הבדיקה, כך שאין שום חיבור לפני שהיא עוברת.
 *
 * הרצה, כשה-emulator רץ (`firebase emulators:start --only firestore,auth --project demo-notes-4-me`):
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   GCLOUD_PROJECT=demo-notes-4-me npm run seed:emulator
 *
 * ואז האפליקציה: `VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-notes-4-me npm run dev`,
 * והתחברות עם המשתמש שהסקריפט מדפיס.
 *
 * מוחק ויוצר מחדש רק את המשתמש ואת המסמכים של ה-fixture (לפי המזהים שלהם).
 */

import { createRequire } from 'node:module';
import { assertEmulatorOnly } from '../tests/fixtures/emulatorGuard.ts';
import { FIXTURE_CATEGORIES, FIXTURE_USER, fixtureNotes } from '../tests/fixtures/realisticHebrew.ts';

let projectId: string;
try {
  projectId = assertEmulatorOnly(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

// firebase-admin מותקן ב-functions/, לא בשורש
const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = requireFromFunctions('firebase-admin/app');
const { getAuth } = requireFromFunctions('firebase-admin/auth');
const { getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');

const app = initializeApp({ projectId }, 'seed-emulator');
const auth = getAuth(app);
const db = getFirestore(app);
const now = new Date();
const DAY = 24 * 60 * 60 * 1000;

try {
  await auth.deleteUser(FIXTURE_USER.uid);
} catch {
  // לא היה - בסדר
}
await auth.createUser({ ...FIXTURE_USER, emailVerified: true });

const batch = db.batch();
for (const [order, category] of FIXTURE_CATEGORIES.entries()) {
  batch.set(db.doc(`categories/${category.id}`), {
    name: category.name,
    color: category.color,
    icon: category.icon,
    order,
    userId: FIXTURE_USER.uid,
    sharedWith: [],
    isSensitive: false,
    isReadOnly: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}
for (const [order, note] of fixtureNotes(now).entries()) {
  batch.set(db.doc(`notes/${note.id}`), {
    title: note.title,
    content: note.content,
    categoryId: note.categoryId,
    templateType: note.templateType,
    tags: [],
    color: null,
    order,
    userId: FIXTURE_USER.uid,
    sharedWith: [],
    isPinned: note.isPinned === true,
    isArchived: false,
    isSensitive: false,
    isReadOnly: false,
    ...(note.workplanStatus && { workplanStatus: true }),
    updatedBy: FIXTURE_USER.uid,
    revision: 1,
    createdAt: Timestamp.fromMillis(now.getTime() - 30 * DAY),
    updatedAt: Timestamp.fromMillis(now.getTime() - note.updatedDaysAgo * DAY),
  });
}
await batch.commit();

console.log(`Seeded ${FIXTURE_CATEGORIES.length} categories and ${fixtureNotes(now).length} notes into ${projectId}.`);
console.log(`Sign in with ${FIXTURE_USER.email} / ${FIXTURE_USER.password}`);
process.exit(0);
