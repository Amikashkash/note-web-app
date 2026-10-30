import { describe, expect, it } from 'vitest';
import { parseChecklist, parseWorkPlan } from './templateContent';
import { withFirstRow } from './firstRow';

describe('withFirstRow (no edit mode: opening a note never writes)', () => {
  const row = { id: 'first', text: '', completed: false };

  it('a new, completely empty list shows one empty row - computed, not written', () => {
    expect(withFirstRow('', parseChecklist(''), false, row)).toEqual([row]);
  });

  it('a list whose tasks were all deleted stays empty', () => {
    expect(withFirstRow('[]', parseChecklist('[]'), false, row)).toEqual([]);
  });

  it('existing content is shown as is', () => {
    const content = JSON.stringify([{ id: 'a', text: 'חלב', completed: false }]);
    expect(withFirstRow(content, parseChecklist(content), false, row)).toEqual([{ id: 'a', text: 'חלב', completed: false }]);
  });

  it('unreadable content is not shown as a list (and so never overwritten)', () => {
    expect(withFirstRow('not json', parseChecklist('not json'), false, row)).toEqual([]);
  });

  it('view-only (a blocked version): no made-up row', () => {
    expect(withFirstRow('', parseChecklist(''), true, row)).toEqual([]);
  });

  it('the same for a work plan', () => {
    const section = { id: 's', header: '', content: '' };
    expect(withFirstRow('', parseWorkPlan(''), false, section)).toEqual([section]);
    expect(withFirstRow('[]', parseWorkPlan('[]'), false, section)).toEqual([]);
  });
});

