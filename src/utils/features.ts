/**
 * דגלי תכונות שנקבעים בזמן build.
 */

/**
 * החיבור ל-Claude (שרת ה-MCP): מסך ההסכמה `/connect` ואזור "אפליקציות
 * מחוברות" בהגדרות. פעיל בפיתוח, ובפרודקשן כש-`VITE_MCP_CONNECT=true`
 * (ה-CI מגדיר אותו). בלי הדגל הם לא נכנסים ל-bundle.
 */
export const MCP_CONNECT_ENABLED = import.meta.env.DEV || import.meta.env.VITE_MCP_CONNECT === 'true';
