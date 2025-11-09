# 📝 אפליקציית פתקים

אפליקציית ווב מתקדמת לניהול פתקים מאורגנים בקטגוריות, עם תמיכה בשיתוף, תבניות מגוונות, ומצב כהה.

## ✨ תכונות עיקריות

- 🔐 **אימות משתמשים** - התחברות עם Email/Password
- 📂 **ניהול קטגוריות** - יצירה, עריכה, מחיקה והצמדה של קטגוריות
- 📝 **פתקים מתקדמים** - 5 סוגי תבניות (טקסט, משימות, מתכון, קניות, רעיון)
- 🎨 **עיצוב עשיר** - בחירת צבעים לקטגוריות ופתקים
- 🔍 **חיפוש חכם** - חיפוש בכותרות, תוכן ותגיות
- 🏷️ **תגיות** - ארגון פתקים עם תגיות
- 📌 **הצמדה** - הצמד פתקים וקטגוריות חשובים
- 👥 **שיתוף** - שתף קטגוריות ופתקים עם משתמשים אחרים
- 🌓 **מצב כהה** - תמיכה מלאה ב-Dark Mode
- 📱 **Responsive** - עובד מצוין בנייד ובדסקטופ
- ⏰ **תזכורות** - הגדר תזכורות לפתקים
- 🔄 **סנכרון בזמן-אמת** - עדכונים מיידיים בין מכשירים
- 🎯 **Drag & Drop** - שנה סדר פתקים בגרירה

## 🛠 טכנולוגיות

- **React 18** + **TypeScript**
- **Vite** - Build tool מהיר
- **Tailwind CSS v3** - עיצוב עם תמיכה מלאה ב-RTL
- **Zustand** - ניהול State
- **React Router v7** - ניתוב
- **Firebase** - Backend (Firestore + Auth)
- **Workbox** - PWA Support

## 🚀 התחלה מהירה

### 1. התקנת תלויות

```bash
npm install
```

### 2. הגדרת Firebase

1. צור פרויקט ב-[Firebase Console](https://console.firebase.google.com/)
2. העתק את קובץ `.env.example` ל-`.env.local`
3. מלא את פרטי הפרויקט שלך מ-Firebase

```bash
cp .env.example .env.local
```

### 3. הרצת סביבת פיתוח

```bash
npm run dev
```

האפליקציה תעלה ב-`http://localhost:5173`

### 4. Build לפרודקשן

```bash
npm run build
```

## 📁 מבנה הפרויקט

```
src/
├── assets/              # תמונות, אייקונים
├── components/          # קומפוננטים
│   ├── common/         # כפתורים, אינפוטים, מודלים
│   ├── layout/         # Header, Navigation
│   ├── category/       # CategoryList, CategoryItem, CategoryForm
│   ├── note/           # NotesList, NoteCard, NoteForm, NoteView
│   └── auth/           # Login, Register
├── pages/              # דפי האפליקציה (Home, Login, Category View)
├── hooks/              # Custom React Hooks (useNotes, useReminders)
├── store/              # Zustand State Management
├── services/           # Firebase, API
├── utils/              # פונקציות עזר
├── types/              # TypeScript Types
└── styles/             # CSS גלובלי

```

## 📋 סטטוס תכונות

### ✅ הושלמו
- ✅ מערכת אימות (Email/Password)
- ✅ ניהול קטגוריות מלא (CRUD)
- ✅ ניהול פתקים מלא (CRUD)
- ✅ 5 תבניות פתקים (Plain, Checklist, Recipe, Shopping, Idea)
- ✅ חיפוש גלובלי
- ✅ תגיות
- ✅ הצמדת פתקים וקטגוריות
- ✅ שיתוף קטגוריות ופתקים
- ✅ עדכונים בזמן-אמת
- ✅ מצב כהה
- ✅ תזכורות
- ✅ Drag & Drop לסידור פתקים
- ✅ תצוגת קטגוריה מלאה
- ✅ PWA Support
- ✅ דפי About, Privacy, Terms, What's New

### 🚧 בפיתוח
- 🚧 עורך טקסט עשיר (Tiptap)
- 🚧 ייצוא/ייבוא נתונים
- 🚧 התראות Push
- 🚧 בינלאום (i18n) - תמיכה בשפות נוספות

### 💡 מתוכנן לעתיד
- 💡 הצפנה אופציונלית
- 💡 AI Integration
- 💡 גרסת Desktop (Electron)
- 💡 אימות Google/Facebook

## 🎨 עיצוב

האפליקציה מעוצבת עם **RTL First** לתמיכה מלאה בעברית.

### צבעים
- Primary: `#3B82F6` (כחול)
- Secondary: `#10B981` (ירוק)
- Accent: `#F59E0B` (כתום)
- Danger: `#EF4444` (אדום)

## 📚 תיעוד

תיעוד מפורט זמין בתיקיית `thinking/`:
- [תוכנית מפורטת](thinking/detailed-plan-he.md)
- [תוכנית הצפנה עתידית](thinking/encryption-future-plan.md)

## 🤝 תרומה

הפרויקט נמצא בפיתוח פעיל. רעיונות והצעות תמיד מתקבלים בברכה!

## 📄 רישיון

MIT

---

**נבנה עם ❤️ בעברית**

