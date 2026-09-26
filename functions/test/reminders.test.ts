import { describe, expect, it } from 'vitest';
import { remindersNeedSync } from '../src/reminders';

const checklist = { templateType: 'checklist', isArchived: false, content: '[]', userId: 'u1', title: 't' };
const plain = { ...checklist, templateType: 'plain' };

describe('remindersNeedSync (early exit, F-4)', () => {
  it('skips notes that are not an active checklist before or after', () => {
    expect(remindersNeedSync(plain, { ...plain, content: 'x' })).toBe(false);
    expect(remindersNeedSync(undefined, plain)).toBe(false);
    expect(remindersNeedSync(plain, undefined)).toBe(false);
    const archived = { ...checklist, isArchived: true };
    expect(remindersNeedSync(archived, { ...archived, content: 'x' })).toBe(false);
  });

  it('runs on creation and deletion of a checklist', () => {
    expect(remindersNeedSync(undefined, checklist)).toBe(true);
    expect(remindersNeedSync(checklist, undefined)).toBe(true);
  });

  it.each(['content', 'templateType', 'isArchived', 'userId'])('runs when %s changes', (field) => {
    expect(remindersNeedSync(checklist, { ...checklist, [field]: 'changed' })).toBe(true);
  });

  it('runs when a note becomes, or stops being, an active checklist', () => {
    expect(remindersNeedSync(plain, checklist)).toBe(true);
    expect(remindersNeedSync(checklist, { ...checklist, isArchived: true })).toBe(true);
  });

  it.each([
    ['title', 'x'],
    ['isPinned', true],
    ['order', 5],
    ['categoryId', 'c2'],
    ['updatedBy', 'u2'],
  ])('skips a change to %s only', (field, value) => {
    expect(remindersNeedSync(checklist, { ...checklist, [field]: value })).toBe(false);
  });
});
