/** @type {import('tailwindcss').Config} */

/**
 * מערכת העיצוב מוגדרת ב-`new_design/design_handoff_visual_identity`.
 *
 * הטוקנים הישנים (primary, shadow-card, rounded-note וכו') נשארים כאן
 * בכוונה: הם עדיין בשימוש ב-16 קבצים, והסרתם עכשיו הייתה שוברת את
 * הבנייה. הם יוסרו בהדרגה ככל שכל קובץ יעבור לטוקנים החדשים - ראה את
 * המקטע "טוקנים לגריעה" בתחתית.
 */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        caption: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }],
        'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        body: ['1rem', { lineHeight: '1.5rem' }],
        h2: ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        h1: ['1.375rem', { lineHeight: '1.75rem', fontWeight: '700' }],
        display: ['1.75rem', { lineHeight: '2.125rem', fontWeight: '700' }],
      },

      colors: {
        // מותג
        brand: {
          DEFAULT: '#4F46E5',
          dark: '#6366F1',
          2: '#4338CA',
          '2-dark': '#818CF8',
          text: '#4F46E5',
          'text-dark': '#A5B4FC',
          soft: '#EEF2FF',
          'soft-dark': '#1E1B4B',
          'soft-bd': '#C7D2FE',
          'soft-bd-dark': '#3730A3',
        },

        teal: { DEFAULT: '#0F766E', fill: '#0D9488', dark: '#2DD4BF' },
        success: { DEFAULT: '#059669', dark: '#34D399' },
        danger: {
          DEFAULT: '#DC2626',
          dark: '#F87171',
          soft: '#FEF2F2',
          'soft-dark': '#450A0A',
        },

        // משטחים וטקסט - נייטרל חמים
        app: { light: '#FAFAF9', dark: '#0C0A09' },
        surface: { light: '#FFFFFF', dark: '#1C1917' },
        raised: { light: '#F5F5F4', dark: '#292524' },
        tint: { light: '#EEF2FF', dark: '#292524' },
        ink: { light: '#1C1917', dark: '#F5F5F4' },
        'ink-2': { light: '#57534E', dark: '#A8A29E' },
        'ink-3': { light: '#78716C', dark: '#8A827C' },
        hairline: { light: '#E7E5E4', dark: '#33302D' },

        // צבעי קטגוריה
        cat: {
          blue: '#3B82F6', 'blue-dark': '#60A5FA',
          purple: '#8B5CF6', 'purple-dark': '#A78BFA',
          green: '#10B981', 'green-dark': '#34D399',
          orange: '#F59E0B', 'orange-dark': '#FBBF24',
          red: '#EF4444', 'red-dark': '#F87171',
          pink: '#EC4899', 'pink-dark': '#F472B6',
        },

        // ===== טוקנים לגריעה =====
        // בשימוש בקוד שטרם שוכתב. להסיר עם סיום המעבר.
        primary: { DEFAULT: '#3B82F6', start: '#667eea', end: '#764ba2' },
        secondary: '#10B981',
        accent: '#F59E0B',
      },

      /**
       * ההגבהה עוברת דרך משתני CSS ולא דרך ערכים קבועים.
       *
       * הסיבה: העיצוב מגדיר צללים שונים לחלוטין למצב כהה - אטימות של
       * 0.4 מול 0.04, כי צל כמעט שקוף על רקע כמעט שחור פשוט נעלם.
       * ל-Tailwind אין דרך להתנות `boxShadow` במצב כהה, ובלי זה כל
       * כרטיס היה צריך `shadow-e1 dark:shadow-e1-dark`. המשתנים
       * מוגדרים ב-`globals.css` ומתחלפים עם `.dark`.
       */
      boxShadow: {
        e1: 'var(--e1)',
        e2: 'var(--e2)',
        e3: 'var(--e3)',

        // ===== לגריעה =====
        'card': '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.12)',
        'card-dark': '0 2px 8px rgba(0,0,0,0.3)',
        'card-hover-dark': '0 8px 25px rgba(0,0,0,0.5)',
        'note': '0 2px 8px rgba(0,0,0,0.08)',
        'note-hover': '0 12px 24px rgba(0,0,0,0.15)',
        'note-dark': '0 2px 8px rgba(0,0,0,0.4)',
        'note-hover-dark': '0 12px 24px rgba(0,0,0,0.6)',
        'button': '0 4px 15px rgba(102, 126, 234, 0.4)',
        'button-hover': '0 8px 25px rgba(102, 126, 234, 0.6)',
        'button-dark': '0 4px 15px rgba(102, 126, 234, 0.3)',
        'button-hover-dark': '0 8px 25px rgba(102, 126, 234, 0.5)',
      },

      // דריסה מכוונת של ברירות המחדל של Tailwind (8px/12px).
      // נוגעת ב-66 מופעים קיימים של `rounded-lg` ו-10 של `rounded-xl`.
      borderRadius: {
        lg: '12px',
        xl: '16px',

        // ===== לגריעה =====
        'card': '16px',
        'note': '12px',
      },

      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
