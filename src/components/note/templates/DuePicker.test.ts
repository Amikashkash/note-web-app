/**
 * הבורר של תאריך ושעה במשימה (v1.44.1). בלי DOM בבדיקות היחידה, ולכן: המבנה
 * שהקומפוננטה מחזירה, והטיפול בנגיעה. הבדיקה בדפדפן אמיתי - ב-PR.
 */

import type { ReactElement, ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { DuePicker } from './DuePicker';

type Element = ReactElement<{ children?: ReactNode; className?: string; onClick?: (event: unknown) => void; id?: string }>;

const childrenOf = (element: Element): Element[] =>
  ([] as ReactNode[]).concat(element.props.children ?? []).filter((child): child is Element => !!child && typeof child === 'object');

/** כל האלמנטים בעץ, עם ההורה הישיר של כל אחד */
const walk = (element: Element, parent: Element | null = null, out: { element: Element; parent: Element | null }[] = []) => {
  out.push({ element, parent });
  for (const child of childrenOf(element)) walk(child, element, out);
  return out;
};

const render = (value: string) =>
  DuePicker({
    inputId: 'date-task-1',
    type: 'date',
    value,
    Icon: CalendarDays,
    colorClass: 'text-brand',
    title: 'תאריך יעד',
    onChange: () => undefined,
    onClear: () => undefined,
  }) as Element;

const parts = (value: string) => {
  const nodes = walk(render(value));
  const input = nodes.find(({ element }) => element.type === 'input')!;
  const icon = nodes.find(({ element }) => element.type === CalendarDays)!;
  const clear = nodes.find(({ element }) => element.type === 'button');
  return { nodes, input, icon, clear };
};

describe('DuePicker: the transparent input covers the icon, and only the icon', () => {
  it.each([['with a value', '2026-11-27'], ['without a value', '']])('%s: the input and the icon share their own box', (_label, value) => {
    const { input, icon } = parts(value);
    // אותה תיבה ממוקמת, והקלט ממלא אותה - לא `left-0` על כל המיכל
    expect(input.parent).toBe(icon.parent);
    expect(input.parent?.props.className).toContain('relative');
    expect(input.element.props.className).toContain('inset-0');
    expect(input.element.props.className).not.toContain('left-0');
  });

  it('with a value, the clear button (X) is outside that box, so it never sits on the input', () => {
    const { input, clear, nodes } = parts('2026-11-27');
    expect(clear).toBeDefined();
    const insideBox = (target: Element) => walk(input.parent!).some(({ element }) => element === target);
    expect(insideBox(clear!.element)).toBe(false);
    expect(nodes.filter(({ element }) => element.type === 'input')).toHaveLength(1);
  });

  it('without a value there is no clear button', () => {
    expect(parts('').clear).toBeUndefined();
  });
});

describe('DuePicker: a tap opens the system picker wherever it lands', () => {
  const tap = (currentTarget: unknown) => parts('2026-11-27').input.element.props.onClick!({ currentTarget });

  it('calls showPicker', () => {
    const showPicker = vi.fn();
    tap({ showPicker });
    expect(showPicker).toHaveBeenCalledOnce();
  });

  it('a browser without showPicker, or one that throws (already open), keeps the normal behavior', () => {
    expect(() => tap({})).not.toThrow();
    expect(() =>
      tap({
        showPicker: () => {
          throw new Error('InvalidStateError');
        },
      })
    ).not.toThrow();
  });
});
