import { describe, expect, it } from 'vitest';
import { cardPreview, listProgress } from './noteCard';

const checklist = (...items: [string, boolean][]) => ({
  templateType: 'checklist',
  content: JSON.stringify(items.map(([text, completed], index) => ({ id: `i${index}`, text, completed }))),
});

describe('listProgress', () => {
  it('counts done out of total in a checklist', () => {
    expect(listProgress(checklist(['חלב', true], ['לחם', false], ['ביצים', true]))).toEqual({ done: 2, total: 3 });
  });

  it('counts a shopping list too', () => {
    const shopping = {
      templateType: 'shopping',
      content: JSON.stringify([
        { id: 'a', name: 'עגבניות', quantity: '', checked: true },
        { id: 'b', name: 'מלפפון', quantity: '', checked: false },
      ]),
    };
    expect(listProgress(shopping)).toEqual({ done: 1, total: 2 });
  });

  it('ignores empty rows (a new list shows an empty first row)', () => {
    expect(listProgress(checklist(['', false], ['חלב', true]))).toEqual({ done: 1, total: 1 });
  });

  it('is null for an empty list, a non-list, or content that did not parse', () => {
    expect(listProgress(checklist())).toBeNull();
    expect(listProgress({ templateType: 'checklist', content: '' })).toBeNull();
    expect(listProgress({ templateType: 'plain', content: 'טקסט' })).toBeNull();
    expect(listProgress({ templateType: 'checklist', content: '{broken' })).toBeNull();
  });
});

describe('cardPreview', () => {
  it('shows the open tasks of a checklist, not the done ones', () => {
    expect(cardPreview(checklist(['חלב', true], ['לחם', false], ['ביצים', false]))).toBe('לחם · ביצים');
  });

  it('says when everything is done', () => {
    expect(cardPreview(checklist(['חלב', true]))).toBe('הכל בוצע');
  });

  it('is empty for an empty list', () => {
    expect(cardPreview(checklist())).toBe('');
    expect(cardPreview(checklist(['  ', false]))).toBe('');
  });

  it('collapses plain text to one running line', () => {
    expect(cardPreview({ templateType: 'plain', content: 'שורה ראשונה\n\nשורה   שנייה' })).toBe('שורה ראשונה שורה שנייה');
  });

  it('limits long text', () => {
    const preview = cardPreview({ templateType: 'plain', content: 'א'.repeat(500) });
    expect(preview.length).toBeLessThanOrEqual(221);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('shows nothing for an empty structured note, not raw JSON', () => {
    expect(cardPreview({ templateType: 'accounting', content: '[]' })).toBe('');
    expect(cardPreview({ templateType: 'recipe', content: '{}' })).toBe('');
    expect(cardPreview({ templateType: 'workplan', content: '' })).toBe('');
  });

  it('uses the existing preview for other templates, on one line', () => {
    const workplan = {
      templateType: 'workplan',
      content: JSON.stringify([{ id: 'a', header: 'שלב 1', content: 'הכנה' }]),
    };
    expect(cardPreview(workplan)).not.toContain('\n');
    expect(cardPreview(workplan)).toContain('שלב 1');
  });
});
