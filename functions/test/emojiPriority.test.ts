/**
 * המיגרציה של 🔴 בתחילת משימה לעדיפות דחופה. בלי Firestore.
 */

import { describe, expect, it } from 'vitest';
import { migrateEmojiPriority } from '../src/scripts/emojiPriority';

describe('migrateEmojiPriority', () => {
  it('moves a leading 🔴 into priority urgent and keeps every other field', () => {
    const rows = [{ id: 'a', text: '🔴 לשלם ארנונה', completed: false, dueDate: '2026-11-01', extra: 1 }];
    const result = migrateEmojiPriority(rows);
    expect(result.rows).toEqual([{ id: 'a', text: 'לשלם ארנונה', completed: false, dueDate: '2026-11-01', extra: 1, priority: 'urgent' }]);
    expect(result).toMatchObject({ migrated: 1, skipped: 0 });
  });

  it.each([
    ['without a space', '🔴לשלם', 'לשלם'],
    ['with the emoji variation selector', '🔴️ לשלם', 'לשלם'],
    ['repeated', '🔴🔴 לשלם', 'לשלם'],
    ['after leading spaces', '  🔴 לשלם', 'לשלם'],
  ])('handles 🔴 %s', (_label, text, expected) => {
    expect(migrateEmojiPriority([{ text }]).rows[0]).toMatchObject({ text: expected, priority: 'urgent' });
  });

  it('leaves 🔴 in the middle of the text, other emoji, and tasks without one', () => {
    const rows = [{ text: 'לשלם 🔴 היום' }, { text: '🟠 לשלם' }, { text: 'רגיל' }];
    const result = migrateEmojiPriority(rows);
    expect(result.rows).toBe(rows);
    expect(result.migrated).toBe(0);
  });

  it('does not touch a task that already has a priority, or one that is only the emoji', () => {
    const rows = [{ text: '🔴 x', priority: 'low' }, { text: ' 🔴 ' }];
    const result = migrateEmojiPriority(rows);
    expect(result.rows).toBe(rows);
    expect(result).toMatchObject({ migrated: 0, skipped: 2 });
  });

  it('a second run changes nothing', () => {
    const once = migrateEmojiPriority([{ text: '🔴 x' }]).rows;
    expect(migrateEmojiPriority(once)).toMatchObject({ migrated: 0, skipped: 0 });
  });
});
