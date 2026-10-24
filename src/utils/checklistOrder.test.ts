import { describe, expect, it } from 'vitest';
import { byPriority, moveTask, sortTasksByPriority } from './checklistOrder';
import { openTasksFirst } from './templateContent';

const task = (id: string, completed = false) => ({ id, text: id, completed });
const ids = (items: { id: string }[] | null) => items?.map((item) => item.id);

describe('moveTask (drag to reorder a checklist)', () => {
  it('moves a task down and up among the open tasks', () => {
    const items = [task('a'), task('b'), task('c'), task('d')];
    expect(ids(moveTask(items, 'a', 'c'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(moveTask(items, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c']);
  });

  it('keeps done tasks in their stored places, so unchecking still returns a task to its place', () => {
    const items = [task('a'), task('x', true), task('b'), task('c')];
    const moved = moveTask(items, 'c', 'a');
    expect(ids(moved)).toEqual(['c', 'x', 'a', 'b']);
    expect(ids(openTasksFirst(moved!))).toEqual(['c', 'a', 'b', 'x']);
  });

  it('reorders done tasks among themselves', () => {
    const items = [task('x', true), task('a'), task('y', true), task('z', true)];
    expect(ids(moveTask(items, 'z', 'x'))).toEqual(['z', 'a', 'x', 'y']);
  });

  it('does nothing across the groups, onto itself, or for an unknown id', () => {
    const items = [task('a'), task('x', true)];
    expect(moveTask(items, 'a', 'x')).toBeNull();
    expect(moveTask(items, 'a', 'a')).toBeNull();
    expect(moveTask(items, 'a', 'nope')).toBeNull();
  });

  it('keeps every field of the moved task', () => {
    const items = [{ ...task('a'), dueDate: '2026-11-01', dueTime: '09:00', priority: 'urgent' as const }, task('b')];
    expect(moveTask(items, 'a', 'b')?.[1]).toEqual(items[0]);
  });
});

describe('byPriority (the "by priority" view)', () => {
  const p = (id: string, priority?: 'urgent' | 'low') => ({ ...task(id), ...(priority && { priority }) });

  it('urgent first, then normal, then low - each level in the stored order', () => {
    const items = [p('n1'), p('l1', 'low'), p('u1', 'urgent'), p('n2'), p('u2', 'urgent'), p('l2', 'low')];
    expect(ids(byPriority(items))).toEqual(['u1', 'u2', 'n1', 'n2', 'l1', 'l2']);
  });

  it('does not change the list it is given', () => {
    const items = [p('l', 'low'), p('u', 'urgent')];
    byPriority(items);
    expect(ids(items)).toEqual(['l', 'u']);
  });
});

describe('sortTasksByPriority (the one-time "sort by priority" that is saved)', () => {
  const p = (id: string, priority?: 'urgent' | 'low', completed = false) => ({
    ...task(id, completed),
    ...(priority && { priority }),
  });

  it('sorts the open tasks into their own places and leaves done tasks where they are', () => {
    const items = [p('n1'), p('x', 'urgent', true), p('l1', 'low'), p('u1', 'urgent'), p('n2')];
    expect(ids(sortTasksByPriority(items))).toEqual(['u1', 'x', 'n1', 'n2', 'l1']);
  });

  it('sorts done tasks among themselves the same way', () => {
    const items = [p('d1', undefined, true), p('a'), p('d2', 'urgent', true)];
    expect(ids(sortTasksByPriority(items))).toEqual(['d2', 'a', 'd1']);
  });

  it('returns null when the list is already sorted, so nothing is saved', () => {
    expect(sortTasksByPriority([p('u', 'urgent'), p('n'), p('l', 'low')])).toBeNull();
  });

  it('a manual move after sorting is kept: the list is not kept sorted', () => {
    const sorted = sortTasksByPriority([p('n'), p('u', 'urgent')])!;
    expect(ids(moveTask(sorted, 'n', 'u'))).toEqual(['n', 'u']);
  });
});
