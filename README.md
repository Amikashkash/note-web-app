# 📝 אפליקציית פתקים

אפליקציית ווב לניהול פתקים מאורגנים בקטגוריות, עם גלילה אנכית של קטגוריות וגלילה אופקית של פתקים.

## 🛠 טכנולוגיות

- **React 18** + **TypeScript**
- **Vite** - Build tool מהיר
- **Tailwind CSS** - עיצוב עם תמיכה מלאה ב-RTL
- **Zustand** - ניהול State
- **React Router v6** - ניתוב
- **Firebase** - Backend (Firestore + Auth)
- **i18next** - תמיכה רב-לשונית

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
│   ├── layout/         # Header, Sidebar, Footer
│   ├── category/       # קומפוננטים של קטגוריות
│   ├── note/           # קומפוננטים של פתקים
│   └── auth/           # קומפוננטים של אימות
├── pages/              # דפי האפליקציה
├── hooks/              # Custom React Hooks
├── store/              # Zustand State Management
├── services/           # Firebase, API
├── utils/              # פונקציות עזר
├── types/              # TypeScript Types
├── i18n/               # תרגומים
└── styles/             # CSS גלובלי

```

## 📋 תכונות מתוכננות

### Phase 1 - MVP (נוכחי)
- [x] הקמת פרויקט
- [ ] מערכת אימות (Google + Email)
- [ ] יצירה/עריכה/מחיקה של קטגוריות
- [ ] יצירה/עריכה/מחיקה של פתקים
- [ ] FAB (Floating Action Button)
- [ ] UI/UX בסיסי

### Phase 2 - תכונות חיוניות
- [ ] עורך טקסט עשיר (Tiptap)
- [ ] 5 תבניות (טקסט, משימות, מתכון, קניות, רעיון)
- [ ] חיפוש
- [ ] תגיות
- [ ] תצוגת קטגוריה מלאה
- [ ] PWA

### Phase 3 - שיתוף
- [ ] שיתוף פתקים וקטגוריות
- [ ] עדכונים בזמן אמת

### Phase 4 - תכונות מתקדמות
- [ ] הצפנה (אופציונלי)
- [ ] בינלאום (i18n)
- [ ] ייצוא/ייבוא
- [ ] AI Integration

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

