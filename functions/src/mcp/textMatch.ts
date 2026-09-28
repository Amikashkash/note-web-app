/**
 * מציאת קטע טקסט מדויק בפתק, להחלפה (`edit_note_text`). טהור.
 *
 * Claude מעתיק את הקטע מתוך `get_note`, והעותק שלו לא תמיד זהה בית-לבית
 * למה ששמור: סימני כיוון בלתי נראים נופלים, שורות מסתיימות אחרת, ניקוד
 * עברי עשוי להגיע בסדר אחר. לכן ההשוואה נעשית על **תצוגה מנורמלת** של שני
 * הצדדים, עם מיפוי חזרה למיקומים במקור - וההחלפה נעשית במקור בלבד. כל מה
 * שמחוץ לקטע נשאר בדיוק כפי שהיה.
 *
 * הנרמול (תמיד):
 * - **סופי שורה:** `\r\n` ו-`\r` כמו `\n`.
 * - **סימנים בלתי נראים:** LRM, RLM, ALM, embeddings/overrides/isolates,
 *   BOM ו-zero-width space לא נספרים. (ZWJ/ZWNJ כן - הם חלק מאמוג'י.)
 * - **Unicode:** כל אות עם הסימנים שצמודים אליה (ניקוד, דגש) בצורת NFC,
 *   כך שאותו ניקוד בסדר אחר נחשב זהה. התאמה חייבת להתחיל ולהסתיים על גבול
 *   של אות שלמה - לא חותכים ניקוד מהאות שלו.
 *
 * אם אין התאמה מדויקת - ניסיון שני, **סובלני**: רצף רווחים/טאבים (כולל
 * רווח קשיח) כרווח אחד, בלי רווחים בקצות שורה, וגרשיים/גרש/מקף עבריים
 * כמו המקבילים ב-ASCII (צה״ל = צה"ל). גם בו הקטע חייב להופיע **בדיוק פעם
 * אחת**. אפס או יותר מפעם - אין החלפה, ואין ניחוש.
 */

/** סימני כיוון ורווחים באורך אפס: לא חלק מהטקסט הנראה */
const INVISIBLE = /^[\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]$/u;

/** רווח אופקי (לא שורה חדשה): רווח, טאב, רווח קשיח ושאר Zs */
const HORIZONTAL_SPACE = /^[\t\p{Zs}]$/u;

/** סימני פיסוק עבריים ומקבילותיהם, להשוואה הסובלנית */
const FOLD: Record<string, string> = {
  '\u05F4': '"', // גרשיים
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u05F3': "'", // גרש
  '\u2018': "'",
  '\u2019': "'",
  '\u05BE': '-', // מקף עברי
  '\u2010': '-',
  '\u2011': '-',
  '\u2013': '-',
  '\u2014': '-',
};

interface Cluster {
  /** מיקום במקור */
  start: number;
  end: number;
  /** הצורה המנורמלת (יכולה להיות ריקה) */
  norm: string;
}

/** אות + הסימנים הצמודים לה, או `\r\n` כיחידה אחת */
const CLUSTER = /\r\n|[^\p{M}][\p{M}]*|[\p{M}]+/gsu;

const clusters = (text: string, tolerant: boolean): Cluster[] => {
  const result: Cluster[] = [];
  for (const match of text.matchAll(CLUSTER)) {
    const raw = match[0];
    const start = match.index ?? 0;
    let norm: string;
    if (raw === '\r\n' || raw === '\r') norm = '\n';
    else if (INVISIBLE.test(raw)) norm = '';
    else norm = raw.normalize('NFC');
    if (tolerant) {
      if (HORIZONTAL_SPACE.test(norm)) norm = ' ';
      else norm = FOLD[norm] ?? norm;
    }
    result.push({ start, end: start + raw.length, norm });
  }
  if (!tolerant) return result;

  // רצף רווחים → רווח אחד, ובלי רווחים בקצות שורה
  const collapsed: Cluster[] = [];
  for (const cluster of result) {
    const previous = collapsed[collapsed.length - 1];
    if (cluster.norm === ' ' && previous && previous.norm === ' ') {
      previous.end = cluster.end;
      continue;
    }
    collapsed.push({ ...cluster });
  }
  return collapsed.map((cluster, index) => {
    if (cluster.norm !== ' ') return cluster;
    const before = collapsed[index - 1]?.norm;
    const after = collapsed[index + 1]?.norm;
    return before === '\n' || after === '\n' || before === undefined || after === undefined
      ? { ...cluster, norm: '' }
      : cluster;
  });
};

interface View {
  text: string;
  /** לכל תו בתצוגה: האינדקס של ה-cluster שלו */
  owner: number[];
  clusters: Cluster[];
}

const view = (text: string, tolerant: boolean): View => {
  const list = clusters(text, tolerant);
  let joined = '';
  const owner: number[] = [];
  list.forEach((cluster, index) => {
    joined += cluster.norm;
    for (let i = 0; i < cluster.norm.length; i++) owner.push(index);
  });
  return { text: joined, owner, clusters: list };
};

const normalizedNeedle = (needle: string, tolerant: boolean): string =>
  clusters(needle, tolerant)
    .map((cluster) => cluster.norm)
    .join('');

/** כל ההופעות, כטווחים במקור. רק כאלה שמתחילות ונגמרות על גבול cluster */
const occurrences = (haystack: string, needle: string, tolerant: boolean): Array<[number, number]> => {
  const target = normalizedNeedle(needle, tolerant);
  if (!target) return [];
  const { text, owner, clusters: list } = view(haystack, tolerant);
  const found: Array<[number, number]> = [];
  for (let at = text.indexOf(target); at !== -1; at = text.indexOf(target, at + 1)) {
    const last = at + target.length - 1;
    const first = owner[at];
    const final = owner[last];
    const startsOnBoundary = at === 0 || owner[at - 1] !== first;
    const endsOnBoundary = last === text.length - 1 || owner[last + 1] !== final;
    if (startsOnBoundary && endsOnBoundary) found.push([list[first].start, list[final].end]);
  }
  return found;
};

export type MatchResult =
  | { ok: true; start: number; end: number; tolerant: boolean }
  | { ok: false; count: number };

/**
 * המקום היחיד של `needle` ב-`haystack`. קודם התאמה מדויקת (אחרי הנרמול
 * הבסיסי), ורק אם אין - סובלנית. `count` בכישלון: כמה הופעות נמצאו (0, או
 * יותר מאחת), מהשלב האחרון שנוסה.
 */
export const findUnique = (haystack: string, needle: string): MatchResult => {
  const exact = occurrences(haystack, needle, false);
  if (exact.length === 1) return { ok: true, start: exact[0][0], end: exact[0][1], tolerant: false };
  if (exact.length > 1) return { ok: false, count: exact.length };

  const loose = occurrences(haystack, needle, true);
  if (loose.length === 1) return { ok: true, start: loose[0][0], end: loose[0][1], tolerant: true };
  return { ok: false, count: loose.length };
};

/** סוף השורה שהפתק משתמש בו, כדי שהטקסט החדש ייראה כמו השאר */
const lineEnding = (text: string): string => (/\r\n/.test(text) ? '\r\n' : '\n');

/** הטקסט החדש: NFC, וסופי שורה כמו בפתק */
export const prepareReplacement = (original: string, replacement: string): string =>
  replacement.normalize('NFC').replace(/\r\n|\r|\n/g, lineEnding(original));

export const replaceRange = (original: string, start: number, end: number, replacement: string): string =>
  `${original.slice(0, start)}${prepareReplacement(original, replacement)}${original.slice(end)}`;
