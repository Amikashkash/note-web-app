/**
 * הגדרת Vitest לבדיקות היחידה של הפונקציות.
 * הבדיקות יושבות ב-`test/` ולא ב-`src/`, כדי שלא ייבנו ל-`lib/` וייפרסו.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
