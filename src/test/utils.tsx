import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';

// Custom render function that includes providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <ThemeProvider>{children}</ThemeProvider>
      </BrowserRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Mock data helpers
export const createMockUser = (overrides = {}) => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  ...overrides,
});

export const createMockCategory = (overrides = {}) => ({
  id: 'test-category-id',
  name: 'Test Category',
  color: '#3B82F6',
  userId: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  order: 0,
  ...overrides,
});

export const createMockNote = (overrides = {}) => ({
  id: 'test-note-id',
  title: 'Test Note',
  content: 'Test content',
  categoryId: 'test-category-id',
  userId: 'test-user-id',
  template: 'plain' as const,
  isPinned: false,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
