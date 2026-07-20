/**
 * קומפוננטת שורש של האפליקציה
 */

import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuthStore } from './store/authStore';
import { usePushRegistration } from './hooks/usePushRegistration';
import './styles/globals.css';

const App: React.FC = () => {
  const initialize = useAuthStore((state) => state.initialize);

  // מאזין אימות יחיד לכל האפליקציה
  useEffect(() => {
    initialize();
  }, [initialize]);

  // רישום המכשיר לקבלת תזכורות ב-push
  usePushRegistration();

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
};

export default App;
