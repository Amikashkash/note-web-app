/**
 * פונקציות עזר כלליות
 */

import { Timestamp } from 'firebase/firestore';

/**
 * יוצר מזהה ייחודי
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * ממיר Timestamp של Firebase (או תאריך רגיל) לטקסט קריא
 */
export const formatDate = (timestamp: Timestamp | Date | string | number | null): string => {
  if (!timestamp) return '';

  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * קיצור טקסט
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * בדיקה האם מחרוזת היא URL תקין
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * השהיה (לטעינות ואנימציות)
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
