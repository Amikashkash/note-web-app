/**
 * "אין לך עדיין גישה" במסך ההסכמה (v1.43.0): במקום שגיאה בלבד, כפתור
 * "בקש גישה" ששולח בקשה למנהל דרך השרת, והמצב שלה.
 *
 * הבקשה לא ממשיכה את החיבור הנוכחי: בקשת ההתחברות של Claude פגה תוך דקות.
 * אחרי האישור מתחילים את החיבור מחדש מ-Claude.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button';
import { getAccessStatus, requestAccess, type AccessStatus } from '@/services/api/mcpAccess';
import { getErrorMessage } from '@/utils/errors';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; status: AccessStatus; error: string | null }
  | { kind: 'sending'; status: AccessStatus }
  | { kind: 'failed'; error: string };

const RESTART = 'חזרו ל-Claude והתחילו את החיבור מחדש.';

export const AccessRequestPanel: React.FC = () => {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getAccessStatus()
      .then((status) => !cancelled && setState({ kind: 'ready', status, error: null }))
      .catch((error) => !cancelled && setState({ kind: 'failed', error: getErrorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async (status: AccessStatus) => {
    setState({ kind: 'sending', status });
    try {
      setState({ kind: 'ready', status: await requestAccess(), error: null });
    } catch (error) {
      setState({ kind: 'ready', status, error: getErrorMessage(error) });
    }
  };

  if (state.kind === 'loading') return <p className="text-gray-600 dark:text-gray-300">בודק את מצב הגישה...</p>;
  if (state.kind === 'failed') return <p className="text-red-700 dark:text-red-300">{state.error}</p>;

  const { status } = state;
  const sending = state.kind === 'sending';
  const error = state.kind === 'ready' ? state.error : null;

  if (status.allowed) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 p-4">
        הגישה שלך אושרה. {RESTART}
      </p>
    );
  }

  if (status.request === 'pending') {
    return (
      <div role="status" className="rounded-xl bg-slate-100 dark:bg-gray-700 p-4 space-y-1">
        <p className="font-semibold">⏳ הבקשה נשלחה וממתינה לאישור</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">כשהיא תאושר, {RESTART}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-gray-600 dark:text-gray-300">
        {status.request === 'rejected'
          ? 'הבקשה הקודמת שלך לא אושרה. אפשר לבקש שוב.'
          : status.request === 'revoked'
            ? 'הגישה שלך בוטלה. אפשר לבקש שוב.'
            : 'החיבור ל-Claude ניתן לכל חשבון באישור. אפשר לבקש גישה, והבקשה תישלח לאישור.'}{' '}
        לא ניתנה גישה ולא נשלח דבר ל-Claude.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <Button fullWidth isLoading={sending} disabled={sending} onClick={() => send(status)}>
        בקש גישה
      </Button>
    </div>
  );
};
