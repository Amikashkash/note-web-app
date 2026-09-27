/**
 * הגדרת Routes לאפליקציה
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
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

/**
 * מסך ההסכמה לחיבור Claude (`/connect`). רשום רק בפיתוח, או כש-
 * `VITE_MCP_CONNECT=true` בזמן build: עד ששרת ה-OAuth פרוס (שלב 1ג)
 * אין לדף מה לעשות, ובלי הדגל הוא לא נכנס ל-bundle בכלל.
 */
const MCP_CONNECT_ENABLED = import.meta.env.DEV || import.meta.env.VITE_MCP_CONNECT === 'true';

const connectRoutes = (): RouteObject[] => {
  if (!MCP_CONNECT_ENABLED) return [];
  const Connect = lazy(() => import('@/pages/Connect/Connect'));
  return [
    {
      path: '/connect',
      element: (
        <ProtectedRoute>
          <Suspense fallback={null}>
            <Connect />
          </Suspense>
        </ProtectedRoute>
      ),
    },
  ];
};

export const router = createBrowserRouter([
  ...connectRoutes(),
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
