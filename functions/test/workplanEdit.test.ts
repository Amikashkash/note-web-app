/**
 * תכניות עבודה והחלפת טקסט (המשך 2ב-lite): איך כל עריכה מוחלת על הגרסה העדכנית.
 */

import { describe, expect, it } from 'vitest';
import { buildNote } from '../src/mcp/createNote';
import {
  buildAddSectionEdit,
  buildAppendEdit,
  buildLogEntryEdit,
  buildRemoveSectionEdit,
  buildReorderSectionsEdit,
  buildReplaceEdit,
  buildSectionStateEdit,
  buildSectionStatusEdit,
} from '../src/mcp/editNote';
import { InvalidError } from '../src/notesCore/errors';
import type { NoteRecord } from '../src/notesCore/model';

const NOW = new Date('2026-10-01T09:00:00Z');

const record = (content: unknown, templateType = 'workplan'): NoteRecord => ({
  id: 'n1',
  title: 'שיפוץ המטבח',
  content: typeof content === 'string' ? content : JSON.stringify(content),
  categoryId: 'c1',
  templateType,
  tags: [],
  color: null,
  order: 0,
  userId: 'u1',
  sharedWith: [],
  isPinned: false,
  isArchived: false,
  isSensitive: false,
  isReadOnly: false,
  createdVia: null,
  revision: 2,
  createdAt: null,
  updatedAt: null,
  archivedAt: null,
  updatedBy: null,
});

const plan = [
  { id: 's1', header: 'תקציב', content: 'עד 40,000 ש"ח', owner: 'דנה' },
  { id: 's2', header: 'קבלנים', content: 'לבקש 3 הצעות' },
];

const rowsOf = (outcome: { content?: string } | null) => JSON.parse(outcome!.content ?? '');

describe('create_note with type "workplan"', () => {
  it('builds sections with ids, in the format the app reads', () => {
    const { draft } = buildNote(
      {
        categoryId: 'c1',
        title: 'שיפוץ',
        type: 'workplan',
        sections: [
          { header: '  תקציב  ', content: 'עד 40,000' },
          { header: '', content: 'הערות כלליות\nשורה שנייה' },
        ],
      },
      NOW
    );
    expect(draft.templateType).toBe('workplan');
    expect(JSON.parse(draft.content)).toEqual([
      { id: `${NOW.getTime()}-0`, header: 'תקציב', content: 'עד 40,000' },
      { id: `${NOW.getTime()}-1`, header: '', content: 'הערות כלליות\nשורה שנייה' },
    ]);
    expect(draft.summary.itemCount).toBe(2);
  });

  it.each([
    ['no sections', { sections: [] }, 'at least one section'],
    ['an empty section', { sections: [{ header: ' ', content: ' ' }] }, 'section 1 is empty'],
    ['items instead of sections', { sections: [{ header: 'a', content: '' }], items: [{ text: 'x' }] }, 'not text or items'],
    ['a header that is too long', { sections: [{ header: 'א'.repeat(201), content: '' }] }, 'the limit is 200'],
  ])('refuses %s', (_label, extra, message) => {
    expect(() => buildNote({ categoryId: 'c1', title: 't', type: 'workplan', ...extra }, NOW)).toThrow(message);
  });

  it('sections are refused on other types', () => {
    expect(() =>
      buildNote({ categoryId: 'c1', title: 't', type: 'text', text: 'x', sections: [{ header: 'a', content: '' }] }, NOW)
    ).toThrow('sections are for work plans');
  });
});

describe('add_workplan_section', () => {
  it('adds at the end by default', () => {
    const outcome = buildAddSectionEdit({ header: 'לוח זמנים', content: 'עד חנוכה' }, NOW).apply(record(plan));
    const rows = rowsOf(outcome);
    expect(rows.map((row: { header: string }) => row.header)).toEqual(['תקציב', 'קבלנים', 'לוח זמנים']);
    expect(rows[0]).toEqual(plan[0]);
  });

  it('adds right after a given section', () => {
    const outcome = buildAddSectionEdit({ header: 'מימון', content: 'הלוואה?', afterSectionId: 's1' }, NOW).apply(record(plan));
    expect(rowsOf(outcome).map((row: { header: string }) => row.header)).toEqual(['תקציב', 'מימון', 'קבלנים']);
  });

  it('refuses an unknown section id, an empty section, and a note that is not a work plan', () => {
    expect(() => buildAddSectionEdit({ header: 'x', content: '', afterSectionId: 'nope' }, NOW).apply(record(plan))).toThrow(
      'Call get_note to see the current section ids'
    );
    expect(() => buildAddSectionEdit({ header: ' ', content: ' ' }, NOW)).toThrow('the section is empty');
    expect(() => buildAddSectionEdit({ header: 'x', content: '' }, NOW).apply(record('טקסט', 'plain'))).toThrow(
      'not a work plan'
    );
  });
});

describe('append_text in a work plan section', () => {
  it('adds on a new line at the end of that section only', () => {
    const outcome = buildAppendEdit('ועוד הצעה מקבלן רביעי', 's2').apply(record(plan));
    expect(rowsOf(outcome)).toEqual([plan[0], { ...plan[1], content: 'לבקש 3 הצעות\nועוד הצעה מקבלן רביעי' }]);
  });

  it('a work plan needs a section id; a text note must not have one', () => {
    expect(() => buildAppendEdit('x').apply(record(plan))).toThrow('Give sectionId');
    expect(() => buildAppendEdit('x', 's1').apply(record('טקסט', 'plain'))).toThrow('sectionId is only for work plans');
  });

  it('the fingerprint includes the section, so the same text in two sections is two additions', () => {
    expect(buildAppendEdit('x', 's1').fingerprint).not.toBe(buildAppendEdit('x', 's2').fingerprint);
  });
});

describe('edit_note_text', () => {
  it('replaces one fragment in a text note', () => {
    const outcome = buildReplaceEdit({ oldText: 'ביום ראשון', newText: 'ביום שני' }).apply(
      record('פגישה ביום ראשון בבוקר', 'plain')
    );
    expect(outcome?.content).toBe('פגישה ביום שני בבוקר');
    expect(outcome?.before).toEqual({ text: 'ביום ראשון' });
    expect(outcome?.after).toMatchObject({ text: 'ביום שני', tolerantMatch: false });
  });

  it('replaces in a section content by default, and in its header when asked', () => {
    const inContent = buildReplaceEdit({ oldText: '40,000', newText: '45,000', sectionId: 's1' }).apply(record(plan));
    expect(rowsOf(inContent)[0]).toEqual({ ...plan[0], content: 'עד 45,000 ש"ח' });

    const inHeader = buildReplaceEdit({ oldText: 'קבלנים', newText: 'בעלי מקצוע', sectionId: 's2', field: 'header' }).apply(
      record(plan)
    );
    expect(rowsOf(inHeader)[1]).toEqual({ ...plan[1], header: 'בעלי מקצוע' });
  });

  it('empty new text removes the fragment', () => {
    expect(buildReplaceEdit({ oldText: ' בבוקר', newText: '' }).apply(record('פגישה בבוקר', 'plain'))?.content).toBe('פגישה');
  });

  it('refuses when the fragment is missing or appears twice, and says what to do', () => {
    const missing = () => buildReplaceEdit({ oldText: 'אין דבר כזה', newText: 'x' }).apply(record('טקסט', 'plain'));
    expect(missing).toThrow(InvalidError);
    expect(missing).toThrow('was not found in the note');
    const twice = () => buildReplaceEdit({ oldText: 'חלב', newText: 'x' }).apply(record('חלב ועוד חלב', 'plain'));
    expect(twice).toThrow('appears 2 times');
    expect(twice).toThrow('Include more of the surrounding text');
  });

  it('matches the gershayim in a section even when Claude copied ASCII quotes', () => {
    const outcome = buildReplaceEdit({ oldText: '40,000 ש"ח', newText: '50 אלף', sectionId: 's1' }).apply(
      record([{ id: 's1', header: 'תקציב', content: 'עד 40,000 ש״ח' }])
    );
    expect(rowsOf(outcome)[0].content).toBe('עד 50 אלף');
    expect(outcome?.after).toMatchObject({ tolerantMatch: true });
  });

  it('refuses a multi-line header, and sectionId on a text note', () => {
    expect(() => buildReplaceEdit({ oldText: 'a', newText: 'b\nc', sectionId: 's1', field: 'header' })).toThrow('one line');
    expect(() => buildReplaceEdit({ oldText: 'a', newText: 'b', sectionId: 's1' }).apply(record('a', 'plain'))).toThrow(
      'sectionId is only for work plans'
    );
  });

  it('points checklist edits to update_checklist_item', () => {
    expect(() => buildReplaceEdit({ oldText: 'a', newText: 'b' }).apply(record('[]', 'checklist'))).toThrow(
      'update_checklist_item'
    );
  });

  it('the same text changes nothing', () => {
    expect(buildReplaceEdit({ oldText: 'א', newText: 'א' }).apply(record('א ב', 'plain'))).toBeNull();
  });
});

describe('remove_workplan_section', () => {
  it('removes that section only, and keeps it in the audit before-value', () => {
    const outcome = buildRemoveSectionEdit('s1').apply(record(plan));
    expect(rowsOf(outcome)).toEqual([plan[1]]);
    expect(outcome?.before).toEqual(plan[0]);
    expect(outcome?.after).toBeNull();
  });

  it('old sections without ids are found by the item-<n> id get_note shows', () => {
    const old = [{ header: 'א', content: '' }, { header: 'ב', content: '' }];
    expect(rowsOf(buildRemoveSectionEdit('item-1').apply(record(old)))).toEqual([{ header: 'א', content: '', id: 'item-0' }]);
  });
});

// ---------------------------------------------------------------------------
// v1.44.0: יומן, מצב ותובנות, סדר, סטטוס
// ---------------------------------------------------------------------------

describe('work plan as a log (v1.44.0)', () => {
  const tanks = [
    { id: 't1', header: 'אקווריום 1', content: '2 זכרים, 5 נקבות\n10/11 העברה אחת', future: 'kept' },
    { id: 't2', header: 'אקווריום 2', content: '', state: 'שקט', status: 'active', updatedAt: 1 },
    { header: 'אקווריום 3', content: 'ישן בלי מזהה' },
  ];
  const at = new Date('2026-11-13T21:30:00Z'); // 23:30 בישראל - עדיין 13/11
  const late = new Date('2026-11-13T22:30:00Z'); // 00:30 בישראל - כבר 14/11
  const rowsOfOutcome = (outcome: { content?: string } | null) => JSON.parse(outcome?.content ?? 'null');

  it('add_workplan_log_entry: a dated line at the end of the log, in Israel time, existing text untouched', () => {
    const outcome = buildLogEntryEdit({ sectionId: 't1', text: '  ניקוי\n מסנן ' }, at).apply(record(tanks));
    const rows = rowsOfOutcome(outcome);
    expect(rows[0]).toEqual({ ...tanks[0], content: '2 זכרים, 5 נקבות\n10/11 העברה אחת\n13/11 ניקוי מסנן', updatedAt: at.getTime() });
    expect(rows[1]).toEqual(tanks[1]);
    expect(rowsOfOutcome(buildLogEntryEdit({ sectionId: 't1', text: 'x' }, late).apply(record(tanks)))[0].content).toMatch(/\n14\/11 x$/);
  });

  it('add_workplan_log_entry: the first entry of an empty log has no leading newline; empty or too long is refused', () => {
    expect(rowsOfOutcome(buildLogEntryEdit({ sectionId: 't2', text: 'האכלה' }, at).apply(record(tanks)))[1].content).toBe('13/11 האכלה');
    expect(() => buildLogEntryEdit({ sectionId: 't1', text: '  ' }, at)).toThrow('text is empty');
    expect(() => buildLogEntryEdit({ sectionId: 't1', text: 'x'.repeat(1_001) }, at)).toThrow('a log entry is at most 1000');
  });

  it('add_workplan_log_entry: the same entry twice in a day has the same fingerprint (a retry is not added again)', () => {
    expect(buildLogEntryEdit({ sectionId: 't1', text: 'a' }, at).fingerprint).toBe(buildLogEntryEdit({ sectionId: 't1', text: 'a ' }, at).fingerprint);
    expect(buildLogEntryEdit({ sectionId: 't1', text: 'a' }, at).fingerprint).not.toBe(buildLogEntryEdit({ sectionId: 't2', text: 'a' }, at).fingerprint);
  });

  it('set_workplan_section_state: replaces the state, clears it when empty, and is a no-op when unchanged', () => {
    const set = rowsOfOutcome(buildSectionStateEdit({ sectionId: 't1', state: '3 זכרים' }, at).apply(record(tanks)));
    expect(set[0]).toEqual({ ...tanks[0], state: '3 זכרים', updatedAt: at.getTime() });
    const cleared = rowsOfOutcome(buildSectionStateEdit({ sectionId: 't2', state: '' }, at).apply(record(tanks)));
    expect(cleared[1]).not.toHaveProperty('state');
    expect(buildSectionStateEdit({ sectionId: 't2', state: 'שקט  ' }, at).apply(record(tanks))).toBeNull();
    expect(() => buildSectionStateEdit({ sectionId: 't1', state: 'x'.repeat(5_001) }, at)).toThrow('the limit is 5000');
  });

  it('reorder_workplan_sections: every id exactly once; keeps fields; persists the shown id; no updatedAt stamps', () => {
    const rows = rowsOfOutcome(buildReorderSectionsEdit(['item-2', 't1', 't2']).apply(record(tanks)));
    expect(rows.map((row: { id: string }) => row.id)).toEqual(['item-2', 't1', 't2']);
    expect(rows[1]).toEqual(tanks[0]);
    expect(rows[0]).toEqual({ ...tanks[2], id: 'item-2' });
    expect(buildReorderSectionsEdit(['t1', 't2', 'item-2']).apply(record(tanks))).toBeNull();
    for (const ids of [['t1', 't2'], ['t1', 't2', 't2'], ['t1', 't2', 'nope'], ['t1', 't2', 'item-2', 'x']]) {
      expect(() => buildReorderSectionsEdit(ids).apply(record(tanks))).toThrow('every section id of this note exactly once');
    }
  });

  it('set_workplan_section_status: refused while status is off in the note; with it on, sets and stamps', () => {
    expect(() => buildSectionStatusEdit({ sectionId: 't1', status: 'done' }, at).apply(record(tanks))).toThrow(
      'section status is turned off'
    );
    const on = { ...record(tanks), workplanStatus: true };
    expect(rowsOfOutcome(buildSectionStatusEdit({ sectionId: 't1', status: 'done' }, at).apply(on))[0]).toEqual({
      ...tanks[0],
      status: 'done',
      updatedAt: at.getTime(),
    });
    expect(buildSectionStatusEdit({ sectionId: 't2', status: 'active' }, at).apply(on)).toBeNull();
    // סעיף בלי סטטוס הוא "פתוח"
    expect(buildSectionStatusEdit({ sectionId: 'item-2', status: 'open' }, at).apply(on)).toBeNull();
  });

  it('the existing section edits stamp updatedAt when given the time, and keep unknown fields', () => {
    const appended = rowsOfOutcome(buildAppendEdit('עוד', 't1', at).apply(record(tanks)));
    expect(appended[0]).toMatchObject({ future: 'kept', updatedAt: at.getTime() });
    const replaced = rowsOfOutcome(buildReplaceEdit({ oldText: 'אחת', newText: 'שתיים', sectionId: 't1' }, at).apply(record(tanks)));
    expect(replaced[0]).toMatchObject({ future: 'kept', updatedAt: at.getTime(), content: '2 זכרים, 5 נקבות\n10/11 העברה שתיים' });
    const added = rowsOfOutcome(buildAddSectionEdit({ header: 'אקווריום 4', content: '' }, at).apply(record(tanks)));
    expect(added.at(-1)).toMatchObject({ header: 'אקווריום 4', updatedAt: at.getTime() });
  });
});
