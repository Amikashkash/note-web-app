import { describe, expect, it } from 'vitest';
import { moveTask } from './checklistOrder';
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
    const items = [{ ...task('a'), dueDate: '2026-11-01', dueTime: '09:00' }, task('b')];
    expect(moveTask(items, 'a', 'b')?.[1]).toEqual(items[0]);
  });
});
