/**
 * המראות של `functions/src/notesCore/content` מול המקור באפליקציה.
 *
 * `functions/` לא יכולה לייבא מ-`src/` (mcp-plan, החלטה 10), ולכן היא
 * מחזיקה העתקים. הבדיקה כאן היא מה שמחזיק אותם זהים, בשתי דרכים:
 * - הקוד עצמו: גוף המראה זהה למקור, חוץ מהשינויים המתועדים בראש המראה.
 * - ההתנהגות: שני הצדדים רצים על אותן דוגמאות מכל תבנית ומחזירים אותו פלט.
 *
 * רצה עם בדיקות היחידה של הלקוח (`npm test`), כי רק מכאן רואים את שני הצדדים.
 */

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note, TemplateType } from '@/types/note';
import * as client from '@/utils/templateContent';
import { renderNoteContent as clientRender } from '@/utils/backupFormat';
import * as mirror from '../../functions/src/notesCore/content/templateContent';
import { renderNoteContent as mirrorRender } from '../../functions/src/notesCore/content/render';

// עותק עבודה ב-Windows (autocrlf) מחזיק CRLF בחלק מהקבצים - משווים בלי \r
const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** מההתחלה של `from` ועד (כולל) הסוף של `to` שאחריו */
const slice = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`markers not found: ${from} / ${to}`);
  return text.slice(start, end + to.length);
};

describe('mirror source', () => {
  it('templateContent.ts is the client module verbatim below the imports', () => {
    const body = (text: string) => text.slice(text.indexOf('export type ParseResult'));
    expect(body(read('functions/src/notesCore/content/templateContent.ts'))).toBe(
      body(read('src/utils/templateContent.ts'))
    );
  });

  it('render.ts is the renderer section of backupFormat.ts, minus the documented changes', () => {
    const section = (text: string) =>
      slice(text, '/** ערך שהתקבל מפענוח JSON', '\n  return `\\`\\`\\`json\\n${trimmed}\\n\\`\\`\\``;\n};');

    const source = section(read('src/utils/backupFormat.ts'))
      .replace(/\nconst formatDateTime = [\s\S]*?\n\n/, '\n')
      .replace('(note: Note): string', '(note: RenderableNote): string');

    expect(section(read('functions/src/notesCore/content/render.ts'))).toBe(source);
  });
});

// ---------------------------------------------------------------------------
// אותן דוגמאות לשני הצדדים
// ---------------------------------------------------------------------------

const json = (value: unknown) => JSON.stringify(value);

const SAMPLES: Record<string, string> = {
  empty: '',
  blank: '   \n ',
  plainText: 'שורה ראשונה\n- פריט\n* עוד פריט\n1. ממוספר\n[x] מסומן',
  bracketText: '[לא JSON',
  corrupt: '[{"id":"1","text":',
  number: '42',
  object: json({ a: 1 }),
  arrayWithNull: json([{ id: '1', text: 'א' }, null]),
  arrayOfStrings: json(['א', 'ב']),
  emptyArray: '[]',
  checklist: json([
    { id: 'c1', text: 'לקנות חלב', completed: false, dueDate: '2026-10-01', dueTime: '09:00', repeat: 'weekly' },
    { id: 'c2', text: 'שורה\nשבורה', completed: true },
    { text: 'בלי מזהה', completed: 'yes', repeat: 'hourly', priority: 3 },
  ]),
  shopping: json([
    { id: 's1', name: 'עגבניות', quantity: '2 ק"ג', checked: false, category: 'ירקות' },
    { id: 's2', name: 'לחם', checked: true },
    { name: 'ביצים', quantity: 12 },
  ]),
  workplan: json([
    { id: 'w1', header: 'שלב א', content: 'לתכנן\nלבצע' },
    { id: 'w2', header: '', content: 'בלי כותרת' },
  ]),
  accounting: json([
    { id: 'a1', description: 'שכירות | דירה', amount: 4500, date: '2026-09-01' },
    { id: 'a2', description: 'ישן', amount: '120.5', date: '' },
    { id: 'a3', description: 'שבור', amount: 'abc', date: '2026-09-02' },
  ]),
  recipe: json({
    servings: 4,
    prepTime: '10 דק',
    cookTime: '',
    ingredients: ['קמח', 'מים'],
    instructions: ['ללוש', 'לאפות'],
    source: 'סבתא',
  }),
  recipeSteps: json({ ingredients: ['אורז'], steps: ['לבשל'] }),
  recipeObjects: json({ ingredients: [{ name: 'קמח' }], instructions: ['ללוש'] }),
  recipeEmptyLists: json({ servings: '2', ingredients: [], instructions: [] }),
};

const TYPES: string[] = ['plain', 'checklist', 'shopping', 'workplan', 'accounting', 'recipe', 'aisummary'];

const cases = Object.entries(SAMPLES);

describe('mirror behaviour', () => {
  // המרה והוספה משתמשות ב-Date.now() למזהים חדשים
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T08:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const parsers = [
    'parseChecklist',
    'parseShopping',
    'parseWorkPlan',
    'parseAccounting',
    'parseRecipe',
  ] as const;

  describe.each(parsers)('%s', (name) => {
    it.each(cases)('%s', (_label, content) => {
      expect(mirror[name](content)).toEqual(client[name](content));
    });
  });

  describe('renderNoteContent', () => {
    it.each(TYPES.flatMap((type) => cases.map(([label, content]) => [type, label, content] as const)))(
      '%s / %s',
      (type, _label, content) => {
        const note = { content, templateType: type as TemplateType };
        expect(mirrorRender(note)).toBe(clientRender(note as Note));
      }
    );
  });

  describe('convertContent', () => {
    const templates = TYPES.filter((type) => type !== 'aisummary') as TemplateType[];
    it.each(
      templates.flatMap((from) =>
        templates.flatMap((to) => cases.map(([label, content]) => [from, to, label, content] as const))
      )
    )('%s -> %s / %s', (from, to, _label, content) => {
      expect(mirror.convertContent(content, from, to)).toEqual(client.convertContent(content, from, to));
    });
  });

  describe('appendSnippet', () => {
    const snippets = [
      { title: 'כותרת', text: 'https://example.com\nשורה שנייה' },
      { title: '', text: 'רק טקסט' },
      { title: 'רק כותרת', text: '' },
      { title: ' ', text: ' ' },
    ];
    it.each(
      TYPES.flatMap((type) =>
        cases.flatMap(([label, content]) => snippets.map((snippet, i) => [type, label, i, content, snippet] as const))
      )
    )('%s / %s / snippet %i', (type, _label, _i, content, snippet) => {
      expect(mirror.appendSnippet(content, type, snippet)).toEqual(client.appendSnippet(content, type, snippet));
    });
  });

  it('canAppendTo and EMPTY_RECIPE match', () => {
    for (const type of TYPES) expect(mirror.canAppendTo(type)).toBe(client.canAppendTo(type));
    expect(mirror.EMPTY_RECIPE).toEqual(client.EMPTY_RECIPE);
  });
});
