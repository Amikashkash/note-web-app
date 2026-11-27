import { describe, expect, it } from 'vitest';
import { parseChecklist, parseShopping, parseWorkPlan } from '@/utils/templateContent';
import { FIXTURE_CATEGORIES, fixtureNotes } from './realisticHebrew';

const now = new Date(2026, 10, 27, 10, 0);
const notes = fixtureNotes(now);
const byId = (id: string) => notes.find((note) => note.id === id)!;

describe('the realistic Hebrew fixture', () => {
  it('every note parses with the app parsers, and belongs to a fixture category', () => {
    const categories = new Set(FIXTURE_CATEGORIES.map((category) => category.id));
    const parsers = { checklist: parseChecklist, shopping: parseShopping, workplan: parseWorkPlan } as const;
    for (const note of notes) {
      expect(categories.has(note.categoryId)).toBe(true);
      const parse = parsers[note.templateType as keyof typeof parsers];
      if (parse) expect(parse(note.content).ok).toBe(true);
    }
  });

  it('has the content that broke on phones: long tasks with dates, times, repeats and flags', () => {
    const tasks = parseChecklist(byId('fx-errands-list').content);
    expect(tasks.ok).toBe(true);
    if (!tasks.ok) return;
    const words = (text: string) => text.trim().split(/\s+/).length;
    expect(tasks.value.some((task) => words(task.text) >= 30 && task.dueDate && task.dueTime && task.priority)).toBe(true);
    expect(tasks.value.some((task) => task.repeat)).toBe(true);
    expect(tasks.value.some((task) => task.dueDate === '2026-11-27')).toBe(true);
  });

  it('has a work plan of 20 sections with long logs, in both the old and the 1.44.0 format', () => {
    const sections = parseWorkPlan(byId('fx-garden-log').content);
    expect(sections.ok).toBe(true);
    if (!sections.ok) return;
    expect(sections.value).toHaveLength(20);
    expect(Math.max(...sections.value.map((section) => section.content.split('\n').length))).toBeGreaterThanOrEqual(60);
    expect(sections.value.some((section) => section.state)).toBe(true);
    expect(sections.value.some((section) => !section.state && section.updatedAt === undefined)).toBe(true);
  });
});
