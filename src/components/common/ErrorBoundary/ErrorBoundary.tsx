/**
 * Error Boundary Component
 * Catches errors in the component tree and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const isFirebaseConfigError =
        this.state.error?.message?.includes('Firebase configuration') ||
        this.state.error?.message?.includes('auth/invalid-api-key');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
            {isFirebaseConfigError ? (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">🔥</div>
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    Firebase Configuration Missing
                  </h1>
                  <p className="text-gray-600">
                    Please set up your Firebase credentials to use this app
                  </p>
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        Check the browser console for detailed instructions
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 text-left">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">
                      Quick Setup Steps:
                    </h2>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                      <li>Create a <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file in the project root</li>
                      <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Firebase Console</a></li>
                      <li>Select your project (or create a new one)</li>
                      <li>Navigate to Project Settings → General</li>
                      <li>Copy your Firebase configuration values</li>
                      <li>Add them to your <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file</li>
                      <li>Restart the dev server</li>
                    </ol>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
                    <p className="text-gray-400 text-xs mb-2">Example .env.local:</p>
                    <pre className="text-sm text-green-400 font-mono">
{`VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123`}
                    </pre>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Tip:</strong> You can copy <code className="bg-blue-100 px-2 py-1 rounded">.env.example</code> to <code className="bg-blue-100 px-2 py-1 rounded">.env.local</code> as a starting point.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    Something Went Wrong
                  </h1>
                  <p className="text-gray-600">
                    An unexpected error occurred
                  </p>
                </div>

                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                  <p className="text-sm text-red-700 font-mono">
                    {this.state.error?.message || 'Unknown error'}
                  </p>
                </div>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Reload Page
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
