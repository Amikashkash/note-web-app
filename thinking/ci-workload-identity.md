# מעבר ל-Workload Identity Federation בפריסה מ-GitHub Actions

> הוראות לביצוע ידני ב-Google Cloud.
> **סטטוס: הושלם.** כל השלבים בוצעו. הפריסה מ-`main` עובדת עם WIF (release של Hosting על ידי `github-deployer`), ומפתח ה-JSON הישן מושבת.
> נכתב מול branch `claude/group-b-infra` (צעד B3 ב-`architecture-review.md`).

## למה

היום הפריסה משתמשת במפתח JSON של service account, ששמור כ-secret ב-GitHub:
- המפתח לא פג אף פעם.
- הוא מאפשר גישה מכל מקום, לא רק מ-GitHub.
- דליפה שלו (log, action פגום, workflow שמישהו שינה) נותנת הרשאות פריסה לפרויקט עד שמישהו שם לב ומבטל אותו.

ב-Workload Identity Federation (WIF) אין מפתח בכלל. GitHub מנפיק לכל הרצה token קצר (OIDC) שמתאר בדיוק איזה repo ואיזה branch רצים, ו-Google מחליף אותו בהרשאות זמניות, **רק** אם התנאים שהגדרת מתקיימים.

## לפני שמתחילים

- `gcloud` מותקן ומחובר עם חשבון שהוא Owner בפרויקט: `gcloud auth login`.
- מגדירים משתנים (ב-Git Bash; ב-PowerShell `$env:NAME="..."`):

```bash
PROJECT_ID="notes-4-me"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
REPO="Amikashkash/note-web-app"
SA_NAME="github-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "$PROJECT_NUMBER"   # צריך להדפיס מספר
```

## שלב 1: הפעלת ה-APIs

```bash
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  --project "$PROJECT_ID"
```

## שלב 2: service account ייעודי לפריסה, עם הרשאות מינימליות

לא ממחזרים את `firebase-adminsdk-...`: יש לו הרשאות רחבות בהרבה ממה שפריסה צריכה.

```bash
gcloud iam service-accounts create "$SA_NAME" \
  --project "$PROJECT_ID" \
  --display-name "GitHub Actions deployer"

for ROLE in \
  roles/firebasehosting.admin \
  roles/firebaserules.admin \
  roles/datastore.indexAdmin \
  roles/serviceusage.serviceUsageConsumer
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role "$ROLE" \
    --condition=None
done
```

| תפקיד | בשביל |
|---|---|
| `firebasehosting.admin` | פריסת Hosting |
| `firebaserules.admin` | פריסת `firestore.rules` |
| `datastore.indexAdmin` | פריסת `firestore.indexes.json` |
| `serviceusage.serviceUsageConsumer` | ה-Firebase CLI בודק שה-APIs פעילים |

**כשתתווסף פריסה של שרת ה-MCP** (Hosting rewrite לפונקציה), הפריסה צריכה גם `roles/run.viewer`. פריסת Functions מה-CI, אם תוחלט, צריכה עוד תפקידים. לא מוסיפים אותם מראש.

## שלב 3: Workload Identity Pool ו-Provider של GitHub

```bash
gcloud iam workload-identity-pools create "github" \
  --project "$PROJECT_ID" \
  --location "global" \
  --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc "github-oidc" \
  --project "$PROJECT_ID" \
  --location "global" \
  --workload-identity-pool "github" \
  --display-name "GitHub OIDC" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository == '${REPO}' && assertion.ref == 'refs/heads/main'"
```

ה-`attribute-condition` הוא שכבת ההגנה העיקרית:
- **רק** ה-repo הזה, **ורק** ה-branch `main`, יכולים לקבל הרשאות.
- הרצה על pull request, על branch אחר או מ-fork נדחית כבר בשלב ההחלפה, גם אם מישהו ישנה את ה-workflow.

## שלב 4: לאפשר ל-repo להתחזות ל-service account

```bash
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role "roles/iam.workloadIdentityUser" \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"
```

## שלב 5: שני ערכים ל-GitHub

אלה לא סודות (שם של provider וכתובת של service account), ולכן נשמרים כ-**Variables** ולא כ-Secrets:
Settings → Secrets and variables → Actions → **Variables** → New repository variable.

| שם | ערך |
|---|---|
| `WIF_PROVIDER` | **הטקסט שהפקודה למטה מדפיסה** (מתחיל ב-`projects/` ואחריו מספר), ולא המילים "הפלט של הפקודה" |
| `WIF_SERVICE_ACCOUNT` | `github-deployer@notes-4-me.iam.gserviceaccount.com` |

```bash
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-oidc"
```

## שלב 6: לעדכן אותי

כשהשלבים 1 עד 5 גמורים, אני מעדכן את ה-job `deploy` ב-workflow. זה הקוד שייכנס, לעיונך:

```yaml
  deploy:
    permissions:
      contents: read
      id-token: write   # מאפשר ל-GitHub להנפיק את ה-OIDC token

    steps:
      # ... checkout, setup-node, npm ci, build - ללא שינוי ...

      - name: Authenticate to Google Cloud (WIF)
        uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}
          create_credentials_file: true   # מגדיר GOOGLE_APPLICATION_CREDENTIALS לשלבים הבאים

      - name: Deploy Hosting, Firestore rules and indexes
        run: npx --no-install firebase deploy --only hosting,firestore --project notes-4-me --non-interactive
```

- `FirebaseExtended/action-hosting-deploy` יוצא: הוא דורש מפתח JSON. ה-CLI עובד עם ההרשאות הזמניות.
- `id-token: write` ניתן **רק** ל-job הפריסה, לא ל-job הבדיקות.

## שלב 7: בדיקה, ורק אחר כך ביטול המפתח

1. Actions → **CI and deploy** → Run workflow על `main`. ה-deploy צריך להצליח.
2. בודקים ש-https://notes-4-me.web.app עלה, ושב-Firebase Console → Firestore → Rules מופיעה פריסה חדשה.
3. רק אחרי הצלחה:
   - מוחקים את ה-secret `FIREBASE_SERVICE_ACCOUNT` ב-GitHub.
   - ב-Google Cloud Console → IAM → Service Accounts → ה-account שהמפתח שלו היה ב-secret → Keys: **מבטלים (Delete) את המפתח** שהיה ב-GitHub. בלי השלב הזה, המפתח הישן ממשיך לעבוד בכל מקום שהוא דלף אליו.
   - מוחקים גם את `FIREBASE_TOKEN`, אם עדיין קיים.

## חזרה אחורה

אם משהו לא עובד: מחזירים את ה-job לגרסה הקודמת (עם `FIREBASE_SERVICE_ACCOUNT`), כל עוד המפתח עוד לא בוטל. לכן **לא מבטלים את המפתח לפני שפריסה עם WIF הצליחה.**

## שגיאות נפוצות

| הודעה | סיבה |
|---|---|
| `unable to generate an access token... permission 'iam.serviceAccounts.getAccessToken' denied` | שלב 4 חסר, או שה-`principalSet` מכיל מספר פרויקט שגוי |
| `The given credential is rejected by the attribute condition` | ההרצה לא מ-`main`, או ששם ה-repo בתנאי לא מדויק (רגיש לאותיות גדולות) |
| `HTTP 403 ... firebaserules` / `datastore` | חסר תפקיד משלב 2 |
| `Unable to acquire ID token` | חסר `id-token: write` ב-permissions של ה-job |
| `Failed to authenticate, have you run firebase login?` (בשלב ה-deploy) | הודעה כללית של firebase-tools שבולעת את הסיבה האמיתית. מאז `token_format: access_token`, תקלות ב-provider, בתנאי או ב-binding נכשלות כבר בשלב ה-auth, עם הודעה מפורשת. אם ה-auth עובר וה-deploy עדיין נכשל, מריצים את ה-deploy ידנית עם `--debug` במחשב מקומי ולא ב-CI, כי הלוג של ריפו ציבורי גלוי לכולם ועלול לכלול tokens. בלוק אבחון עם סינון tokens היה ב-workflow (PR #3) והוסר אחרי שהפריסה עברה, וניתן לשחזר אותו מההיסטוריה. "Premature close" פירושו באג ה-Node של [nodejs/node#63989](https://github.com/nodejs/node/issues/63989), והפתרון הוא לנעוץ את Node לגרסה מדויקת |
