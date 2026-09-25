import { describe, expect, it } from 'vitest';
import {
  appendSnippet,
  canAppendTo,
  convertContent,
  EMPTY_RECIPE,
  parseAccounting,
  parseChecklist,
  parseRecipe,
  parseShopping,
  parseWorkPlan,
  type ParseResult,
} from './templateContent';

const PLAIN_TEXT = 'לקנות חלב\n- לחם\n* ביצים';

/** הערך מתוך תוצאה מוצלחת; נכשל בבדיקה אם הפענוח נכשל */
const valueOf = <T>(result: ParseResult<T>): T => {
  if (!result.ok) throw new Error('expected a successful parse');
  return result.value;
};

describe('parsers never turn unreadable content into "empty" (A2 / C-2)', () => {
  it.each([
    ['plain text', PLAIN_TEXT],
    ['a JSON object', '{"a":1}'],
    ['a JSON number', '5'],
    ['an array with null', '[null]'],
    ['an array with a string', '["x"]'],
    ['broken JSON', '[{"id":"1"}]\n\nhttps://example.com'],
  ])('rejects %s in every list template', (_label, value) => {
    expect(parseChecklist(value).ok).toBe(false);
    expect(parseShopping(value).ok).toBe(false);
    expect(parseWorkPlan(value).ok).toBe(false);
    expect(parseAccounting(value).ok).toBe(false);
  });

  it('treats only the empty string (and whitespace) as empty content', () => {
    expect(valueOf(parseChecklist(''))).toEqual([]);
    expect(valueOf(parseChecklist('   '))).toEqual([]);
    expect(valueOf(parseChecklist('[]'))).toEqual([]);
  });
});

describe('parseChecklist', () => {
  it('keeps due date, due time and repeat', () => {
    const [item] = valueOf(
      parseChecklist(
        '[{"id":"1","text":"x","completed":true,"dueDate":"2026-09-26","dueTime":"09:00","repeat":"weekly"}]'
      )
    );
    expect(item).toEqual({
      id: '1',
      text: 'x',
      completed: true,
      dueDate: '2026-09-26',
      dueTime: '09:00',
      repeat: 'weekly',
    });
  });

  it('derives a position-based id for items without one, matching the reminder trigger', () => {
    const items = valueOf(parseChecklist('[{"text":"a"},{"text":"b"}]'));
    expect(items.map((item) => item.id)).toEqual(['item-0', 'item-1']);
  });

  it('drops an unknown repeat rule instead of passing it on', () => {
    const [item] = valueOf(parseChecklist('[{"id":"1","text":"x","repeat":"hourly"}]'));
    expect(item.repeat).toBeUndefined();
  });
});

describe('parseShopping and parseWorkPlan', () => {
  it('normalizes shopping items', () => {
    expect(valueOf(parseShopping('[{"id":"a","name":"חלב"}]'))).toEqual([
      { id: 'a', name: 'חלב', quantity: '', checked: false },
    ]);
  });

  it('normalizes work plan sections', () => {
    expect(valueOf(parseWorkPlan('[{"header":"h"}]'))).toEqual([
      { id: 'item-0', header: 'h', content: '' },
    ]);
  });
});

describe('parseAccounting', () => {
  it('rejects a non-array JSON value instead of crashing the table (A2)', () => {
    expect(parseAccounting('{"ingredients":["a"]}').ok).toBe(false);
  });

  it('coerces amounts stored as strings so the balance adds up', () => {
    const rows = valueOf(
      parseAccounting(
        '[{"id":"1","description":"d","amount":"12.5","date":"2026-01-01"},{"id":"2","amount":"abc"}]'
      )
    );
    expect(rows.map((row) => row.amount)).toEqual([12.5, 0]);
  });
});

describe('parseRecipe', () => {
  it('returns the empty recipe for empty content', () => {
    expect(valueOf(parseRecipe(''))).toEqual(EMPTY_RECIPE);
  });

  it('rejects plain text', () => {
    expect(parseRecipe(PLAIN_TEXT).ok).toBe(false);
  });

  it('keeps numeric fields as text', () => {
    expect(valueOf(parseRecipe('{"servings":4,"prepTime":"10"}')).servings).toBe('4');
  });

  it('falls back to steps when instructions are missing', () => {
    expect(valueOf(parseRecipe('{"ingredients":["a"],"steps":["s1"]}')).instructions).toEqual([
      's1',
    ]);
  });

  it('rejects list entries that are not text rather than dropping them on the next edit', () => {
    expect(parseRecipe('{"ingredients":[{"name":"a"}]}').ok).toBe(false);
  });
});

describe('convertContent (A2: explicit conversion when the template changes)', () => {
  it('turns text lines into checklist items and strips list markers', () => {
    const result = convertContent(PLAIN_TEXT, 'plain', 'checklist');
    if (!result.ok) throw new Error('expected conversion');

    const items = valueOf(parseChecklist(result.content));
    expect(items.map((item) => item.text)).toEqual(['לקנות חלב', 'לחם', 'ביצים']);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });

  it('round-trips checklist back to text', () => {
    const toList = convertContent(PLAIN_TEXT, 'plain', 'checklist');
    if (!toList.ok) throw new Error('expected conversion');
    expect(convertContent(toList.content, 'checklist', 'plain')).toEqual({
      ok: true,
      content: 'לקנות חלב\nלחם\nביצים',
    });
  });

  it('keeps the quantity when converting shopping to checklist', () => {
    const result = convertContent(
      '[{"id":"1","name":"חלב","quantity":"2","checked":false}]',
      'shopping',
      'checklist'
    );
    if (!result.ok) throw new Error('expected conversion');
    expect(valueOf(parseChecklist(result.content))[0].text).toBe('חלב 2');
  });

  it('puts text into a single work plan section', () => {
    const result = convertContent(PLAIN_TEXT, 'plain', 'workplan');
    if (!result.ok) throw new Error('expected conversion');
    expect(valueOf(parseWorkPlan(result.content))).toHaveLength(1);
  });

  it('treats content that does not match its template as text instead of losing it', () => {
    expect(convertContent(PLAIN_TEXT, 'checklist', 'plain')).toEqual({
      ok: true,
      content: 'לקנות חלב\nלחם\nביצים',
    });
  });

  it.each([
    ['plain', 'accounting'],
    ['plain', 'recipe'],
    ['recipe', 'plain'],
    ['accounting', 'checklist'],
  ] as const)('refuses %s -> %s so the form can warn', (from, to) => {
    expect(convertContent('{"ingredients":["a"]}\nx', from, to).ok).toBe(false);
  });

  it('allows any conversion of empty content', () => {
    expect(convertContent('', 'plain', 'recipe')).toEqual({ ok: true, content: '' });
  });

  it('returns the content unchanged when the template does not change', () => {
    expect(convertContent('abc', 'plain', 'plain')).toEqual({ ok: true, content: 'abc' });
  });
});

describe('appendSnippet (A3 / C-3: Share page "append to note")', () => {
  const snippet = { title: 'מתכון עוגה', text: 'שווה לנסות\nhttps://example.com/cake' };

  it('adds a checklist item and keeps every field of existing items, including unknown ones', () => {
    const existing =
      '[{"id":"1","text":"חלב","completed":true,"dueDate":"2026-09-26","dueTime":"09:00","repeat":"daily","futureField":42}]';
    const result = appendSnippet(existing, 'checklist', snippet);
    if (!result.ok) throw new Error('expected append');

    const raw = JSON.parse(result.content);
    expect(raw[0]).toEqual(JSON.parse(existing)[0]);
    expect(raw[1]).toMatchObject({
      text: 'מתכון עוגה — שווה לנסות https://example.com/cake',
      completed: false,
    });
  });

  it('adds a shopping item and keeps the legacy category field', () => {
    const result = appendSnippet(
      '[{"id":"a","name":"לחם","quantity":"1","checked":false,"category":"מאפים"}]',
      'shopping',
      snippet
    );
    if (!result.ok) throw new Error('expected append');
    const raw = JSON.parse(result.content);
    expect(raw).toHaveLength(2);
    expect(raw[0].category).toBe('מאפים');
  });

  it('adds a work plan section with the title as header', () => {
    const result = appendSnippet('[]', 'workplan', snippet);
    if (!result.ok) throw new Error('expected append');
    expect(JSON.parse(result.content)[0]).toMatchObject({
      header: 'מתכון עוגה',
      content: snippet.text,
    });
  });

  it('uses a default header when there is no title', () => {
    const result = appendSnippet('', 'workplan', { title: '', text: 'x' });
    if (!result.ok) throw new Error('expected append');
    expect(JSON.parse(result.content)[0].header).toBe('קישור משותף');
  });

  it('appends a paragraph to a plain note', () => {
    expect(appendSnippet('שורה', 'plain', snippet)).toEqual({
      ok: true,
      content: `שורה\n\n${snippet.text}`,
    });
    expect(appendSnippet('', 'plain', snippet)).toEqual({ ok: true, content: snippet.text });
    expect(appendSnippet('a', 'plain', { title: 'כותרת', text: '' })).toEqual({
      ok: true,
      content: 'a\n\nכותרת',
    });
  });

  it.each(['accounting', 'recipe', 'aisummary'])('refuses to append to %s', (type) => {
    expect(appendSnippet('[]', type, snippet)).toEqual({ ok: false, reason: 'unsupported' });
    expect(canAppendTo(type)).toBe(false);
  });

  it('writes nothing to a list whose content is already corrupted', () => {
    expect(appendSnippet('[{"id":"1"}]\n\nhttps://x', 'checklist', snippet)).toEqual({
      ok: false,
      reason: 'unparseable',
    });
  });

  it('refuses an empty snippet', () => {
    expect(appendSnippet('[]', 'checklist', { title: ' ', text: '' })).toEqual({
      ok: false,
      reason: 'empty',
    });
  });
});
