/**
 * Hook לגישה לערכת הנושא הנוכחית
 */

import { useContext } from 'react';
import { ThemeContext } from '@/contexts/themeContextValue';

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
