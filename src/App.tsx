/**
 * קומפוננטת שורש של האפליקציה
 */

import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuthStore } from './store/authStore';
import { useNoteReminders } from './hooks/useNoteReminders';
import './styles/globals.css';

const App: React.FC = () => {
  const initialize = useAuthStore((state) => state.initialize);

  // מאזין אימות יחיד לכל האפליקציה
  useEffect(() => {
    initialize();
  }, [initialize]);

  // תזמון התראות לפתקים עם תזכורת פעילה
  useNoteReminders();

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
};

export default App;
