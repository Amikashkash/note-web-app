/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** `'true'` רושם את מסך ההסכמה `/connect` (שרת ה-MCP). ראו `router.tsx` */
  readonly VITE_MCP_CONNECT?: string
  /** `'true'` בפיתוח: האפליקציה מתחברת ל-emulators המקומיים. ראו `services/firebase/config.ts` */
  readonly VITE_USE_EMULATORS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** גרסת האפליקציה, מוזרקת בזמן build מתוך package.json */
declare const __APP_VERSION__: string
