# תוכנית פיתוח מפורטת - אפליקציית פתקים

## 📋 תקציר פרויקט

אפליקציית ווב לניהול פתקים מאורגנים בקטגוריות, עם גלילה אנכית של קטגוריות וגלילה אופקית של פתקים בתוך כל קטגוריה.

---

## 🛠 סטאק טכנולוגי מומלץ

### Frontend
- **React 18** + **TypeScript** - לבניה טיפוסית ובטוחה
- **Vite** - כלי build מהיר ומודרני
- **Tailwind CSS** - לעיצוב עם תמיכה מלאה ב-RTL
- **Zustand** - ניהול state קל ופשוט
- **React Router v6** - ניתוב

### Backend & Services
- **Firebase**:
  - **Firestore** - מסד נתונים
  - **Firebase Auth** - אימות משתמשים
  - **Firebase Storage** - אחסון קבצים (אם נצטרך)
- **Firebase Hosting** - אחסון האפליקציה

### עורך טקסט עשיר
- **Tiptap** - עורך מודרני ועוצמתי (מבוסס ProseMirror)
  - תמיכה מצוינת ב-RTL
  - גמיש וניתן להרחבה
  - תמיכה ברשימות מסומנות (checklist)

### תרגום ובינלאום
- **i18next** + **react-i18next** - תמיכה רב-לשונית
- נתחיל עם עברית, נכין תשתית לשפות נוספות

### PWA
- **Vite PWA Plugin** - להפיכת האפליקציה ל-PWA
- **Workbox** - Service Workers לעבודה אופליין

---

## 📊 מבנה מסד הנתונים (Firestore)

### Collection: users
```typescript
{
  uid: string,                    // Firebase Auth ID
  email: string,
  displayName: string,
  photoURL: string | null,
  createdAt: Timestamp,
  settings: {
    language: 'he' | 'en',        // ברירת מחדל: 'he'
    defaultCategoryColor: string, // ברירת מחדל: '#3B82F6'
    theme: 'light' | 'dark',      // ברירת מחדל: 'light'
    encryptionEnabled: boolean,   // ברירת מחדל: false (שלב 4)
    encryptionLevel: 'none' | 'content' | 'full' // ברירת מחדל: 'none'
  }
}
```

### Collection: categories
```typescript
{
  id: string,
  name: string,
  color: string,                  // ברירת מחדל: '#3B82F6' (כחול)
  icon: string | null,            // ברירת מחדל: null
  order: number,                  // לסדר תצוגה
  userId: string,                 // בעלים
  sharedWith: string[],           // משתמשים משותפים (Phase 3)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Collection: notes
```typescript
{
  id: string,
  title: string,
  content: string,                // JSON של Tiptap
  categoryId: string,
  templateType: 'plain' | 'checklist' | 'recipe' | 'shopping' | 'idea',
  tags: string[],                 // ברירת מחדל: []
  color: string | null,           // ברירת מחדל: null (ירש מהקטגוריה)
  order: number,
  userId: string,
  sharedWith: string[],           // Phase 3
  createdAt: Timestamp,
  updatedAt: Timestamp,
  isPinned: boolean               // ברירת מחדל: false
}
```

### Collection: templates (Phase 2)
```typescript
{
  id: string,
  type: 'plain' | 'checklist' | 'recipe' | 'shopping' | 'idea',
  name: string,                   // שם התבנית
  nameHe: string,                 // שם בעברית
  structure: object,              // מבנה התבנית (Tiptap JSON)
  icon: string,
  description: string,
  descriptionHe: string
}
```

---

## 📁 מבנה תיקיות הפרויקט

```
notes-app/
├── public/
│   ├── icons/                   # אייקונים ל-PWA
│   ├── manifest.json            # PWA manifest
│   └── robots.txt
├── src/
│   ├── assets/                  # תמונות, אייקונים
│   │   └── icons/
│   ├── components/              # קומפוננטים משותפים
│   │   ├── common/              # כפתורים, אינפוטים, מודלים
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   └── Button.test.tsx
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── FAB/            # Floating Action Button
│   │   │   └── index.ts
│   │   ├── layout/              # Layout קומפוננטים
│   │   │   ├── Header/
│   │   │   ├── Sidebar/
│   │   │   └── Footer/
│   │   ├── category/            # קומפוננטים הקשורים לקטגוריות
│   │   │   ├── CategoryList/
│   │   │   ├── CategoryItem/
│   │   │   ├── CategoryForm/
│   │   │   └── CategoryCard/
│   │   ├── note/                # קומפוננטים הקשורים לפתקים
│   │   │   ├── NoteList/
│   │   │   ├── NoteCard/
│   │   │   ├── NoteForm/
│   │   │   ├── NoteEditor/
│   │   │   └── NoteTemplates/
│   │   └── auth/                # קומפוננטים של אימות
│   │       ├── LoginForm/
│   │       ├── GoogleLogin/
│   │       └── ProtectedRoute/
│   ├── pages/                   # דפי האפליקציה
│   │   ├── Home/               # דף הבית - תצוגת הקטגוריות והפתקים
│   │   ├── Login/              # דף התחברות
│   │   ├── CategoryView/       # תצוגת קטגוריה מלאה (grid של כרטיסים)
│   │   ├── NoteView/           # תצוגת פתק בודד
│   │   └── Settings/           # הגדרות
│   ├── hooks/                   # Custom React Hooks
│   │   ├── useAuth.ts          # ניהול אימות
│   │   ├── useCategories.ts    # שליפת וניהול קטגוריות
│   │   ├── useNotes.ts         # שליפת וניהול פתקים
│   │   ├── useSearch.ts        # חיפוש
│   │   └── useLocalStorage.ts  # PWA - אחסון מקומי
│   ├── store/                   # Zustand State Management
│   │   ├── authStore.ts        # State של משתמש
│   │   ├── categoryStore.ts    # State של קטגוריות
│   │   ├── noteStore.ts        # State של פתקים
│   │   └── uiStore.ts          # State של UI (מודלים, טעינות)
│   ├── services/                # שירותים חיצוניים
│   │   ├── firebase/
│   │   │   ├── config.ts       # הגדרות Firebase
│   │   │   ├── auth.ts         # פונקציות אימות
│   │   │   ├── firestore.ts    # פונקציות Firestore
│   │   │   └── storage.ts      # פונקציות Storage
│   │   └── api/
│   │       ├── categories.ts   # API של קטגוריות
│   │       └── notes.ts        # API של פתקים
│   ├── utils/                   # פונקציות עזר
│   │   ├── constants.ts        # קבועים
│   │   ├── helpers.ts          # פונקציות כלליות
│   │   ├── validators.ts       # ולידציות
│   │   └── defaults.ts         # ערכי ברירת מחדל
│   ├── types/                   # TypeScript Types
│   │   ├── user.ts
│   │   ├── category.ts
│   │   ├── note.ts
│   │   └── template.ts
│   ├── i18n/                    # תרגומים
│   │   ├── index.ts
│   │   ├── he.json             # תרגום עברית
│   │   └── en.json             # תרגום אנגלית
│   ├── styles/                  # עיצוב גלובלי
│   │   ├── globals.css
│   │   └── tailwind.css
│   ├── App.tsx                  # קומפוננטת שורש
│   ├── main.tsx                 # נקודת כניסה
│   ├── router.tsx               # הגדרת routes
│   └── vite-env.d.ts
├── .env.example                 # דוגמת משתני סביבה
├── .env.local                   # משתני סביבה (לא בגיט)
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## 🎯 ערכי ברירת מחדל (Defaults)

### קובץ: `src/utils/defaults.ts`
```typescript
/**
 * ערכי ברירת מחדל לאפליקציה
 */

// צבעי ברירת מחדל לקטגוריות
export const DEFAULT_COLORS = {
  category: '#3B82F6',      // כחול
  note: null,               // ירש מהקטגוריה
}

// צבעים זמינים לבחירה
export const AVAILABLE_COLORS = [
  '#3B82F6', // כחול
  '#10B981', // ירוק
  '#F59E0B', // כתום
  '#EF4444', // אדום
  '#8B5CF6', // סגול
  '#EC4899', // ורוד
  '#6B7280', // אפור
  '#14B8A6', // טורקיז
]

// הגדרות משתמש ברירת מחדל
export const DEFAULT_USER_SETTINGS = {
  language: 'he',
  defaultCategoryColor: '#3B82F6',
  theme: 'light',
}

// סוגי תבניות
export const TEMPLATE_TYPES = {
  PLAIN: 'plain',
  CHECKLIST: 'checklist',
  RECIPE: 'recipe',
  SHOPPING: 'shopping',
  IDEA: 'idea',
}

// שמות תבניות בעברית
export const TEMPLATE_NAMES_HE = {
  plain: 'טקסט חופשי',
  checklist: 'רשימת משימות',
  recipe: 'מתכון בישול',
  shopping: 'רשימת קניות',
  idea: 'רעיון מהיר',
}
```

---

## 🚀 תוכנית יישום בשלבים

### **שלב 1 - MVP (2-3 שבועות)**

#### 1.1 הקמת פרויקט (יום 1)
- [ ] יצירת פרויקט React + Vite + TypeScript
- [ ] התקנת תלויות בסיסיות
- [ ] הגדרת Tailwind CSS עם RTL
- [ ] הגדרת Firebase Project
- [ ] הגדרת ESLint + Prettier
- [ ] יצירת מבנה תיקיות

#### 1.2 אימות משתמשים (ימים 2-3)
- [ ] הגדרת Firebase Auth
- [ ] דף Login עם Google Auth
- [ ] דף Login עם Email/Password
- [ ] Protected Routes
- [ ] AuthStore (Zustand)
- [ ] Hook: useAuth

#### 1.3 קטגוריות - בסיסי (ימים 4-6)
- [ ] Firestore: Categories Collection
- [ ] UI: רשימת קטגוריות אנכית
- [ ] קומפוננטה: CategoryList
- [ ] קומפוננטה: CategoryItem
- [ ] קומפוננטה: CategoryForm (הוספה/עריכה)
- [ ] פעולות: יצירה, עריכה, מחיקה
- [ ] Hook: useCategories
- [ ] ברירת מחדל: צבע כחול

#### 1.4 פתקים - בסיסי (ימים 7-10)
- [ ] Firestore: Notes Collection
- [ ] UI: רשימת פתקים אופקית (לכל קטגוריה)
- [ ] קומפוננטה: NoteList (גלילה אופקית)
- [ ] קומפוננטה: NoteCard (תצוגה)
- [ ] קומפוננטה: NoteForm (טקסט פשוט בלבד)
- [ ] פעולות: יצירה, עריכה, מחיקה
- [ ] Hook: useNotes
- [ ] חובה לבחור קטגוריה בהוספת פתק

#### 1.5 FAB (Floating Action Button) (יום 11)
- [ ] קומפוננטה: FAB
- [ ] תפריט פעולות: "הוסף פתק" / "הוסף קטגוריה"
- [ ] מודל להוספת קטגוריה
- [ ] מודל להוספת פתק

#### 1.6 UI/UX בסיסי (ימים 12-14)
- [ ] Header עם לוגו ולחצן התנתקות
- [ ] עיצוב responsive
- [ ] טעינות (Loaders)
- [ ] הודעות שגיאה/הצלחה (Toasts)
- [ ] עיצוב RTL מלא

#### 1.7 בדיקות ותיקוני באגים (ימים 15-16)
- [ ] בדיקות ידניות
- [ ] תיקון באגים
- [ ] אופטימיזציה ראשונית

---

### **שלב 2 - תכונות חיוניות (2-3 שבועות)**

#### 2.1 עורך טקסט עשיר - Tiptap (ימים 1-3)
- [ ] התקנת Tiptap
- [ ] קומפוננטה: RichTextEditor
- [ ] תמיכה בעיצוב: מודגש, נטוי, קו תחתון, קו חוצה
- [ ] תמיכה בצבעי טקסט
- [ ] תמיכה ברקע צבעוני
- [ ] תמיכה ברשימות (bullet, numbered)
- [ ] תמיכה ב-RTL מלא

#### 2.2 תבניות (ימים 4-7)
- [ ] Firestore: Templates Collection
- [ ] תבנית: טקסט חופשי
- [ ] תבנית: רשימת משימות (checklist)
- [ ] תבנית: מתכון בישול
- [ ] תבנית: רשימת קניות
- [ ] תבנית: רעיון מהיר
- [ ] בחירת תבנית ביצירת פתק
- [ ] קומפוננטה: TemplateSelector

#### 2.3 חיפוש (ימים 8-10)
- [ ] קומפוננטה: SearchBar
- [ ] חיפוש בכותרות פתקים
- [ ] חיפוש בתוכן פתקים
- [ ] חיפוש בקטגוריות
- [ ] Hook: useSearch
- [ ] הדגשת תוצאות

#### 2.4 תצוגת קטגוריה מלאה (ימים 11-13)
- [ ] דף: CategoryView
- [ ] רשימה דו-עמודתית של פתקים (Grid)
- [ ] כרטיסים עם כותרת ותקציר
- [ ] מעבר לתצוגת פתק מלא

#### 2.5 תגיות (Tags) (ימים 14-15)
- [ ] הוספת שדה tags לפתקים
- [ ] קומפוננטה: TagInput
- [ ] קומפוננטה: TagList
- [ ] סינון לפי תגיות
- [ ] ברירת מחדל: מערך ריק

#### 2.6 צבעים ואייקונים (יום 16)
- [ ] בורר צבעים לקטגוריות
- [ ] בורר צבעים לפתקים (אופציונלי)
- [ ] בורר אייקונים לקטגוריות
- [ ] קומפוננטה: ColorPicker
- [ ] קומפוננטה: IconPicker

#### 2.7 PWA - עבודה אופליין (ימים 17-19)
- [ ] הגדרת Service Worker
- [ ] Manifest.json
- [ ] אייקונים ל-PWA
- [ ] Cache Strategy
- [ ] Offline Sync
- [ ] התקנה על המכשיר

---

### **שלב 3 - שיתוף ושיתוף פעולה (2-3 שבועות)**

#### 3.1 שיתוף פתקים (ימים 1-5)
- [ ] UI: כפתור "שתף"
- [ ] מודל שיתוף
- [ ] הוספת משתמשים (לפי email)
- [ ] הרשאות: צפייה/עריכה
- [ ] עדכון Firestore Rules

#### 3.2 שיתוף קטגוריות (ימים 6-8)
- [ ] שיתוף קטגוריה שלמה
- [ ] כל הפתקים בקטגוריה משותפים

#### 3.3 עדכונים בזמן אמת (ימים 9-12)
- [ ] Firestore Listeners
- [ ] עדכון אוטומטי של UI
- [ ] סנכרון בין משתמשים

#### 3.4 התראות (ימים 13-15)
- [ ] התראה על שיתוף חדש
- [ ] התראה על עריכת פתק משותף

---

### **שלב 4 - תכונות מתקדמות (לפי צורך)**

#### 4.1 🔒 הצפנה (Encryption) - אופציונלי למשתמשים
- [ ] תשתית הצפנה (Web Crypto API)
- [ ] הגדרות הצפנה בפרופיל משתמש
- [ ] Hybrid Encryption - הצפנת תוכן בלבד
- [ ] ניהול מפתחות (Key Management)
- [ ] UI להפעלה/כיבוי הצפנה
- [ ] הסבר למשתמש על הצפנה ומגבלותיה
- [ ] שחזור מפתח (Recovery) - optional

#### 4.2 בינלאום (i18n)
- [ ] תרגום לאנגלית
- [ ] תרגומים נוספים
- [ ] בורר שפה בהגדרות

#### 4.3 ייצוא/ייבוא
- [ ] ייצוא לPDF
- [ ] ייצוא לMarkdown
- [ ] ייצוא לJSON
- [ ] ייבוא מJSON

#### 4.4 אופטימיזציה
- [ ] React.memo למניעת רינדורים מיותרים
- [ ] Virtualization לרשימות ארוכות
- [ ] Code Splitting
- [ ] Lazy Loading

#### 4.5 הכנה לבינה מלאכותית
- [ ] API endpoints לשירותי AI
- [ ] בחירת קטגוריה אוטומטית
- [ ] בחירת תבנית אוטומטית
- [ ] הצעות השלמה

---

## 🎨 עיצוב ו-UI

### צבעי ברירת מחדל
```css
:root {
  --color-primary: #3B82F6;        /* כחול */
  --color-secondary: #10B981;      /* ירוק */
  --color-accent: #F59E0B;         /* כתום */
  --color-danger: #EF4444;         /* אדום */
  --color-bg: #F9FAFB;             /* רקע בהיר */
  --color-text: #1F2937;           /* טקסט כהה */
}
```

### עקרונות עיצוב
1. **RTL First** - כל העיצוב מותאם לעברית
2. **Mobile First** - responsive מלא
3. **Clean & Minimal** - ממשק נקי ופשוט
4. **Accessibility** - נגישות מלאה

---

## 🧪 בדיקות

### Phase 1
- בדיקות ידניות בלבד
- דגש על זרימות בסיסיות

### Phase 2 ואילך
- Unit Tests (Vitest)
- Component Tests (React Testing Library)
- E2E Tests (Playwright) - אופציונלי

---

## 📦 פריסה (Deployment)

### סביבות
1. **Development** - מקומי
2. **Staging** - Firebase Hosting (פרויקט נפרד)
3. **Production** - Firebase Hosting

### CI/CD (Phase 3+)
- GitHub Actions
- Deploy אוטומטי ל-staging בכל push
- Deploy ל-production בתגיות

---

## 🔒 אבטחה

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Categories
    match /categories/{categoryId} {
      allow read: if request.auth != null &&
        (resource.data.userId == request.auth.uid ||
         request.auth.uid in resource.data.sharedWith);
      allow create: if request.auth != null &&
        request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }

    // Notes
    match /notes/{noteId} {
      allow read: if request.auth != null &&
        (resource.data.userId == request.auth.uid ||
         request.auth.uid in resource.data.sharedWith);
      allow create: if request.auth != null &&
        request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## 📚 תיעוד קוד

### כללים
1. **הערה לפני כל פונקציה**
   ```typescript
   /**
    * יוצר קטגוריה חדשה במערכת
    * @param name - שם הקטגוריה
    * @param color - צבע הקטגוריה (ברירת מחדל: כחול)
    * @returns Promise עם ID הקטגוריה החדשה
    */
   async function createCategory(name: string, color?: string): Promise<string> {
     // ...
   }
   ```

2. **הערה בראש כל קומפוננטה**
   ```typescript
   /**
    * קומפוננטת כרטיס פתק
    * מציגה כותרת ותקציר של הפתק
    *
    * @component
    * @example
    * <NoteCard note={note} onClick={handleClick} />
    */
   export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick }) => {
     // ...
   }
   ```

3. **הערה לכל import**
   ```typescript
   // React - ספריית UI
   import React from 'react';

   // Zustand - ניהול state
   import { useStore } from 'zustand';

   // קומפוננטות פנימיות
   import { Button } from '@/components/common/Button';
   ```

---

## 🚦 צ'קליסט התחלה

- [ ] קריאת והבנת כל התוכנית
- [ ] הכנת סביבת פיתוח (Node.js, VS Code, Git)
- [ ] יצירת חשבון Firebase
- [ ] יצירת פרויקט ב-Firebase Console
- [ ] שיחה נוספת להחלטות עיצוב ו-UI
- [ ] התחלת Phase 1!

---

## 📞 שאלות פתוחות

1. **עיצוב**: האם יש לך דוגמת עיצוב או אפליקציה מועדפת?
2. **פונטים**: אילו פונטים עבריים לתמוך? (Assistant, Rubik, Heebo?)
3. **צבעים**: האם הפלטה שהצעתי מתאימה?
4. **Mobile**: האם נרצה אפליקציית מובייל נטיבית בעתיד?
5. **גיבוי**: האם נרצה ייצוא אוטומטי לגיבוי?

---

## ✅ הצעד הבא

אני ממליץ להתחיל בשלב 1 - MVP.
נתחיל עם:
1. יצירת הפרויקט
2. הגדרת Firebase
3. בניית מערכת האימות

**האם אתה מוכן להתחיל?** 🚀
