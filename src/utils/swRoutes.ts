/**
 * נתיבים שה-Service Worker לא מטפל בניווט אליהם (`src/sw.ts`).
 *
 * שרת ה-MCP וה-OAuth (פונקציית `mcp` מאחורי rewrite של Hosting): ניווט ל-
 * `/oauth/authorize` מגיע מ-Claude, ותשובה מה-cache - או timeout של 3
 * שניות שנופל לדף אחר - היה שובר את ההתחברות. הם הולכים ישר לרשת.
 *
 * מסך ההסכמה `/connect` (v1.44.2): תמיד מהרשת, בכל צירוף אותיות (הנתב של
 * האפליקציה לא מבחין בין `/connect` ל-`/Connect`). מה-cache הוא היה מגיע
 * בלי הכותרות של Hosting (`firebase.json`: לא בתוך frame, לא נשמר), והכתובת
 * שלו, עם מזהה הבקשה, הייתה נשמרת ב-`pages-cache`. בלי רשת הוא ממילא לא עובד.
 */
export const SW_NAVIGATION_DENYLIST: RegExp[] = [
  /^\/mcp(?:\/|$)/,
  /^\/oauth\//,
  /^\/\.well-known\//,
  /^\/connect(?:[/?#]|$)/i,
];
