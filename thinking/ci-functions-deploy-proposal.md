# הצעה: פריסת Cloud Functions מ-CI (לא בוצע)

> מסמך הצעה בלבד. שום שינוי לא בוצע - לא ב-workflow, לא ב-IAM. פונקציות הענן
> ממשיכות להיפרס ידנית מהמחשב (`firebase deploy --only functions:<name>`).
> נכתב מול branch `claude/housekeeping`, כהמשך ל-`thinking/ci-workload-identity.md`
> (שם מתועד WIF ל-Hosting ול-Firestore rules/indexes בלבד).

## המצב היום

CI (`test` job) כבר **בונה ובודק** את `functions/` בכל PR: `tsc`, `vitest`,
ו-emulator. מה שהוא **לא** עושה הוא `firebase deploy --only functions`. את
זה מריץ הבעלים ידנית, רואה את הפלט, ויכול לעצור אם משהו נראה לא בסדר.

## מה זה ידרוש

### 1. תפקידי IAM ל-`github-deployer`

הפריסה של `hosting` ו-`firestore` היום מסתפקת בארבעה תפקידים צרים
(`thinking/ci-workload-identity.md`). Cloud Functions **מגן ה-generation 2**
הן בפועל שירותי **Cloud Run**, עם trigger דרך **Eventarc** (טריגר Firestore,
`onNoteWritten`) או **Cloud Scheduler** (`sendDueReminders`), ובנייה דרך
**Cloud Build** שדוחפת image ל-**Artifact Registry**. פריסה שלהן מ-CI
דורשת בערך:

| תפקיד | בשביל |
|---|---|
| `roles/cloudfunctions.admin` | ניהול הפונקציות עצמן |
| `roles/run.admin` | הפריסה בפועל היא Cloud Run service |
| `roles/cloudbuild.builds.editor` | בניית ה-container בכל פריסה |
| `roles/artifactregistry.writer` | דחיפת ה-image שנבנה |
| `roles/eventarc.admin` | טריגר Firestore (`onNoteWritten`) |
| `roles/cloudscheduler.admin` | טריגר מתוזמן (`sendDueReminders`) |
| `roles/pubsub.admin` | Eventarc בנוי על Pub/Sub |
| `roles/storage.admin` (על ה-bucket של staging) | העלאת קוד המקור |
| `roles/iam.serviceAccountUser` | להתחזות לזהות הריצה של הפונקציות עצמן |

זו קפיצה מוחלטת בהיקף ההרשאות: מ"לכתוב קבצים סטטיים ומסמכי rules" ל"להריץ
קוד שרירותי בפרויקט, עם גישה לכל מה שהפונקציות עצמן ניגשות אליו" - ובמקרה
שלנו זה Admin SDK מלא ל-Firestore (עוקף rules לגמרי) ושליחת FCM לכל משתמש.

### 2. אין secret חדש

WIF כבר קיים. תוספת תפקידים ל-`github-deployer` הקיים (או, כמומלץ למטה,
service account חדש) לא דורשת שום סוד חדש ב-GitHub.

## הסיכונים

1. **שטח הפגיעה גדל בסדר גודל.** היום, גם אם ה-WIF ייפרץ במלואו, התוקף
   יכול לכתוב קבצים ל-Hosting ולשנות `firestore.rules`/`indexes` - חמור,
   אבל נראה לעין (שינוי ב-rules מופיע ב-Console, ופריסת Hosting מוחלפת
   כולה ואפשר לשחזר גרסה קודמת בלחיצה). פריסת Functions נותנת **הרצת קוד**
   בפרויקט, עם המפתחות שהקוד עצמו מחזיק - כלומר גישה שקטה לנתוני כל
   המשתמשים, ויכולת לשלוח push לכל מכשיר.
2. **אין "ערוץ תצוגה מקדימה" ל-Functions כמו ל-Hosting.** `channelId: live`
   מול preview channels ב-Hosting נותן safety net; ל-Functions אין מקבילה
   - פריסה היא מיידית ל-production.
3. **בדיקת ה-CI לא שקולה להרצה בפועל.** ה-emulator בודק לוגיקה, אבל לא
   תופס הכל: quota, IAM חסר, קונפיגורציה ספציפית ל-region (ראה commit
   `86b443a` באותו branch - טעות region שהתגלתה רק בפריסה אמיתית), עלות
   של misconfiguration (למשל scheduler שרץ כל שנייה במקום כל דקה).
4. **פריסה אוטומטית מסירה את הבדיקה האנושית האחרונה.** היום, מרגע ה-merge
   ועד שהבעלים בפועל מריץ `firebase deploy`, יש הזדמנות לראות את השינוי,
   להריץ אותו קודם ב-emulator באופן אינטראקטיבי, ולעצור. merge-to-main
   שמפעיל פריסת קוד שרץ מיד בפרודקשן מוחק את החלון הזה.
5. **תלות שרשרת אספקה גדלה.** כל dependency חדש ב-`functions/`, כל action
   שנעוץ ב-workflow, וכל תורם ל-PR (גם עם code review) הופכים לחלק משטח
   שיכול, במקרה של baget/malicious code שעבר review, להריץ קוד עם
   ההרשאות האלה - שהן, כאמור, שקולות בפועל להרשאות ה-Admin SDK של
   הפונקציות עצמן.

## המלצה

**לא כרגע.** הפריסה הנוכחית (בנייה+בדיקה ב-CI, פריסה ידנית) כבר תופסת את
רוב הערך: קוד שלא עובר build/test/emulator לא מגיע לשלב הפריסה בכלל.
התוספת של deploy אוטומטי מסירה את הבדיקה האנושית האחרונה בלי להוסיף בטיחות
מקבילה.

**הקשר ל-MCP:** `thinking/mcp-plan.md` מוסיף פונקציה חדשה עם משטח HTTP
פתוח לאינטרנט (OAuth endpoints). זה בדיוק השלב שבו שינויים ב-Functions
יהיו תכופים יותר ובעלי סיכון גבוה יותר - ולכן דווקא **לא** הזמן להוסיף
CI deploy אוטומטי להם. עדיף לחכות שהמשטח הזה יתייצב.

### אם וכאשר תרצה בכל זאת

1. **Service account נפרד**, לא `github-deployer` הקיים. כך פריצה של
   workflow ה-Hosting/Firestore (הנפוץ, שרץ בכל merge) לא נותנת אוטומטית
   גם הרשאות Functions.
2. **GitHub Environment עם required reviewers** על ה-job של פריסת
   Functions (Settings → Environments → `functions-deploy` → Required
   reviewers). כך הפריסה עדיין דרך CI (reproducible, לא תלויה במחשב של
   מישהו), אבל לא רצה עד שמישהו לוחץ Approve - משמר את הבדיקה האנושית
   בלי לחזור למחשב מקומי.
3. **פריסה לפונקציה בודדת בכל פעם** (`--only functions:<name>`) ולא
   `--only functions` גלובלי, כדי שסקירת ה-diff תדע בדיוק מה עומד להשתנות.
4. להריץ את זה קודם על branch נפרד, לא ישר על התהליך הראשי.

תפקידי IAM המדויקים ל-service account הנפרד הזה ייקבעו כשתהיה החלטה
ליישם, לא עכשיו.
