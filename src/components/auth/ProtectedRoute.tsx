/**
 * קומפוננטה להגנה על routes
 * מאפשרת גישה רק למשתמשים מחוברים
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // אם עדיין טוען - הצג מסך טעינה
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  // אם לא מחובר - הפנה לדף התחברות
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // מחובר - הצג את התוכן
  return <>{children}</>;
};
