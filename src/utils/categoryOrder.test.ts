import { describe, expect, it } from 'vitest';
import { MAX_CATEGORY_ORDER, applyCategoryOrder, moveCategory, parseCategoryOrder } from './categoryOrder';

const cats = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((category) => category.id);

describe('applyCategoryOrder', () => {
  it('keeps the incoming order when nothing was saved', () => {
    expect(ids(applyCategoryOrder(cats('a', 'b', 'c'), []))).toEqual(['a', 'b', 'c']);
  });

  it('orders by the saved list', () => {
    expect(ids(applyCategoryOrder(cats('a', 'b', 'c'), ['c', 'a', 'b']))).toEqual(['c', 'a', 'b']);
  });

  it('puts categories missing from the list (new, or just shared) after, in their incoming order', () => {
    expect(ids(applyCategoryOrder(cats('a', 'new1', 'b', 'new2'), ['b', 'a']))).toEqual([
      'b',
      'a',
      'new1',
      'new2',
    ]);
  });

  it('ignores ids of categories that no longer exist, and duplicates', () => {
    expect(ids(applyCategoryOrder(cats('a', 'b'), ['gone', 'b', 'b', 'a']))).toEqual(['b', 'a']);
  });

  it('does not change the input array', () => {
    const input = cats('a', 'b');
    applyCategoryOrder(input, ['b', 'a']);
    expect(ids(input)).toEqual(['a', 'b']);
  });
});

describe('moveCategory', () => {
  it('moves down', () => {
    expect(moveCategory(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves up', () => {
    expect(moveCategory(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns null for no move or an unknown id', () => {
    expect(moveCategory(['a', 'b'], 'a', 'a')).toBeNull();
    expect(moveCategory(['a', 'b'], 'x', 'a')).toBeNull();
    expect(moveCategory(['a', 'b'], 'a', 'x')).toBeNull();
  });

  it('never returns more than the rules allow', () => {
    const many = Array.from({ length: MAX_CATEGORY_ORDER + 5 }, (_, index) => `c${index}`);
    expect(moveCategory(many, 'c1', 'c0')).toHaveLength(MAX_CATEGORY_ORDER);
  });
});

describe('parseCategoryOrder', () => {
  it('keeps only strings', () => {
    expect(parseCategoryOrder(['a', 3, null, 'b'])).toEqual(['a', 'b']);
  });

  it('treats anything else as no order', () => {
    expect(parseCategoryOrder(undefined)).toEqual([]);
    expect(parseCategoryOrder('a,b')).toEqual([]);
    expect(parseCategoryOrder({ 0: 'a' })).toEqual([]);
  });
});
