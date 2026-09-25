# סקירת ארכיטקטורה: Notes 4 Me

> ניתוח בלבד. לא שונה קוד, לא הותקנו חבילות ולא נפרס דבר.
> תאריך: 2026-09-25 · נכתב מול commit `570fed5` (v1.20.0) · branch `claude/architecture-review`
> קריאה מקדימה: `CLAUDE_GUIDELINES.md`, `thinking/mcp-plan.md`

## איך לקרוא את המסמך

לכל ממצא יש מזהה (למשל `C-1`), וחמישה פרטים:

- **חומרה:** קריטי / גבוה / בינוני / נמוך.
- **ראיות:** קובץ ומספרי שורות.
- **למה זה חשוב.**
- **תיקון מוצע.**
- **תזמון**, באחד משלושה ערכים:
  - **לפני MCP**: חוסם גם את שלב 1 (קריאה בלבד).
  - **לפני MCP שלב 2**: חוסם רק את tools הכתיבה.
  - **יכול לחכות.**

### סיכום מנהלים

| # | ממצא | חומרה | תזמון |
|---|---|---|---|
| C-1 | `NoteView` דורס את כל ה-`content` מטיוטה ישנה, גם בסימון V במצב צפייה | **קריטי** | לפני MCP שלב 2 |
| C-2 | תבנית שלא מצליחה לפענח את התוכן "מאתחלת" אותו ומוחקת את הטקסט | **קריטי** | לפני MCP שלב 2 |
| C-3 | "הוספה לפתק קיים" במסך השיתוף משחיתה JSON של תבניות מובנות | **קריטי** | לפני MCP שלב 2 |
| S-1 | `userLookup` חשוף לרשימה מלאה, וניתן לרשום בו אימייל של מישהו אחר | **קריטי** | לפני MCP |
| C-4 | ה-debounce שומר רק את הקריאה האחרונה, ושינוי כותרת נבלע | גבוה | לפני MCP שלב 2 |
| SH-1 | שיתוף בלי הסכמה של הנמען: כל אחד יכול "לדחוף" פתקים לכל אחד | גבוה | לפני MCP |
| SH-2 | שותף יכול להעביר פתק לקטגוריה שלו, והפתק נעלם אצל הבעלים | גבוה | לפני MCP שלב 2 |
| SH-3 | פתקים חדשים בקטגוריה משותפת לא משותפים | גבוה | לפני MCP שלב 2 |
| F-1 | ה-scheduler שולח ורק אחר כך מסמן, ב-batch אחד, ולכן כפילויות התראות | גבוה | לפני MCP שלב 2 |
| ST-1 | שגיאת listener מוצגת כ"אין קטגוריות" | גבוה | לפני MCP |
| CI-1 | ה-CI לא בונה, לא בודק ולא פורס את `functions/` | גבוה | לפני MCP |
| T-1 | אין בדיקות בכלל | גבוה | לפני MCP |

---

## 1. מודל נתונים

### D-1. התוכן נשמר כמחרוזת JSON אחת לכל פתק, בלי חוזה משותף

- **חומרה:** גבוה
- **ראיות:**
  - `src/types/note.ts:22`: `content: string`.
  - הפענוח משוכפל בחמש תבניות, כל אחת עם כללים משלה:
    - `ChecklistTemplate.tsx:116-134`
    - `ShoppingTemplate.tsx:43-60`
    - `AccountingTemplate.tsx:41-47`
    - `WorkPlanTemplate.tsx:30-35`
    - `RecipeTemplate.tsx:27-60`
  - ובנוסף עוד שני מפענחים נפרדים: `src/utils/backupFormat.ts:59-160` ו-`functions/src/index.ts:87-97`.
- **למה:**
  - כל כותב (הטופס, `NoteView`, `Share`, הטריגר, ובעתיד MCP) מפרש ומייצר את המבנה בעצמו.
  - אין גרסת סכמה ואין ולידציה, ולכן ההבדלים בין המפענחים הם מקור ישיר לאובדן מידע (ראו C-2, C-3).
  - Firestore לא יכול לשאול לתוך התוכן. זו הסיבה שקיים קולקציית `reminders`, וזה גם מה שהופך כל עדכון ל"החלפת הכל" (C-1).
- **תיקון:**
  - מודול codecs אחד וטהור: `parse(type, raw) → {ok, value} | {ok:false, raw}` ו-`serialize(type, value)`.
  - `parse` שומר שדות לא מוכרים ולעולם לא מחזיר "ריק" כשהפענוח נכשל.
  - כל התבניות, `backupFormat` ו-`Share` משתמשים בו.
  - אותו מודול ישמש את `notesCore/content` מ-`mcp-plan.md` §4. כלומר זו אותה עבודה שממילא מתוכננת, רק מוקדמת.
  - הוספה אופציונלית: שדה `contentVersion`.
  - פיצול לפריטים ב-subcollection נשקל ונדחה ב-`mcp-plan.md` §7 (שובר את הגיבוי, הטריגר וכל ה-UI).
- **תזמון:** לפני MCP. זה הבסיס של `notesCore`.

### D-2. טיפוסים משוכפלים בין `src/` ל-`functions/`, ובתוך `src/` עצמו

- **חומרה:** בינוני
- **ראיות:**
  - `ChecklistItem` מוגדר פעמיים:
    - `src/components/note/templates/ChecklistTemplate.tsx:32-39` (מיוצא מקובץ קומפוננטה).
    - `functions/src/index.ts:55-63`.
  - `ReminderPushData` מוגדר פעמיים: `src/types/reminder.ts` ו-`functions/src/reminderPayload.ts`, עם הערת "מראה".
  - `RepeatRule` מיובא בלקוח מתוך `functions/`, לפי ההערה ב-`ChecklistTemplate.tsx:38`.
  - טיפוסי התוכן מפוזרים:
    - `AccountingRow` ו-`WorkPlanSection` ב-`src/types/template.ts`.
    - `ShoppingItem` ו-`RecipeData` בתוך קבצי הקומפוננטות.
- **למה:**
  - שינוי שדה (למשל הוספת `repeat` ב-v1.20.0) מחייב עדכון ידני של 3 עד 4 מקומות.
  - MCP יוסיף מראה נוסף (`notesCore`), ואז אלה ארבעה מקומות לתחזוקה.
- **תיקון:**
  - מינימום: כל טיפוסי התוכן עוברים ל-`src/types/content.ts`, בלי שום import מקומפוננטות.
  - מומלץ: חבילה משותפת `packages/notes-core` (npm workspaces). בה יהיו טיפוסים, codecs (D-1), `recurrence` ו-`timezone`, ושתי החבילות תייבאנה ממנה.
  - זו שאלה פתוחה מס' 10 ב-`mcp-plan.md`, וההמלצה כאן היא **כן**.
- **תזמון:** לפני MCP (לפחות ההחלטה ותיקון המינימום).

### D-3. שדות שקיימים בנתונים אבל לא בטיפוסים, ולהפך

- **חומרה:** בינוני
- **ראיות:**
  - **`reminderPending`:**
    - נכתב לכל הפתקים על ידי `functions/src/scripts/backfillReminderPending.ts:47`.
    - לא קיים ב-`Note` ולא בשום קוד פעיל. הטריגר הנוכחי לא משתמש בו.
    - `CLAUDE_GUIDELINES.md` עדיין קובע ש"חייב תמיד להיכתב".
  - **`archivedAt: null`:**
    - נכתב ב-`restoreNote` (`src/services/api/notes.ts:249`).
    - הטיפוס הוא `archivedAt?: Timestamp` (`src/types/note.ts:34`). ה-mapper מסתיר את זה.
  - **`category` בפריטי קניות:** נזרק בשקט בכל עריכה, כי `ShoppingTemplate.tsx:51-56` בונה פריט רק מ-4 שדות.
  - **`amount` בחשבונאות:** מוגדר `number`, ואין בדיקה בזמן קריאה.
    - `backupFormat.ts:28` מגן עם `asAmount`.
    - `AccountingTemplate.tsx:54` לא מגן, ולכן מחרוזת תגרום לשרשור (`"0" + 5`) ביתרה.
  - **`User.settings`** (`src/types/user.ts:9-15`):
    - נכתב ביצירת משתמש (`src/store/authStore.ts:60`) אבל אף פעם לא נקרא.
    - ה-theme נשמר ב-`localStorage` (`src/contexts/ThemeContext.tsx:11,20`).
    - `updateSettings` (`authStore.ts:82`) לא נקרא מאף מקום.
  - **`authStore.ts:50`:** `snapshot.data() as User` בלי נרמול, בניגוד לכלל "Document normalization" בהנחיות.
- **למה:**
  - "שדות רפאים" מטעים כל מי שקורא את הנתונים, כולל MCP ששולף ישירות מ-Firestore.
  - מחיקת שדות לא מוכרים בעריכה היא אובדן מידע בין גרסאות.
- **תיקון:**
  - להוסיף את כל השדות האמיתיים לטיפוסים, כאופציונליים ומסומנים `@deprecated` לפי הצורך.
  - codecs ששומרים שדות לא מוכרים (D-1).
  - `toUser` ב-`mappers.ts`.
  - להחליט: או למחוק את `settings` ואת `updateSettings`, או לחבר אותם באמת.
- **תזמון:** לפני MCP שלב 2 (שמירת שדות לא מוכרים). השאר יכול לחכות.

### D-4. ה-`order` של קטגוריות תמיד 0

- **חומרה:** נמוך
- **ראיות:**
  - `src/utils/defaults.ts:22`.
  - אין UI לשינוי סדר קטגוריות, אבל המיון לפיו קיים: `src/services/api/categories.ts:100,126`.
  - ה-index `categories(userId, order)` ב-`firestore.indexes.json` לא בשימוש.
- **למה:** הסדר בפועל שרירותי ותלוי במיזוג owned ו-shared.
- **תיקון:** `order = Date.now()` ביצירה או UI לסידור. לחלופין, להסיר את המיון והאינדקס.
- **תזמון:** יכול לחכות.

---

## 2. Concurrency ואובדן מידע

### C-1. `NoteView` דורס את כל התוכן מטיוטה מקומית ישנה

- **חומרה:** **קריטי**
- **ראיות:**
  - `src/components/note/NoteView/NoteView.tsx:64-80`: הטיוטה מסתנכרנת **רק כשמזהה הפתק משתנה**.
  - `NoteView.tsx:96-99`: כל שינוי שולח `{content}` מלא.
  - `src/components/category/CategoryItem/CategoryItem.tsx:74-77`: ה-`note` שמגיע ל-`NoteView` הוא חי (מתעדכן מהמאזין), אבל ה-state המקומי מתעלם ממנו.
  - החמור מכל, **הדריסה לא דורשת מצב עריכה:**
    - `ChecklistTemplate.tsx:275-277`: כפתור הסימון פעיל גם ב-`readOnly`.
    - `NoteView.tsx:144,148,150`: חשבונאות, מתכון וקניות תמיד ניתנים לעריכה.
- **תרחיש:**
  1. בני זוג פותחים את אותה רשימת קניות משותפת בסופר.
  2. כל אחד מסמן מוצרים.
  3. כל סימון כותב את הרשימה המלאה מהעותק שנטען כשהמודאל נפתח.
  4. הסימונים של השני נמחקים בשקט.
  - אותו דבר קורה בין שני מכשירים של אותו משתמש, ובעתיד גם בין המשתמש ל-MCP.
- **למה:** אובדן מידע שקט בפעולה השכיחה ביותר באפליקציה.
- **תיקון** (פירוט ב-`mcp-plan.md` §7.3):
  1. שדה `revision` (עם `increment(1)`) בכל כתיבה של `content` או `title`.
  2. `NoteView` שומר `baseContent` ו-`baseRevision`. כשמגיע `note` חי עם revision גבוה יותר:
     - **אם אין שינוי ממתין:** מאמצים את הגרסה החדשה.
     - **אם יש שינוי ממתין בתבנית מבוססת פריטים:** 3-way merge לפי `item.id`, דרך ה-codec מ-D-1.
     - **אם יש שינוי ממתין בטקסט חופשי:** הודעת "עודכן ברקע".
  3. השמירה עוברת ל-`runTransaction` עם בדיקת `revision`.
  4. תיקון ביניים זול ומיידי לסימוני V: שמירה ברמת פריט דרך transaction שמחיל `toggle(itemId)` על התוכן העדכני. זה פותר את רוב התרחישים עוד לפני ה-merge המלא.
- **תזמון:** לפני MCP שלב 2. בגלל הרשימות המשותפות, כדאי לתקן **מיד**, בלי קשר ל-MCP.

### C-2. תבנית שנכשלת בפענוח "מאתחלת" את התוכן ומוחקת אותו

- **חומרה:** **קריטי**
- **ראיות:**
  - `ChecklistTemplate.tsx:131-133`: פענוח שנכשל מחזיר `[]`.
  - `ChecklistTemplate.tsx:157-163`: effect שרואה `items.length === 0` כשלא ב-`readOnly`, וקורא ל-`onChange` עם רשימה חדשה.
  - `WorkPlanTemplate.tsx:30-35,46-50`: אותו דפוס.
  - `ChecklistTemplate.tsx:123`: `item.id` על `null` זורק בתוך ה-`try`, כלומר גם `[null]` נחשב "ריק".
- **תרחיש 1 (דרך `NoteView`):**
  1. יש פתק שהתוכן שלו הוא טקסט רגיל אבל `templateType: 'checklist'`. הוא יכול להיווצר מהמרת תבנית בטופס (`NoteForm.tsx:108`, שמחליף תבנית בלי להמיר תוכן) או מ-C-3.
  2. המשתמש לוחץ "עריכה".
  3. ה-effect מחליף את כל הטקסט ב-`[{"text":""}]`.
  4. ה-debounce שומר, והטקסט אבד.
- **תרחיש 2 (בטופס):** מחליפים את התבנית של פתק קיים מ"פשוט" ל"משימות" ושומרים. הטקסט נמחק.
- **ראיה נוספת:** `AccountingTemplate.tsx:41-47` מחזיר JSON שאינו מערך כמו שהוא, ו-`rows.reduce` (שורה 52) קורס. כלומר תוכן של מתכון שהוגדר כחשבונאות מפיל את המסך ל-ErrorBoundary.
- **למה:** מחיקה בלתי הפיכה, שמופעלת מלחיצה תמימה.
- **תיקון:**
  - ה-codec מחזיר `{ok:false, raw}` כשהפענוח נכשל.
  - התבנית מציגה "לא ניתן להציג את התוכן בתבנית זו" עם אפשרות "המר לטקסט". **לעולם לא** `onChange` אוטומטי על תוכן שלא פוענח.
  - ה-effect של האתחול רץ רק כש-`value === ''`.
  - החלפת תבנית בטופס ממירה במפורש, למשל טקסט לפריטי checklist לפי שורות, או מזהירה.
- **תזמון:** לפני MCP שלב 2 (MCP יכתוב תוכן שהתבניות יקראו). בפועל כדאי **מיד**.

### C-3. "הוספה לפתק קיים" ב-Share משחיתה תבניות מובנות

- **חומרה:** **קריטי**
- **ראיות:**
  - `src/pages/Share/Share.tsx:263-265`: רשימת היעד כוללת **כל** פתק בקטגוריה, בלי סינון לפי תבנית.
  - `Share.tsx:210-213`: לכל תבנית שאינה workplan מבוצע `existingNote.content + '\n\n' + content`.
  - `Share.tsx:188,215`: בנוסף, read-modify-write על עותק מה-store ולא ב-transaction.
- **תרחיש:**
  1. משתפים קישור מהדפדפן לרשימת קניות.
  2. התוכן הופך ל-`[...]\n\nhttps://...`, שאינו JSON תקין.
  3. הרשימה מוצגת ריקה.
  4. בקניות, הוספת פריט דורסת את התוכן. בצ'קליסט, מעבר לעריכה מוחק אותו (C-2).
  - גם ב-workplan, אם הפענוח נכשל (שורה 206), הטקסט משורשר למחרוזת JSON.
- **תיקון:**
  - "הוספה" עוברת דרך codec: `appendText(type, text)`. בצ'קליסט נוסף פריט, בקניות מוצר, ב-workplan סעיף, ובחשבונאות או מתכון האפשרות חסומה.
  - הכתיבה ב-transaction.
  - אורך ה-title מוגבל ל-`LENGTH_LIMITS.NOTE_TITLE` (שורה 222 לא מגבילה).
- **תזמון:** לפני MCP שלב 2.

### C-4. ה-debounce מאבד עדכונים של שדות שונים

- **חומרה:** גבוה
- **ראיות:**
  - `src/hooks/useDebouncedCallback.ts:54-57`: `pendingArgsRef.current = args`. הקריאה האחרונה **מחליפה** את הקודמת ולא מתמזגת איתה.
  - `NoteView.tsx:89-99`: כותרת ותוכן עוברים באותו debounce, כל אחד עם אובייקט של שדה יחיד.
- **תרחיש:**
  1. המשתמש משנה כותרת.
  2. תוך פחות מ-600ms הוא מסמן V בפריט.
  3. נשמר רק `{content}`. הכותרת נשארת ישנה בשרת, והמסך מציג את החדשה.
  4. בסגירה, `flush` שולח רק את האחרון.
- **תיקון:** `saveUpdates.call(prev => ({...prev, ...updates}))`. כלומר צבירת patch, או debounce נפרד לכל שדה. לכתוב לזה test.
- **תזמון:** לפני MCP שלב 2. תיקון של שורה אחת, כדאי מיד.

### C-5. `reorderNotes` כותב לכל הפתקים בקטגוריה, כולל של אחרים, ומעדכן להם `updatedAt`

- **חומרה:** בינוני
- **ראיות:**
  - `src/services/api/notes.ts:207-215`: `batch.update(... { order: index, updatedAt: serverTimestamp() })`.
  - `src/hooks/useNoteEditor.ts:101-110`: הסדר מחושב רק מהפתקים שהמשתמש רואה.
- **למה:**
  - גרירה אחת משנה את "עודכן לאחרונה" לכל הפתקים, וכך השדה חסר משמעות. זה גם יפגע ב-`revision` ו-merge (C-1).
  - N כתיבות מפעילות N הרצות של `syncNoteReminders` (F-4).
  - פתקים שהמשתמש לא רואה (למשל פתק של שותף בקטגוריה שלו, SH-3) לא נכללים, ולכן נוצרות התנגשויות `order`.
  - שותף משנה את הסדר לבעלים. זה סביר, אבל צריך להיות החלטה.
  - ראו גם `order: notes.length` ביצירה (`useNoteEditor.ts:63`) ו-`order: 0` ב-Share (`Share.tsx:243`), שמייצרים כפילויות.
- **תיקון:**
  - לא לעדכן `updatedAt` ב-reorder.
  - לכתוב רק פתקים ש-`order` שלהם באמת השתנה.
  - בטווח ארוך: fractional indexing (`order` כמספר בין שכנים), כך שגרירה היא כתיבה אחת.
- **תזמון:** יכול לחכות. לפני MCP שלב 2 אם `revision` נשען על `updatedAt`.

### C-6. Offline: אין persistence, ו-writes ממתינים הולכים לאיבוד

- **חומרה:** בינוני
- **ראיות:**
  - `src/services/firebase/config.ts:62`: `getFirestore(app)` עם memory cache כברירת מחדל.
  - `src/sw.ts:125-129` טוען ש"ה-SDK מנהל שכבת מטמון offline משלו". הטענה לא נכונה ללא `persistentLocalCache`.
  - `NoteView.tsx:85-87`: השמירה היא fire-and-forget, בלי חיווי.
- **למה:**
  - PWA שמותקנת כאפליקציה ונפתחת בלי רשת מציגה רשימה ריקה.
  - עריכה בלי רשת שנסגרת לפני חזרת החיבור אובדת בלי אזהרה.
  - שילוב עם C-1: כשהחיבור חוזר, הכתיבות הממתינות דורסות שינויים שנעשו בינתיים במכשיר אחר.
- **תיקון:**
  - `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`.
  - חיווי "לא מסונכרן" לפי `hasPendingWrites` ב-metadata של ה-snapshot.
  - תיקון ההערה ב-`sw.ts`.
- **תזמון:** יכול לחכות, אבל רק אחרי C-1. persistence בלי merge מגדיל את חלון הדריסה.

### C-7. שיתוף וארכוב: נקודות נוספות

- **שיתוף:** `arrayUnion`/`arrayRemove` כבר אטומיים (טוב). הבדיקה "כבר משותף" ב-`notes.ts:269-275` היא read-then-write, אבל היא רק מייצרת הודעה ואינה מאבדת מידע. **נמוך.**
- **שיתוף קטגוריה ב-batches:** `categories.ts:201-207` מבצע כמה batches ברצף. כישלון באמצע משאיר שיתוף חלקי בלי rollback ובלי הודעה ברורה. **בינוני**, יכול לחכות.
- **ארכוב:** `archiveNote` משנה רק שדות ייעודיים (טוב). אבל `NoteView` פתוח על פתק שאורכב במכשיר אחר ממשיך לשמור אליו. `CategoryItem.tsx:75-77` נופל ל-`viewingNote`. **נמוך.**

---

## 3. התאמה בין `firestore.rules` למה שהלקוח עושה

### R-1. אין ולידציית סכמה או גודל ב-rules

- **חומרה:** בינוני
- **ראיות:** `firestore.rules:48-49` (create של note) ו-`36-37` (create של category) בודקים רק `userId`. אין בדיקה של טיפוסים, אורך `title` (הלקוח מגביל ל-50) או גודל `content`, ואין רשימת שדות מותרים.
- **למה:**
  - לקוח פגום או זדוני יכול לכתוב כל דבר, ו-MCP (שקורא עם Admin SDK) יצטרך להתגונן.
  - `sharedWith` בזמן create לא מוגבל, ראו SH-1.
- **תיקון:**
  - פונקציית `validNote(data)` ב-rules עם `keys().hasOnly([...])`, בדיקות טיפוסים ו-`content.size() < 200000`.
  - ב-create: `sharedWith == []`, כך ששיתוף עובר רק דרך המסלול הייעודי.
- **תזמון:** יכול לחכות, אבל מומלץ יחד עם SH-1.

### R-2. rules מתירים לשותף יותר ממה שהאפליקציה מתכוונת

- **חומרה:** גבוה, כי SH-2 הוא תוצאה ישירה.
- **ראיות:** `firestore.rules:51-52` יחד עם `ownershipUnchanged` (`28-31`) מתירים לשותף לשנות כל שדה חוץ מ-`userId` ו-`sharedWith`: `categoryId`, `isArchived`, `archivedAt`, `order`, `isPinned`, `templateType`, ושדות חדשים שרירותיים.
- **מה הלקוח חושף לשותף:**
  - `NoteView.tsx:350-361`: "העבר" ו"מחק" (ארכוב) מוצגים גם למי שאינו בעלים.
  - `CategoriesManagement.tsx:21-43`: עריכה ומחיקה של קטגוריה ללא בדיקת בעלות. עריכה של קטגוריה משותפת **מצליחה** (שינוי שם לבעלים). מחיקה נכשלת עם `alert` כללי.
- **תיקון:** להחליט על מודל ההרשאות של שותף (ראו §4). הצעה:
  - שותף יכול לערוך `title`, `content`, `tags`, `color`, ו-`order`/`isPinned` אם מחליטים שכן.
  - שותף **לא** יכול לשנות `categoryId`, `isArchived` או `templateType`.
  - לאכוף ב-rules עם `diff(resource.data).affectedKeys().hasOnly([...])`, ולהסתיר את הכפתורים ב-UI.
  - `mcp-plan.md` §3.2.5 כבר מניח את המודל המחמיר הזה.
- **תזמון:** לפני MCP שלב 2.

### R-3. בעלים יכול להעביר בעלות

- **חומרה:** נמוך
- **ראיות:** `firestore.rules:51` מבצע `isOwner(resource.data.userId)` בלי לבדוק ש-`request.resource.data.userId` נשאר זהה.
- **תיקון:** להוסיף `request.resource.data.userId == resource.data.userId` לכל update.
- **תזמון:** יכול לחכות.

### R-4. כללים מתים ואינדקסים מתים

- **חומרה:** נמוך
- **ראיות:**
  - `firestore.rules:65-67`: `userSettings/{userId}`. אין שום קוד שמשתמש בקולקציה.
  - `firestore.indexes.json`: `notes(categoryId,isPinned,order)`, `notes(categoryId,order)`, `notes(userId,order)` ו-`categories(userId,order)` לא נדרשים לאף שאילתה קיימת. כל השאילתות הן equality בודד או `array-contains`.
- **תיקון:** להסיר אחרי אימות ב-console שאין להם שימוש.
- **תזמון:** יכול לחכות.

(`userLookup` מופיע כ-S-1 בסעיף 9.)

---

## 4. מודל השיתוף

המצב היום: שני מנגנונים שמשתמשים באותו שדה (`sharedWith`).
- **שיתוף פתק:** `sharedWith` על הפתק.
- **שיתוף קטגוריה:** `sharedWith` על הקטגוריה **ומועתק** לכל הפתקים הקיימים שלה, רק לפתקים של הבעלים (`categories.ts:170-210`).
- **הרשאת קריאה לפתק:** נקבעת **רק** לפי ה-`sharedWith` של הפתק (`firestore.rules:46`).

### SH-1. שיתוף בלי הסכמה, בשילוב עם enumeration של אימיילים

- **חומרה:** גבוה
- **ראיות:**
  - `notes.ts:263-285`: שיתוף מוסיף את ה-uid מיד, בלי הזמנה או אישור.
  - `firestore.rules:48-49`: אפשר ליצור פתק עם `sharedWith` כלשהו כבר ב-create.
  - `useOrphanSharedNotes.ts` ו-`SharedWithMe.tsx`: פתקים כאלה **מוצגים אוטומטית** בדף הבית של הנמען.
  - הנמען לא יכול להסיר את עצמו, כי `ownershipUnchanged` חוסם אותו.
- **למה:**
  - spam והטרדה: כל מי שיודע (או מוצא, ראו S-1) אימייל יכול להציף משתמש בפתקים שהוא לא יכול למחוק.
  - **עם MCP זה נהיה וקטור prompt injection:** תוקף משתף פתק עם "הוראות", וה-Claude של הקורבן קורא אותו דרך `list_notes`/`get_note` וכותב בשמו.
- **תיקון:**
  1. הנמען יכול להסיר את עצמו: rule שמתיר `sharedWith` = `sharedWith` פחות עצמו בלבד, יחד עם כפתור "הסר אותי".
  2. הזמנות: `shareInvites/{id}` שהנמען מאשר, ורק אז `arrayUnion`. לחלופין, לפחות שדה `acceptedBy` שה-UI וה-MCP מכבדים.
  3. ב-MCP: פתקים שלא אושרו לא מוחזרים. אחרים מסומנים `sharedBy` (כבר ב-`mcp-plan.md` §3.3).
- **תזמון:** לפני MCP (לפחות 1 ו-3).

### SH-2. שותף יכול "להעלים" פתק של הבעלים

- **חומרה:** גבוה
- **ראיות:**
  - `NoteView.tsx:132-139` + `useNoteEditor.ts:80-84`: "העבר לקטגוריה" מציג את **כל** הקטגוריות של השותף.
  - `firestore.rules:51-52`: ההעברה מותרת.
  - `useOrphanSharedNotes.ts:31-37`: פתק "יתום" מוצג רק אם `note.userId !== userId`. ההערה בשורה 33, "פתק שלי תמיד מגיע עם הקטגוריה שלי", שגויה.
- **תרחיש:**
  1. B מעביר את הפתק של A לקטגוריה פרטית של B.
  2. ה-`categoryId` מצביע על קטגוריה ש-A לא רואה.
  3. אצל A הפתק לא מופיע באף קטגוריה, וגם לא במקטע "שותף איתי", כי A הוא הבעלים.
  - אותו מצב קורה לבעלים כשהוא מוחק קטגוריה שיש בה רק פתקים **מאורכבים**: `CategoriesManagement.tsx:28` סופר רק פתקים לא מאורכבים, כי `subscribeToNotes` מסנן אותם (`notes.ts:141`). שחזור מהארכיון מחזיר את הפתק לקטגוריה שלא קיימת.
- **תיקון:**
  - rules: שותף לא משנה `categoryId` (R-2).
  - מחיקת קטגוריה בודקת פתקים בשרת, כולל מאורכבים ופתקים של אחרים, או מעבירה אותם לקטגוריית "ללא קטגוריה".
  - `useOrphanSharedNotes` (ובדף הבית) מציג **כל** פתק שה-`categoryId` שלו לא נראה, כולל של הבעלים.
- **תזמון:** לפני MCP שלב 2 (ל-MCP יש `move_note_to_category`).

### SH-3. שיתוף קטגוריה הוא snapshot ולא הרשאה

- **חומרה:** גבוה
- **ראיות:**
  - `useNoteEditor.ts:64`: פתק חדש נוצר עם `sharedWith: []`, גם בקטגוריה משותפת. אותו דבר ב-`Share.tsx:244`.
  - `categories.ts:190-196`: השיתוף חל רק על פתקים קיימים של הבעלים.
  - `useNoteEditor.ts:80-84`: העברת פתק לקטגוריה משותפת לא משתפת אותו. העברה החוצה לא מבטלת שיתוף.
  - `categories.ts:235-245`: ביטול שיתוף קטגוריה מסיר את המשתמש מ**כל** הפתקים שבה, כולל כאלה ששותפו איתו בנפרד.
- **תרחישים:**
  - A משתף קטגוריה "קניות" עם B ומוסיף רשימה חדשה. B לא רואה אותה.
  - B יוצר פתק בקטגוריה של A. הבעלים של הפתק הוא B, הוא לא משותף, ו-**A לא רואה אותו בקטגוריה שלו**.
- **תיקון** (החלטת מודל):
  - **אפשרות א' (מומלצת):** הרשאת קריאה לפתק = `note.sharedWith` **או** `category.sharedWith` (עם `get()` ב-rules, שעולה קריאה אחת). שאילתות הלקוח עוברות ל-`categoryId in [הקטגוריות המשותפות איתי]`. כך אין העתקה ואין סנכרון.
  - **אפשרות ב':** להשאיר את ההעתקה, ולשתף בזמן יצירה או העברה (`sharedWith` = של הקטגוריה + בעלי הקטגוריה). הסנכרון נעשה ב-Cloud Function על שינוי `categoryId` וכתיבה ל-`categories`.
  - בשתי האפשרויות צריך להבחין בין "משותף ישירות" ל"משותף דרך קטגוריה", למשל שדה `sharedVia`, כדי שביטול לא ימחק שיתופים ישירים.
- **תזמון:** לפני MCP שלב 2. `create_note` ו-`move_note_to_category` תלויים בהחלטה, וזו שאלה פתוחה מס' 5 ב-`mcp-plan.md`.

### SH-4. מקרי קצה נוספים

- **תזכורות בפתק משותף הולכות רק לבעלים.** `functions/src/index.ts:181` כותב `userId: note.userId`. B מוסיף משימה עם שעה לרשימה של A, ו-A מקבל את ההתראה ו-B לא. **בינוני.** תיקון: שדה `assignee` או `createdBy` בפריט, או שליחה לכל המשתתפים (החלטת מוצר).
- **הצמדה גלובלית.** `isPinned` הוא שדה של הפתק, ולכן B מצמיד ל-A. **נמוך.** תיקון: `pinnedBy: string[]`.
- **"מחק" ב-`SharedWithMe` לא עושה כלום.** `SharedWithMe.tsx:54,65` מעבירים `onDelete={() => undefined}`, אבל `NoteView` עדיין מציג "מחק", מבקש אישור וסוגר. **נמוך.** תיקון: להסתיר, או להחליף ב"הסר אותי" (SH-1).
- **ניווט מהתראה לפתק יתום.** `sw.ts:207-210` מנווט ל-`/category/<id>`, ו-`CategoryView.tsx:41` לא ימצא את הקטגוריה. **נמוך.**

---

## 5. State ו-subscriptions

### ST-1. שגיאות listener נבלעות ומוצגות כ"אין נתונים"

- **חומרה:** גבוה
- **ראיות:**
  - `notes.ts:156-161,171-176`: `error` רק רושם ללוג ומסמן `loaded`, ו-`emit` שולח רשימה ריקה.
  - אותו דבר ב-`categories.ts:138-142,152-156`.
  - `noteStore.ts:89-91` ו-`categoryStore.ts:84-86` לא מקבלים ערוץ שגיאה בכלל.
  - `CategoryList.tsx:26-37`: רשימה ריקה מוצגת כ"עדיין אין קטגוריות" עם כפתור "צור קטגוריה ראשונה".
  - `Archive.tsx:30-33` + `notes.ts:199`: שגיאה משאירה את מסך הארכיון על `loading` לנצח.
- **למה:**
  - `permission-denied` (למשל אחרי שינוי rules), quota או רשת מוצגים למשתמש כ"כל הפתקים שלי נמחקו". זה מוביל ליצירת קטגוריות כפולות ולבלבול.
  - לפי ההנחיות עצמן, השגיאה המקורית היא מה ש"מספר לך שהכישלון היה permission-denied".
- **תיקון:**
  - `subscribeTo*` מקבלים `onError`.
  - ה-stores מחזיקים `error` ו-`hasLoaded`. ל-`noteStore` אין `hasLoaded` בכלל, ו-`isLoading` שלו מתחיל ב-`false` (שורה 60), מה שגורם להבהוב "ריק".
  - הקומפוננטות מבדילות בין "טוען", "שגיאה" ו"ריק".
- **תזמון:** לפני MCP. באגי הרשאות מהשינויים ב-rules (SH-1, R-2) חייבים להיות גלויים.

### ST-2. כישלון בטעינת מסמך המשתמש מוביל לאפליקציה ריקה ושקטה

- **חומרה:** בינוני
- **ראיות:**
  - `authStore.ts:125-135`: בכישלון `user: null` אבל `firebaseUser` מוגדר.
  - `useAuth.ts:37`: `isAuthenticated: !!firebaseUser`.
  - `useNotes.ts:16`, `useCategories.ts:14`: המנויים תלויים ב-`user?.uid`, ולכן לא נפתחים.
  - `authStore.error` לא מוצג בשום דף.
  - בנוסף, `ensureUserDocument` כותב ל-`userLookup` **בכל** התחברות (`authStore.ts:49`), וכל כישלון שם נבלע (`users.ts:51-55`).
- **תיקון:**
  - המנויים יתלו ב-`firebaseUser.uid` ולא בפרופיל.
  - מסך שגיאה עם "נסה שוב".
- **תזמון:** יכול לחכות.

### ST-3. מנגנון ה-subscriptions עצמו תקין, עם הערות קטנות

- ספירת הצרכנים ב-`noteStore.ts:67-118` וב-`categoryStore.ts:60-113` נכונה. גם החלפת משתמש מטופלת. אין דליפה שמצאתי.
- `useOrphanSharedNotes.ts:20-21` ו-`CategoriesManagement.tsx:17` צורכים את ה-hooks ומעלים את המונה. זה תקין.
- `noteStore.reset` (שורה 133) לא נקרא מאף מקום. קוד מת. **נמוך.**
- `Archive.tsx:27-36` מחזיק מנוי מקומי מחוץ ל-store. זה עובד, אבל חורג מהכלל ש-"components subscribe via hooks". **נמוך.**
- בכל קטגוריה, `CategoryItem` מסנן וממיין את כל הפתקים (`useNotes.ts:40-43`). O(קטגוריות × פתקים) בכל עדכון זה זניח בהיקף אישי. **נמוך.**
- `globals.css` מיובא פעמיים (`main.tsx:10`, `App.tsx:11`). **נמוך.**

### ST-4. Login לא שומר יעד חזרה

- **חומרה:** בינוני
- **ראיות:**
  - `ProtectedRoute.tsx:30-32`: `<Navigate to="/login" replace />`, בלי `state.from`.
  - `Login.tsx:20`: `navigate('/')`.
- **למה:**
  - שיתוף נכנס (`/share?shareId=`) או לחיצה על התראה כשהמשתמש לא מחובר הולכים לאיבוד. רשומת ה-cache של השיתוף נשארת יתומה.
  - **מסך ההסכמה של MCP (`/connect?req=`) תלוי בזה.**
- **תיקון:** `state={{ from: location }}` ב-`ProtectedRoute`, וחזרה אליו אחרי התחברות.
- **תזמון:** לפני MCP.

---

## 6. Cloud Functions

### F-1. `sendDueReminders` לא אידמפוטנטי: שליחה לפני סימון, ו-batch אחד לכל ההרצה

- **חומרה:** גבוה
- **ראיות:**
  - `functions/src/index.ts:290-352`: לולאה שבה כל תזכורת **נשלחת** (שורה 352) ורק מתווספת ל-batch.
  - `index.ts:363`: `batch.commit()` אחד בסוף.
- **למה:**
  - אם ה-commit נכשל, כל התזכורות שנשלחו נשארות `sent:false` ונשלחות שוב בדקה הבאה. זה יכול לחזור על עצמו.
  - הכישלון לא נדיר:
    - `batch.update` על מסמך שנמחק בינתיים. `syncNoteReminders` מוחק תזכורות כשהמשתמש עורך או מסמן V, ולכן כל ה-batch נכשל עם NOT_FOUND.
    - חריגה שנזרקת מ-`sendEachForMulticast` באמצע הלולאה מפילה את כל ההרצה.
  - תוצאה: **התראות כפולות לכל המשתמשים** בהרצה, בלולאה.
  - בנוסף, מרוץ עם הטריגר: המשתמש משנה שעה, הטריגר כותב `sent:false` עם `remindAt` חדש, וה-scheduler שקרא את המסמך הישן דורס עם `sent:true`, כך שהתזכורת החדשה לא תישלח.
- **תיקון:**
  - "claim then send" לכל תזכורת: transaction שבודק ש-`sent == false` ו-`remindAt` זהה לזה שנקרא, ומסמן `sent:true`/rolled-forward (או `leaseUntil`). רק אחרי הצלחה שולחים.
  - כישלון שליחה נרשם ולא מחזיר את המסמך לתור, או מחזיר עם מונה ניסיונות.
  - `update` שנכשל ב-NOT_FOUND מדולג.
- **תזמון:** לפני MCP שלב 2 (`add_checklist_item` נשען על התזכורות).

### F-2. `syncNoteReminders` רגיש לסדר אירועים

- **חומרה:** בינוני
- **ראיות:** `index.ts:145-149` משתמש ב-`event.data.after` ולא במצב הנוכחי של המסמך. טריגרים של Firestore לא מובטחים בסדר ועשויים להגיע פעמיים.
- **למה:**
  - שתי כתיבות מהירות (debounce של 600ms) עלולות להיות מעובדות בסדר הפוך, והתזכורות ישקפו את הגרסה הישנה. זה ייצא מסונכרן רק בכתיבה הבאה.
  - MCP יוסיף כתיבות צמודות לכתיבות המשתמש.
- **תיקון:**
  - לקרוא את המסמך מחדש בתוך הפונקציה (`db.doc(...).get()`) ולחשב ממנו, כלומר reconcile אידמפוטנטי.
  - לחלופין, לשמור ב-reminder את `sourceUpdateTime` ולהתעלם מאירוע ישן יותר.
- **תזמון:** לפני MCP שלב 2.

### F-3. שדות מועתקים בתזכורת מתיישנים

- **חומרה:** נמוך
- **ראיות:** `index.ts:162-172` מדלג על עדכון כש-`remindAt`/`repeat` לא השתנו. לכן `noteTitle`, `itemText` ו-`categoryId` (`index.ts:180-186`) לא מתעדכנים אחרי שינוי כותרת, טקסט משימה או **העברת קטגוריה**.
- **למה:** ההתראה מציגה טקסט ישן ומנווטת לקטגוריה הקודמת.
- **תיקון:** להשוות גם את השדות האלה, ולעדכן אותם **בלי** לאפס `sent`.
- **תזמון:** יכול לחכות.

### F-4. עלות

- **חומרה:** נמוך
- **ראיות:** `index.ts:264-270`: `every 1 minutes`.
- **פירוט:**
  - בערך 43,200 הרצות בחודש, וכל אחת מבצעת שאילתה (לפחות קריאה אחת גם כשאין תוצאות).
  - זה בתוך ה-free tier של Functions, ובערך 43K קריאות Firestore בחודש. זניח.
  - העלות האמיתית היא `syncNoteReminders` על **כל** כתיבה לפתק, כולל כל debounce של הקלדה ו-N כתיבות של reorder (C-5). כל הרצה כזו מבצעת שאילתת `reminders where noteId`.
- **תיקון (יכול לחכות):**
  - לצאת מוקדם כש-`content`, `templateType`, `isArchived`, `title` ו-`categoryId` לא השתנו בין `before` ל-`after`. זה חוסך את רוב ההרצות.
  - Cloud Tasks לכל תזכורת במקום polling לא שווה את המורכבות כרגע.

### F-5. אזור זמן ונכונות החזרה

- **חומרה:** נמוך
- **ראיות:**
  - `functions/src/timezone.ts:15`: `Asia/Jerusalem` קבוע.
  - `recurrence.ts:98-146`.
- **הערכה:**
  - הלוגיקה נכונה: two-pass לשעון קיץ, חישוב מהבסיס, קיצוץ לסוף חודש ו-`MAX_STEPS`.
  - החולשה היחידה היא משתמש בחו"ל, וזה מתועד.
  - אין בדיקות. זה היעד הראשון ל-unit tests (T-1), כי הקוד טהור.
- **תזמון:** בדיקות לפני MCP שלב 2. שדה `timeZone` למשתמש יכול לחכות.

### F-6. קוד מת

- **חומרה:** נמוך
- **ראיות:** `functions/src/scripts/backfillReminderPending.ts` ממלא שדה שאף קוד לא קורא (D-3).
- **תיקון:** למחוק, ולעדכן את `CLAUDE_GUIDELINES.md`.
- **תזמון:** יכול לחכות.

---

## 7. טיפול בשגיאות, logging, ומה המשתמש רואה

### E-1. אין דיווח שגיאות מ-production

- **חומרה:** בינוני
- **ראיות:**
  - `src/utils/logger.ts:24-26`: `logger.error` כותב רק ל-console של הדפדפן.
  - `ErrorBoundary.tsx:28-29` באותו אופן.
- **למה:** כישלונות אצל משתמשים (C-2, ST-1, F-1) לא מגיעים אליך. בפונקציות הלוגים קיימים ב-Cloud Logging, אבל אין עליהם התראה.
- **תיקון:**
  - בצד הלקוח: דיווח שגיאות קל, כמו Sentry (free tier) או callable function שכותבת ל-Cloud Logging, עם סינון תוכן פתקים. **לא** לשלוח `content`.
  - בצד השרת: log-based alert על `severity>=ERROR` של `sendDueReminders` ו-`syncNoteReminders`.
- **תזמון:** לפני MCP. שרת MCP בלי ניטור הוא סיכון.

### E-2. `alert`/`confirm` ב-15 מקומות, והודעות כלליות

- **חומרה:** נמוך
- **ראיות:**
  - `useNoteEditor.ts:30`, `CategoriesManagement.tsx:31,40`, `Share.tsx:164-179,253`, `Archive.tsx:43,58` ועוד.
  - `CategoriesManagement.tsx:31` אומר "יש למחוק תחילה את כל הפתקים", אבל "מחיקה" באפליקציה היא ארכוב.
  - `CategoriesManagement.tsx:40`: הודעה כללית, גם כשהסיבה היא permission-denied על קטגוריה של מישהו אחר.
- **תיקון:**
  - toast אחד מרכזי.
  - מיפוי `permission-denied` להודעה "אין לך הרשאה לפעולה זו".
- **תזמון:** יכול לחכות.

### E-3. `NoteForm` נסגר גם כשהשמירה נכשלת

- **חומרה:** בינוני
- **ראיות:**
  - `NoteForm.tsx:61-69`: `onSubmit(...)` (הטיפוס `void`, בלי await) ומיד אחריו `onClose()`.
  - `CategoryItem.tsx:89-95` מנסה לסגור רק בהצלחה, אבל הטופס כבר נסגר.
- **למה:** בכישלון המשתמש רואה `alert`, והתוכן שהקליד בטופס אבד.
- **תיקון:** `onSubmit: (data) => Promise<boolean>`, ולסגור רק בהצלחה.
- **תזמון:** יכול לחכות (קל, כדאי ביחד עם C-2).

---

## 8. בדיקות

### T-1. אין בדיקות בכלל, והקוד שהכי זקוק להן הוא גם הכי קל לבדוק

- **חומרה:** גבוה
- **ראיות:** אין `*.test.ts`, אין `vitest`/`jest` ב-`package.json`, ואין שלב בדיקות ב-`.github/workflows/firebase-deploy.yml`. `CLAUDE_GUIDELINES.md` ("Test Files") מתאר מבנה שלא קיים.

**הקמה מינימלית מוצעת:**

| שכבה | כלים | מיקום |
|---|---|---|
| Unit (לקוח) | `vitest` + `jsdom` + `@testing-library/react` | `src/**/*.test.ts(x)` |
| Unit (functions) | `vitest` (Node) | `functions/src/**/*.test.ts` |
| Rules | `@firebase/rules-unit-testing` + Firestore Emulator | `tests/rules/*.test.ts` |
| Integration (functions) | Emulator Suite (Firestore + Auth + Functions), `firebase emulators:exec` | `functions/test/` |
| CI | job חדש: `npm test` ו-`firebase emulators:exec --only firestore "npm run test:rules"` לפני deploy | workflow |

**סדר כיסוי** (הערך הגבוה ביותר קודם, וכל שלב קטן):

1. **Pure, בלי emulator:**
   - `recurrence.ts`/`timezone.ts`: מעברי שעון קיץ, 31 בחודש, 29 בפברואר, בסיס רחוק בעבר.
   - `computeDesiredReminders`: דורש export, או העברה ל-`reminders.ts`.
   - `productMatching.ts`.
   - `backupFormat.ts`.
   - `useDebouncedCallback` (בדיקה שמשחזרת את C-4).
2. **Codecs** (אחרי D-1): round-trip, שמירת שדות לא מוכרים, תוכן פגום **לא** הופך לריק (משחזר את C-2), append לכל תבנית (C-3), merge ברמת פריט (C-1).
3. **Rules:**
   - `userLookup`: אסור `list`, ואסור לרשום אימייל שאינו שלך (S-1).
   - שותף לא משנה `categoryId`/`isArchived` (R-2).
   - נמען מסיר את עצמו (SH-1).
   - `reminders` קריא רק לבעלים.
4. **Functions integration:**
   - כתיבת פתק ⇒ מסמך reminder נכון.
   - מחיקה ⇒ ניקוי.
   - ה-scheduler לא שולח פעמיים גם כשמסמך נמחק באמצע (F-1).
   - Messaging עם mock.
5. **קומפוננטות:** `ChecklistTemplate` לא קורא `onChange` על תוכן פגום. `NoteView` מאמץ עדכון חי כשאין טיוטה.

- **תזמון:** לפני MCP. שלב 0 ב-`mcp-plan.md` §8.3 כבר דורש את זה.

---

## 9. אבטחה מעבר ל-rules

### S-1. `userLookup`: דליפת כל האימיילים, וחטיפת זהות בשיתוף

- **חומרה:** **קריטי**
- **ראיות:**
  - `firestore.rules:100`: `allow read: if isAuthenticated()`. `read` כולל `list`, כלומר כל משתמש מחובר יכול לשלוף **את כל הקולקציה**: אימייל ושם של כל המשתמשים. זה יותר מה"enumeration" שמתועד ב-Known Issues. אפשר לשלוף הכל בבקשה אחת, בלי לנחש.
  - `firestore.rules:102-104`: הכתיבה בודקת רק מפתחות וטיפוס. **לא** בודקת ש-`email == request.auth.token.email`.
  - `users.ts:64-74`: `findUserIdByEmail` מחזיר את הראשון שנמצא (`limit(1)`).
- **תרחיש:**
  1. התוקף כותב `userLookup/{attackerUid} = {email: "victim@gmail.com"}`.
  2. כשמישהו משתף פתק או קטגוריה עם victim@gmail.com, השיתוף עלול להגיע **לתוקף**.
  - גם הרשמה עם email/password לא דורשת אימות מייל (`auth.ts:59-62` שולח מייל אימות ולא אוכף אותו).
- **תיקון:**
  1. rules:
     - `allow get: if isAuthenticated()` (לפי מזהה בלבד).
     - `allow list: if false`.
     - `write` רק כש-`request.resource.data.email == request.auth.token.email.lower()` וגם `request.auth.token.email_verified == true`.
  2. החיפוש לפי אימייל עובר ל-callable function (`findUserByEmail`) עם rate limit, שמחזירה רק uid. כך גם נסגר ה-Known Issue.
  3. עם החיפוש ב-callable, doc id יכול להיות hash של האימייל, וה-`list` מיותר.
- **תזמון:** לפני MCP. זו פרצת פרטיות קיימת, ו-MCP מגדיל את ההשלכה (SH-1).

### S-2. `LinkPreview` שולח כל URL מהפתקים לצד שלישי

- **חומרה:** בינוני
- **ראיות:**
  - `src/services/api/linkPreview.ts:87`: `https://corsproxy.io/?${url}`.
  - `linkPreview.ts:65,109`: שליחה ל-`google.com/s2/favicons`.
  - `FormattedText.tsx:143`: מופעל אוטומטית לכל URL בכל פתק טקסט שנצפה.
  - `LinkPreview.tsx:91`: `<img src={preview.image}>` מדף זר (tracking pixel).
- **למה:**
  - קישורים פרטיים (Google Docs עם token, קישורי איפוס, קישורי Zoom) דולפים לפרוקסי ציבורי שלא בשליטתך.
  - הפרוקסי גם יכול להחזיר תוכן שקרי לתצוגה.
  - דף הפרטיות (`src/pages/Privacy/Privacy.tsx`) לא מזכיר את הפרוקסי ולא את שליחת הקישורים (נבדק ב-grep).
- **תיקון:**
  - הטוב ביותר: Cloud Function משלך ל-preview, עם allowlist של סכמות, timeout, גודל מקסימלי, SSRF guard ו-cache.
  - לחלופין: preview רק בלחיצה.
  - בכל מקרה לסנן `image` ל-`https:` בלבד.
- **תזמון:** יכול לחכות, אבל כדאי לפני פרסום רחב.

### S-3. XSS: `FormattedText` ו-`LinkPreview` בטוחים

- **חומרה:** נמוך (אין ממצא)
- **ראיות:**
  - `FormattedText.tsx:30-33,87-91`: tokenizer שמייצר React elements. אין `dangerouslySetInnerHTML`.
  - `href` רק מ-regex של `https?://`, כך ש-`javascript:` לא יכול להיכנס. יש `rel="noopener noreferrer"`.
  - `linkPreview.ts:20-21`: `DOMParser` לא מריץ סקריפטים.
  - אין `innerHTML` בקוד (נבדק ב-grep).
- **הערה קטנה:** ה-regex של URL תופס גם סימני פיסוק בסוף, למשל `https://x.com).`, וזה שובר קישורים. בעיה קוסמטית.
- **תזמון:** אין צורך לפעול.

### S-4. Service Worker

- **חומרה:** נמוך
- **ראיות:**
  - `sw.ts:23-62`: כל POST ל-`/share`, גם ניווט cross-site מטופס באתר זר, נקלט ונשמר ב-cache. ההשפעה מוגבלת, כי המשתמש צריך ללחוץ "שמור" (`Share.tsx:162`). זה עדיין "CSRF של תוכן מוצע".
  - `share-data-cache` מתנקה רק כשהדף נטען בהצלחה עם ה-`shareId` (`Share.tsx:94`). במקרה של ST-4 הרשומות מצטברות.
  - `sw.ts:250-256`: `skipWaiting` + `clients.claim` מיידיים. באפליקציה ללא lazy chunks (`router.tsx` מייבא הכל סטטית) הסיכון קטן, אבל עדכון באמצע עריכה מחליף את ה-SW מתחת לדף.
  - `sw.ts:125-129`: הערה שגויה (C-6).
- **תיקון:**
  - לבדוק `Sec-Fetch-Site` ב-POST, ולדחות אם אינו `same-origin`/`none`. ב-Web Share Target הערך הוא `none`.
  - TTL לרשומות.
  - "גרסה חדשה זמינה, רענן" במקום `skipWaiting` שקט.
- **תזמון:** יכול לחכות.

### S-5. ולידציית קלט

- **חומרה:** בינוני (כפול R-1)
- **ראיות:**
  - הגבלות האורך קיימות רק ב-UI (`LENGTH_LIMITS`, `constants.ts:26-30`).
  - `Share.tsx:222` לא מגביל כותרת.
  - `validators.ts:24-41` (`isValidNoteTitle` וכו') מוגדרים ו**לא בשימוש**.
- **תיקון:** ולידציה ב-codecs וב-rules (R-1). למחוק את ה-validators המתים או לחבר אותם.
- **תזמון:** יכול לחכות.

### S-6. אין security headers ב-Hosting

- **חומרה:** נמוך
- **ראיות:** `firebase.json` בלי `headers`. `index.html` בלי CSP.
- **תיקון:** `Content-Security-Policy` בסיסי (script-src self, connect-src ל-Firebase), `X-Content-Type-Options`, `Referrer-Policy`. `mcp-plan.md` §1.3 כבר דורש `frame-ancestors` ל-`/connect`.
- **תזמון:** יחד עם שינוי `firebase.json` של MCP.

### S-7. ניהול secrets ב-CI

- **חומרה:** בינוני
- **ראיות:**
  - `.github/workflows/firebase-deploy.yml:56-61`: `w9jds/firebase-action@master`, כלומר action צד שלישי **לא נעוץ** (branch), שמקבל את מפתח ה-service account.
  - `action-hosting-deploy@v0` נעוץ ל-tag נע.
  - `FIREBASE_SERVICE_ACCOUNT` הוא מפתח JSON ארוך-טווח.
- **למה:** supply-chain. שינוי ב-`master` של ה-action מקבל את המפתח עם הרשאות deploy לפרויקט.
- **תיקון:**
  - לנעוץ actions ל-commit SHA.
  - להחליף את `w9jds` ב-`npx firebase-tools deploy` ישיר.
  - לעבור ל-Workload Identity Federation (`google-github-actions/auth`) בלי מפתח.
  - service account עם הרשאות מינימליות.
- **תזמון:** לפני MCP. ה-deploy של MCP יעבור באותו מסלול.

---

## 10. קוד מת, תיעוד מיושן, ותלויות

### X-1. קוד ותלויות מתים

- **חומרה:** נמוך
- **ראיות:**

| פריט | ראיה |
|---|---|
| `src/utils/helpers.ts` (כל הקובץ: `generateId`, `formatDate`, `truncateText`, `isValidUrl`, `delay`) | 0 שימושים (grep) |
| `src/utils/index.ts` (barrel) | אף import מ-`@/utils` |
| `isValidCategoryName`, `isValidNoteTitle`, `isValidColor` | `validators.ts:24-41`, 0 שימושים |
| `getUserCategories`, `getNotesByCategory` | `categories.ts:97`, `notes.ts:108`, 0 שימושים |
| `noteStore.reset`, `authStore.updateSettings` | 0 קריאות |
| `storage` (Firebase Storage) | `config.ts:15,63,90`, 0 שימושים. גם מסלול cache ב-`sw.ts:111-123`. מגדיל את ה-bundle. |
| `i18next`, `react-i18next` | ב-`package.json`, 0 imports |
| כלל `userSettings/{userId}` | `firestore.rules:65-67` |
| 4 אינדקסים | R-4 |
| `backfillReminderPending.ts` | F-6 |
| `extractUrls`, `isValidUrl` כפולים | `linkPreview.ts:117-132` מול `helpers.ts:41` |

- **תיקון:** מחיקה, commit אחד לכל קבוצה. הסרת Storage ו-i18next מקטינה את ה-bundle (Known Issue: כ-986KB).
- **תזמון:** יכול לחכות (אבל זול, כדאי כחימום).

### X-2. תלויות

- **חומרה:** נמוך עד בינוני
- **ראיות:**
  - `workbox-*` מיובאים ישירות ב-`sw.ts:13-17` אבל **לא מופיעים ב-`package.json`**. הם מגיעים טרנזיטיבית מ-`vite-plugin-pwa`, כך ששדרוג של הפלאגין עלול לשבור את ה-SW בשקט.
  - `react`/`react-dom` ב-`devDependencies`. עובד עם Vite, אבל מטעה.
  - `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` + `typescript-eslint`: כפילות.
  - ב-CI `node-version: '20'` (`firebase-deploy.yml:19`), ו-Node 20 יצא מ-LTS באפריל 2026. `functions/package.json` דורש `node: 22`.
  - `firebase-functions@^6`: לבדוק מול הגרסה העדכנית לפני הוספת `onRequest` של MCP.
- **תיקון:**
  - להוסיף במפורש את `workbox-precaching`, `-routing`, `-strategies`, `-expiration` ו-`-cacheable-response`.
  - Node 22 ב-CI.
  - לנקות כפילויות.
- **תזמון:** Node ו-workbox לפני MCP. השאר יכול לחכות.

### X-3. CI לא מכסה את `functions/`, ו-deploy רץ בלי שער

- **חומרה:** גבוה (כ-CI-1 בסיכום)
- **ראיות:**
  - `firebase-deploy.yml`: אין `npm ci`/`build` ב-`functions/`, ואין `firebase deploy --only functions`.
  - `tsconfig.json:29`: `include: ["src"]`, כלומר ה-`tsc` של השורש לא בודק את `functions/`. ESLint כן מכסה אותו (`eslint.config.js:62`).
  - deploy אוטומטי על כל push ל-main, בלי בדיקות (T-1).
  - `firebase-deploy.yml:44-61`: Hosting נפרס **לפני** ה-rules. קוד חדש שתלוי ב-rules חדשים ירוץ מול הישנים בחלון הביניים. בהידוק rules הסדר ההפוך הוא הנכון.
- **למה:**
  - הפונקציות נפרסות ידנית מהמחשב, ולכן אין ודאות שמה שב-production תואם ל-main.
  - שגיאת טיפוס ב-`functions/` לא נתפסת.
  - שרת MCP יהיה פונקציה, ולכן זה חוסם.
- **תיקון:**
  - job של `functions`: `npm ci && npm run build` ב-`functions/`.
  - deploy של functions עם `--only functions:<name>` לפי שינוי. לפחות build ו-typecheck בכל PR.
  - שלב בדיקות (T-1) כתנאי ל-deploy.
  - `on: pull_request` ל-build ובדיקות בלבד.
  - סדר ה-deploy נקבע לפי סוג השינוי. במקרה של ספק: rules שמרחיבים הרשאות לפני הלקוח, ו-rules שמצמצמים אחריו.
- **תזמון:** לפני MCP.

### X-4. תיעוד מיושן

- **חומרה:** נמוך (אבל מטעה מודלים עתידיים)
- **ראיות:**
  - **`CLAUDE_GUIDELINES.md`:**
    - "Current State (as of v1.5.0)" ו-"Recent Changes (v1.5.0)", כשהגרסה בפועל היא 1.20.0.
    - "Key Files" חלקי.
    - "`reminderPending` must always be written" לא נכון עוד (D-3).
    - "increment patch version for each change" סותר את הנוהג בפועל (minor לכל פיצ'ר).
    - "Test Files: Place tests next to source" מתאר מבנה שלא קיים.
    - "Branch names ... end with session ID" לא נאכף.
  - **`src/sw.ts:125-129`:** הערת persistence שגויה (C-6).
  - **`src/hooks/useOrphanSharedNotes.ts:33`:** הנחה שגויה (SH-2).
  - **`src/hooks/usePushRegistration.ts:9`:** מפנה ל-`ReminderPicker`, שלא קיים.
  - **`README.md:109-110`:** "הצפנה אופציונלית" ו-"AI Integration" כפיצ'רים מתוכננים. `settings.encryptionEnabled` קיים בטיפוסים בלי מימוש.
  - **`thinking/phase-1-2-complete.md`, `setup-complete.md`, `auth-complete.md`, `plan-01.txt`:** היסטוריים. כדאי להעביר ל-`thinking/archive/`.
  - **`.claude/settings.local.json`:** בקרת גרסאות. זה קובץ הגדרות מקומי של Claude Code שבדרך כלל ב-`.gitignore`, והריפו ציבורי.
    - נבדק: הקובץ מכיל רק רשימת הרשאות Bash, בלי secrets.
    - אבל הוא חושף הרגלי עבודה, וכולל הרשאות רחבות (`Bash(curl:*)`, `Bash(git push:*)`) שיחולו על כל מי שמשכפל את הריפו.
  - **`backup.ts`/`backupFormat.ts`:** מתארים JSON "שאפשר לשחזר ממנו במדויק", אבל אין מסלול שחזור באפליקציה.
- **תיקון:** לרענן את `CLAUDE_GUIDELINES.md` (ראו §11), להעביר מסמכים היסטוריים לארכיון, ולהוציא את `settings.local.json` מה-repo.
- **תזמון:** יכול לחכות, חוץ מהסעיף על `reminderPending` בהנחיות, שכדאי לתקן לפני MCP.

---

## 11. סדר תיקון מומלץ

כל צעד קטן, נבדק בנפרד ונכנס ב-commit משלו עם העלאת גרסה ורשומה ב-WhatsNew, לפי ההנחיות. הקבוצות בסדר ביצוע.

### קבוצה A: עצירת אובדן מידע מיידי (בלי תלות ב-MCP, להתחיל כאן)

| צעד | תוכן | בדיקה |
|---|---|---|
| A1 | C-4: ה-debounce צובר patch | ידני: שינוי כותרת ואז V מהיר, ובדיקה ב-Firestore console ששניהם נשמרו |
| A2 | C-2: התבניות לא "מאתחלות" תוכן שלא פוענח. הודעה + "המר לטקסט". האתחול רק על `''` | פתק plain ששונה ל-checklist → עריכה → הטקסט נשאר |
| A3 | C-3: Share "הוסף" רק ל-plain ו-workplan, או הוספה כפריט דרך פונקציית append | שיתוף לרשימת קניות → נוסף מוצר, ה-JSON תקין |
| A4 | E-3: `NoteForm` נסגר רק בהצלחה | אופליין או rules חוסמים → הטופס נשאר פתוח עם התוכן |

### קבוצה B: תשתית (תנאי לכל השאר)

| צעד | תוכן | בדיקה |
|---|---|---|
| B1 | T-1: `vitest` ללקוח ול-functions + בדיקות pure (recurrence, timezone, debounce, productMatching, backupFormat) | `npm test` ירוק מקומית |
| B2 | X-3: CI עם build ו-typecheck של `functions/`, `npm test`, `pull_request` trigger, Node 22 | PR פתוח מריץ את הכל |
| B3 | S-7: נעיצת actions ל-SHA, החלפת `w9jds`, ו-WIF אם אפשר | deploy ל-main עובד |
| B4 | Emulator + `@firebase/rules-unit-testing` + בדיקות rules ראשונות (מצב קיים) | בדיקות מתעדות את ההתנהגות הנוכחית |
| B5 | E-1: דיווח שגיאות (לקוח) + התראת לוגים (functions) | שגיאה יזומה מגיעה לדיווח |

### קבוצה C: אבטחה ושיתוף (לפני MCP)

| צעד | תוכן | בדיקה |
|---|---|---|
| C1 | S-1: rules ל-`userLookup` (get בלבד, email תואם ומאומת) + callable `findUserByEmail` | בדיקות rules: `list` נדחה, email זר נדחה. שיתוף לפי אימייל עובד |
| C2 | SH-1 (חלק 1): נמען מסיר את עצמו (rule + כפתור). מחליף את ה-"מחק" המת ב-`SharedWithMe` | בדיקת rule + ידני |
| C3 | ST-1: ערוץ שגיאה ב-listeners, `hasLoaded` ב-`noteStore`, והבחנה בין טוען, שגיאה וריק | rules חוסמים זמנית ב-emulator → מוצגת שגיאה ולא "אין קטגוריות" |
| C4 | ST-4: Login עם יעד חזרה | `/share?shareId=` כשלא מחוברים → התחברות → חזרה לשיתוף |
| C5 | X-2: workbox כתלות מפורשת. X-4: תיקון `CLAUDE_GUIDELINES.md` | build ו-SW עובדים |

**כאן אפשר להתחיל את MCP שלב 1 (קריאה בלבד)**, במקביל לקבוצות D ו-E.

### קבוצה D: מודל נתונים (בסיס ל-MCP ולתיקון C-1)

| צעד | תוכן | בדיקה |
|---|---|---|
| D1 | D-2: החלטה על `packages/notes-core` (או `src/types/content.ts` מינימלי). העברת טיפוסי התוכן, `recurrence` ו-`timezone` | שתי החבילות מתקמפלות |
| D2 | D-1 + D-3: codecs עם שמירת שדות לא מוכרים ו-`{ok:false}` על כשל. חיבור התבניות, `backupFormat` ו-`Share` | unit: round-trip, שדות לא מוכרים נשמרים, תוכן פגום לא מתרוקן |
| D3 | הוספת `revision` בכל כתיבה בלקוח (`increment(1)`) | קיים במסמכים אחרי עריכה |

### קבוצה E: concurrency ושיתוף (לפני MCP שלב 2)

| צעד | תוכן | בדיקה |
|---|---|---|
| E1 | C-1 שלב א': סימון V ושינוי פריט כ-transaction ברמת פריט (toggle/patch לפי `itemId`) | שני דפדפנים מסמנים פריטים שונים במקביל → שניהם נשמרים |
| E2 | C-1 שלב ב': `NoteView` מאמץ עדכונים חיים כשאין טיוטה, ו-3-way merge כשיש | שני דפדפנים עורכים טקסט של פריטים שונים → merge |
| E3 | R-2 + SH-2: rules עם `affectedKeys` לשותף, והסתרת "העבר"/"מחק" ממי שאינו בעלים. הצגת פתקים יתומים גם לבעלים | בדיקות rules + ידני |
| E4 | SH-3: החלטת מודל שיתוף קטגוריה (א' או ב') ומימוש, כולל `sharedVia` | A משתף קטגוריה ויוצר פתק → B רואה. ביטול שיתוף קטגוריה לא מבטל שיתוף ישיר |
| E5 | F-1: claim-then-send ב-scheduler | integration: מחיקת reminder באמצע ההרצה → אין שליחה כפולה |
| E6 | F-2: reconcile מהמסמך הנוכחי ב-`syncNoteReminders` + יציאה מוקדמת (F-4) | integration: שתי כתיבות מהירות → התזכורות לפי האחרונה |
| E7 | C-5: reorder בלי `updatedAt` ורק לשינויים | גרירה → כתיבות רק למה שזז |

**כאן אפשר להתחיל את MCP שלב 2 (כתיבה).**

### קבוצה F: יכול לחכות

- C-6: offline persistence + חיווי (רק אחרי E2).
- R-1: ולידציית סכמה ב-rules. R-3: נעילת `userId`.
- S-2: link preview בשרת. S-4: הקשחת ה-SW. S-6: security headers (יחד עם `firebase.json` של MCP).
- SH-4: תזכורות לשותפים והצמדה אישית.
- F-3, F-5 (`timeZone` למשתמש).
- D-4, ST-2, ST-3, E-2.
- X-1: ניקוי קוד מת (אפשר גם כחימום בכל שלב).
