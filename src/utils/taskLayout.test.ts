import { describe, expect, it } from 'vitest';
import { controlsOnOwnLine } from './taskLayout';

describe('controlsOnOwnLine: the controls drop below the text when they would squeeze it', () => {
  it('without a date: only long tasks (over 40 characters)', () => {
    expect(controlsOnOwnLine({ text: 'לקבוע תור לרופא שיניים' })).toBe(false);
    expect(controlsOnOwnLine({ text: 'לחדש את רישיון הנהיגה באתר של משרד התחבורה' })).toBe(true);
  });

  it('with a date: always, even a two-word task (it wrapped beside a date, a time and two clear buttons)', () => {
    expect(controlsOnOwnLine({ text: 'לשלם ארנונה', dueDate: '2026-12-01' })).toBe(true);
    expect(controlsOnOwnLine({ text: 'x', dueDate: '2026-12-01' })).toBe(true);
  });
});
