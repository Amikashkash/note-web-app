/**
 * מצבי טעינה ושגיאה של המאזינים (ST-1)
 *
 * ה-API של Firestore מוחלף ב-mock שחושף את הקולבקים, כך שאפשר להפעיל
 * "הגיעו נתונים" ו"המאזין נכשל" בדיוק מתי שהבדיקה צריכה.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener<T> = { data: (value: T) => void; error: (error: unknown) => void; unsubscribe: () => void };

const noteListeners: Listener<unknown[]>[] = [];
const categoryListeners: Listener<unknown[]>[] = [];

const register = <T,>(list: Listener<T>[]) =>
  (_userId: string, data: (value: T) => void, error: (e: unknown) => void) => {
    const listener = { data, error, unsubscribe: vi.fn() };
    list.push(listener);
    return listener.unsubscribe;
  };

vi.mock('@/services/api/notes', () => ({ subscribeToNotes: vi.fn(register(noteListeners)) }));
vi.mock('@/services/api/categories', () => ({ subscribeToCategories: vi.fn(register(categoryListeners)) }));

const { useNoteStore } = await import('./noteStore');
const { useCategoryStore } = await import('./categoryStore');

const permissionDenied = Object.assign(new Error('Missing or insufficient permissions.'), {
  code: 'permission-denied',
});

describe.each([
  ['notes', () => useNoteStore, noteListeners, 'הפתקים'],
  ['categories', () => useCategoryStore, categoryListeners, 'הקטגוריות'],
] as const)('%s store', (_name, getStore, listeners, label) => {
  beforeEach(() => {
    const store = getStore();
    // מפרקים כל מנוי שנשאר מבדיקה קודמת
    while (store.getState()._subscriberCount > 0) store.getState().unsubscribe();
    listeners.length = 0;
  });

  it('is not loaded before the first answer, and loaded after data arrives', () => {
    const store = getStore();
    store.getState().subscribe('user-1');
    expect(store.getState().hasLoaded).toBe(false);

    listeners[0].data([]);
    expect(store.getState()).toMatchObject({ hasLoaded: true, loadError: null });
  });

  it('turns a listener error into a load error instead of an empty list', () => {
    const store = getStore();
    store.getState().subscribe('user-1');
    listeners[0].error(permissionDenied);

    const state = store.getState();
    expect(state.hasLoaded).toBe(true);
    expect(state.loadError).toContain(label);
    expect(state.loadError).toContain('אין הרשאה');
  });

  it('keeps the load error separate from write errors', () => {
    const store = getStore();
    store.getState().subscribe('user-1');
    listeners[0].error(new Error('network'));
    expect(store.getState().error).toBeNull();
  });

  it('retry tears down the listener, starts a new one, and clears the error on success', () => {
    const store = getStore();
    store.getState().subscribe('user-1');
    listeners[0].error(permissionDenied);

    store.getState().retry();
    expect(listeners[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(2);
    expect(store.getState()).toMatchObject({ hasLoaded: false, loadError: null });

    listeners[1].data([]);
    expect(store.getState()).toMatchObject({ hasLoaded: true, loadError: null });
  });

  it('retry keeps the subscriber count, so the last consumer still closes the listener', () => {
    const store = getStore();
    store.getState().subscribe('user-1');
    store.getState().subscribe('user-1');
    store.getState().retry();

    expect(store.getState()._subscriberCount).toBe(2);
    store.getState().unsubscribe();
    store.getState().unsubscribe();
    expect(listeners[1].unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ hasLoaded: false, loadError: null });
  });

  it('retry does nothing when nothing is subscribed', () => {
    getStore().getState().retry();
    expect(listeners).toHaveLength(0);
  });
});
