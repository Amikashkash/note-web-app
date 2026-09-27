/**
 * נתיבים שה-Service Worker לא מטפל בניווט אליהם (`src/sw.ts`).
 *
 * שרת ה-MCP וה-OAuth (פונקציית `mcp` מאחורי rewrite של Hosting): ניווט ל-
 * `/oauth/authorize` מגיע מ-Claude, ותשובה מה-cache - או timeout של 3
 * שניות שנופל לדף אחר - היה שובר את ההתחברות. הם הולכים ישר לרשת.
 */
export const SW_NAVIGATION_DENYLIST: RegExp[] = [/^\/mcp(?:\/|$)/, /^\/oauth\//, /^\/\.well-known\//];
