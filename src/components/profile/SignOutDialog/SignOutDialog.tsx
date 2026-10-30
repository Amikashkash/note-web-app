/**
 * התנתקות שלא זורקת שינויים (v1.35.0).
 *
 * התנתקות מוחקת את הנתונים שבמכשיר (`services/firebase/localData.ts`) -
 * כולל כתיבות שעוד לא הגיעו לשרת. לכן קודם מחכים קצת שיגיעו. אם לא הגיעו
 * (בדרך כלל: אין חיבור), המשתמש בוחר:
 * - **להישאר מחובר** (ברירת המחדל): השינויים יישלחו כשהחיבור יחזור.
 * - **להתנתק ולהשאיר במכשיר**: השינויים נשמרים בדפדפן, ויישלחו כשיתחבר
 *   שוב **מהמכשיר הזה** עם אותו חשבון. המחיר: הפתקים נשארים שמורים כאן.
 * - **להתנתק ולמחוק**: מפורש, עם אזהרה שהשינויים יאבדו.
 */

import { Modal } from '@/components/common/Modal/Modal';
import type { useSafeSignOut } from '@/hooks/useSafeSignOut';

type SafeSignOut = ReturnType<typeof useSafeSignOut>;

export const SignOutDialog: React.FC<{ signOut: SafeSignOut }> = ({ signOut }) => {
  const { phase } = signOut;
  if (phase === 'idle') return null;

  if (phase === 'checking' || phase === 'leaving') {
    return (
      <Modal onClose={() => undefined} title="מתנתק">
        <p className="text-sm text-ink-light dark:text-ink-dark">
          {phase === 'checking' ? 'מוודא שכל השינויים הגיעו לשרת…' : 'מתנתק ומנקה את הפתקים מהמכשיר…'}
        </p>
      </Modal>
    );
  }

  return (
    <Modal onClose={signOut.stay} title="יש שינויים שעוד לא נשמרו בשרת">
      <div dir="rtl" className="space-y-4 text-sm text-ink-light dark:text-ink-dark">
        <p>
          כנראה שאין חיבור לאינטרנט. השינויים האחרונים שמורים רק במכשיר הזה, ויישלחו כשהחיבור יחזור. התנתקות רגילה
          מוחקת את הפתקים מהמכשיר - וגם אותם.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={signOut.stay}
            className="px-4 py-2 rounded-lg bg-brand text-white font-medium"
          >
            הישאר מחובר
          </button>
          <button
            type="button"
            onClick={() => void signOut.keepAndLeave()}
            className="px-4 py-2 rounded-lg border border-hairline-light dark:border-hairline-dark text-right"
          >
            <span className="block font-medium">התנתק והשאר את השינויים במכשיר</span>
            <span className="block text-xs text-ink-2-light dark:text-ink-2-dark">
              יישלחו כשתתחבר שוב מהמכשיר הזה. הפתקים יישארו שמורים בדפדפן - לא מתאים למחשב משותף.
            </span>
          </button>
          <button
            type="button"
            onClick={() => void signOut.deleteAndLeave()}
            className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 text-right"
          >
            <span className="block font-medium">התנתק ומחק בכל זאת</span>
            <span className="block text-xs">השינויים שלא הגיעו לשרת יאבדו.</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
