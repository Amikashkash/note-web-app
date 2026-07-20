// @ts-check
/**
 * תצורת ESLint בפורמט flat config (נדרש מגרסה 9).
 * הקובץ הקודם, .eslintrc.cjs, לא נטען יותר ולכן `npm run lint` לא רץ בפועל.
 */

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        __APP_VERSION__: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // משתנים לא בשימוש הם שגיאה, למעט כאלה שמתחילים בקו תחתון -
      // מוסכמה לציון "הושמט בכוונה" (למשל בפירוק אובייקט).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // שימוש ב-`any` מבטל את בדיקות הטיפוסים בדיוק במקומות
      // שבהם הן הכי נחוצות (טיפול בשגיאות, נתונים חיצוניים).
      '@typescript-eslint/no-explicit-any': 'warn',

      // לוגים אמורים לעבור דרך `utils/logger`, שמושתק בפרודקשן
      'no-console': ['warn', { allow: ['error'] }],
    },
  },
  {
    // ה-Service Worker רץ מחוץ לאפליקציה ואין לו גישה ללוגר שלה
    files: ['src/sw.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // הלוגר עצמו הוא העטיפה סביב console
    files: ['src/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // פונקציות הענן הן חבילת Node נפרדת: אין להן DOM, אין להן את הלוגר
    // של האפליקציה, וסקריפטים חד-פעמיים מדפיסים ל-console בכוונה.
    files: ['functions/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  }
);
