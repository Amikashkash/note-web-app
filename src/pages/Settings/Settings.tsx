/**
 * Settings Page - העדפות משתמש
 */

import React from 'react';
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { BackupSection } from '@/components/settings/BackupSection';

export const Settings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-app-light dark:bg-app-dark transition-colors">
      {/* Header */}
      <header className="bg-surface-light dark:bg-surface-dark shadow-sm transition-colors">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 text-ink-2-light dark:text-ink-2-dark hover:text-ink-light dark:hover:text-ink-dark"
          >
            <ChevronRight size={20} strokeWidth={1.75} />
            חזרה
          </button>
          <h1 className="text-2xl font-bold text-ink-light dark:text-ink-dark">הגדרות</h1>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <BackupSection />
      </main>
    </div>
  );
};
