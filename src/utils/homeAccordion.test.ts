import { describe, expect, it } from 'vitest';
import { latestNote, readOpenCategory, toggleOpen, writeOpenCategory } from './homeAccordion';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
};

const at = (millis: number) => ({ toMillis: () => millis });

describe('the open category is remembered per user, on this device', () => {
  it('reads back what was written', () => {
    const storage = memoryStorage();
    writeOpenCategory('u1', 'cat-a', storage);
    expect(readOpenCategory('u1', storage)).toBe('cat-a');
  });

  it('keeps users apart', () => {
    const storage = memoryStorage();
    writeOpenCategory('u1', 'cat-a', storage);
    expect(readOpenCategory('u2', storage)).toBeNull();
  });

  it('closing removes the key', () => {
    const storage = memoryStorage();
    writeOpenCategory('u1', 'cat-a', storage);
    writeOpenCategory('u1', null, storage);
    expect(storage.map.size).toBe(0);
    expect(readOpenCategory('u1', storage)).toBeNull();
  });

  it('a storage that throws (blocked, full) is not fatal', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => writeOpenCategory('u1', 'cat-a', broken)).not.toThrow();
    expect(readOpenCategory('u1', broken)).toBeNull();
  });

  it('no storage at all', () => {
    expect(readOpenCategory('u1', null)).toBeNull();
    expect(() => writeOpenCategory('u1', 'cat-a', null)).not.toThrow();
  });
});

describe('toggleOpen: only one category open at a time', () => {
  it('opening one closes the other', () => {
    expect(toggleOpen('cat-a', 'cat-b')).toBe('cat-b');
  });

  it('tapping the open one closes it', () => {
    expect(toggleOpen('cat-a', 'cat-a')).toBeNull();
  });

  it('opens from nothing', () => {
    expect(toggleOpen(null, 'cat-a')).toBe('cat-a');
  });
});

describe('latestNote', () => {
  it('is the most recently updated note', () => {
    const notes = [
      { title: 'old', updatedAt: at(1) },
      { title: 'newest', updatedAt: at(3) },
      { title: 'middle', updatedAt: at(2) },
    ];
    expect(latestNote(notes)?.title).toBe('newest');
  });

  it('is null for an empty category', () => {
    expect(latestNote([])).toBeNull();
  });
});
