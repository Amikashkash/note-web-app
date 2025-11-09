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
import { CategoryView } from '@/pages/CategoryView';
import { About } from '@/pages/About';
import { Privacy } from '@/pages/Privacy';
import { Terms } from '@/pages/Terms';
import { WhatsNew } from '@/pages/WhatsNew';

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
    path: '/category/:categoryId',
    element: (
      <ProtectedRoute>
        <CategoryView />
      </ProtectedRoute>
    ),
  },
  {
    path: '/about',
    element: (
      <ProtectedRoute>
        <About />
      </ProtectedRoute>
    ),
  },
  {
    path: '/privacy',
    element: (
      <ProtectedRoute>
        <Privacy />
      </ProtectedRoute>
    ),
  },
  {
    path: '/terms',
    element: (
      <ProtectedRoute>
        <Terms />
      </ProtectedRoute>
    ),
  },
  {
    path: '/whats-new',
    element: (
      <ProtectedRoute>
        <WhatsNew />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
