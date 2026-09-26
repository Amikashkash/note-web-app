/**
 * הגדרת Vitest לבדיקות היחידה של הלקוח
 *
 * קובץ נפרד מ-`vite.config.ts` בכוונה: שם רשום ה-PWA plugin, שבונה
 * Service Worker ואין לו מה לחפש בהרצת בדיקות. מכאן נלקח רק ה-alias.
 *
 * בדיקות ה-rules רצות בנפרד מול ה-emulator - ראה `vitest.rules.config.ts`.
 */

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
