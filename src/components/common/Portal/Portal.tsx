/**
 * Portal Component
 * מרנדר את הילדים אל מחוץ להיררכיית ה-DOM של ההורה
 */

import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

// האפליקציה רצה בדפדפן בלבד (אין רינדור בצד שרת), ולכן `document.body`
// זמין כבר ברינדור הראשון. הגרסה הקודמת השתמשה ב-state ו-effect כדי
// "להמתין לטעינה", מה שגרם לרינדור מיותר בכל פתיחת מודאל.
export const Portal: React.FC<PortalProps> = ({ children }) =>
  createPortal(children, document.body);
