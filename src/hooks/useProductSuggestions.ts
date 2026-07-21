/**
 * Hook להשלמה אוטומטית של מוצרים ברשימת קניות
 *
 * המוצרים נטענים פעם אחת כשהתבנית עולה, ומשם הדירוג מקומי - כל הקלדה
 * לא פונה לרשת. הרשימה קטנה מספיק כדי שזה ישתלם, וזה גם מה שמאפשר
 * להצעות להופיע מיד בלי המתנה.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  fetchRememberedProducts,
  rankSuggestions,
  recordProductUse,
  type RememberedProduct,
} from '@/services/api/products';

interface ProductSuggestions {
  /** ההצעות המדורגות למה שהוקלד */
  suggestions: RememberedProduct[];
  /** רישום מוצר שנוסף לרשימה, כדי שיוצע בפעם הבאה */
  remember: (name: string) => void;
}

export const useProductSuggestions = (
  query: string,
  /** שמות שכבר ברשימה - אין טעם להציע אותם שוב */
  exclude: string[]
): ProductSuggestions => {
  const userId = useAuthStore((state) => state.user?.uid);
  const [products, setProducts] = useState<RememberedProduct[]>([]);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    void fetchRememberedProducts(userId).then((loaded) => {
      // הקומפוננטה עשויה להיסגר לפני שהטעינה חוזרת
      if (active) setProducts(loaded);
    });

    return () => {
      active = false;
    };
  }, [userId]);

  const suggestions = useMemo(
    () => rankSuggestions(products, query, exclude),
    [products, query, exclude]
  );

  const remember = useCallback(
    (name: string) => {
      if (!userId) return;

      void recordProductUse(userId, name);

      // עדכון מקומי מיידי: בלעדיו מוצר שנוסף עכשיו לא יוצע עד לטעינה
      // הבאה של התבנית.
      setProducts((current) => {
        const trimmed = name.trim();
        const existing = current.find(
          (product) => product.name.toLowerCase() === trimmed.toLowerCase()
        );

        if (existing) {
          return current.map((product) =>
            product === existing ? { ...product, useCount: product.useCount + 1 } : product
          );
        }

        return [...current, { name: trimmed, useCount: 1 }];
      });
    },
    [userId]
  );

  return { suggestions, remember };
};
