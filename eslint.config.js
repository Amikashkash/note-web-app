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
  // `functions/lib` הוא פלט ה-build של הפונקציות (לא בגיט). בלי זה, lint אחרי build נכשל על קוד מתורגם
  { ignores: ['dist', 'dev-dist', 'node_modules', 'functions/lib'] },
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
  },
  ...functionsImportBoundaries()
);

/**
 * גבולות הייבוא בפונקציות הענן (mcp-plan §3.2.7).
 *
 * ה-Admin SDK עוקף את `firestore.rules`, ולכן רק שכבה אחת מחזיקה את
 * `db`: `notesCore/store.ts` (ו-`oauth/store.ts` בעתיד). כל קוד אחר עובר
 * דרך `UserScope`, שבודק בעלות ורגישות במקום אחד.
 *
 * ב-flat config כל בלוק שמגדיר את אותו כלל מחליף את הקודם במלואו, ולכן
 * הבלוקים נבנים כאן מרשימות משותפות במקום לרשת אחד מהשני.
 */
function functionsImportBoundaries() {
  const firestore = [
    { name: 'firebase-admin', message: 'Firestore עובר רק דרך notesCore/store.ts (UserScope).' },
    { name: 'firebase-admin/firestore', message: 'Firestore עובר רק דרך notesCore/store.ts (UserScope).' },
    { name: '@google-cloud/firestore', message: 'Firestore עובר רק דרך notesCore/store.ts (UserScope).' },
  ];
  // זהות מאומתת נוצרת רק ממקום שאימת token. היום אין כזה (שלב 1ב).
  const mint = [
    {
      group: ['**/identity', '**/notesCore'],
      importNames: ['mintVerifiedIdentity'],
      message: 'זהות מאומתת נוצרת רק ב-oauth/verify.ts, אחרי אימות token.',
    },
  ];
  // notesCore לא יודע מה זה MCP או OAuth (mcp-plan §4.2)
  const layers = [
    { group: ['**/mcp/**', '**/oauth/**'], message: 'notesCore לא מייבא מ-mcp/ או מ-oauth/.' },
  ];

  const rule = (paths, patterns) => ({
    'no-restricted-imports': ['error', { paths, patterns }],
  });

  // הקבצים שהחזיקו את Firestore לפני notesCore. לא עוברים דרך UserScope
  // כי הם לא פועלים בשם משתמש (טריגרים, מתזמן, callable עם בדיקות משלו).
  const legacyFirestoreFiles = [
    'functions/src/index.ts',
    'functions/src/noteWritten.ts',
    'functions/src/reminders.ts',
    'functions/src/userLookup.ts',
    'functions/src/versions.ts',
    'functions/src/scripts/**/*.ts',
  ];

  return [
    { files: ['functions/src/**/*.ts'], rules: rule(firestore, mint) },
    { files: ['functions/src/notesCore/**/*.ts'], rules: rule(firestore, [...mint, ...layers]) },
    { files: legacyFirestoreFiles, rules: rule([], mint) },
    { files: ['functions/src/oauth/store.ts'], rules: rule([], mint) },
    { files: ['functions/src/notesCore/store.ts'], rules: rule([], [...mint, ...layers]) },
    { files: ['functions/src/oauth/verify.ts'], rules: rule(firestore, []) },
  ];
}
