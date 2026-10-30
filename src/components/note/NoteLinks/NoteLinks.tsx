/**
 * קישורים מתוך טקסט שנערך (בלי מצב עריכה, v1.38.0): שדה טקסט לא מציג
 * קישור לחיץ, אז הם מוצגים מתחתיו - כרטיס לכל קישור, כמו ב-`FormattedText`.
 */

import { LinkPreview } from '@/components/common/LinkPreview';
import { extractUrls } from '@/services/api/linkPreview';

export const NoteLinks: React.FC<{ text: string }> = ({ text }) => {
  const urls = extractUrls(text);
  if (urls.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {urls.map((url, index) => (
        <LinkPreview key={`${url}-${index}`} url={url} />
      ))}
    </div>
  );
};
