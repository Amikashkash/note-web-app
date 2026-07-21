/**
 * אייקון התבנית של פתק
 *
 * עוטף את חילוץ הרכיב מ-`getTemplateMeta`, כי בתוך `map` על פתקים אי
 * אפשר לחלץ אותו למשתנה בלי לפרק את הביטוי. `templates.ts` הוא קובץ
 * `.ts` ולכן לא יכול להחזיק JSX בעצמו.
 */

import React from 'react';
import { getTemplateMeta } from '@/utils/templates';
import type { TemplateType } from '@/types/note';

interface TemplateIconProps {
  type: TemplateType | string;
  size?: number;
  className?: string;
}

export const TemplateIcon: React.FC<TemplateIconProps> = ({
  type,
  size = 20,
  className = '',
}) => {
  const { Icon, label } = getTemplateMeta(type);

  return <Icon size={size} strokeWidth={1.75} className={className} aria-label={label} />;
};
