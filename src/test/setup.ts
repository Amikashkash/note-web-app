import '@testing-library/jest-dom';
import { afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock Firebase config before any imports
beforeAll(() => {
  // Mock environment variables
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test.appspot.com');
  vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456789');
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app-id');
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();
