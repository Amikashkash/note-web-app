/**
 * הצגת טקסט עם עיצוב markdown פשוט
 *
 * תומך ב:
 * - **מודגש**
 * - *נטוי*
 * - זיהוי אוטומטי של קישורים (כקישור בשורה + כרטיס תצוגה מקדימה בתחתית)
 */

import React, { useMemo } from 'react';
import { LinkPreview } from '@/components/common/LinkPreview';
import { extractUrls } from '@/services/api/linkPreview';

interface FormattedTextProps {
  content: string;
  className?: string;
}

type TokenType = 'text' | 'url' | 'bold' | 'italic';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * הדפוסים הנתמכים, לפי סדר עדיפות בין התאמות שמתחילות באותו מקום.
 * bold חייב להופיע לפני italic - אחרת טקסט מודגש היה נתפס כנטוי.
 */
const PATTERNS: { type: Exclude<TokenType, 'text'>; regex: RegExp }[] = [
  { type: 'url', regex: /https?:\/\/[^\s]+/ },
  { type: 'bold', regex: /\*\*(.+?)\*\*/ },
  { type: 'italic', regex: /\*(.+?)\*/ },
];

/**
 * פירוק שורה לאסימונים.
 *
 * בכל צעד נבחרת ההתאמה שמתחילה הכי מוקדם בשורה - ולא הדפוס הראשון
 * שמצליח. זה מה שמאפשר לשלב טקסט מודגש וקישור באותה שורה: בגרסה קודמת
 * הקישור נבדק תמיד ראשון, וכל מה שקדם לו נפלט כטקסט גולמי עם הכוכביות
 * גלויות למשתמש.
 */
const tokenizeLine = (line: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    let earliest:
      | { type: Exclude<TokenType, 'text'>; index: number; match: RegExpMatchArray }
      | null = null;

    for (const { type, regex } of PATTERNS) {
      const match = remaining.match(regex);
      if (match?.index === undefined) continue;

      if (earliest === null || match.index < earliest.index) {
        earliest = { type, index: match.index, match };
      }
    }

    if (!earliest) {
      tokens.push({ type: 'text', value: remaining });
      break;
    }

    if (earliest.index > 0) {
      tokens.push({ type: 'text', value: remaining.slice(0, earliest.index) });
    }

    // לקישור לוקחים את ההתאמה המלאה; לעיצוב לוקחים את התוכן שבתוך הסימונים
    tokens.push({
      type: earliest.type,
      value: earliest.type === 'url' ? earliest.match[0] : earliest.match[1],
    });

    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }

  return tokens;
};

const renderToken = (token: Token, key: string): React.ReactNode => {
  switch (token.type) {
    case 'url':
      return (
        <a
          key={key}
          href={token.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
          dir="ltr"
        >
          {token.value}
        </a>
      );
    case 'bold':
      return (
        <strong key={key} className="font-bold">
          {token.value}
        </strong>
      );
    case 'italic':
      return (
        <em key={key} className="italic">
          {token.value}
        </em>
      );
    default:
      return <span key={key}>{token.value}</span>;
  }
};

/** רווח קשיח - שומר על גובה שורה ריקה */
const NBSP = ' ';

export const FormattedText: React.FC<FormattedTextProps> = ({ content, className = '' }) => {
  const urls = useMemo(() => extractUrls(content), [content]);
  const lines = useMemo(() => content.split('\n').map(tokenizeLine), [content]);

  return (
    <div className={className}>
      <div
        className="whitespace-pre-wrap text-gray-800 dark:text-gray-100"
        style={{ direction: 'rtl', textAlign: 'right' }}
      >
        {lines.map((tokens, lineIndex) => (
          <React.Fragment key={lineIndex}>
            {tokens.length > 0
              ? tokens.map((token, tokenIndex) =>
                  renderToken(token, `${lineIndex}-${tokenIndex}`)
                )
              : NBSP}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>

      {urls.length > 0 && (
        <div className="mt-4 space-y-3">
          {urls.map((url, index) => (
            <LinkPreview key={`${url}-${index}`} url={url} />
          ))}
        </div>
      )}
    </div>
  );
};
