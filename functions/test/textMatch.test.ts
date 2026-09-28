/**
 * `edit_note_text`: מציאת הקטע להחלפה, עם מקרי קצה של עברית.
 */

import { describe, expect, it } from 'vitest';
import { findUnique, replaceRange } from '../src/mcp/textMatch';

const replace = (text: string, oldText: string, newText: string) => {
  const match = findUnique(text, oldText);
  if (!match.ok) throw new Error(`no unique match (${match.count})`);
  return { text: replaceRange(text, match.start, match.end, newText), tolerant: match.tolerant };
};

describe('exact matching', () => {
  it('replaces the one occurrence and keeps everything around it', () => {
    expect(replace('לקנות חלב ולחם', 'חלב', 'גבינה').text).toBe('לקנות גבינה ולחם');
  });

  it('refuses a fragment that is not there, and one that appears twice', () => {
    expect(findUnique('לקנות חלב', 'גבינה')).toEqual({ ok: false, count: 0 });
    expect(findUnique('חלב וחלב', 'חלב')).toEqual({ ok: false, count: 2 });
  });

  it('counts overlapping occurrences, so "אאא" in "אאאא" is ambiguous', () => {
    expect(findUnique('אאאא', 'אאא')).toEqual({ ok: false, count: 2 });
  });

  it('an empty fragment matches nothing', () => {
    expect(findUnique('טקסט', '')).toEqual({ ok: false, count: 0 });
    expect(findUnique('טקסט', '\u200F')).toEqual({ ok: false, count: 0 });
  });
});

describe('line endings', () => {
  it('a fragment with \\n matches a note stored with \\r\\n', () => {
    const note = 'שורה 1\r\nשורה 2\r\nשורה 3';
    expect(replace(note, 'שורה 1\nשורה 2', 'אחת').text).toBe('אחת\r\nשורה 3');
  });

  it('new text follows the note\'s line endings', () => {
    expect(replace('א\r\nב', 'ב', 'ג\nד').text).toBe('א\r\nג\r\nד');
    expect(replace('א\nב', 'ב', 'ג\r\nד').text).toBe('א\nג\nד');
  });
});

describe('invisible direction marks', () => {
  it('a copy without the RLM matches the stored text that has it, and the rest keeps its marks', () => {
    const note = '\u200Fפגישה עם\u200F דני\u200F ב-10:00';
    const result = replace(note, 'עם דני', 'עם רותי');
    expect(result.text).toBe('\u200Fפגישה עם רותי\u200F ב-10:00');
    expect(result.tolerant).toBe(false);
  });

  it('a copy that has marks the note does not have still matches', () => {
    expect(replace('שלום עולם', '\u202Bשלום\u202C', 'היי').text).toBe('היי עולם');
  });

  it('keeps ZWJ, which is part of emoji', () => {
    const family = '👨\u200D👩\u200D👧';
    expect(findUnique(`משפחה ${family}`, '👨👩👧')).toEqual({ ok: false, count: 0 });
    expect(findUnique(`משפחה ${family}`, family).ok).toBe(true);
  });
});

describe('Hebrew with niqqud', () => {
  it('the same niqqud in another order (NFC) still matches', () => {
    // בּ + ָ בשני סדרים שונים
    const stored = 'בָּית';
    const copy = 'בָּית';
    expect(findUnique(stored, copy).ok).toBe(true);
  });

  it('never cuts a letter away from its niqqud', () => {
    // "ש" בלי הניקוד לא מתאים ל"שָׁ" - זו לא אותה אות מבחינת ההתאמה
    expect(findUnique('שָׁלוֹם', 'ש')).toEqual({ ok: false, count: 0 });
  });

  it('replaces a vocalised word as a whole', () => {
    expect(replace('אמר שָׁלוֹם לכולם', 'שָׁלוֹם', 'היי').text).toBe('אמר היי לכולם');
  });
});

describe('tolerant fallback, only when there is no exact match', () => {
  it('several spaces or a tab count as one space', () => {
    const result = replace('משימה:   לקנות\tחלב', 'משימה: לקנות חלב', 'בוצע');
    expect(result).toEqual({ text: 'בוצע', tolerant: true });
  });

  it('a non-breaking space counts as a space', () => {
    expect(replace('10\u00A0ש"ח', '10 ש"ח', '12 ש"ח').text).toBe('12 ש"ח');
  });

  it('spaces at the end of a line do not matter', () => {
    expect(replace('שורה ראשונה   \nשורה שנייה', 'שורה ראשונה\nשורה שנייה', 'x').text).toBe('x');
  });

  it('Hebrew gershayim, geresh and maqaf match their ASCII look-alikes', () => {
    expect(replace('שירות בצה״ל', 'בצה"ל', 'במילואים').text).toBe('שירות במילואים');
    expect(replace('ג׳ירפה', "ג'ירפה", 'פיל').text).toBe('פיל');
    expect(replace('בית־ספר', 'בית-ספר', 'גן').text).toBe('גן');
  });

  it('an exact match wins over a tolerant one', () => {
    expect(replace('א  ב וגם א ב', 'א ב', 'ג')).toEqual({ text: 'א  ב וגם ג', tolerant: false });
  });

  it('still refuses when the tolerant match is ambiguous', () => {
    expect(findUnique('א  ב ועוד א\tב', 'א ב')).toEqual({ ok: false, count: 2 });
  });

  it('does not merge words: "אתהבית" is not "את הבית"', () => {
    expect(findUnique('אתהבית', 'את הבית')).toEqual({ ok: false, count: 0 });
  });
});
