/**
 * נקודת כניסה לאפליקציה
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary/ErrorBoundary'
import { FirebaseConfigCheck } from './components/common/FirebaseConfigCheck/FirebaseConfigCheck'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <FirebaseConfigCheck>
        <App />
      </FirebaseConfigCheck>
    </ErrorBoundary>
  </React.StrictMode>,
)
