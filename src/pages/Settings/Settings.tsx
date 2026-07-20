/**
 * Settings Page - העדפות משתמש
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BackupSection } from '@/components/settings/BackupSection';

export const Settings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ← חזרה
          </button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">⚙️ הגדרות</h1>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <BackupSection />
      </main>
    </div>
  );
};
