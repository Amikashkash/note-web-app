/**
 * קומפוננטה לטופס יצירה/עריכה של פתק
 */

import { useState, useEffect } from 'react';
import { Note, TemplateType } from '@/types/note';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { AVAILABLE_COLORS } from '@/utils/constants';

interface NoteFormProps {
  categoryId: string;
  note?: Note | null;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    content: string;
    templateType: TemplateType;
    tags: string[];
    color: string | null;
  }) => void;
}

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; icon: string }[] = [
  { value: 'plain', label: 'טקסט חופשי', icon: '📝' },
  { value: 'checklist', label: 'רשימת משימות', icon: '✅' },
  { value: 'recipe', label: 'מתכון', icon: '🍳' },
  { value: 'shopping', label: 'רשימת קניות', icon: '🛒' },
  { value: 'idea', label: 'רעיון מהיר', icon: '💡' },
];

export const NoteForm: React.FC<NoteFormProps> = ({
  categoryId,
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

  const isEditMode = !!note;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('נא להזין כותרת לפתק');
      return;
    }

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
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {isEditMode ? 'עריכת פתק' : 'פתק חדש'}
        </h2>

        {/* כותרת */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            כותרת *
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="הזן כותרת..."
            required
          />
        </div>

        {/* בחירת תבנית */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            סוג פתק
          </label>
          <div className="grid grid-cols-5 gap-2">
            {TEMPLATE_OPTIONS.map((template) => (
              <button
                key={template.value}
                type="button"
                onClick={() => setTemplateType(template.value)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  templateType === template.value
                    ? 'border-primary bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{template.icon}</div>
                <div className="text-xs">{template.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* תוכן */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            תוכן
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`הזן ${TEMPLATE_OPTIONS.find(t => t.value === templateType)?.label.toLowerCase()}...`}
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {/* תגיות */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            צבע פתק (אופציונלי)
          </label>
          <div className="flex gap-2">
            {/* אפשרות ללא צבע */}
            <button
              type="button"
              onClick={() => setSelectedColor(null)}
              className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center ${
                selectedColor === null
                  ? 'border-gray-800'
                  : 'border-gray-300 hover:border-gray-400'
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
                    ? 'border-gray-800 scale-110'
                    : 'border-transparent hover:scale-105'
                } transition-transform`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

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
