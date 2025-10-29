# 🔒 תוכנית הצפנה עתידית - שלב 4

## תקציר
הצפנה כ**אופציה** למשתמשים שרוצים פרטיות מקסימלית.
תיושם בשלב 4, לאחר שכל הפונקציונליות הבסיסית עובדת.

---

## 🎯 גישה: Hybrid Encryption (מומלץ)

### מה מוצפן?
- ✅ **תוכן הפתק** (`content`) - **מוצפן**
- ✅ **כותרת** (`title`) - **לא מוצפן** (לחיפוש)
- ✅ **קטגוריה** (`categoryId`) - **לא מוצפן**
- ✅ **תגיות** (`tags`) - **לא מוצפן**

### למה Hybrid?
- 🔍 **חיפוש עובד** - אפשר לחפש בכותרות
- 🏷️ **סינון עובד** - לפי קטגוריות ותגיות
- 🔒 **תוכן מוגן** - המידע הרגיש מוצפן
- ⚡ **ביצועים טובים** - לא צריך לפענח הכל

---

## 🛠 טכנולוגיה

### Web Crypto API (Native)
```typescript
// src/services/encryption/encryptionService.ts

/**
 * שירות הצפנה מרכזי
 * משתמש ב-Web Crypto API המובנה בדפדפן
 */

import { EncryptionConfig } from './types';

export class EncryptionService {
  private key: CryptoKey | null = null;

  /**
   * יצירת מפתח הצפנה מסיסמת משתמש
   */
  async generateKey(password: string, salt?: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const actualSalt = salt || crypto.getRandomValues(new Uint8Array(16));

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * הצפנת טקסט
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!this.key) throw new Error('Encryption key not initialized');

    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      enc.encode(plaintext)
    );

    // שמירת IV + Data בפורמט Base64
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const dataBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

    return `${ivBase64}.${dataBase64}`;
  }

  /**
   * פענוח טקסט
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!this.key) throw new Error('Encryption key not initialized');

    const [ivBase64, dataBase64] = ciphertext.split('.');
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(dataBase64), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * אתחול מפתח
   */
  async initialize(password: string): Promise<void> {
    this.key = await this.generateKey(password);
  }

  /**
   * ניקוי מפתח מהזיכרון
   */
  clear(): void {
    this.key = null;
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
```

---

## 🎨 ממשק משתמש

### דף הגדרות - אבטחה
```tsx
// src/pages/Settings/SecuritySettings.tsx

/**
 * הגדרות אבטחה והצפנה
 */

import React, { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Toggle } from '@/components/common/Toggle';
import { Modal } from '@/components/common/Modal';

export const SecuritySettings: React.FC = () => {
  const { user, updateSettings } = useAuthStore();
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);

  const handleToggleEncryption = () => {
    if (!user?.settings.encryptionEnabled) {
      // הפעלת הצפנה - צריך סיסמה
      setShowEncryptionModal(true);
    } else {
      // כיבוי הצפנה - אזהרה
      if (confirm('האם אתה בטוח? כל הפתקים המוצפנים יהיו בלתי נגישים')) {
        updateSettings({ encryptionEnabled: false });
      }
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">אבטחה ופרטיות</h2>

      {/* הפעלת הצפנה */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">הצפנת פתקים</h3>
            <p className="text-sm text-gray-600">
              הפתקים שלך יוצפנו ויישמרו במצב מוצפן במסד הנתונים
            </p>
          </div>
          <Toggle
            checked={user?.settings.encryptionEnabled || false}
            onChange={handleToggleEncryption}
          />
        </div>

        {user?.settings.encryptionEnabled && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              🔒 ההצפנה פעילה. הפתקים שלך מוגנים!
            </p>
          </div>
        )}
      </div>

      {/* אזהרה */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>חשוב:</strong> אם תאבד את סיסמת ההצפנה, לא תוכל לשחזר את הפתקים המוצפנים!
        </p>
      </div>

      {/* מודל הגדרת הצפנה */}
      {showEncryptionModal && (
        <EncryptionSetupModal onClose={() => setShowEncryptionModal(false)} />
      )}
    </div>
  );
};
```

---

## 📊 מבנה נתונים מעודכן

```typescript
// src/types/note.ts

export interface Note {
  id: string;
  title: string;                      // ✅ לא מוצפן
  content: string;                    // 🔒 מוצפן אם enabled
  encryptedContent?: string;          // 🔒 תוכן מוצפן (אם ההצפנה פעילה)
  isEncrypted: boolean;               // האם הפתק מוצפן
  categoryId: string;
  templateType: TemplateType;
  tags: string[];
  color: string | null;
  order: number;
  userId: string;
  sharedWith: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPinned: boolean;
}
```

---

## 🔄 זרימת עבודה

### הפעלת הצפנה:
1. משתמש מפעיל הצפנה בהגדרות
2. מתבקש ליצור "סיסמת הצפנה" (או להשתמש בסיסמת Firebase)
3. המפתח נשמר ב-**SessionStorage** (לא localStorage!)
4. כל פתק חדש מוצפן אוטומטית

### שמירת פתק:
```typescript
// src/hooks/useNotes.ts

const saveNote = async (note: Note) => {
  const { encryptionEnabled } = user.settings;

  if (encryptionEnabled) {
    // הצפנת תוכן
    const encrypted = await encryptionService.encrypt(note.content);

    return firestore.collection('notes').add({
      ...note,
      content: '', // ריק
      encryptedContent: encrypted,
      isEncrypted: true
    });
  } else {
    // שמירה רגילה
    return firestore.collection('notes').add({
      ...note,
      isEncrypted: false
    });
  }
};
```

### טעינת פתק:
```typescript
const loadNote = async (noteId: string): Promise<Note> => {
  const doc = await firestore.collection('notes').doc(noteId).get();
  const data = doc.data();

  if (data.isEncrypted && data.encryptedContent) {
    // פענוח
    const decrypted = await encryptionService.decrypt(data.encryptedContent);
    return { ...data, content: decrypted };
  }

  return data as Note;
};
```

---

## 🚨 אתגרים ופתרונות

### 1. שיתוף פתקים מוצפנים
**בעיה:** איך לשתף פתק מוצפן עם מישהו אחר?

**פתרון:**
- שיתוף רק של פתקים **לא מוצפנים**
- או: "שתף עם פענוח" - הפתק נפענח ונשמר מחדש בלי הצפנה

### 2. חיפוש בתוכן מוצפן
**בעיה:** לא ניתן לחפש בתוכן מוצפן

**פתרון:**
- חיפוש רק בכותרות ותגיות
- הודעה למשתמש: "חיפוש בתוכן לא זמין לפתקים מוצפנים"

### 3. שכחת סיסמה
**בעיה:** אין דרך לשחזר!

**פתרון אופציונלי:**
- "שאלת אבטחה"
- Backup מפתח (מוצפן בסיסמה נוספת)
- אזהרה ברורה מראש!

---

## ✅ Checklist ליישום (שלב 4)

- [ ] הוספת `encryptionEnabled` ו-`encryptionLevel` ל-User Settings
- [ ] יצירת `EncryptionService` עם Web Crypto API
- [ ] יצירת `useEncryption` hook
- [ ] עדכון `saveNote` ו-`loadNote` לתמיכה בהצפנה
- [ ] UI להפעלה/כיבוי הצפנה
- [ ] מודל הגדרת סיסמת הצפנה
- [ ] אזהרות ברורות למשתמש
- [ ] ניהול מפתח ב-Session (לא ב-LocalStorage)
- [ ] טיפול בשיתוף (להשבית או להסביר)
- [ ] עדכון Firestore schema
- [ ] בדיקות

---

## 📝 הערות חשובות

1. **ביצועים:** הצפנה/פענוח הם פעולות מהירות - לא צריך לדאוג
2. **תאימות:** Web Crypto API נתמך בכל הדפדפנים המודרניים
3. **אבטחה:** AES-256-GCM היא תקן התעשייה
4. **גיבוי:** מומלץ להוסיף ייצוא לפני הפעלת הצפנה

---

## 🎓 משאבים

- [Web Crypto API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [PBKDF2 - Password-Based Key Derivation](https://en.wikipedia.org/wiki/PBKDF2)
- [AES-GCM Encryption](https://en.wikipedia.org/wiki/Galois/Counter_Mode)

---

**זכור: זה שלב 4 - תתמקד קודם בבניית אפליקציה פונקציונלית!** 🚀
