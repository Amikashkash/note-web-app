/**
 * פונקציות עזר לשיתוף תוכן
 */

import { Note } from '@/types/note';

/**
 * המרת תוכן הפתק לטקסט רגיל לצורך שיתוף
 */
export const formatNoteForSharing = (note: Note): string => {
  let text = `${note.title}\n`;
  text += `${'='.repeat(note.title.length)}\n\n`;

  // הוספת סוג הפתק
  const typeEmoji = {
    plain: '📝',
    checklist: '✅',
    recipe: '🍳',
    shopping: '🛒',
    idea: '💡',
    accounting: '💰',
  }[note.templateType] || '📝';

  text += `${typeEmoji} סוג: ${getTemplateLabel(note.templateType)}\n`;

  // תאריך עדכון
  const date = new Date(note.updatedAt.toDate()).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  text += `📅 תאריך: ${date}\n\n`;

  // תוכן
  text += `${note.content}\n`;

  // תגיות
  if (note.tags.length > 0) {
    text += `\n🏷️ תגיות: ${note.tags.map(tag => `#${tag}`).join(' ')}\n`;
  }

  return text;
};

/**
 * קבלת תווית של סוג תבנית
 */
const getTemplateLabel = (templateType: string): string => {
  const labels: Record<string, string> = {
    plain: 'פתק רגיל',
    checklist: 'רשימת משימות',
    recipe: 'מתכון',
    shopping: 'רשימת קניות',
    idea: 'רעיון',
    accounting: 'חשבונאות',
  };
  return labels[templateType] || 'פתק';
};

/**
 * שיתוף פתק בוואטסאפ
 */
export const shareViaWhatsApp = (note: Note): void => {
  const text = formatNoteForSharing(note);
  const encodedText = encodeURIComponent(text);

  // פתיחת WhatsApp Web או האפליקציה במובייל
  const url = `https://wa.me/?text=${encodedText}`;
  window.open(url, '_blank');
};

/**
 * שיתוף פתק באימייל
 */
export const shareViaEmail = (note: Note): void => {
  const text = formatNoteForSharing(note);
  const subject = encodeURIComponent(note.title);
  const body = encodeURIComponent(text);

  // פתיחת לקוח האימייל
  const url = `mailto:?subject=${subject}&body=${body}`;
  window.location.href = url;
};

/**
 * העתקת תוכן הפתק ללוח (clipboard)
 */
export const copyToClipboard = async (note: Note): Promise<boolean> => {
  try {
    const text = formatNoteForSharing(note);
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * שיתוף באמצעות Web Share API (אם נתמך)
 */
export const shareViaNative = async (note: Note): Promise<boolean> => {
  if (!navigator.share) {
    return false;
  }

  try {
    const text = formatNoteForSharing(note);
    await navigator.share({
      title: note.title,
      text: text,
    });
    return true;
  } catch (error) {
    // המשתמש ביטל את השיתוף או שהיתה שגיאה
    console.error('Share failed:', error);
    return false;
  }
};
