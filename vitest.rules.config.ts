/**
 * בדיקות `firestore.rules` מול ה-Firestore Emulator.
 *
 * מורץ דרך `npm run test:rules`, שמרים את ה-emulator, מריץ את הבדיקות
 * ומכבה אותו. פרויקט `demo-*` מבטיח שאף בקשה לא תגיע לפרויקט אמיתי.
 * הבדיקות רצות בטור כי כולן חולקות את אותו מסד במהלך ההרצה.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
