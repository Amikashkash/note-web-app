/**
 * קומפוננטה להצגת טקסט עם עיצוב markdown פשוט
 * תומכת ב:
 * - **טקסט מודגש** -> <strong>
 * - *טקסט נטוי* -> <em>
 * - זיהוי אוטומטי של URLs והצגתם כ-preview cards
 * - שמירה על מספור ו-bullets
 */

import React from 'react';
import { LinkPreview } from '@/components/common/LinkPreview';
import { extractUrls } from '@/services/api/linkPreview';

interface FormattedTextProps {
  content: string;
  className?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ content, className = '' }) => {
  // Extract URLs from content for preview cards
  const urls = React.useMemo(() => extractUrls(content), [content]);

  /**
   * המרת markdown פשוט ל-HTML
   */
  const formatText = (text: string): React.ReactNode[] => {
    if (!text) return [];

    const lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      // עיבוד של **bold**, *italic*, ו-URLs בשורה
      const parts: React.ReactNode[] = [];
      let remainingText = line;
      let partKey = 0;

      // regex למציאת **bold**, *italic*, או URLs
      // נעבור על הטקסט ונמיר את הסימונים
      while (remainingText.length > 0) {
        // חיפוש URLs
        const urlMatch = remainingText.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch && urlMatch.index !== undefined) {
          // הוסף טקסט רגיל לפני ה-URL
          if (urlMatch.index > 0) {
            parts.push(
              <span key={`${lineIndex}-${partKey++}`}>
                {remainingText.substring(0, urlMatch.index)}
              </span>
            );
          }

          // הוסף את ה-URL כקישור לחיץ (לא preview - זה יופיע בנפרד)
          const url = urlMatch[1];
          parts.push(
            <a
              key={`${lineIndex}-${partKey++}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
              dir="ltr"
            >
              {url}
            </a>
          );

          // המשך עם שאר הטקסט
          remainingText = remainingText.substring(urlMatch.index + urlMatch[0].length);
          continue;
        }


        // חיפוש **bold**
        const boldMatch = remainingText.match(/\*\*(.+?)\*\*/);
        if (boldMatch && boldMatch.index !== undefined) {
          // הוסף טקסט רגיל לפני ה-bold
          if (boldMatch.index > 0) {
            parts.push(
              <span key={`${lineIndex}-${partKey++}`}>
                {remainingText.substring(0, boldMatch.index)}
              </span>
            );
          }

          // הוסף את ה-bold
          parts.push(
            <strong key={`${lineIndex}-${partKey++}`} className="font-bold">
              {boldMatch[1]}
            </strong>
          );

          // המשך עם שאר הטקסט
          remainingText = remainingText.substring(boldMatch.index + boldMatch[0].length);
          continue;
        }

        // חיפוש *italic* (רק אם לא מצאנו bold)
        const italicMatch = remainingText.match(/\*(.+?)\*/);
        if (italicMatch && italicMatch.index !== undefined) {
          // הוסף טקסט רגיל לפני ה-italic
          if (italicMatch.index > 0) {
            parts.push(
              <span key={`${lineIndex}-${partKey++}`}>
                {remainingText.substring(0, italicMatch.index)}
              </span>
            );
          }

          // הוסף את ה-italic
          parts.push(
            <em key={`${lineIndex}-${partKey++}`} className="italic">
              {italicMatch[1]}
            </em>
          );

          // המשך עם שאר הטקסט
          remainingText = remainingText.substring(italicMatch.index + italicMatch[0].length);
          continue;
        }

        // אם לא מצאנו עיצוב נוסף, הוסף את כל מה שנשאר
        if (remainingText.length > 0) {
          parts.push(<span key={`${lineIndex}-${partKey++}`}>{remainingText}</span>);
        }
        break;
      }

      // החזר את השורה עם <br> בסוף (חוץ מהשורה האחרונה)
      return (
        <React.Fragment key={lineIndex}>
          {parts.length > 0 ? parts : line || '\u00A0'}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className={className}>
      {/* Main formatted text */}
      <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-100" style={{ direction: 'rtl', textAlign: 'right' }}>
        {formatText(content)}
      </div>

      {/* Link previews at the bottom */}
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
