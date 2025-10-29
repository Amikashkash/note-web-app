/**
 * תבנית מתכון - Recipe
 */

import React, { useMemo } from 'react';

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
    try {
      return value
        ? JSON.parse(value)
        : {
            servings: '',
            prepTime: '',
            cookTime: '',
            ingredients: [''],
            instructions: [''],
          };
    } catch {
      return {
        servings: '',
        prepTime: '',
        cookTime: '',
        ingredients: [''],
        instructions: [''],
      };
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
          <label className="block text-xs font-medium text-gray-600 mb-1">מנות</label>
          {readOnly ? (
            <div className="text-sm text-gray-700">{data.servings || '-'}</div>
          ) : (
            <input
              type="text"
              value={data.servings}
              onChange={(e) => updateData({ servings: e.target.value })}
              placeholder="4 מנות"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">זמן הכנה</label>
          {readOnly ? (
            <div className="text-sm text-gray-700">{data.prepTime || '-'}</div>
          ) : (
            <input
              type="text"
              value={data.prepTime}
              onChange={(e) => updateData({ prepTime: e.target.value })}
              placeholder="15 דקות"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">זמן בישול</label>
          {readOnly ? (
            <div className="text-sm text-gray-700">{data.cookTime || '-'}</div>
          ) : (
            <input
              type="text"
              value={data.cookTime}
              onChange={(e) => updateData({ cookTime: e.target.value })}
              placeholder="30 דקות"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          )}
        </div>
      </div>

      {/* מרכיבים */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">🥕 מרכיבים:</h4>
        <div className="space-y-2">
          {data.ingredients.map((ingredient, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-gray-500">•</span>
              {readOnly ? (
                <span className="flex-1 text-sm text-gray-700">{ingredient || '-'}</span>
              ) : (
                <>
                  <input
                    type="text"
                    value={ingredient}
                    onChange={(e) => updateIngredient(index, e.target.value)}
                    placeholder="מרכיב..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  {data.ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
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
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            + הוסף מרכיב
          </button>
        )}
      </div>

      {/* הוראות הכנה */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">👨‍🍳 הוראות הכנה:</h4>
        <div className="space-y-2">
          {data.instructions.map((instruction, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-gray-500 font-medium text-sm">{index + 1}.</span>
              {readOnly ? (
                <span className="flex-1 text-sm text-gray-700">{instruction || '-'}</span>
              ) : (
                <>
                  <textarea
                    value={instruction}
                    onChange={(e) => updateInstruction(index, e.target.value)}
                    placeholder="הוראת הכנה..."
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                  {data.instructions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInstruction(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
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
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            + הוסף שלב
          </button>
        )}
      </div>
    </div>
  );
};
