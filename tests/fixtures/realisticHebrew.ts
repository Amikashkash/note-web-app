/**
 * נתוני בדיקה ריאליסטיים בעברית (סבב 4): כל PR נבדק ברוחב 390px על אותו תוכן
 * ארוך, ולא על דוגמאות קצרות שהומצאו באותו רגע. שני תיקונים בסבב 3 נמצאו רק
 * בטלפון, על תוכן אמיתי.
 *
 * **הכל מומצא.** שום דבר כאן לא הועתק מפתקים אמיתיים, ואסור להעתיק לכאן.
 *
 * טהור: בלי Firebase. הזמנים יחסיים ל-`now`, כדי שתאריכים "היום" ו"מחר" יהיו
 * נכונים בכל הרצה. `scripts/seed-emulator.ts` כותב את זה ל-emulator בלבד.
 */

export interface FixtureCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface FixtureNote {
  id: string;
  categoryId: string;
  title: string;
  templateType: 'plain' | 'checklist' | 'shopping' | 'workplan' | 'accounting' | 'recipe';
  content: string;
  isPinned?: boolean;
  workplanStatus?: boolean;
  /** לפני כמה ימים עודכן הפתק */
  updatedDaysAgo: number;
}

export const FIXTURE_USER = {
  uid: 'fixture-user',
  email: 'tester@example.com',
  password: 'fixture-password',
  displayName: 'בודק בדיקות',
};

export const FIXTURE_CATEGORIES: FixtureCategory[] = [
  { id: 'fx-home', name: 'בית ושיפוצים', color: '#3B82F6', icon: '🏠' },
  { id: 'fx-garden', name: 'גינה - ערוגות, השקיה ומעקב עונתי', color: '#10B981', icon: '🌱' },
  { id: 'fx-errands', name: 'סידורים', color: '#F59E0B', icon: '🧾' },
  { id: 'fx-trip', name: 'טיול משפחתי לצפון', color: '#8B5CF6', icon: '🧳' },
  { id: 'fx-kitchen', name: 'מטבח', color: '#EF4444', icon: '🍲' },
  { id: 'fx-empty', name: 'רעיונות', color: '#EC4899', icon: '💡' },
];

/** YYYY-MM-DD בשעון המקומי, `days` ימים מ-`now` */
const localDate = (now: Date, days: number): string => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** "13/11" - כמו שכותבים ביומן */
const dayMonth = (now: Date, days: number): string => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

const errandTasks = (now: Date) => [
  {
    id: 'task-1',
    text: 'להתקשר לחברת הביטוח לפני סוף החודש ולבקש הצעת מחיר מעודכנת לרכב ולדירה, לבדוק אם יש הנחה על איחוד פוליסות ולשאול מה קורה עם ההחזר מהתביעה הקודמת שעוד לא הגיע אלינו',
    completed: false,
    dueDate: localDate(now, 0),
    dueTime: '09:30',
    priority: 'urgent',
  },
  {
    id: 'task-2',
    text: 'לחדש את רישיון הנהיגה באתר של משרד התחבורה, להעלות תמונה עדכנית ובדיקת ראייה מהאופטיקאי, ולוודא שהכתובת למשלוח נכונה',
    completed: false,
    dueDate: localDate(now, 1),
    dueTime: '18:00',
  },
  {
    id: 'task-3',
    text: 'להוציא את פחי המיחזור לפני שמונה בבוקר',
    completed: false,
    dueDate: localDate(now, 2),
    dueTime: '07:30',
    repeat: 'weekly',
  },
  {
    id: 'task-4',
    text: 'לשלם ארנונה',
    completed: false,
    dueDate: localDate(now, 5),
    dueTime: '12:00',
    repeat: 'monthly',
    priority: 'low',
  },
  { id: 'task-5', text: 'לקבוע תור לרופא שיניים', completed: false },
  {
    id: 'task-6',
    text: 'לסדר את המסמכים של שנת המס שעברה בתיקייה אחת: תלושי שכר, אישורי תרומות, קבלות על הוצאות רפואיות ואישור ניכוי מס במקור מהבנק, ולשלוח לרואה החשבון עד אמצע החודש הבא',
    completed: false,
    priority: 'urgent',
  },
  { id: 'task-7', text: 'להחזיר את המקדחה לשכנים מקומה שלישית', completed: true },
  {
    id: 'task-8',
    text: 'לבטל את המנוי לחדר הכושר שלא משתמשים בו כבר חצי שנה, ולבקש אישור ביטול בכתב כדי שלא יחייבו שוב',
    completed: true,
  },
  { id: 'task-9', text: 'לתקן את ידית הדלת במרפסת', completed: false, dueDate: localDate(now, -2), dueTime: '10:00' },
  { id: 'task-10', text: 'לאסוף חבילה מהדואר (מספר מעקב בהודעה)', completed: false, dueDate: localDate(now, 0) },
];

const BED_NAMES = [
  'עגבניות שרי',
  'מלפפונים',
  'פלפל חריף',
  'חסה ועלים',
  'תבלינים - בזיליקום ונענע',
  'תותים',
  'שעועית מטפסת',
  'קישואים',
  'גזר וסלק',
  'בצל ירוק',
  'פרחי עונה ליד השביל',
  'לימון בעציץ גדול',
  'רוזמרין וטימין',
  'חציל',
  'ערוגת קומפוסט',
  'שתילים חדשים - מגש בהצללה',
  'פטרוזיליה וכוסברה',
  'אבטיח ניסיוני',
  'ורדים בגדר הצפונית - ליד הברז, עם הטפטפת שדולפת',
  'עשבי מרפא',
];

const LOG_LINES = [
  'השקיה ידנית, האדמה הייתה יבשה בעומק',
  'דישון עם קומפוסט מהערימה',
  'גיזום עלים צהובים וענפים יבשים',
  'נמצאו כנימות על העלים התחתונים, ריסוס בתמיסת סבון',
  'קטיף ראשון, יצא מעט',
  'החלפת טפטפת שנסתמה',
  'כיסוי ברשת נגד ציפורים',
];

/** יומן: שורה של מצב ואחריה רשומות מתוארכות, מהישנה לחדשה */
const gardenLog = (now: Date, lines: number, seed: number): string =>
  [`${3 + (seed % 4)} שתילים, ${seed % 2 === 0 ? 'שמש מלאה' : 'חצי צל'}`]
    .concat(
      Array.from({ length: lines }, (_, index) => {
        const daysAgo = (lines - index) * 2 + (seed % 3);
        return `${dayMonth(now, -daysAgo)} ${LOG_LINES[(index + seed) % LOG_LINES.length]}`;
      })
    )
    .join('\n');

const gardenSections = (now: Date) =>
  BED_NAMES.map((header, index) => ({
    id: `bed-${index + 1}`,
    header,
    // כל רביעית: יומן ארוך (60 שורות). השאר קצרים, כמו ביומן אמיתי
    content: gardenLog(now, index % 4 === 0 ? 60 : 2 + (index % 5), index),
    // חלק בפורמט של 1.44.0 (מצב ותובנות, זמן עדכון), וחלק בפורמט הישן
    ...(index % 3 === 0 && { state: `ערוגה ${index + 1}: ${index % 2 === 0 ? 'מצב טוב' : 'צריך מעקב'}, השקיה כל יומיים` }),
    ...(index % 2 === 1 && { updatedAt: now.getTime() - (index + 1) * 24 * 60 * 60 * 1000 }),
  }));

export const fixtureNotes = (now: Date): FixtureNote[] => [
  {
    id: 'fx-errands-list',
    categoryId: 'fx-errands',
    title: 'סידורים לשבוע הקרוב - לפני שמתחיל החודש החדש',
    templateType: 'checklist',
    content: JSON.stringify(errandTasks(now)),
    isPinned: true,
    updatedDaysAgo: 0,
  },
  {
    id: 'fx-garden-log',
    categoryId: 'fx-garden',
    title: 'יומן ערוגות',
    templateType: 'workplan',
    content: JSON.stringify(gardenSections(now)),
    updatedDaysAgo: 1,
  },
  {
    id: 'fx-renovation',
    categoryId: 'fx-home',
    title: 'שיפוץ חדר הרחצה',
    templateType: 'workplan',
    workplanStatus: true,
    content: JSON.stringify([
      { id: 'r1', header: 'פירוק', content: 'לפרק אריחים ישנים ואמבטיה\nלפנות פסולת בשקי בנייה', status: 'done', updatedAt: now.getTime() - 9e8 },
      { id: 'r2', header: 'אינסטלציה', content: 'להעביר את נקודת המים של המקלחת לקיר הצפוני', status: 'active', updatedAt: now.getTime() - 2e8 },
      { id: 'r3', header: 'ריצוף וחיפוי', content: 'לבחור אריחים - שתי אפשרויות בחנות בצומת', state: 'מחכים להצעת מחיר שנייה' },
      { id: 'r4', header: 'כלים סניטריים', content: '' },
    ]),
    updatedDaysAgo: 3,
  },
  {
    id: 'fx-shopping',
    categoryId: 'fx-kitchen',
    title: 'קניות לסופר',
    templateType: 'shopping',
    content: JSON.stringify([
      { id: 's1', name: 'גבינה צהובה מעודנת בפרוסות דקות, לא המותג הרגיל אלא זה עם האריזה הכחולה', quantity: '2', checked: false },
      { id: 's2', name: 'לחם מחיטה מלאה', quantity: '1', checked: true },
      { id: 's3', name: 'עגבניות', quantity: '1 ק"ג', checked: false },
      { id: 's4', name: 'שמן זית כתית מעולה, בקבוק זכוכית כהה של ליטר', quantity: '', checked: false },
    ]),
    updatedDaysAgo: 0,
  },
  {
    id: 'fx-trip-plan',
    categoryId: 'fx-trip',
    title: 'רשימת ציוד לטיול - שלושה ימים בגליל העליון, כולל לינה בשטח',
    templateType: 'checklist',
    content: JSON.stringify([
      { id: 't1', text: 'אוהל לארבעה אנשים, לבדוק שכל המוטות והיתדות בתיק לפני שיוצאים', completed: false },
      { id: 't2', text: 'פנסי ראש וסוללות רזרביות', completed: true },
      { id: 't3', text: 'מים - שלושה ליטר לאדם ליום, ועוד מיכל גדול לבישול ולשטיפה', completed: false, priority: 'urgent' },
    ]),
    updatedDaysAgo: 6,
  },
  {
    id: 'fx-plain',
    categoryId: 'fx-home',
    title: 'הוראות לשכנה שמשקה את העציצים',
    templateType: 'plain',
    content:
      'תודה רבה שאת עוזרת! העציצים במרפסת צריכים מים כל יומיים, עד שהמים יוצאים מלמטה. ' +
      'הלימון הגדול - פעם בשלושה ימים, ולא יותר, כי השורשים נרקבים. המפתח הרזרבי מתחת לעציץ האדום ליד הדלת. ' +
      'אם משהו נראה לא טוב, אפשר לשלוח לי תמונה ואני אחזור אלייך עד הערב.\n\nקישור לסרטון ההסבר: https://example.com/watering',
    updatedDaysAgo: 2,
  },
];
