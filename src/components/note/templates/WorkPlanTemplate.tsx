/**
 * תבנית תכנית עבודה - סעיפים עם כותרות ותוכן
 * כל סעיף מכיל כותרת משנה וטקסט חופשי עם תמיכה במספור אוטומטי ועיצוב טקסט
 */

import React, { useEffect, useMemo } from 'react';
import { ChevronDown, ChevronLeft, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { EnhancedTextarea } from '@/components/common/EnhancedTextarea';
import { FormattedText } from '@/components/common/FormattedText';
import type { WorkPlanSection } from '@/types/template';

export type { WorkPlanSection };

interface WorkPlanTemplateProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export const WorkPlanTemplate: React.FC<WorkPlanTemplateProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  // המרת JSON ממחרוזת למערך.
  // בדיקת המערך אינה קוסמטית: תוכן שמתפרסר לערך שאינו מערך (מספר,
  // אובייקט) היה מגיע הלאה עם `length` לא מוגדר, וגם `map` וגם הזריעה
  // של הסעיף הראשון היו מתנהגים בצורה בלתי צפויה.
  const sections = useMemo<WorkPlanSection[]>(() => {
    try {
      const parsed = value ? JSON.parse(value) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [value]);

  /**
   * תכנית ריקה מקבלת סעיף ראשון אוטומטית.
   *
   * תכנית בלי סעיף אחד לפחות היא חסרת משמעות, ולכן הלחיצה על "הוסף
   * סעיף" רק כדי להתחיל הייתה מיותרת. בלי פוקוס בכוונה: בפתק חדש
   * הפוקוס שייך לשדה הכותרת, ובפתק קיים הוא היה מקפיץ מקלדת בנייד.
   */
  useEffect(() => {
    if (readOnly || sections.length > 0) return;

    onChange(JSON.stringify([{ id: Date.now().toString(), header: '', content: '' }]));
  }, [readOnly, sections.length, onChange]);

  const handleAddSection = () => {
    const newSection: WorkPlanSection = {
      id: Date.now().toString(),
      header: '',
      content: '',
    };
    const updatedSections = [...sections, newSection];
    onChange(JSON.stringify(updatedSections));
  };

  const handleUpdateSection = (id: string, field: 'header' | 'content', newValue: string) => {
    const updatedSections = sections.map((section) =>
      section.id === id ? { ...section, [field]: newValue } : section
    );
    onChange(JSON.stringify(updatedSections));
  };

  const handleDeleteSection = (id: string) => {
    const updatedSections = sections.filter((section) => section.id !== id);
    onChange(JSON.stringify(updatedSections));
  };

  const handleMoveSection = (id: string, direction: 'up' | 'down') => {
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    const updatedSections = [...sections];
    [updatedSections[index], updatedSections[newIndex]] = [updatedSections[newIndex], updatedSections[index]];
    onChange(JSON.stringify(updatedSections));
  };

  if (readOnly) {
    return (
      <div className="space-y-4">
        {sections.length === 0 ? (
          <p className="text-ink-3-light dark:text-ink-3-dark text-center py-8">אין סעיפים בתכנית</p>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="bg-surface-light dark:bg-surface-dark rounded-lg border border-hairline-light dark:border-hairline-dark p-4">
              <h4 className="text-lg font-bold text-ink-light dark:text-ink-dark mb-2 flex items-center gap-2">
                <ChevronLeft size={16} strokeWidth={2} className="text-brand-text dark:text-brand-text-dark flex-shrink-0" />
                {section.header || 'כותרת ריקה'}
              </h4>
              <div className="text-ink-light dark:text-ink-dark pr-6">
                <FormattedText content={section.content || 'אין תוכן'} />
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <div key={section.id} className="bg-raised-light dark:bg-raised-dark rounded-lg border border-hairline-light dark:border-hairline-dark p-3">
          {/* כפתורי סידור */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleMoveSection(section.id, 'up')}
                disabled={index === 0}
                className="h-9 w-9 grid place-items-center bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark rounded-lg text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark disabled:opacity-30 disabled:cursor-not-allowed"
                title="הזז למעלה"
              >
                <ChevronUp size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => handleMoveSection(section.id, 'down')}
                disabled={index === sections.length - 1}
                className="h-9 w-9 grid place-items-center bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark rounded-lg text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark disabled:opacity-30 disabled:cursor-not-allowed"
                title="הזז למטה"
              >
                <ChevronDown size={16} strokeWidth={2} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleDeleteSection(section.id)}
              className="inline-flex items-center gap-1 px-2 py-1 text-caption text-danger dark:text-danger-dark hover:bg-danger/10 rounded"
              title="מחק סעיף"
            >
              <Trash2 size={14} strokeWidth={1.75} />
              מחק
            </button>
          </div>

          {/* כותרת הסעיף */}
          <input
            type="text"
            value={section.header}
            onChange={(e) => handleUpdateSection(section.id, 'header', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddSection();
              }
            }}
            placeholder="הזן כותרת סעיף..."
            className="w-full px-3 py-2 mb-2 text-lg font-bold border border-hairline-light dark:border-hairline-dark dark:bg-surface-dark dark:text-ink-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            style={{ direction: 'rtl', textAlign: 'right' }}
          />

          {/* תוכן הסעיף - עם תמיכה במספור ועיצוב טקסט */}
          <EnhancedTextarea
            value={section.content}
            onChange={(content) => handleUpdateSection(section.id, 'content', content)}
            placeholder="הזן תוכן הסעיף... (1. למספור, * לנקודות)"
            rows={5}
            className="text-sm"
          />
        </div>
      ))}

      {/* כפתור הוספת סעיף */}
      <Button
        type="button"
        onClick={handleAddSection}
        variant="outline"
        size="sm"
        className="w-full"
      >
        + הוסף סעיף
      </Button>

      {sections.length === 0 && (
        <p className="text-ink-3-light dark:text-ink-3-dark text-center text-sm py-4">
          לחץ על "הוסף סעיף" כדי להתחיל לבנות את תכנית העבודה
        </p>
      )}
    </div>
  );
};
