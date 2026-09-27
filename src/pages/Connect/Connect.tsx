/**
 * מסך ההסכמה לחיבור Claude לפתקים (`/connect?req=`, mcp-plan §2.3.5).
 *
 * שרת ה-OAuth מפנה לכאן מ-`/oauth/authorize`. הדף מציג מי מבקש גישה,
 * לאן היא תישלח ומה היא כוללת, ושולח את ההחלטה לשרת. המשתמש כבר מחובר
 * (`ProtectedRoute`), כך שאין התחברות נוספת.
 *
 * clickjacking: ה-headers ב-`firebase.json` אוסרים הצגה בתוך frame. אם
 * הדף בכל זאת רץ בתוך frame (למשל בשרת הפיתוח), הוא לא מציג כפתורים.
 *
 * ה-route רשום רק כש-`VITE_MCP_CONNECT` פעיל (ראו `router.tsx`): בלי
 * שרת OAuth פרוס אין לדף מה לעשות.
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { signOut } from '@/services/firebase/auth';
import { loadConnectRequest, sendConnectDecision } from '@/services/api/mcpConnect';
import { isFramed, scopeLabel, type ConnectProblem, type ConnectRequest } from '@/utils/mcpConnect';
import { loginRedirectState } from '@/utils/returnTo';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; request: ConnectRequest }
  | { kind: 'sending'; request: ConnectRequest }
  | { kind: 'leaving' }
  | { kind: 'problem'; problem: ConnectProblem };

const PROBLEMS: Record<ConnectProblem, { title: string; text: string }> = {
  expired: {
    title: 'בקשת החיבור לא בתוקף',
    text: 'הבקשה פגה, כבר טופלה, או נפתחה בחשבון אחר. חזרו ל-Claude והתחילו את החיבור מחדש.',
  },
  not_allowed: {
    title: 'החיבור ל-Claude עדיין לא פתוח לחשבון שלך',
    text: 'לא ניתנה גישה ולא נשלח דבר ל-Claude.',
  },
  login_required: {
    title: 'צריך להתחבר מחדש',
    text: 'לפני שמאשרים גישה לפתקים, יש להתחבר שוב לחשבון.',
  },
  unavailable: {
    title: 'לא ניתן להשלים את החיבור כרגע',
    text: 'נסו שוב בעוד כמה דקות, או התחילו את החיבור מחדש מ-Claude.',
  },
};

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-5 text-gray-800 dark:text-gray-100">
      {children}
    </div>
  </div>
);

export const Connect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reqId = searchParams.get('req') ?? '';
  const navigate = useNavigate();
  const location = useLocation();
  const [framed] = useState(() => isFramed(window));
  const [state, setState] = useState<State>(() =>
    reqId ? { kind: 'loading' } : { kind: 'problem', problem: 'expired' }
  );

  useEffect(() => {
    if (!reqId || framed) return;
    let cancelled = false;
    void loadConnectRequest(reqId).then((result) => {
      if (cancelled) return;
      setState(result.ok ? { kind: 'ready', request: result.value } : { kind: 'problem', problem: result.problem });
    });
    return () => {
      cancelled = true;
    };
  }, [reqId, framed]);

  const decide = async (request: ConnectRequest, approve: boolean) => {
    setState({ kind: 'sending', request });
    const result = await sendConnectDecision(reqId, request, approve);
    if (!result.ok) {
      setState({ kind: 'problem', problem: result.problem });
      return;
    }
    setState({ kind: 'leaving' });
    window.location.assign(result.value);
  };

  const signInAgain = async () => {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true, state: loginRedirectState(location) });
    }
  };

  if (framed) {
    return (
      <Card>
        <h1 className="text-xl font-bold">הדף הזה לא נפתח בתוך אתר אחר</h1>
        <p>פתחו את החיבור ל-Claude בחלון נפרד.</p>
      </Card>
    );
  }

  if (state.kind === 'loading' || state.kind === 'leaving') {
    return (
      <Card>
        <p className="text-center">{state.kind === 'loading' ? 'טוען את בקשת החיבור...' : 'חוזרים ל-Claude...'}</p>
      </Card>
    );
  }

  if (state.kind === 'problem') {
    const { title, text } = PROBLEMS[state.problem];
    return (
      <Card>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-gray-600 dark:text-gray-300">{text}</p>
        {state.problem === 'login_required' ? (
          <Button fullWidth onClick={signInAgain}>
            התחברות מחדש
          </Button>
        ) : (
          <Button variant="secondary" fullWidth onClick={() => navigate('/', { replace: true })}>
            לדף הבית
          </Button>
        )}
      </Card>
    );
  }

  const { request } = state;
  const sending = state.kind === 'sending';

  return (
    <Card>
      <h1 className="text-xl font-bold">חיבור לפתקים</h1>
      <p>
        <bdi className="font-semibold">{request.clientName}</bdi> מבקש גישה לחשבון שלך.
      </p>

      <div className="rounded-xl bg-slate-100 dark:bg-gray-700 p-4 space-y-1">
        <p className="text-sm text-gray-600 dark:text-gray-300">הגישה תישלח אל:</p>
        <p className="text-lg font-bold" dir="ltr">
          {request.redirectHost}
        </p>
      </div>

      <div>
        <p className="font-medium mb-2">הגישה כוללת:</p>
        <ul className="list-disc list-inside space-y-1">
          {request.scopes.map((scope) => (
            <li key={scope}>{scopeLabel(scope)}</li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">
        פתקים וקטגוריות שסומנו כרגישים לא יהיו נגישים.
      </p>

      <div className="flex gap-3">
        <Button fullWidth isLoading={sending} disabled={sending} onClick={() => decide(request, true)}>
          אישור
        </Button>
        <Button variant="secondary" fullWidth disabled={sending} onClick={() => decide(request, false)}>
          דחייה
        </Button>
      </div>
    </Card>
  );
};

export default Connect;
