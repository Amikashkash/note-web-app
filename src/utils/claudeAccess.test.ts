import { describe, expect, it } from 'vitest';
import { accessOf, choiceExposes, effectiveAccess, flagsFor } from './claudeAccess';

const open = { isSensitive: false, isReadOnly: false };
const readOnly = { isSensitive: false, isReadOnly: true };
const hidden = { isSensitive: true, isReadOnly: false };

describe('accessOf / flagsFor', () => {
  it('maps the two flags to one level', () => {
    expect(accessOf(open)).toBe('edit');
    expect(accessOf(readOnly)).toBe('read');
    expect(accessOf(hidden)).toBe('hidden');
    // both flags: hidden wins
    expect(accessOf({ isSensitive: true, isReadOnly: true })).toBe('hidden');
    expect(accessOf({})).toBe('edit');
  });

  it('round-trips', () => {
    for (const level of ['edit', 'read', 'hidden'] as const) {
      expect(accessOf(flagsFor(level))).toBe(level);
    }
  });
});

describe('effectiveAccess: the category can only make it stricter', () => {
  it('uses the note when the category is open, or there is none', () => {
    expect(effectiveAccess(readOnly, open)).toEqual({ access: 'read', fromCategory: false });
    expect(effectiveAccess(hidden)).toEqual({ access: 'hidden', fromCategory: false });
  });

  it('a sensitive category hides an open note, and says so', () => {
    expect(effectiveAccess(open, hidden)).toEqual({ access: 'hidden', fromCategory: true });
    expect(effectiveAccess(readOnly, hidden)).toEqual({ access: 'hidden', fromCategory: true });
  });

  it('a read-only category makes an open note read-only', () => {
    expect(effectiveAccess(open, readOnly)).toEqual({ access: 'read', fromCategory: true });
  });

  it('a stricter note is its own state, not the category', () => {
    expect(effectiveAccess(hidden, readOnly)).toEqual({ access: 'hidden', fromCategory: false });
    expect(effectiveAccess(hidden, hidden)).toEqual({ access: 'hidden', fromCategory: false });
  });
});

describe('choiceExposes: confirm before showing a hidden note to Claude', () => {
  it('hidden note → edit or read exposes it', () => {
    expect(choiceExposes(hidden, open, 'edit')).toBe(true);
    expect(choiceExposes(hidden, readOnly, 'read')).toBe(true);
  });

  it('staying hidden, or a note that is not hidden, does not', () => {
    expect(choiceExposes(hidden, open, 'hidden')).toBe(false);
    expect(choiceExposes(readOnly, open, 'edit')).toBe(false);
  });

  it('in a sensitive category the note stays hidden whatever is chosen', () => {
    expect(choiceExposes(hidden, hidden, 'edit')).toBe(false);
    expect(choiceExposes(open, hidden, 'edit')).toBe(false);
  });
});
