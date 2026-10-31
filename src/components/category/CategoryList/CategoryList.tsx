/**
 * הקטגוריות במסך הבית: אקורדיון (סבב 3, v1.40.0).
 *
 * - קטגוריה אחת פתוחה בכל פעם, והאחרונה שנפתחה נזכרת במכשיר (`utils/homeAccordion.ts`).
 * - הסדר אישי, נשמר אצל המשתמש ולא על הקטגוריה (`useCategoryOrder`), ומשתנה בגרירה.
 * - "+" אחד: פתק חדש בקטגוריה הפתוחה, ואם אין - שואל באיזו.
 * - בזמן חיפוש: רק קטגוריות עם תוצאות, כולן פתוחות, ובלי גרירה.
 *
 * ארבעה מצבים נפרדים (ST-1): טוען, שגיאה, ריק, ורשימה. קודם שגיאה
 * בטעינה הוצגה כ"עדיין אין קטגוריות" - המשתמש ראה את כל הנתונים שלו
 * כאילו נמחקו, ועוד קיבל כפתור ליצור קטגוריה ראשונה.
 */

import React, { useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Plus } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useCategoryOrder } from '@/hooks/useCategoryOrder';
import { useNotes } from '@/hooks/useNotes';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { useAuthStore } from '@/store/authStore';
import { LoadError } from '@/components/common/LoadError';
import { Modal } from '@/components/common/Modal';
import { NoteForm } from '@/components/note/NoteForm';
import { readOpenCategory, toggleOpen, writeOpenCategory } from '@/utils/homeAccordion';
import { CategoryItem } from '../CategoryItem/CategoryItem';

interface CategoryListProps {
  onCreateFirstCategory?: () => void;
  searchQuery?: string;
}

/** הודעות לקורא מסך, בעברית (ברירת המחדל של הספרייה באנגלית) */
const DRAG_ACCESSIBILITY = {
  screenReaderInstructions: {
    draggable:
      'כדי לשנות את סדר הקטגוריות: רווח כדי להרים, חיצים כדי להזיז, רווח כדי להניח, Escape כדי לבטל. Enter פותח או סוגר.',
  },
  announcements: {
    onDragStart: () => 'הקטגוריה הורמה',
    onDragOver: () => 'הקטגוריה הוזזה',
    onDragEnd: () => 'הקטגוריה הונחה',
    onDragCancel: () => 'ההזזה בוטלה',
  },
};

/**
 * אחרי גרירה בעכבר הדפדפן שולח גם click לשורה שנגררה. הלחיצה הזו לא
 * אמורה לפתוח או לסגור אותה, ולכן לחיצות מתעלמות עד זמן קצר אחרי הגרירה.
 */
const CLICK_AFTER_DRAG_MS = 300;

export const CategoryList: React.FC<CategoryListProps> = ({ onCreateFirstCategory, searchQuery = '' }) => {
  const userId = useAuthStore((state) => state.user?.uid);
  const { categories, hasLoaded, loadError, retry } = useCategories();
  const { loadError: notesLoadError, retry: retryNotes } = useNotes();
  const { ordered, orderLoaded, reorder } = useCategoryOrder(categories);

  const [storedOpenId, setStoredOpenId] = useState<string | null>(() =>
    userId ? readOpenCategory(userId) : null
  );
  const [pickingCategory, setPickingCategory] = useState(false);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const ignoreClicks = useRef(false);

  const sensors = useSensors(
    // עכבר: מרחק קטן לפני שהגרירה מתחילה - לחיצה רגילה פותחת את הקטגוריה
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // מגע: לחיצה ארוכה, כמו במשימות (v1.39.0). גלילה אף פעם לא מזיזה קטגוריה
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // מקלדת: רק רווח מרים. Enter נשאר לפתיחה וסגירה
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  const hasSearch = searchQuery.trim().length > 0;
  // קטגוריה שנזכרה ונמחקה מאז (או שהמשתמש יצא משיתופה) - אף אחת לא פתוחה
  const openId = ordered.some((category) => category.id === storedOpenId) ? storedOpenId : null;

  const setOpen = (categoryId: string | null) => {
    setStoredOpenId(categoryId);
    if (userId) writeOpenCategory(userId, categoryId);
  };

  const handleToggle = (categoryId: string) => {
    if (ignoreClicks.current) return;
    setOpen(toggleOpen(openId, categoryId));
  };

  const endDrag = () => {
    window.setTimeout(() => {
      ignoreClicks.current = false;
    }, CLICK_AFTER_DRAG_MS);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    endDrag();
    if (over && active.id !== over.id) {
      reorder(String(active.id), String(over.id));
    }
  };

  /** ה-"+" היחיד: בקטגוריה הפתוחה, ואם אין אחת כזו (או בחיפוש) - שואל */
  const handleNewNote = () => {
    if (!hasSearch && openId) setCreatingIn(openId);
    else setPickingCategory(true);
  };

  const pickCategory = (categoryId: string) => {
    setPickingCategory(false);
    // הקטגוריה נפתחת, כדי שהפתק החדש ייראה כשהטופס נסגר
    setOpen(categoryId);
    setCreatingIn(categoryId);
  };

  if (!hasLoaded || !orderLoaded) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // שגיאה ואין מה להציג: השגיאה במקום הרשימה, בלי "צור קטגוריה ראשונה"
  if (loadError && categories.length === 0) {
    return <LoadError message={loadError} onRetry={retry} />;
  }

  // שגיאה בפתקים: הקטגוריות מוצגות, אבל ריקות מפתקים - צריך לומר למה
  const notesBanner = notesLoadError && <LoadError message={notesLoadError} onRetry={retryNotes} compact />;

  if (categories.length === 0) {
    return (
      <>
        {notesBanner}
        <div className="text-center p-4 sm:p-8 text-ink-3-light dark:text-ink-3-dark">
          <p className="mb-4 text-body">עדיין אין קטגוריות</p>
          <button
            onClick={onCreateFirstCategory}
            className="px-4 py-2 text-body bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            צור קטגוריה ראשונה
          </button>
        </div>
      </>
    );
  }

  const dragDisabled = hasSearch || ordered.length < 2;
  const creatingCategory = ordered.find((category) => category.id === creatingIn);
  const openCategory = ordered.find((category) => category.id === openId);

  return (
    <>
      <div className="space-y-2 sm:space-y-3">
        {/* חלק מהקטגוריות נטענו (למשל רק המשותפות נכשלו) */}
        {loadError && <LoadError message={loadError} onRetry={retry} compact />}
        {notesBanner}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={() => {
            ignoreClicks.current = true;
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={endDrag}
          accessibility={DRAG_ACCESSIBILITY}
        >
          <SortableContext items={ordered.map((category) => category.id)} strategy={verticalListSortingStrategy}>
            {ordered.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                searchQuery={searchQuery}
                isOpen={category.id === openId}
                onToggle={() => handleToggle(category.id)}
                dragDisabled={dragDisabled}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* ה-"+" היחיד במסך. בצד שבו השורה נגמרת (שמאל ב-RTL), מעל אזור הבית של iOS */}
      <button
        type="button"
        onClick={handleNewNote}
        className="fixed z-40 end-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] h-14 w-14 grid place-items-center rounded-2xl bg-brand dark:bg-brand-dark text-white shadow-e3 hover:bg-brand-2 dark:hover:bg-brand-2-dark active:scale-95 transition"
        aria-label={!hasSearch && openCategory ? `פתק חדש ב${openCategory.name}` : 'פתק חדש'}
        title={!hasSearch && openCategory ? `פתק חדש ב${openCategory.name}` : 'פתק חדש'}
      >
        <Plus size={28} strokeWidth={2.25} />
      </button>

      {pickingCategory && (
        <Modal onClose={() => setPickingCategory(false)} title="פתק חדש - באיזו קטגוריה?">
          <ul className="space-y-2 sm:min-w-[24rem]">
            {ordered.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => pickCategory(category.id)}
                  className="w-full flex items-center gap-3 min-h-12 px-4 py-2 rounded-xl text-start bg-raised-light dark:bg-raised-dark hover:bg-hairline-light dark:hover:bg-hairline-dark border-s-4 transition-colors"
                  style={{ borderInlineStartColor: category.color }}
                >
                  {category.icon && (
                    <span className="text-xl leading-none" aria-hidden="true">
                      {category.icon}
                    </span>
                  )}
                  <span className="text-body font-semibold text-ink-light dark:text-ink-dark truncate">
                    {category.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {creatingCategory && (
        <NewNoteForm categoryId={creatingCategory.id} onClose={() => setCreatingIn(null)} />
      )}
    </>
  );
};

/** טופס פתק חדש בקטגוריה. קומפוננטה נפרדת כי `useNoteEditor` קשור לקטגוריה אחת */
const NewNoteForm: React.FC<{ categoryId: string; onClose: () => void }> = ({ categoryId, onClose }) => {
  const { saveNote } = useNoteEditor(categoryId);
  return (
    <NoteForm
      categoryId={categoryId}
      note={null}
      onClose={onClose}
      onSubmit={async (data) => {
        if (await saveNote(data, null)) onClose();
      }}
    />
  );
};
