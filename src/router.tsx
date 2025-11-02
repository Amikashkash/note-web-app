/**
 * הגדרת Routes לאפליקציה
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Login from '@/pages/Login/Login';
import Home from '@/pages/Home/Home';
import CategoriesManagement from '@/pages/CategoriesManagement/CategoriesManagement';
import { Archive } from '@/pages/Archive';
import { Settings } from '@/pages/Settings';
import { Share } from '@/pages/Share';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
  },
  {
    path: '/categories',
    element: (
      <ProtectedRoute>
        <CategoriesManagement />
      </ProtectedRoute>
    ),
  },
  {
    path: '/archive',
    element: (
      <ProtectedRoute>
        <Archive />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
  },
  {
    path: '/share',
    element: (
      <ProtectedRoute>
        <Share />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
