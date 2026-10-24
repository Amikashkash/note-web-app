/**
 * `config/app` - הגדרות שהאפליקציה קוראת לפני הכל. היום: `minClientVersion`
 * (D4a). נקרא ע"י כל אחד, גם לפני התחברות; נכתב רק במסוף של Firebase.
 */

import { doc, getDocFromServer, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/services/firebase/config';

const appConfigRef = () => doc(db, 'config', 'app');

/** מסמך חסר - `undefined`, כלומר אין מינימום */
const minVersionOf = (data: Record<string, unknown> | undefined): unknown => data?.minClientVersion;

export const subscribeToMinClientVersion = (
  onChange: (minClientVersion: unknown) => void,
  onError: (error: unknown) => void
): Unsubscribe => onSnapshot(appConfigRef(), (snapshot) => onChange(minVersionOf(snapshot.data())), onError);

/** קריאה מהשרת, לא מהמטמון - בחזרה לאפליקציה אחרי שהייתה ברקע */
export const fetchMinClientVersion = async (): Promise<unknown> =>
  minVersionOf((await getDocFromServer(appConfigRef())).data());
