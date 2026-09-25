# תכנית: שרת MCP מרוחק לאפליקציית הפתקים

> מסמך תכנון בלבד. שום קוד קיים לא שונה, שום חבילה לא הותקנה ושום דבר לא נפרס.
> תאריך: 2026-09-25 · נכתב מול commit `cffeab1` (v1.20.0)
> **עודכן עם החלטות (2026-09-25):** התשובות לכל 13 השאלות הפתוחות נמצאות בסעיף 9 ושולבו בגוף המסמך. נוספו: DCR בלבד בשלב 1 (בלי CIMD), פתקים רגישים (§3.4), ומודל ה-`items` מ-`architecture-review.md` §11.7 (סעיפים 5 ו-7).

## 0. תקציר

- **מה:** שרת MCP מרוחק, כך ש-Claude (כ-custom connector ב-claude.ai, וגם ב-Claude Desktop, במובייל וב-Claude Code) יוכל לקרוא ולכתוב את הפתקים של המשתמש.
- **איפה:** פונקציית HTTPS חדשה (Cloud Functions v2, `onRequest`) בחבילה הקיימת `functions/`. היא מוגשת מאחורי Firebase Hosting באותו דומיין של האפליקציה.
- **Auth:** שכבת OAuth 2.1 מינימלית שנבנית בתוך ה-Functions. היא משמשת כ-Authorization Server, וההתחברות עצמה נעשית ב-Firebase Auth הקיים דרך מסך הסכמה (consent) חדש ב-SPA.
- **אבטחה:** כל גישה לנתונים עוברת דרך `UserScope` אחד שנבנה רק מתוך token מאומת. לשכבת ה-tools אין גישה ל-`firestore` בכלל.
- **שלבים:** שלב 1 לקריאה בלבד, שלב 2 לכתיבה. לכתיבה יש audit log ו-optimistic concurrency. אין tool למחיקה סופית.

---

## 1. אירוח (Hosting)

### 1.1 הפונקציה

- ב-`functions/src/index.ts` נוסף רק שורת export אחת לפונקציה חדשה, `mcp`. כל הקוד שלה יושב בתיקיות חדשות (ראו סעיף 4). **את `syncNoteReminders` ואת `sendDueReminders` לא נוגעים.**
- `onRequest` מ-`firebase-functions/v2/https`, עם אפליקציית Express קטנה. Express כבר מגיעה כתלות של `firebase-functions`, אבל נוסיף אותה במפורש ל-`package.json`.
- אפשרויות לפונקציה:
  - `region: 'us-central1'`: אותו region כמו הפונקציות הקיימות, ו-Hosting rewrite דורש region ידוע.
  - `memory: '256MiB'`, `timeoutSeconds: 30`.
  - `concurrency: 20`: ב-v2 מופע אחד מטפל בכמה בקשות במקביל.
  - `minInstances`: **החלטה: בלי `minInstances` בהתחלה, ומודדים** (שלב 13 ב-8.3). Claude ממתין 10 שניות לכל היותר ל-discovery, ל-registration ול-token (ו-30 שניות ל-refresh). cold start של Node עם Admin SDK ו-MCP SDK לוקח בדרך כלל 2 עד 5 שניות, כלומר בטווח אבל בלי הרבה מרווח. `minInstances: 1` מבטל את הבעיה ועולה כמה דולרים בחודש. ברירת המחדל שלי: להתחיל עם 0, למדוד ולהחליט.

### 1.2 MCP SDK ו-Transport

- ה-SDK הרשמי ל-TypeScript. **בנקודת הזמן הנוכחית** v2 מפוצל לחבילות (`@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `@modelcontextprotocol/express`) ועדיין מסומן beta/alpha. v1 (`@modelcontextprotocol/sdk`) יציב.
  - **החלטה:** הגרסה ה-**stable** העדכנית בזמן המימוש (לא beta/alpha), **נעולה לגרסה מדויקת** (בלי `^`). אם v2 עדיין לא stable, משתמשים ב-v1.x.
  - בכל מקרה לא להשתמש בעוזרי ה-Authorization Server של ה-SDK (ראו 2.4).
- **Streamable HTTP, stateless:**
  - `StreamableHTTPServerTransport` עם `sessionIdGenerator: undefined`.
  - `McpServer` ו-transport חדשים לכל בקשה. היצירה זולה, ורישום ה-tools הוא סינכרוני.
  - `enableJsonResponse: true`: תשובת JSON רגילה במקום SSE. ב-stateless אין צורך ב-streaming, ו-SSE דרך ה-CDN של Hosting הוא מקור ידוע לבעיות buffering.
  - `GET /mcp` ו-`DELETE /mcp` מחזירים 405, כי אין sessions.
- המשתמש המאומת (`uid`, `clientId`, `scopes`) מועבר ל-tools דרך `authInfo` של ה-transport. ה-tools לא קוראים headers בעצמם.

### 1.3 דומיין ו-routing

**המלצה:** לחשוף הכל תחת דומיין ה-Hosting הקיים (`https://notes-4-me.web.app`, או דומיין מותאם אם קיים) בעזרת rewrites ב-`firebase.json`. ה-rewrites חייבים לבוא **לפני** ה-`"**" → /index.html` הקיים:

| נתיב | יעד |
|---|---|
| `/mcp` | function `mcp` |
| `/.well-known/oauth-protected-resource` + `/.well-known/oauth-protected-resource/mcp` | function `mcp` |
| `/.well-known/oauth-authorization-server` | function `mcp` |
| `/oauth/authorize`, `/oauth/token`, `/oauth/register`, `/oauth/revoke`, `/oauth/decision` | function `mcp` |
| `/connect` (מסך ההסכמה) | ה-SPA, דרך ה-`**` הקיים |

היתרונות:
- origin אחד ל-issuer, ל-resource ולמסך ההסכמה.
- URL קריא שהמשתמש מדביק ב-claude.ai: `https://notes-4-me.web.app/mcp`.
- ה-consent רץ באותו origin שבו המשתמש כבר מחובר ל-Firebase Auth, ולכן אין צורך להתחבר שוב.

**החלטה: `notes-4-me.web.app`**, דרך rewrites ב-Hosting. החלופה שנדחתה: ה-URL הישיר של הפונקציה (`*.run.app`).

דרישות נלוות:
- `Cache-Control: no-store` על כל תשובה של הפונקציה, כדי שה-CDN של Hosting לא ישמור אותה.
- `X-Frame-Options: DENY` ו-`Content-Security-Policy: frame-ancestors 'none'` על `/connect` (הגנה מ-clickjacking), דרך `headers` ב-`firebase.json`.

---

## 2. Auth (החלק החשוב)

### 2.1 איזו גרסת spec

אני עובד לפי **MCP Authorization spec בגרסה `2026-07-28`**. זו הגרסה ש-`modelcontextprotocol.io/specification/latest` מפנה אליה היום. היא מבוססת על OAuth 2.1 (`draft-ietf-oauth-v2-1-13`), RFC 8414, RFC 9728, RFC 8707, RFC 7591, RFC 9207 ו-Client ID Metadata Documents.

השינויים שרלוונטיים לנו לעומת `2025-06-18`:
- **Dynamic Client Registration (DCR) מסומן כ-deprecated.** נשאר MAY לצורכי תאימות.
- **Client ID Metadata Documents (CIMD) הוא SHOULD.**
- **RFC 9207:** מומלץ להחזיר `iss` בתשובת ה-authorization.

במקביל אני עוקב אחרי [תיעוד Claude לחיבורי connectors](https://claude.com/docs/connectors/building/authentication), שמגדיר מה Claude עושה בפועל:
- Claude תומך ב-DCR וגם ב-CIMD. הוא בוחר ב-CIMD רק אם ה-metadata מפרסם `client_id_metadata_document_supported: true` **וגם** `"none"` ב-`token_endpoint_auth_methods_supported`. אחרת הוא נופל ל-DCR.
- Redirect URI לממשקי Claude המתארחים: `https://claude.ai/api/mcp/auth_callback`.
- Claude Code משתמש ב-loopback: `http://localhost:<port>/callback` ו-`http://127.0.0.1:<port>/callback`. נדרשת התאמה שמתעלמת מה-port.
- PKCE `S256` תמיד. חובה לפרסם `code_challenge_methods_supported: ["S256"]`.
- `/token` מקבל `application/x-www-form-urlencoded`. `/register` מקבל JSON.
- Refresh ריאקטיבי אחרי 401, ופרואקטיבי עד 5 דקות לפני התפוגה. עבור public clients חובה לסובב (rotate) refresh tokens. refresh token לא תקף מחזיר `invalid_grant`.
- Claude מוסיף `offline_access` ל-scopes אם ה-AS מפרסם אותו.

**החלטה לשלב 1: DCR בלבד, עם allowlist של redirect URIs. CIMD נדחה.**
- CIMD מחייב את השרת להוריד מסמכים מ-URL שהלקוח שולח. זה משטח SSRF שאין בו צורך כל עוד Claude עובד היטב עם DCR.
- ה-metadata **לא** מפרסם `client_id_metadata_document_supported`, ולכן Claude נופל ל-DCR (כמתועד אצלם).
- **הוספה בהמשך:** מממשים את ההורדה עם ההגנות שתוארו בגרסה הקודמת של המסמך: allowlist של hosts, HTTPS בלבד, timeout של 3 שניות, 5KB, בלי redirects, ובדיקה שה-`client_id` זהה ל-URL. אחר כך מפרסמים `client_id_metadata_document_supported: true`.
- החריגה מה-spec מודעת: DCR הוא MAY ועדיין נתמך, ו-CIMD הוא SHOULD.

### 2.2 הבעיה

Firebase Auth הוא לא OAuth Authorization Server. אין לו `/authorize` או `/token` ללקוחות צד שלישי, אין DCR, ו-ID token שלו מיועד (audience) לפרויקט Firebase ולא ל-MCP server. לפי ה-spec, לשרת MCP **אסור** לקבל tokens שלא הונפקו עבורו (token passthrough). לכן אי אפשר פשוט להעביר ל-Claude את ה-ID token של Firebase.

### 2.3 הפתרון: AS מינימלי שמאציל את ההתחברות ל-Firebase Auth

```
Claude                MCP fn (RS+AS)                  SPA /connect            Firebase Auth
  |  POST /mcp (no token) |                               |                         |
  |<-- 401 WWW-Authenticate: Bearer resource_metadata=... |                         |
  |  GET /.well-known/oauth-protected-resource/mcp        |                         |
  |  GET /.well-known/oauth-authorization-server          |                         |
  |  POST /oauth/register (DCR, redirect allowlist)       |                         |
  |  browser -> GET /oauth/authorize?...&code_challenge&resource&state             |
  |                       |-- validate, store request --> 302 /connect?req=<id>    |
  |                       |                               |-- existing login ------>|
  |                       |                               |<-- ID token ------------|
  |                       |<-- POST /oauth/decision (Bearer <Firebase ID token>, req, approve)
  |                       |-- verifyIdToken(checkRevoked) -> issue code            |
  |                       |--> { redirectTo: callback?code&state&iss }             |
  |<-- browser redirect to https://claude.ai/api/mcp/auth_callback?code=..&state=..&iss=..
  |  POST /oauth/token (code, code_verifier, resource, client_id)                   |
  |<-- { access_token, refresh_token, expires_in, scope }                          |
  |  POST /mcp  Authorization: Bearer <access_token>                               |
```

#### רכיבים

**1. Protected Resource Metadata (RFC 9728).** `GET /.well-known/oauth-protected-resource/mcp`, וגם בלי הסיומת:
```json
{
  "resource": "https://notes-4-me.web.app/mcp",
  "authorization_servers": ["https://notes-4-me.web.app"],
  "scopes_supported": ["notes.read", "notes.write"],
  "bearer_methods_supported": ["header"],
  "resource_name": "Notes 4 Me"
}
```
- `resource` חייב להיות זהה **בדיוק** ל-URL שהמשתמש מזין ב-Claude.
- 401 על `/mcp` מחזיר `WWW-Authenticate: Bearer resource_metadata="https://notes-4-me.web.app/.well-known/oauth-protected-resource/mcp", scope="notes.read notes.write"`.
- ב-Claude, 401 הוא התנאי להתחלת ה-flow. לא שגיאת tool ולא 200.

**2. Authorization Server Metadata (RFC 8414).** `GET /.well-known/oauth-authorization-server`:
```json
{
  "issuer": "https://notes-4-me.web.app",
  "authorization_endpoint": "https://notes-4-me.web.app/oauth/authorize",
  "token_endpoint": "https://notes-4-me.web.app/oauth/token",
  "registration_endpoint": "https://notes-4-me.web.app/oauth/register",
  "revocation_endpoint": "https://notes-4-me.web.app/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "revocation_endpoint_auth_methods_supported": ["none"],
  "scopes_supported": ["notes.read", "notes.write", "offline_access"],
  "authorization_response_iss_parameter_supported": true
}
```

**3. רישום לקוח: DCR בלבד (שלב 1). CIMD נדחה, ראו 2.1.**
- `client_id` בפורמט URL נדחה ב-`/oauth/authorize` עם `invalid_client`. השרת לא מוריד אותו.
- **DCR (RFC 7591):** `POST /oauth/register`.
  - רק `token_endpoint_auth_method: "none"` (public client) ורק `grant_types` של authorization_code ו-refresh_token.
  - **ה-`redirect_uris` מוגבלים ל-allowlist:** `https://claude.ai/api/mcp/auth_callback` ו-loopback (`http://localhost/*`, `http://127.0.0.1/*`).
  - מחזיר `client_id` אקראי.
  - rate limit לכל IP.
  - לקוח שלא הונפק לו token תוך 24 שעות נמחק (Firestore TTL).
  - ההגבלה ל-allowlist מונעת מתוקף לרשום redirect משלו ולגנוב codes דרך מסך הסכמה שנראה לגיטימי.
  - **החלטה: Claude בלבד.** ה-allowlist הוא בדיוק הכתובות של Claude: claude.ai, ו-loopback בשביל Claude Code. לקוחות MCP אחרים לא יכולים להירשם.

**4. `GET /oauth/authorize`**
- מאמת: `response_type=code`, `client_id` ידוע (שנרשם ב-DCR), `redirect_uri` רשום בהתאמה מדויקת (מלבד port ב-loopback), `code_challenge` עם method `S256`, ו-`resource` זהה ל-canonical URI.
- `scope` הוא תת-קבוצה של הנתמכים. `state` לא חובה אבל מועבר הלאה.
- שגיאה ב-`client_id` או ב-`redirect_uri` מוצגת כדף שגיאה בלי redirect (מניעת open redirect). שגיאות אחרות חוזרות ל-redirect_uri עם `error` ו-`iss`.
- שומר בקשה ממתינה `oauthRequests/{reqId}` (TTL של 10 דקות) ומפנה ל-`/connect?req=<reqId>`.

**5. מסך ההסכמה `/connect` (route חדש ב-SPA)**
- משתמש בהתחברות הקיימת. אם המשתמש לא מחובר, מוצג מסך ה-Login הקיים וחוזרים אחריו.
- הדף מבקש מהפונקציה את פרטי הבקשה (`GET /oauth/decision?req=`). התשובה כוללת שם לקוח, **hostname של ה-redirect מוצג בבירור** (דרישת ה-spec), ו-scopes בעברית ("קריאת פתקים", "יצירה ועריכה של פתקים").
  - אם כל ה-redirect_uris של הלקוח הם loopback, מוצגת אזהרה נוספת.
- כפתורי "אשר" ו"דחה". הלחיצה שולחת `POST /oauth/decision` עם `Authorization: Bearer <Firebase ID token>`.
- השרת:
  - מריץ `verifyIdToken(token, checkRevoked=true)`.
  - דורש `auth_time` של פחות מ-24 שעות. אחרת ה-SPA מבקש התחברות מחדש.
  - **בודק את ה-allowlist של משתמשים** (ראו למטה). משתמש שלא ברשימה מקבל "הגישה ל-Claude עדיין לא פתוחה לחשבון שלך", ולא מונפק code.
  - מריץ את ה-decision ב-transaction, פעם אחת לכל `reqId`.
  - מנפיק code ומחזיר JSON עם `redirectTo`. ה-SPA מבצע `window.location.assign`.
- **allowlist של משתמשים (החלטה):**
  - הקוד נכתב נכון לריבוי משתמשים: `UserScope` וכל הבדיקות לפי `uid`.
  - אבל בהתחלה רק החשבון של הבעלים מורשה.
  - הרשימה נשמרת ב-`config/mcp` ב-Firestore (`allowedUids: string[]`, ו-`openToAll: boolean` לפתיחה בעתיד), ולא בריפו הציבורי.
  - rules: `read, write: if false`. עריכה רק מה-console.
  - **fail-closed:** מסמך חסר או ריק פירושו שאף אחד לא מורשה.
  - נבדק גם ב-`/oauth/decision` וגם ב-`requireMcpAuth` (9). הסרה מהרשימה מנתקת מיד.
- **למה POST עם ID token ולא cookie:** אין session cookie בפרויקט. ה-ID token מוכיח זהות, ו-`reqId` חד-פעמי שנשמר בשרת מונע CSRF.

**6. Authorization code**
- 32 בתים אקראיים, base64url.
- נשמר **כ-SHA-256 hash** ב-`oauthCodes/{hash}` יחד עם `uid`, `clientId`, `redirectUri`, `codeChallenge`, `resource`, `scope` ו-`expiresAt` (60 שניות).
- חד-פעמי: נצרך ב-transaction. שימוש חוזר ב-code מבטל את כל ה-grant שנוצר ממנו (לפי OAuth 2.1).

**7. `POST /oauth/token` (form-urlencoded)**
- `grant_type=authorization_code`:
  - בודק `client_id`, `redirect_uri` זהה, `SHA256(code_verifier) == code_challenge`, ו-`resource` זהה.
  - מנפיק access token ו-refresh token.
- `grant_type=refresh_token`:
  - **rotation:** ה-refresh token הישן מסומן `used` וה-token החדש מוחזר באותה תשובה.
  - **reuse detection:** שימוש ב-refresh token שכבר סומן `used` מבטל את כל המשפחה (`grantId`).
  - token לא תקף מחזיר `invalid_grant`.
- זמני חיים (**אושר**): access token לשעה. refresh token ל-30 יום sliding, עם תקרה מוחלטת של 90 יום מההסכמה.
- יעד latency: פחות משנייה. זה 2 עד 3 פעולות Firestore ב-transaction אחד.

**8. Tokens אטומים (opaque) ולא JWT**
- access token הוא 32 בתים אקראיים עם prefix מזהה (`n4m_at_...`, `n4m_rt_...`), כדי ש-secret scanning יזהה אותם אם ידלפו.
- ב-Firestore נשמר רק **SHA-256 hash** (`oauthTokens/{hash}`). דליפה של ה-DB לא חושפת tokens שמישים.
- **למה לא JWT:**
  - revocation מיידי מחייב בדיקה ב-DB בכל מקרה.
  - JWT מחייב מפתח חתימה, ואז צריך secret, rotation וניהול מפתחות.
  - tokens אטומים לא דורשים **שום secret**, וזה מתאים לריפו ציבורי.
- עלות: קריאת Firestore אחת לכל בקשת MCP. **החלטה: אין cache של אימות tokens בזיכרון.** ביטול חייב להיות מיידי, והעלות זניחה בהיקף הזה.

**9. אימות בכל בקשה ל-`/mcp`** (middleware אחד, `requireMcpAuth`)
- `Authorization: Bearer` בלבד. token ב-query string נדחה.
- hash, קריאה של `oauthTokens/{hash}`, ובדיקה של `type == 'access'`, `expiresAt > now`, `revoked == false` ו-**`resource == canonical`** (audience, RFC 8707). אחר כך בדיקה שה-grant לא בוטל.
- `admin.auth().getUser(uid)`, בדיקה ש-`disabled != true`, ובדיקה ש-`tokensValidAfterTime` לא מאוחר מהנפקת ה-grant. כך "התנתק מכל המכשירים" ב-Firebase מבטל גם את Claude. בלי cache (ראו 8).
- בדיקת ה-allowlist של משתמשים (`config/mcp`, ראו 5).
- כשל מחזיר 401 עם `WWW-Authenticate`. חוסר scope מחזיר 403 עם `error="insufficient_scope", scope="notes.write"`.

**10. Revocation**
- `POST /oauth/revoke` (RFC 7009): מבטל token, ועבור refresh token את כל ה-grant. תמיד מחזיר 200.
- **מתוך האפליקציה:** בדף הפרופיל נוסף אזור "אפליקציות מחוברות". הוא מציג את ה-grants של המשתמש (`oauthGrants`, קריא לבעלים) ומאפשר ניתוק דרך `onCall` function חדשה, `revokeMcpGrant`, שמבטלת את ה-grant ואת כל ה-tokens שלו.
- מחיקה או השבתה של משתמש ב-Firebase Auth מבטלת את הגישה כבר בבדיקה של סעיף 9.

**11. Scopes**
- `notes.read` בשלב 1. `notes.write` בשלב 2.
- ה-tools נרשמים תמיד. כל tool מצהיר על ה-scope שהוא דורש, ובדיקה אחת במקום אחד (wrapper, ראו 4.3) מחזירה שגיאה אם חסר.
- `offline_access` מפורסם כדי ש-Claude יבקש refresh token.

#### מבנה Firestore ל-OAuth

כל המסמכים נכתבים רק על ידי Admin SDK.

| collection | מפתח | תוכן עיקרי | TTL |
|---|---|---|---|
| `oauthClients/{clientId}` | אקראי | `clientName`, `redirectUris`, `source: 'dcr'` (בעתיד גם `'cimd'`), `createdAt` | 24 שעות אם לא בשימוש |
| `config/mcp` | קבוע | `allowedUids`, `openToAll` | אין |
| `oauthRequests/{reqId}` | אקראי | פרמטרי authorize, `expiresAt` | 10 דקות |
| `oauthCodes/{sha256}` | hash | `uid`, `clientId`, `grantId`, `codeChallenge`, `redirectUri`, `resource`, `scope`, `used` | 60 שניות (+ TTL לניקוי) |
| `oauthGrants/{grantId}` | אקראי | `uid`, `clientId`, `clientName`, `scope`, `createdAt`, `lastUsedAt`, `revoked` | אין |
| `oauthTokens/{sha256}` | hash | `type`, `grantId`, `uid`, `clientId`, `scope`, `resource`, `expiresAt`, `used`, `revoked` | `expiresAt` |

הניקוי נעשה ב-**Firestore TTL policies** על השדה `expiresAt`. זה מוגדר ב-console או ב-`gcloud` ולא ב-`firestore.indexes.json`, ואין צורך ב-cron.

### 2.4 אפשרויות: לבנות לבד מול ספרייה

| אפשרות | יתרונות | חסרונות |
|---|---|---|
| **A. בנייה עצמית, מינימלית** (מומלץ) | שטח קטן ומובן (בערך 600 עד 900 שורות). התאמה מדויקת ל-Firebase Auth ול-Firestore. אין secrets. אין תלות חיצונית. כל החלטה גלויה בקוד. | אחריות מלאה לנכונות ה-OAuth. דורש סט בדיקות קפדני (סעיף 8). עלינו לעקוב אחרי שינויים ב-spec. |
| **B. עוזרי ה-AS של ה-MCP SDK** (`mcpAuthRouter` + `OAuthServerProvider` עם מימוש Firestore) | מכסה metadata, register, authorize, token ו-revoke עם ולידציה מוכנה, ומוכר ל-Claude. | **ב-v2 הם הוקפאו והועברו ל-`@modelcontextprotocol/server-legacy/auth` כ-deprecated**, וההמלצה הרשמית היא לעבור לספריית OAuth ייעודית. אין תמיכה ב-CIMD וב-`iss`. עבודה על קוד מת. |
| **C. `oidc-provider` (panva)** | מימוש מוסמך ובוגר: DCR, PKCE, Resource Indicators, revocation, rotation. | כבד ומורכב להגדרה. דורש adapter ל-Firestore וחיבור "interaction" ל-Firebase login. גדול מדי לשני scopes ולקוח אחד. מגדיל cold start. |
| **D. IdP חיצוני** (Auth0, WorkOS AuthKit, Descope, Stytch, שחלקם עם תמיכת MCP מובנית) | אין OAuth לתחזק. dashboard, logs ו-MFA. | עלות או מגבלות free tier. ספק נוסף שמחזיק את ה-login. גישור ל-Firebase Auth (federation או custom token) הוא סיבוך בפני עצמו. אלה secrets שצריך לנהל. זהות כפולה. |

**המלצה: A.** הפונקציונליות הנדרשת צרה (לקוח public אחד בפועל, 2 scopes, בלי OIDC, בלי id_token ובלי consent מורכב). אפשר לכתוב אותה בקוד קריא עם בדיקות, ולשמור על אפס secrets. את ה-types וה-Zod schemas של metadata מה-SDK (למשל `OAuthMetadataSchema`, `OAuthClientMetadataSchema`) כדאי להשתמש לולידציה אם הם זמינים ב-`core`.

---

## 3. אבטחה

### 3.1 הבעיה

ה-Admin SDK עוקף את `firestore.rules`. לכן כל שגיאה ב-tool אחד, למשל `get_note` שלא בודק בעלות, היא דליפה של פתקים של משתמש אחר.

### 3.2 הערובה: `UserScope` במקום אחד

1. **רק מודול אחד מחזיק את `db`:** `functions/src/notesCore/store.ts`. ממנו נחשפת רק מחלקה `UserScope`.
2. **`UserScope` נבנה רק מתוך `AuthContext` מאומת.** ה-constructor פרטי. יש factory אחד, `scopeFromAuth(auth)`, וה-middleware של סעיף 2.3.9 הוא היחיד שקורא לו. `uid` לא מגיע אף פעם מקלט של tool.
3. **כל השאילתות נבנות בתוך `UserScope`:**
   - `listAccessibleNotes()` מריץ תמיד שתי שאילתות, `where('userId','==',uid)` ו-`where('sharedWith','array-contains',uid)`, וממזג אותן. זה אותו דפוס כמו `subscribeToNotes` בלקוח.
   - `listAccessibleCategories()` באותו אופן.
   - אין API ציבורי שמקבל query חופשי.
4. **גישה לפי id עוברת בפונקציה אחת:** `loadNoteForUser(noteId, need: 'read' | 'write' | 'owner')`.
   - היא קוראת את המסמך ובודקת `userId == uid || sharedWith.includes(uid)`.
   - עבור `'owner'` היא דורשת `userId == uid`.
   - היא **מחזירה `NotFound` זהה** גם כשהפתק לא קיים וגם כשאין הרשאה, כדי לא לאפשר enumeration.
   - כל פעולת כתיבה משתמשת בה בתוך transaction.
5. **הרשאות ה-MCP הן תת-קבוצה של `firestore.rules`, אף פעם לא יותר.** המיפוי מוגדר בטבלה אחת (`permissions.ts`):
   - `read`: בעלים או שיתוף.
   - `update content/title/pin`: בעלים או שיתוף.
   - `archive`, `move`: **בעלים בלבד** (החלטה). זה מחמיר יותר מה-rules של היום, ויהיה זהה אחרי R-2 ב-review.
   - `create` בקטגוריה: **רק בקטגוריה שבבעלות המשתמש** (החלטה). יצירה בקטגוריה משותפת של מישהו אחר אסורה בינתיים (ראו 5).
   - `isSensitive`: אף פעם לא נכתב מ-MCP (ראו 3.4).
   - `userId`, `sharedWith`: אף פעם לא נכתבים.
   - כל write עובר דרך `sanitizeNotePatch()` עם **allowlist** של שדות, ולא blocklist.
6. **קטגוריית יעד** (ב-`create_note` או ב-`move_note_to_category`) נבדקת ב-`loadCategoryForUser(categoryId, 'owner')`, באותו דפוס. קטגוריה רגישה מחזירה `NotFound` (3.4).
7. **אכיפה סטטית:**
   - כלל ESLint `no-restricted-imports` ב-`functions/` אוסר `firebase-admin/firestore` מחוץ ל-`notesCore/store.ts` ו-`oauth/store.ts`. גם הקבצים הקיימים (`index.ts`) מוחרגים במפורש.
   - ל-`functions/` אין כרגע ESLint. הוספה של config מינימלי היא חלק מהמשימה.
8. **בדיקת רגרסיה גנרית:** test שעובר על **כל tool רשום** (מתוך `listTools`), מריץ אותו עם `noteId` ו-`categoryId` של משתמש זר (על ה-emulator), ומצפה ל-`NotFound`. tool חדש שנוסף מכוסה אוטומטית. **אותה בדיקה רצה גם מול פתק רגיש ומול קטגוריה רגישה** (3.4).

### 3.3 אבטחה נוספת

- **אין secrets בריפו:**
  - tokens אטומים לא דורשים מפתח.
  - אם יידרש secret בעתיד (למשל pepper ל-hash), הוא ייכנס דרך `defineSecret` מ-Secret Manager ולא לקובץ.
  - אין `.env` עם ערכים. `.gitignore` כבר מכסה `*.local` ו-`.env*` (לוודא).
  - ה-config הציבורי של Firebase Web (apiKey וכו') אינו secret.
- **Logging:**
  - לעולם לא לרשום tokens, codes, `code_verifier` או תוכן פתקים ב-`logger`.
  - רק מזהים (`uid`, `noteId`, `clientId`, `grantId`) ושמות tools.
- **Input limits:** כל tool מגדיר Zod schema עם אורכים מקסימליים. `title` עד 50 תווים, כמו `LENGTH_LIMITS.NOTE_TITLE`. טקסט של פריט עד 1000 תווים. `content` מלא עד 100KB.
- **Rate limiting:**
  - מונה לכל `uid` ב-Firestore (או בזיכרון המופע, כהגנה בסיסית). למשל 60 כתיבות בדקה.
  - ל-`/oauth/register` ול-`/oauth/authorize` מונה לכל IP.
- **Prompt injection:** תוכן פתקים משותפים מגיע ממשתמשים אחרים. ה-tools מחזירים אותו כ-data, בתוך מבנה JSON ברור עם השדה `sharedBy`. אין לתת לתוכן להשפיע על הרשאות. ההרשאות נקבעות רק לפי ה-token. זו עוד סיבה לא לספק tool של hard delete.
- **Tool annotations:** `readOnlyHint: true` לכל tools הקריאה, ו-`destructiveHint: false` / `idempotentHint` בהתאם לכתיבה. כך Claude יכול לבקש אישור לפני כתיבות.
- **CORS:** לא נדרש ל-`/mcp`, כי Claude קורא מצד השרת. `/oauth/decision` מקבל רק מה-origin של האפליקציה.

---

### 3.4 פתקים רגישים: בלתי נראים ל-MCP

ההגדרה המלאה של התכונה והצד של האפליקציה נמצאים ב-`architecture-review.md` §12 (צעד C6).

- **רגישות אפקטיבית** = `note.isSensitive || category(note.categoryId).isSensitive`.
  - הקטגוריה נקראת בזמן הבקשה. לכן פתק שנוסף לקטגוריה רגישה אחרי שסומנה מוסתר גם הוא.
- **בלתי נראה, לא "קריאה בלבד":**
  - פתקים רגישים לא מופיעים ב-`list_notes`, ב-`search_notes` ולא נספרים ב-`noteCount`.
  - קטגוריות רגישות לא מופיעות ב-`list_categories`.
  - גישה ישירה לפי מזהה (`get_note` וכל tool כתיבה) מחזירה את **אותו `NotFound`** כמו פתק של משתמש זר. אין דרך להבחין ש"יש כאן משהו מוסתר".
  - קטגוריה רגישה כיעד ל-`create_note` או ל-`move_note_to_category` מחזירה גם היא `NotFound`.
- **נאכף במקום אחד: `UserScope`.**
  - `listAccessibleNotes`, `listAccessibleCategories`, `loadNoteForUser` ו-`loadCategoryForUser` מסננים דרך פונקציה אחת, `isVisibleToMcp(note, categoriesById)`.
  - אף tool לא בודק רגישות בעצמו, ואין tool שיכול לעקוף.
  - החיפוש רץ רק על מה ש-`listAccessibleNotes` מחזיר, כך שלא יכולה לזלוג התאמה בטקסט של פתק רגיש.
- **פתק משותף:** הדגל של הבעלים חל על כל משתמש.
  - `UserScope` רץ עם Admin SDK ולכן טוען את הקטגוריה של **הבעלים** לפי `categoryId`, גם כשהיא לא משותפת עם המשתמש המבקש.
- **fail-closed:**
  - פתק שהקטגוריה שלו לא נמצאת (נמחקה, או מזהה שבור) נחשב רגיש ומוסתר.
  - עדיף שפתק יתום לא יהיה נגיש ל-Claude, מאשר שפתק מקטגוריה רגישה שנמחקה יחשף.
- **אין שום tool שמשנה `isSensitive`.** השדה לא ב-allowlist של `sanitizeNotePatch`. הוא נקבע רק באפליקציה, על ידי הבעלים, ונאכף ב-`firestore.rules` (review §12.2).
- **Audit log:** אין רשומות על פתקים רגישים, כי אין גישה אליהם. אם פתק הפך לרגיש אחרי שנכתב, רשומות ה-audit הקודמות נשארות (הן של הבעלים, לא נחשפות ל-MCP).
- **בדיקות** (בנוסף ל-3.2.8), כל אחת כפי שהמשתמש המבקש רואה אותה:
  - פתק עם דגל משלו.
  - פתק בקטגוריה רגישה.
  - פתק שנוסף לקטגוריה רגישה **אחרי** הסימון.
  - פתק משותף שהקטגוריה של הבעלים שלו רגישה, מנקודת המבט של המשתמש שאיתו שותף.
  - קטגוריה רגישה ב-`list_categories`.
  - חיפוש של מילה שמופיעה רק בפתק רגיש: אפס תוצאות.
  - פתק עם `categoryId` שבור: מוסתר.

## 4. ארכיטקטורה

### 4.1 שכבות

```
functions/src/
  index.ts                 ← קיים. תוספת אחת: export { mcp } from './mcp/http';
  recurrence.ts, timezone.ts  ← קיימים, נקראים גם משכבת הנתונים (לולידציה בלבד)
  notesCore/               ← שכבת נתונים. לא יודעת מה זה MCP
    store.ts               ← UserScope: הקובץ היחיד שמחזיק את db של notes/categories
    permissions.ts         ← טבלת ההרשאות (סעיף 3.2.5)
    model.ts               ← Note / Category / NoteSummary (בלי תלות ב-Firestore Timestamp; ISO strings)
    mappers.ts             ← נרמול מסמכים (מראה של src/services/api/mappers.ts)
    content/               ← codecs לתוכן התבניות
      index.ts             ← parseContent(note) / serializeContent(type, value): dispatch לפי templateType + shape detection
      checklist.ts shopping.ts workplan.ts accounting.ts recipe.ts plain.ts
      render.ts            ← תוכן לטקסט קריא ל-LLM (מראה של utils/backupFormat.ts)
    search.ts              ← חיפוש בזיכרון (מראה של src/utils/search.ts)
    audit.ts               ← writeAudit(tx, entry)
    errors.ts              ← NotFound / Forbidden / Conflict / Invalid: שגיאות דומיין
  oauth/                   ← Authorization Server
    metadata.ts authorize.ts decision.ts token.ts register.ts revoke.ts   (cimd.ts - נדחה, 2.1)
    tokens.ts              ← יצירה, hash ואימות
    store.ts               ← גישה ל-collections של oauth*
    verify.ts              ← requireMcpAuth middleware → AuthContext
  mcp/                     ← שכבה דקה
    http.ts                ← Express app + onRequest + routing
    server.ts              ← createMcpServer(scope, auth): רושם tools
    tools/                 ← קובץ לכל tool: Zod input, קריאה ל-UserScope, עיצוב פלט
    defineTool.ts          ← wrapper: בדיקת scope, מיפוי שגיאות דומיין לשגיאות MCP, logging
```

### 4.2 עקרונות

- **`notesCore` לא מייבא כלום מ-`mcp/` או מ-`oauth/`.** הוא מקבל `UserScope` ומחזיר אובייקטים פשוטים. אפשר להעביר אותו כמו שהוא לפרויקט עתידי (API רגיל, bot וכו'), ובהמשך לחבילה משותפת (`packages/notes-core`) שגם ה-SPA משתמש בה.
- **Codecs לתוכן** מטפלים בכל פורמטי ה-JSON הקיימים:
  - checklist: `{id,text,completed,dueDate?,dueTime?,repeat?}[]`
  - shopping: `{id,name,quantity?,checked}[]`
  - workplan: `{id,header,content}[]`
  - accounting: `{id,description,amount,date}[]`
  - recipe: `{ingredients[], instructions[]|steps[], servings?, prepTime?, cookTime?}`
  - plain: טקסט חופשי

  כמו ב-`backupFormat.ts`, ה-dispatch הוא לפי `templateType`, עם fallback ל-shape detection. תוכן לא מזוהה נשמר ומוחזר כמו שהוא ולא נזרק.
  - **כתיבה:** ה-codec **שומר שדות לא מוכרים** בכל פריט (למשל `category` ישן ברשימת קניות). המשמעות היא עדכון ממוזג לפריט הקיים ולא בנייה מחדש, כדי לא למחוק מידע של גרסאות אחרות.
- **מראות (mirrors):**
  - `functions/` היא חבילה נפרדת ולא יכולה לייבא מ-`src/`, בדיוק כמו `reminderPayload.ts` היום.
  - כל מראה מסומן בהערה שמפנה למקור.
  - **החלטה: מראות מתועדות עכשיו, בלי חבילה משותפת.** כל קובץ מראה מפנה בהערה לקובץ המקור ב-`src/` (למשל `src/utils/templateContent.ts`), ושינוי באחד מחייב שינוי בשני. חבילה משותפת נשקלת רק אם המראות יתחילו להתפצל בפועל.
- **`ChecklistItem` מוגדר היום פעמיים** (בלקוח וב-`functions/src/index.ts`). ה-codec החדש לא נוגע ב-`index.ts`. הוא מגדיר type משלו שתואם את שניהם.

### 4.3 `defineTool`

```ts
defineTool({
  name: 'get_note',
  scope: 'notes.read',
  annotations: { readOnlyHint: true },
  input: z.object({ noteId: z.string().min(1).max(128) }),
  run: (user: UserScope, input) => user.getNote(input.noteId),
});
```

ה-wrapper עושה את כל אלה במקום אחד, ולכן כל tool הוא בערך 15 שורות:
- בודק scope.
- ממפה `NotFound` ל-tool error בטקסט "הפתק לא נמצא", ו-`Conflict` להודעה שמורה ל-Claude לקרוא מחדש.
- רושם לוג.
- מחזיר גם `structuredContent` (עם `outputSchema`) וגם `content` טקסטואלי קצר.

---

## 5. Tools

כל ה-tools מחזירים מזהים, כדי ש-Claude ישרשר קריאות. תאריכים ב-ISO. שדה `access: 'owner' | 'shared'` בכל פתק. פתקים וקטגוריות רגישים לא קיימים מבחינת ה-tools (3.4).

**מודל התוכן:** הכתיבות בנויות על מודל ה-`items` מ-`architecture-review.md` §11.7.
- **תבניות רשימה** (checklist, shopping, workplan, accounting): `items` כ-map במסמך הפתק, עם `contentFormat: 2`. כל שינוי פריט הוא כתיבת field-path (`items.<id>.<field>`). מחיקה היא tombstone. הסדר לפי `pos`.
- **טקסט חופשי:** מחרוזת עם `revision`.
- הקריאה עוברת דרך ה-codec, שקורא גם את הפורמט הישן (`content` כ-JSON) וגם את החדש. לכן שלב 1 (קריאה) לא תלוי במיגרציה, ושלב 2 (כתיבה) תלוי בה (צעדים D4 ו-E1 ב-review).

### שלב 1: קריאה בלבד (`notes.read`)

| Tool | קלט | פלט | הערות |
|---|---|---|---|
| `list_categories` | – | `[{id,name,color,icon,order,access,noteCount}]` | owned ו-shared ממוזגים וממוינים לפי `order`. כולל קטגוריה וירטואלית "משותף איתי ללא קטגוריה" לפתקים שה-`categoryId` שלהם לא נגיש (תואם ל-v1.18.0). |
| `list_notes` | `categoryId?`, `pinned?`, `archived?` (ברירת מחדל false), `limit?` (עד 100), `cursor?` | `[{id,title,templateType,categoryId,isPinned,isArchived,updatedAt,access,preview}]` | `preview` הוא עד 200 תווים מטקסט מרונדר. בלי תוכן מלא. **`archived: true` מחזיר רק פתקים בבעלות**, כמו `subscribeToArchivedNotes`. |
| `search_notes` | `query`, `categoryId?`, `includeArchived?`, `limit?` | כמו `list_notes` + `matchedIn: ('title'\|'content'\|'tags')[]` | חיפוש בזיכרון על הפתקים הנגישים. אין full-text ב-Firestore. בהיקף אישי (מאות פתקים) זה זול. החיפוש הוא על **טקסט מרונדר**, כלומר ב-JSON של checklist מחפשים ב-`text` ולא ב-keys. |
| `get_note` | `noteId` | `{...metadata, revision, content: {type, raw, parsed, text}}` | `parsed` הוא המבנה המפוענח (למשל פריטי checklist עם `id`). `text` הוא Markdown קריא. `revision` נדרש לכתיבה (סעיף 7). |

### שלב 2: כתיבה (`notes.write`)

| Tool | קלט | התנהגות |
|---|---|---|
| `create_note` | `categoryId`, `title`, `templateType` (ברירת מחדל `plain`), `text?` או `items?` | בונה את התוכן דרך ה-codec (תבנית רשימה נכתבת ישר כ-`items` עם `contentFormat: 2`). `userId=uid`, `sharedWith: []`, `isPinned:false`, `isArchived:false`, `isSensitive:false`, `isEmpty` מחושב, `revision: 1`, `updatedBy: 'mcp:<clientId>'`, `pos`/`order` בסוף הקטגוריה, `tags: []`, `color: null`, ו-`createdAt`/`updatedAt` מהשרת. **קטגוריית היעד חייבת להיות בבעלות המשתמש** (החלטה). קטגוריה משותפת של מישהו אחר אסורה בינתיים. |
| `add_checklist_item` | `noteId`, `text`, `dueDate?` (`YYYY-MM-DD`), `dueTime?` (`HH:MM`), `repeat?` (`daily\|weekly\|monthly\|yearly`) | רק ל-`templateType == 'checklist'` (או תוכן שזוהה כ-checklist). `id = Date.now().toString()`, כמו בלקוח, עם הגנה מהתנגשות. ולידציה: `repeat` דורש `dueDate` ו-`dueTime` (כך בממשק). התאריך נבדק עם `localDateTimeToDate`. **כתיבת שדה אחת:** `items.<newId> = {...}` + `revision: increment(1)` + `updatedBy`, בתוך ה-transaction של ה-tool (בשביל `loadNoteForUser` וה-audit). אין קריאה-שינוי-כתיבה של רשימה, ואין `expectedRevision`. פתק בפורמט הישן מומר ל-`items` באותה transaction (מיגרציה עצלה, review E1). הטריגר הקיים `syncNoteReminders` רואה את הכתיבה ויוצר תזכורת, **בלי שום שינוי בו**. פלט: `{noteId,itemId,revision,reminderScheduled: boolean, remindAt?}`. |
| `update_note` | `noteId`, `expectedRevision?`, ואחד או יותר מ: `title`, `text` (plain), `itemPatches` (`[{itemId, text?, completed?, dueDate?, dueTime?, repeat?\|null, deleted?}]`), `isPinned` | **`itemPatches`**: כתיבות field-path ל-`items.<id>.<field>`, ומחיקה כ-tombstone. לא דורש `expectedRevision`, ולא נוגע בפריטים אחרים או בשדות לא מוכרים. **`text`** (plain): דורש `expectedRevision`, שנבדק ב-transaction בצד השרת, כי Admin SDK עוקף את ה-rule (7.2). אי-התאמה מחזירה `Conflict`. **`title`**: last-write-wins. אין "החלפת כל הרשימה". |
| `move_note_to_category` | `noteId`, `categoryId` | **בעלים בלבד** (החלטה). היעד חייב להיות קטגוריה **בבעלות המשתמש** ולא רגישה (אותו כלל כמו ב-`create_note`). מעדכן `categoryId` ו-`pos` (סוף הקטגוריה). **לא** משנה `sharedWith`, עד להחלטת SH-3 ב-review. |
| `archive_note` | `noteId` | `isArchived:true`, `archivedAt: serverTimestamp()`, כמו `archiveNote` בלקוח. הטריגר מוחק את התזכורות. בעלים בלבד. אפשר לשחזר מהאפליקציה. |

**אין `delete_note` ואין שום נתיב קוד שקורא ל-`.delete()` על notes או categories.** בדיקה סטטית ב-CI: grep על `notesCore/` שנכשל אם יש `delete(`.

**שקול להוסיף בהמשך:** `complete_checklist_item` (קיצור נפוץ), `unarchive_note`, ו-`list_upcoming_reminders` (קריאה מ-`reminders` לפי `userId`).

---

## 6. Audit log

- collection חדש, `auditLog/{autoId}`, שנכתב **באותו transaction** של הכתיבה עצמה. אם ה-audit נכשל, הכתיבה נכשלת. אין כתיבה בלי תיעוד.
- מבנה:
```ts
{
  uid, clientId, grantId,            // מי (המשתמש + דרך איזה חיבור)
  source: 'mcp',
  tool: 'add_checklist_item',
  at: serverTimestamp(),             // מתי
  target: { collection: 'notes', id },
  noteOwnerId,                       // למי שייך הפתק (שונה מ-uid בשיתוף)
  changes: {                         // מה השתנה
    fields: ['content', 'updatedAt'],
    before: { content: '<previous JSON string>', title?, categoryId?, isArchived?, ... },
    after:  { content: '<new JSON string>', ... },
  },
  summary: 'נוספה משימה "לקנות חלב" (יעד 2026-09-26 09:00)',
  revisionBefore, revisionAfter,
  expiresAt                          // TTL: 180 יום (החלטה)
}
```
- **ערך קודם מלא** נשמר עבור השדות שהשתנו בלבד. זה מאפשר שחזור ידני ובעתיד tool של `undo_last_change`. גודל מסמך ב-Firestore מוגבל ל-1MB, ולכן לתוכן גדול מ-400KB נשמר hash ו-diff ברמת פריט.
- **הרשאה:**
  - `read` לבעלים (`resource.data.uid == request.auth.uid` או `noteOwnerId == request.auth.uid`). הבעלים יכולים לראות מה Claude של שותף עשה בפתק שלהם.
  - `write: if false`.
- אופציונלי: מסך "פעילות Claude" באפליקציה. לא חלק מהתכנית הזו.

---

## 7. Concurrency

> **עודכן:** הסעיף נבנה עכשיו על מודל ה-`items` מ-`architecture-review.md` §11.7, ולא על merge של מחרוזת JSON. הגרסה הקודמת הציעה `runTransaction` בלקוח, שלא עובד offline, ולכן נדחתה.

### 7.1 המצב היום

- `NoteView` מחזיק טיוטה מקומית ו**מסתנכרן לפי מזהה הפתק בלבד**, וכל שינוי שולח את **כל מחרוזת ה-`content`** (C-1 ב-review).
  - A1 עד A3 (v1.20.1 עד v1.20.3) תיקנו את אובדן העדכונים ב-debounce, את דריסת תוכן שלא פוענח ואת ההוספה מדף השיתוף. **את הדריסה של הטיוטה המלאה הם לא תיקנו.**
- **תרחיש האובדן** נשאר:
  1. המשתמש פותח פתק checklist.
  2. Claude מוסיף משימה.
  3. המשתמש מסמן V על משימה אחרת.
  4. הטיוטה הישנה נכתבת, והמשימה של Claude נמחקת.

### 7.2 צד השרת (בשליטת ה-MCP)

1. **כל write של MCP רץ ב-`runTransaction` בצד השרת**, דרך שכבת הכתיבה של `notesCore`. זה המקום היחיד שכותב. בתוכו:
   - `loadNoteForUser` (הרשאה + רגישות).
   - הכתיבה.
   - רשומת ה-audit.
2. **תבניות רשימה:** כתיבות field-path ל-`items.<id>.<field>` + `revision: increment(1)` + `updatedBy: 'mcp:<clientId>'`.
   - כתיבה כזו לא דורסת פריטים אחרים, ולא מתנגשת עם כתיבות של הלקוח לפריטים אחרים. גם כתיבות offline שמגיעות מאוחר יותר מתמזגות ברמת השדה.
3. **טקסט חופשי: בדיקת `revision` בתוך ה-transaction של השרת.**
   - ה-Admin SDK **עוקף את `firestore.rules`**, ולכן ה-rule של `revision == old + 1` (review §11.7ב) לא חל על MCP.
   - השרת אוכף את אותו כלל בעצמו: `expectedRevision` חייב להיות שווה ל-`revision` הנוכחי, והכתיבה היא `revision + 1`. אחרת `Conflict`, עם ההודעה "הפתק השתנה מאז שקראת אותו - קרא שוב עם get_note".
   - ראו review §11.7ד.
4. **פתק בפורמט הישן** (`contentFormat` חסר): מומר ל-`items` באותה transaction, לפני הכתיבה.
5. **Presence (`editingUntil`): לא בתכנית.** עם כתיבות ברמת שדה אין בו צורך. נשקל מחדש רק אם יתגלו התנגשויות בטקסט חופשי.

### 7.3 צד הלקוח: תנאי מוקדם לשלב 2 (החלטה)

שלב 2 (כתיבה) לא נפתח לפני ש**צעדים E1, E2 ו-E2b ב-review** נמצאים ב-production:
- **E1:** הלקוח כותב field-path לתבניות רשימה, ו-`NoteView` מציג את ה-snapshot החי.
- **E2:** rule של `revision` + `draftJournal` + "שמירת שתי הגרסאות" לטקסט חופשי.
- **E2b:** offline persistence.
- **תנאי מקדים שלהם:** D4 (`contentFormat: 2` + `minClientVersion`).

**המלצה:** שלב 1 לא תלוי בזה, כי אין בו כתיבה והקריאה עוברת דרך codec שמכיר את שני הפורמטים. שלב 2 מחכה ל-E, בלי חריגים. הגרסה הקודמת הציעה לשחרר את `add_checklist_item` מוקדם, וזה בוטל.

---

## 8. Firestore rules, indexes, סדר מימוש ובדיקות

### 8.1 שינויים ב-`firestore.rules`

```
// OAuth: שרת בלבד
match /oauthClients/{id}   { allow read, write: if false; }
match /oauthRequests/{id}  { allow read, write: if false; }
match /oauthCodes/{id}     { allow read, write: if false; }
match /oauthTokens/{id}    { allow read, write: if false; }
match /oauthGrants/{id} {
  allow read: if isOwner(resource.data.uid);   // לרשימת "אפליקציות מחוברות"
  allow write: if false;                        // ביטול רק דרך callable
}
match /auditLog/{id} {
  allow read: if isOwner(resource.data.uid) || isOwner(resource.data.noteOwnerId);
  allow write: if false;
}
// allowlist של משתמשים (2.3.5): נערך רק מה-console
match /config/{id}         { allow read, write: if false; }
```
- **`isSensitive`:** הכללים ב-`notes` וב-`categories` (רק הבעלים משנה את הדגל, ושותף לא משנה `categoryId`) הם חלק מצעד C6 ב-review (§12.2), ונפרסים לפני שלב 1 ולא כאן.
- `allow ... if false` הוא ברירת המחדל ב-Firestore. הכללים נכתבים במפורש לתיעוד, כמו `reminders`.
- **notes:** אם 7.3 יתווסף, שותף ששולח `revision` צריך להיות מותר. `ownershipUnchanged()` כבר מתיר כל שדה חוץ מבעלות, ולכן אין שינוי נדרש. אפשר להוסיף `request.resource.data.get('revision',0) >= resource.data.get('revision',0)` כהגנה.

### 8.2 Indexes

| collection | שדות | עבור |
|---|---|---|
| `notes` | `userId ASC, isArchived ASC` | `list_notes` מאורכבים. **ייתכן שכבר נוצר אוטומטית** מ-`subscribeToArchivedNotes` (equality בלבד עובד עם single-field indexes). לבדוק. |
| `notes` | `sharedWith CONTAINS, categoryId ASC` | סינון shared לפי קטגוריה, אם נסנן בשאילתה ולא בזיכרון. |
| `oauthGrants` | `uid ASC, createdAt DESC` | רשימת החיבורים בפרופיל |
| `oauthTokens` | `grantId ASC` (single-field, קיים אוטומטית) | ביטול משפחה |
| `auditLog` | `uid ASC, at DESC` ; `target.id ASC, at DESC` | צפייה והיסטוריה לפתק |

- **המלצה:** `list_notes` ו-`search_notes` שולפים את כל הפתקים הנגישים (שתי שאילתות equality) ומסננים בזיכרון. זה חוסך את רוב ה-indexes ותואם לדפוס הקיים. להוסיף indexes רק לפי מדידה.
- **TTL policies** (מחוץ ל-`firestore.indexes.json`, דרך `gcloud firestore fields ttls update`) על `expiresAt` ב-`oauthRequests`, `oauthCodes`, `oauthTokens`, `oauthClients` ו-`auditLog`.

### 8.3 סדר מימוש

כל שלב נכנס ב-commit נפרד עם העלאת גרסה ורשומה ב-WhatsNew, לפי `CLAUDE_GUIDELINES.md`. **החלטה (שאלה 12): branch ו-PR לכל שלב (0, 1א, 1ב, 1ג, 2). הבעלים עושה review לפני merge.** אין דחיפה ישירה ל-`main`.

**שלב 0: תשתית (בלי השפעה על משתמשים)**
1. ESLint מינימלי ל-`functions/` + כלל `no-restricted-imports` (3.2.7).
2. תשתית בדיקות ל-`functions/`: `vitest` + Firebase Emulator Suite (Firestore ו-Auth). `npm run test` ב-`functions/`.
3. `notesCore/content/*` + `render.ts` + בדיקות יחידה על דוגמאות מכל תבנית, כולל תוכן "לא תואם לסוג" ושדות לא מוכרים שנשמרים.

**שלב 1א: שכבת נתונים לקריאה**
4. `notesCore/store.ts` (`UserScope`, `loadNoteForUser`, `listAccessible*`, `isVisibleToMcp`), `permissions.ts`, `search.ts`. **תלוי ב-C6 ב-review** (השדה `isSensitive` קיים והבעלים יכול לסמן לפני שהשרת עולה).
5. בדיקות emulator: משתמש A, משתמש B, פתק משותף, קטגוריה משותפת, פתק זר.

**שלב 1ב: OAuth**
6. `oauth/tokens.ts`, `oauth/store.ts`, metadata endpoints.
7. `register` (DCR עם allowlist של redirect URIs של Claude). בלי CIMD (2.1). `config/mcp` עם allowlist של משתמשים (החשבון של הבעלים בלבד).
8. `authorize`, `decision`, route `/connect` ב-SPA (מסך הסכמה בסגנון העיצוב הקיים).
9. `token` (code + refresh rotation + reuse detection), `revoke`, `verify.ts`.
10. Firestore rules (8.1) ו-TTL policies.

**שלב 1ג: MCP קריאה**
11. `mcp/http.ts`, `server.ts`, `defineTool.ts`, ו-4 tools הקריאה.
12. rewrites ב-`firebase.json`. פריסה: `firebase deploy --only functions:mcp,hosting,firestore:rules`, **לא** `--only functions` כולו, כדי לא לגעת בפונקציות הקיימות מעבר לנדרש.
13. חיבור אמיתי מ-claude.ai (Settings → Connectors → Add custom connector), ובנוסף מ-Claude Code (`claude mcp add --transport http notes https://.../mcp`) לבדיקת loopback.
14. "אפליקציות מחוברות" בפרופיל + `revokeMcpGrant` callable.

**שלב 2: כתיבה**
15. **תנאי מקדים:** review D4, E1, E2 ו-E2b ב-production (7.3). לא חלק מה-branch של MCP.
16. `audit.ts` + rules ל-`auditLog`.
17. `add_checklist_item` → בדיקה שהתזכורת נוצרת ונשלחת.
18. `create_note`, `update_note`, `move_note_to_category`, `archive_note`.
19. rate limiting לכתיבות.

### 8.4 תכנית בדיקות

**יחידה (ללא emulator)**
- Codecs: round-trip לכל תבנית. שמירת שדות לא מוכרים. `steps` מול `instructions`. JSON פגום נשאר כמו שהוא.
- PKCE: וקטורים מ-RFC 7636 (appendix B).
- התאמת redirect_uri: exact, loopback עם port שונה מותר, `http://localhost.evil.com` נדחה, `https://claude.ai.evil.com` נדחה, fragment נדחה.
- ולידציה של `dueDate`, `dueTime` ו-`repeat`.

**אינטגרציה (emulator)**
- **הרשאות (החשוב ביותר):**
  - הבדיקה הגנרית "כל tool × פתק זר → NotFound" (3.2.8), **וגם "כל tool × פתק רגיש / קטגוריה רגישה → NotFound"** (3.4).
  - allowlist של משתמשים: משתמש שלא ברשימה לא מקבל code, ו-token קיים שלו נדחה אחרי הסרה מהרשימה.
  - שותף יכול לקרוא ולעדכן תוכן, אבל לא לארכב או להעביר.
  - אף tool לא משנה `userId` או `sharedWith` (בדיקה על המסמך אחרי כל tool).
- **OAuth flow מלא** בלי דפדפן: register → authorize → decision (עם ID token מ-Auth emulator) → token → `/mcp` → refresh → revoke → 401.
- **שליליות:**
  - code שני בשימוש חוזר מבטל את ה-grant.
  - refresh token ישן בשימוש חוזר מבטל את המשפחה.
  - `resource` שגוי נדחה.
  - `code_verifier` שגוי נדחה.
  - token שפג נדחה.
  - משתמש disabled נדחה.
  - `tokensValidAfterTime` אחרי ה-grant נדחה.
  - token ב-query string נדחה.
  - 401 כולל `WWW-Authenticate` נכון.
- **Concurrency:**
  - שתי קריאות `add_checklist_item` במקביל → שני הפריטים קיימים.
  - `update_note` עם `expectedRevision` ישן → `Conflict`.
  - סימולציה של כתיבת לקוח בין `get_note` ל-`update_note`.
- **Audit:** כל tool כתיבה מייצר רשומה אחת עם `before`/`after` נכונים. כשל מלאכותי ב-audit → הפתק לא השתנה.
- **תזכורות:** `add_checklist_item` עם תאריך עתידי → מסמך ב-`reminders` עם `remindAt` נכון (Asia/Jerusalem). עם `repeat` → `baseDate` ו-`baseTime`.

**Conformance**
- הרצת **MCP Inspector** (`npx @modelcontextprotocol/inspector`) מול ה-emulator, כולל ה-OAuth flow שלו.

**ידני (production)**
- חיבור מ-claude.ai web ומהמובייל, וקריאת פתקים בעברית (RTL, אמוג'י).
- "הוסף משימה לרשימת הקניות למחר ב-9 בבוקר" → push מגיע.
- פתק פתוח בעריכה בטלפון, ובמקביל Claude מוסיף משימה → אחרי 7.3 שני השינויים נשמרים.
- ניתוק מהפרופיל → Claude מקבל 401 ומבקש התחברות מחדש.
- מדידת cold start של `/oauth/token` (יעד פחות מ-5 שניות) → החלטה על `minInstances`.

---

## 9. החלטות (היו שאלות פתוחות)

| # | נושא | החלטה | איפה במסמך |
|---|---|---|---|
| 1 | דומיין | `notes-4-me.web.app`, דרך rewrites ב-Hosting | 1.3 |
| 2 | מי רשאי להתחבר | **Claude בלבד**, לפי allowlist של redirect URIs (claude.ai + loopback של Claude Code). **DCR בלבד** בשלב 1. CIMD נדחה (משטח SSRF) ויתווסף בהמשך דרך `client_id_metadata_document_supported` | 2.1, 2.3.3 |
| 3 | מי המשתמשים | קוד נכון לריבוי משתמשים, אבל **allowlist של `uid`** ב-`config/mcp`, ובהתחלה רק החשבון של הבעלים. fail-closed | 2.3.5, 2.3.9 |
| 4 | הרשאות שותפים | ארכוב והעברה: **בעלים בלבד** | 3.2.5, 5 |
| 5 | `create_note` בקטגוריה משותפת של אחר | **אסור בינתיים.** אותו כלל ליעד של `move_note_to_category` | 3.2.5, 5 |
| 6 | זמני חיים | access token לשעה, refresh token ל-30 יום sliding עם תקרה של 90: **אושר**. audit log: **180 יום** | 2.3.7, 6 |
| 7 | cache של אימות tokens | **אין** | 2.3.8 |
| 8 | `minInstances` | **בלי בהתחלה, מודדים** | 1.1, 8.4 |
| 9 | concurrency בלקוח | **כן, תנאי מקדים לשלב 2.** מבוסס על מודל ה-`items` (review §11.7, צעדים D4/E1/E2/E2b). presence לא בתכנית | 7.3 |
| 10 | מראות מול חבילה משותפת | **מראות מתועדות עכשיו**, בלי חבילה משותפת | 4.2 |
| 11 | גרסת SDK | **stable, נעולה לגרסה מדויקת** | 1.2 |
| 12 | עבודה עם git | **branch ו-PR לכל שלב**, והבעלים עושה review לפני merge | 8.3 |
| 13 | תיעוד מיושן | לעדכן את `CLAUDE_GUIDELINES.md` (כולל `reminderPending`) **ב-commit נפרד** | review X-4 / C5 |

**נוסף אחרי ההחלטות:** פתקים רגישים, בלתי נראים ל-MCP (3.4, review §12).
