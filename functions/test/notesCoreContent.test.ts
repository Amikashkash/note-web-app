/**
 * `notesCore/content`: פענוח, רינדור וכתיבה בחזרה בלי לאבד שדות.
 *
 * ההתאמה לאפליקציה נבדקת ב-`tests/mirrors/notesCore.mirror.test.ts`.
 * כאן נבדק מה שנוסף מעל המראות: `extra` ו-`serializeContent`.
 */

import { describe, expect, it } from 'vitest';
import { parseContent, serializeContent } from '../src/notesCore/content';

const json = (value: unknown) => JSON.stringify(value);
const roundTrip = (type: string, content: string) => {
  const serialized = serializeContent(parseContent(type, content).parsed);
  return serialized === null ? null : JSON.parse(serialized);
};

describe('parseContent', () => {
  it('returns raw, parsed and rendered text together', () => {
    const content = json([{ id: '1', text: 'חלב', completed: true }]);
    const result = parseContent('checklist', content);

    expect(result.raw).toBe(content);
    expect(result.text).toBe('- [x] חלב');
    expect(result.parsed).toEqual({
      kind: 'checklist',
      items: [{ id: '1', text: 'חלב', completed: true, extra: {} }],
    });
  });

  it('keeps unknown fields of each row in extra', () => {
    const { parsed } = parseContent(
      'shopping',
      json([{ id: 's1', name: 'עגבניות', quantity: '2', checked: false, category: 'ירקות' }])
    );
    expect(parsed).toMatchObject({ kind: 'shopping', items: [{ extra: { category: 'ירקות' } }] });
  });

  it('keeps a known field the normaliser dropped, such as a repeat rule it does not know', () => {
    const { parsed } = parseContent('checklist', json([{ id: '1', text: 'א', completed: false, repeat: 'hourly' }]));
    expect(parsed).toMatchObject({ items: [{ repeat: undefined, extra: { repeat: 'hourly' } }] });
  });

  it('keeps unknown recipe fields, and steps next to instructions', () => {
    const { parsed } = parseContent('recipe', json({ ingredients: ['אורז'], steps: ['לבשל'], source: 'סבתא' }));
    expect(parsed).toMatchObject({
      kind: 'recipe',
      recipe: { instructions: ['לבשל'], extra: { steps: ['לבשל'], source: 'סבתא' } },
    });
  });

  it.each([
    ['plain text in a checklist', 'checklist', 'לקנות חלב'],
    ['corrupt JSON', 'shopping', '[{"id":'],
    ['a removed template', 'aisummary', json({ summary: 'x' })],
    ['a recipe with object ingredients', 'recipe', json({ ingredients: [{ name: 'קמח' }] })],
  ])('marks %s as unparsed, keeping raw and text', (_label, type, content) => {
    const result = parseContent(type, content);
    expect(result.parsed).toEqual({ kind: 'unparsed' });
    expect(result.raw).toBe(content);
    expect(result.text).not.toBe('');
  });

  it('renders content that does not match the declared type by its shape', () => {
    const content = json([{ id: 'w', header: 'שלב', content: 'לבצע' }]);
    expect(parseContent('checklist', content).text).toContain('## שלב');
  });

  it('treats empty structured content as an empty list, not a failure', () => {
    expect(parseContent('checklist', '').parsed).toEqual({ kind: 'checklist', items: [] });
    expect(parseContent('recipe', '').parsed).toMatchObject({ kind: 'recipe', recipe: { extra: {} } });
  });
});

describe('serializeContent', () => {
  it.each([
    ['checklist', [{ id: '1', text: 'א', completed: false, dueDate: '2026-10-01', priority: 2, tags: ['x'] }]],
    ['shopping', [{ id: 's', name: 'לחם', quantity: '', checked: true, category: 'מאפים' }]],
    ['workplan', [{ id: 'w', header: 'כ', content: 'ת', owner: 'דנה' }]],
    ['accounting', [{ id: 'a', description: 'ד', amount: 10, date: '2026-09-01', currency: 'ILS' }]],
  ])('%s round-trips with unknown fields intact', (type, rows) => {
    expect(roundTrip(type, json(rows))).toEqual(rows);
  });

  it('recipe round-trips with unknown fields intact', () => {
    const recipe = {
      servings: '4',
      prepTime: '',
      cookTime: '',
      ingredients: ['קמח'],
      instructions: ['ללוש'],
      source: 'סבתא',
    };
    expect(roundTrip('recipe', json(recipe))).toEqual(recipe);
  });

  it('writes the normalised value of a known field over a malformed raw one', () => {
    // סכום שנשמר כמחרוזת בגרסה ישנה נכתב בחזרה כמספר
    expect(roundTrip('accounting', json([{ id: 'a', description: '', amount: '12.5', date: '' }]))).toEqual([
      { id: 'a', description: '', amount: 12.5, date: '' },
    ]);
  });

  it('keeps an unknown repeat rule on write instead of clearing it', () => {
    expect(roundTrip('checklist', json([{ id: '1', text: 'א', completed: false, repeat: 'hourly' }]))).toEqual([
      { id: '1', text: 'א', completed: false, repeat: 'hourly' },
    ]);
  });

  it('returns plain text as is', () => {
    expect(serializeContent(parseContent('plain', 'שלום\n[x]').parsed)).toBe('שלום\n[x]');
  });

  it('refuses to serialize unparsed content', () => {
    expect(serializeContent(parseContent('checklist', 'טקסט').parsed)).toBeNull();
  });
});
