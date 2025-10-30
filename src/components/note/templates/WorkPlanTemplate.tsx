/**
 * תבנית תכנית עבודה - סעיפים עם כותרות ותוכן
 * כל סעיף מכיל כותרת משנה וטקסט חופשי
 */

import React, { useMemo } from 'react';
import { Button } from '@/components/common/Button';

export interface WorkPlanSection {
  id: string;
  header: string;
  content: string;
}

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
  // המרת JSON ממחרוזת למערך
  const sections = useMemo<WorkPlanSection[]>(() => {
    try {
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }, [value]);

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
          <p className="text-gray-500 text-center py-8">אין סעיפים בתכנית</p>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span className="text-blue-600">▸</span>
                {section.header || 'כותרת ריקה'}
              </h4>
              <div className="text-gray-700 whitespace-pre-wrap pr-6">
                {section.content || 'אין תוכן'}
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
        <div key={section.id} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          {/* כפתורי סידור */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleMoveSection(section.id, 'up')}
                disabled={index === 0}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="הזז למעלה"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => handleMoveSection(section.id, 'down')}
                disabled={index === sections.length - 1}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="הזז למטה"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleDeleteSection(section.id)}
              className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
              title="מחק סעיף"
            >
              🗑 מחק
            </button>
          </div>

          {/* כותרת הסעיף */}
          <input
            type="text"
            value={section.header}
            onChange={(e) => handleUpdateSection(section.id, 'header', e.target.value)}
            placeholder="הזן כותרת סעיף..."
            className="w-full px-3 py-2 mb-2 text-lg font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ direction: 'rtl', textAlign: 'right' }}
          />

          {/* תוכן הסעיף */}
          <textarea
            value={section.content}
            onChange={(e) => handleUpdateSection(section.id, 'content', e.target.value)}
            placeholder="הזן תוכן הסעיף..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            style={{ direction: 'rtl', textAlign: 'right' }}
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
        <p className="text-gray-500 text-center text-sm py-4">
          לחץ על "הוסף סעיף" כדי להתחיל לבנות את תכנית העבודה
        </p>
      )}
    </div>
  );
};
