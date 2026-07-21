/**
 * תבנית מתכון - Recipe
 */

import React, { useMemo } from 'react';
import { X } from 'lucide-react';

export interface RecipeData {
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: string[];
  instructions: string[];
}

interface RecipeTemplateProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export const RecipeTemplate: React.FC<RecipeTemplateProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const data = useMemo<RecipeData>(() => {
    const defaultData: RecipeData = {
      servings: '',
      prepTime: '',
      cookTime: '',
      ingredients: [''],
      instructions: [''],
    };

    if (!value) {
      return defaultData;
    }

    try {
      const parsed = JSON.parse(value);

      // Validate and normalize the structure
      return {
        servings: parsed.servings || '',
        prepTime: parsed.prepTime || '',
        cookTime: parsed.cookTime || '',
        ingredients: Array.isArray(parsed.ingredients) && parsed.ingredients.length > 0
          ? parsed.ingredients
          : [''],
        instructions: Array.isArray(parsed.instructions) && parsed.instructions.length > 0
          ? parsed.instructions
          : Array.isArray(parsed.steps) && parsed.steps.length > 0
            ? parsed.steps // Support AI format with 'steps' instead of 'instructions'
            : [''],
      };
    } catch {
      return defaultData;
    }
  }, [value]);

  const updateData = (updates: Partial<RecipeData>) => {
    onChange(JSON.stringify({ ...data, ...updates }));
  };

  const addIngredient = () => {
    updateData({ ingredients: [...data.ingredients, ''] });
  };

  const updateIngredient = (index: number, text: string) => {
    const newIngredients = [...data.ingredients];
    newIngredients[index] = text;
    updateData({ ingredients: newIngredients });
  };

  const removeIngredient = (index: number) => {
    updateData({ ingredients: data.ingredients.filter((_, i) => i !== index) });
  };

  const addInstruction = () => {
    updateData({ instructions: [...data.instructions, ''] });
  };

  const updateInstruction = (index: number, text: string) => {
    const newInstructions = [...data.instructions];
    newInstructions[index] = text;
    updateData({ instructions: newInstructions });
  };

  const removeInstruction = (index: number) => {
    updateData({ instructions: data.instructions.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      {/* פרטי מתכון */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-2-light dark:text-ink-2-dark mb-1">מנות</label>
          {readOnly ? (
            <div className="text-sm text-ink-light dark:text-ink-dark">{data.servings || '-'}</div>
          ) : (
            <input
              type="text"
              value={data.servings}
              onChange={(e) => updateData({ servings: e.target.value })}
              placeholder="4 מנות"
              className="w-full px-3 py-2 text-sm border border-hairline-light dark:border-hairline-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-2-light dark:text-ink-2-dark mb-1">זמן הכנה</label>
          {readOnly ? (
            <div className="text-sm text-ink-light dark:text-ink-dark">{data.prepTime || '-'}</div>
          ) : (
            <input
              type="text"
              value={data.prepTime}
              onChange={(e) => updateData({ prepTime: e.target.value })}
              placeholder="15 דקות"
              className="w-full px-3 py-2 text-sm border border-hairline-light dark:border-hairline-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-2-light dark:text-ink-2-dark mb-1">זמן בישול</label>
          {readOnly ? (
            <div className="text-sm text-ink-light dark:text-ink-dark">{data.cookTime || '-'}</div>
          ) : (
            <input
              type="text"
              value={data.cookTime}
              onChange={(e) => updateData({ cookTime: e.target.value })}
              placeholder="30 דקות"
              className="w-full px-3 py-2 text-sm border border-hairline-light dark:border-hairline-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          )}
        </div>
      </div>

      {/* מרכיבים */}
      <div>
        <h4 className="text-sm font-semibold text-ink-light dark:text-ink-dark mb-2">🥕 מרכיבים:</h4>
        <div className="space-y-2">
          {data.ingredients.map((ingredient, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-ink-3-light dark:text-ink-3-dark">•</span>
              {readOnly ? (
                <span className="flex-1 text-sm text-ink-light dark:text-ink-dark">{ingredient || '-'}</span>
              ) : (
                <>
                  <input
                    type="text"
                    value={ingredient}
                    onChange={(e) => updateIngredient(index, e.target.value)}
                    placeholder="מרכיב..."
                    className="flex-1 px-3 py-2 text-sm border border-hairline-light dark:border-hairline-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  {data.ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="text-danger dark:text-danger-dark hover:opacity-80"
                    >
                      <X size={16} strokeWidth={2} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 text-sm text-brand-text hover:text-brand-2"
          >
            + הוסף מרכיב
          </button>
        )}
      </div>

      {/* הוראות הכנה */}
      <div>
        <h4 className="text-sm font-semibold text-ink-light dark:text-ink-dark mb-2">👨‍🍳 הוראות הכנה:</h4>
        <div className="space-y-2">
          {data.instructions.map((instruction, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-ink-3-light dark:text-ink-3-dark font-medium text-sm">{index + 1}.</span>
              {readOnly ? (
                <span className="flex-1 text-sm text-ink-light dark:text-ink-dark">{instruction || '-'}</span>
              ) : (
                <>
                  <textarea
                    value={instruction}
                    onChange={(e) => updateInstruction(index, e.target.value)}
                    placeholder="הוראת הכנה..."
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-hairline-light dark:border-hairline-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40 resize-none"
                  />
                  {data.instructions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInstruction(index)}
                      className="text-danger dark:text-danger-dark hover:opacity-80"
                    >
                      <X size={16} strokeWidth={2} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addInstruction}
            className="mt-2 text-sm text-brand-text hover:text-brand-2"
          >
            + הוסף שלב
          </button>
        )}
      </div>
    </div>
  );
};
