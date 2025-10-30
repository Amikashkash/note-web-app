/**
 * קומפוננטה להצגת טקסט עם עיצוב markdown פשוט
 * תומכת ב:
 * - **טקסט מודגש** -> <strong>
 * - *טקסט נטוי* -> <em>
 * - שמירה על מספור ו-bullets
 */

import React from 'react';

interface FormattedTextProps {
  content: string;
  className?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ content, className = '' }) => {
  /**
   * המרת markdown פשוט ל-HTML
   */
  const formatText = (text: string): React.ReactNode[] => {
    if (!text) return [];

    const lines = text.split('\n');
    return lines.map((line, lineIndex) => {
      // עיבוד של **bold** ו-*italic* בשורה
      const parts: React.ReactNode[] = [];
      let remainingText = line;
      let partKey = 0;

      // regex למציאת **bold** או *italic*
      // נעבור על הטקסט ונמיר את הסימונים
      while (remainingText.length > 0) {
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
    <div className={`whitespace-pre-wrap ${className}`} style={{ direction: 'rtl', textAlign: 'right' }}>
      {formatText(content)}
    </div>
  );
};
