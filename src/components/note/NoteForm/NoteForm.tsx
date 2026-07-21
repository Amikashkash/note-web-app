/**
 * קומפוננטה לטופס יצירה/עריכה של פתק
 */

import { useState } from 'react';
import { Note, NoteFormData, TemplateType } from '@/types/note';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { EnhancedTextarea } from '@/components/common/EnhancedTextarea';
import { AVAILABLE_COLORS, LENGTH_LIMITS } from '@/utils/constants';
import { SELECTABLE_TEMPLATES, getTemplateLabel } from '@/utils/templates';
import { AccountingTemplate } from '@/components/note/templates/AccountingTemplate';
import { ChecklistTemplate } from '@/components/note/templates/ChecklistTemplate';
import { RecipeTemplate } from '@/components/note/templates/RecipeTemplate';
import { ShoppingTemplate } from '@/components/note/templates/ShoppingTemplate';
import { WorkPlanTemplate } from '@/components/note/templates/WorkPlanTemplate';

interface NoteFormProps {
  categoryId: string;
  note?: Note | null;
  onClose: () => void;
  onSubmit: (data: NoteFormData) => void;
}

export const NoteForm: React.FC<NoteFormProps> = ({
  note,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [templateType, setTemplateType] = useState<TemplateType>(
    note?.templateType || 'plain'
  );
  const [tagsInput, setTagsInput] = useState(note?.tags.join(', ') || '');
  const [selectedColor, setSelectedColor] = useState<string | null>(
    note?.color || null
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isEditMode = !!note;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setValidationError('נא להזין כותרת לפתק');
      return;
    }

    setValidationError(null);

    // המרת תגיות ממחרוזת למערך
    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onSubmit({
      title: title.trim(),
      content: content.trim(),
      templateType,
      tags,
      color: selectedColor,
    });

    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-ink-light dark:text-ink-dark mb-4">
          {isEditMode ? 'עריכת פתק' : 'פתק חדש'}
        </h2>

        {/* כותרת */}
        <div>
          <label className="block text-sm font-medium text-ink-light dark:text-ink-dark mb-1">
            כותרת * <span className="text-xs text-ink-3-light dark:text-ink-3-dark">({title.length}/{LENGTH_LIMITS.NOTE_TITLE})</span>
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, LENGTH_LIMITS.NOTE_TITLE))}
            placeholder="הזן כותרת..."
            maxLength={LENGTH_LIMITS.NOTE_TITLE}
            required
            // רק בפתק חדש: הכותרת היא השדה הראשון שממלאים, ובלי פוקוס
            // קל לדלג עליה ולגלות את זה רק כשהשמירה נחסמת. בעריכת פתק
            // קיים כבר יש כותרת, ופוקוס אוטומטי רק היה מקפיץ מקלדת.
            autoFocus={!isEditMode}
          />
        </div>

        {/* בחירת תבנית */}
        <div>
          <label className="block text-sm font-medium text-ink-light dark:text-ink-dark mb-2">
            סוג פתק
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SELECTABLE_TEMPLATES.map((template) => (
              <button
                key={template.value}
                type="button"
                onClick={() => setTemplateType(template.value)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  templateType === template.value
                    ? 'border-brand bg-brand-soft dark:bg-brand-soft-dark dark:border-brand-dark'
                    : 'border-hairline-light dark:border-hairline-dark hover:border-ink-3-light dark:hover:border-ink-3-dark'
                }`}
              >
                <template.Icon
                  size={24}
                  strokeWidth={1.75}
                  className="mx-auto mb-1 text-ink-2-light dark:text-ink-2-dark"
                />
                <div className="text-caption text-ink-2-light dark:text-ink-2-dark">
                  {template.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* תוכן */}
        <div>
          <label className="block text-sm font-medium text-ink-light dark:text-ink-dark mb-1">
            תוכן
          </label>
          {templateType === 'accounting' ? (
            <AccountingTemplate value={content} onChange={setContent} />
          ) : templateType === 'checklist' ? (
            <ChecklistTemplate value={content} onChange={setContent} />
          ) : templateType === 'recipe' ? (
            <RecipeTemplate value={content} onChange={setContent} />
          ) : templateType === 'shopping' ? (
            <ShoppingTemplate value={content} onChange={setContent} />
          ) : templateType === 'workplan' ? (
            <WorkPlanTemplate value={content} onChange={setContent} />
          ) : (
            <EnhancedTextarea
              value={content}
              onChange={setContent}
              placeholder={`הזן ${getTemplateLabel(templateType)}...`}
              rows={8}
            />
          )}
        </div>

        {/* אפשרויות מתקדמות - מתקפל */}
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-ink-2-light dark:text-ink-2-dark hover:text-ink-light dark:text-ink-dark dark:hover:text-ink-dark transition-colors"
          >
            <span>{showAdvanced ? '▼' : '◀'}</span>
            <span>אפשרויות נוספות (תגיות וצבע)</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* תגיות */}
              <div>
                <label className="block text-sm font-medium text-ink-light dark:text-ink-dark mb-1">
                  תגיות (מופרדות בפסיקים)
                </label>
                <Input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="עבודה, חשוב, אישי..."
                />
              </div>

              {/* בחירת צבע */}
              <div>
                <label className="block text-sm font-medium text-ink-light dark:text-ink-dark mb-2">
                  צבע פתק (אופציונלי)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {/* אפשרות ללא צבע */}
                  <button
                    type="button"
                    onClick={() => setSelectedColor(null)}
                    className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center ${
                      selectedColor === null
                        ? 'border-ink-light dark:border-ink-dark'
                        : 'border-hairline-light dark:border-hairline-dark hover:border-ink-3-light dark:hover:border-ink-3-dark'
                    }`}
                    title="ללא צבע"
                  >
                    ✕
                  </button>

                  {/* אפשרויות צבע */}
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-lg border-2 ${
                        selectedColor === color
                          ? 'border-ink-light dark:border-ink-dark scale-110'
                          : 'border-transparent hover:scale-105'
                      } transition-transform`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* שגיאת ולידציה */}
        {validationError && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
            <p className="text-sm font-medium text-danger dark:text-danger-dark flex items-center gap-2">
              <span>⚠️</span>
              <span>{validationError}</span>
            </p>
          </div>
        )}

        {/* כפתורי פעולה */}
        <div className="flex gap-3 pt-4">
          <Button type="submit" className="flex-1">
            {isEditMode ? 'עדכן פתק' : 'שמור פתק'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
};
