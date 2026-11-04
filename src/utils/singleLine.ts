/**
 * ערך של שורה אחת לשדה של פריט (משימה, מוצר, מרכיב...): ירידות שורה,
 * למשל מהדבקה, הופכות לרווח. התצוגה נשברת לשורות (`AutoGrowTextarea`),
 * הערך לא.
 */
export const singleLine = (value: string): string => value.replace(/\r\n|\r|\n/g, ' ');
