/**
 * בדיקות אינטגרציה של הפונקציות מול Firestore Emulator.
 *
 * מורץ מהשורש דרך `npm run test:functions:emulator`, שמרים את ה-emulator
 * (פרויקט demo) ומגדיר `FIRESTORE_EMULATOR_HOST`. הבדיקות קוראות ישירות
 * ל-`handleNoteWritten` - אותו קוד שהטריגר מריץ - עם Admin SDK מחובר ל-emulator.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test-emulator/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
