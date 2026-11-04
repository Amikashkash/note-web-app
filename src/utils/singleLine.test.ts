import { describe, expect, it } from 'vitest';
import { singleLine } from './singleLine';

describe('singleLine: an item stays one line, only the display wraps', () => {
  it('turns pasted line breaks of every kind into spaces', () => {
    expect(singleLine('חלב\nלחם')).toBe('חלב לחם');
    expect(singleLine('חלב\r\nלחם\rביצים')).toBe('חלב לחם ביצים');
  });

  it('leaves text without line breaks untouched, including spaces', () => {
    expect(singleLine('  משימה  ארוכה ')).toBe('  משימה  ארוכה ');
  });
});
