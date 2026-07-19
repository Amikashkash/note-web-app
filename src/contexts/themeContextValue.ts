/**
 * אובייקט ה-Context של ערכת הנושא
 *
 * מופרד מקובץ ה-Provider כדי שקובץ הקומפוננטה ייצא קומפוננטות בלבד -
 * תנאי לעבודה תקינה של Fast Refresh בפיתוח.
 */

import { createContext } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
