import { describe, expect, it } from 'vitest';
import {
  addSection,
  appendTodayEntry,
  latestLogLine,
  logDate,
  moveSection,
  patchSection,
  removeSection,
  sectionProgress,
  timeAgo,
} from './workplan';
import { parseWorkPlan } from './templateContent';

const NOW = new Date(2026, 10, 13, 12, 0).getTime();
const plan = (...rows: object[]) => JSON.stringify(rows);
const rows = (value: string | null) => JSON.parse(value ?? 'null');

describe('existing content stays intact', () => {
  const old = plan({ id: 'a', header: 'אקווריום 1', content: '2 זכרים, 5 נקבות\n10/11 העברה אחת' });

  it('an old section parses with its content as the log, and no new fields invented', () => {
    const parsed = parseWorkPlan(old);
    expect(parsed).toEqual({ ok: true, value: [{ id: 'a', header: 'אקווריום 1', content: '2 זכרים, 5 נקבות\n10/11 העברה אחת' }] });
  });

  it('reading it never rewrites it: nothing here runs without an edit', () => {
    expect(moveSection(old, 'a', 'a')).toBeNull();
    expect(patchSection(old, 'a', { header: 'אקווריום 1' }, NOW)).toBeNull();
  });
});

describe('patchSection', () => {
  it('changes only the given fields, stamps updatedAt, and keeps fields it does not know', () => {
    const value = plan({ id: 'a', header: 'א', content: 'יומן', future: { x: 1 } }, { id: 'b', header: 'ב', content: '' });
    const next = rows(patchSection(value, 'a', { state: 'מצב' }, NOW));
    expect(next[0]).toEqual({ id: 'a', header: 'א', content: 'יומן', future: { x: 1 }, state: 'מצב', updatedAt: NOW });
    expect(next[1]).toEqual({ id: 'b', header: 'ב', content: '' });
  });

  it('persists the shown id of a section saved without one', () => {
    const next = rows(patchSection(plan({ header: 'ישן', content: '' }), 'item-0', { content: 'חדש' }, NOW));
    expect(next[0]).toMatchObject({ id: 'item-0', content: 'חדש' });
  });

  it('returns null for an unknown section, no change, or unreadable content', () => {
    expect(patchSection(plan({ id: 'a', header: '', content: '' }), 'x', { content: '1' }, NOW)).toBeNull();
    expect(patchSection(plan({ id: 'a', header: 'א', content: '' }), 'a', { header: 'א' }, NOW)).toBeNull();
    expect(patchSection('not json', 'a', { content: '1' }, NOW)).toBeNull();
  });

  it('an empty state counts as no state, so clearing a missing state is not a change', () => {
    expect(patchSection(plan({ id: 'a', header: '', content: '' }), 'a', { state: '' }, NOW)).toBeNull();
  });
});

describe('add, remove, move', () => {
  const value = plan({ id: 'a', header: 'א', content: '' }, { id: 'b', header: 'ב', content: '' }, { id: 'c', header: 'ג', content: '' });

  it('adds an empty section at the end and returns its id', () => {
    const added = addSection(value, NOW);
    const next = rows(added?.value ?? null);
    expect(next).toHaveLength(4);
    expect(next[3]).toEqual({ id: added?.id, header: '', content: '', updatedAt: NOW });
  });

  it('removes one section', () => {
    expect(rows(removeSection(value, 'b')).map((row: { id: string }) => row.id)).toEqual(['a', 'c']);
    expect(removeSection(value, 'x')).toBeNull();
  });

  it('moves down and up', () => {
    expect(rows(moveSection(value, 'a', 'c')).map((row: { id: string }) => row.id)).toEqual(['b', 'c', 'a']);
    expect(rows(moveSection(value, 'c', 'a')).map((row: { id: string }) => row.id)).toEqual(['c', 'a', 'b']);
  });

  it('moving does not stamp updatedAt: the order is not the content of a section', () => {
    expect(rows(moveSection(value, 'a', 'b'))[1]).toEqual({ id: 'a', header: 'א', content: '' });
  });
});

describe('the collapsed row', () => {
  it('latestLogLine is the last non-empty line, without list markers', () => {
    expect(latestLogLine('2 זכרים\n10/11 העברה אחת\n\n  ')).toBe('10/11 העברה אחת');
    expect(latestLogLine('* 12/11 **ניקוי** מסנן')).toBe('12/11 ניקוי מסנן');
    expect(latestLogLine('1. ראשון\n2. שני')).toBe('שני');
    expect(latestLogLine('')).toBe('');
  });

  it('timeAgo counts calendar days', () => {
    const at = (days: number, hour = 12) => new Date(2026, 10, 13 - days, hour).getTime();
    expect(timeAgo(at(0, 1), NOW)).toBe('היום');
    expect(timeAgo(at(1, 23), NOW)).toBe('אתמול');
    expect(timeAgo(at(3), NOW)).toBe('לפני 3 ימים');
    expect(timeAgo(at(7), NOW)).toBe('לפני שבוע');
    expect(timeAgo(at(15), NOW)).toBe('לפני שבועיים');
    expect(timeAgo(at(40), NOW)).toBe('לפני חודש');
    expect(timeAgo(at(70), NOW)).toBe('לפני חודשיים');
    expect(timeAgo(at(200), NOW)).toBe('לפני 6 חודשים');
    expect(timeAgo(at(800), NOW)).toBe('לפני שנתיים');
    // שעון של מכשיר אחר שמקדים בכמה דקות
    expect(timeAgo(NOW + 60_000, NOW)).toBe('היום');
  });
});

describe('+ רשומה היום', () => {
  const today = new Date(2026, 10, 13);

  it('writes the date like the user does: day/month, no zeros', () => {
    expect(logDate(today)).toBe('13/11');
    expect(logDate(new Date(2026, 0, 5))).toBe('5/1');
  });

  it('adds a new line at the end, with the cursor after the date', () => {
    const entry = appendTodayEntry('10/11 העברה אחת', today);
    expect(entry.log).toBe('10/11 העברה אחת\n13/11 ');
    expect(entry.cursor).toBe(entry.log.length);
  });

  it('on an empty log, the first line; trailing blank lines are not doubled', () => {
    expect(appendTodayEntry('', today).log).toBe('13/11 ');
    expect(appendTodayEntry('שורה\n\n\n', today).log).toBe('שורה\n13/11 ');
  });
});

describe('sectionProgress', () => {
  it('counts done out of all sections; a section without status is open', () => {
    expect(sectionProgress([{ status: 'done' }, { status: 'active' }, {}, { status: 'done' }])).toEqual({ done: 2, total: 4 });
  });
});
