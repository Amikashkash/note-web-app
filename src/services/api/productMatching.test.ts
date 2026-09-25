import { describe, expect, it } from 'vitest';
import { normalizeProductName, rankSuggestions } from './productMatching';

describe('normalizeProductName', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeProductName('  Milk   3%  ')).toBe('milk 3%');
    expect(normalizeProductName('חלב  תנובה')).toBe('חלב תנובה');
  });
});

describe('rankSuggestions', () => {
  const products = [
    { name: 'שקדי חלב', useCount: 10 },
    { name: 'חלב', useCount: 2 },
    { name: 'חלב סויה', useCount: 5 },
    { name: 'לחם', useCount: 50 },
  ];

  it('puts names that start with the query before names that only contain it', () => {
    expect(rankSuggestions(products, 'חל').map((product) => product.name)).toEqual([
      'חלב סויה',
      'חלב',
      'שקדי חלב',
    ]);
  });

  it('orders by use count within each group', () => {
    const [first, second] = rankSuggestions(products, 'חלב');
    expect([first.name, second.name]).toEqual(['חלב סויה', 'חלב']);
  });

  it('returns nothing for an empty query', () => {
    expect(rankSuggestions(products, '   ')).toEqual([]);
  });

  it('excludes items already on the list, ignoring case and spacing', () => {
    const names = rankSuggestions(products, 'חל', [' חלב  סויה']).map((product) => product.name);
    expect(names).not.toContain('חלב סויה');
  });

  it('returns at most six suggestions', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({ name: `a${index}`, useCount: index }));
    expect(rankSuggestions(many, 'a')).toHaveLength(6);
  });
});
