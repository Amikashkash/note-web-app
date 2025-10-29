/**
 * טיפוסים הקשורים לתבניות
 */

import { TemplateType } from './note';

export interface Template {
  id: string;
  type: TemplateType;
  name: string;
  nameHe: string;
  structure: object;
  icon: string;
  description: string;
  descriptionHe: string;
}
