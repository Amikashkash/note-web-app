/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // הפעלת dark mode עם class
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          start: '#667eea',
          end: '#764ba2',
        },
        secondary: '#10B981',
        accent: '#F59E0B',
        danger: '#EF4444',
        category: {
          purple: '#8b5cf6',
          blue: '#3b82f6',
          green: '#10b981',
          orange: '#f59e0b',
          red: '#ef4444',
          pink: '#ec4899',
        }
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.12)',
        'card-dark': '0 2px 8px rgba(0,0,0,0.3)',
        'card-hover-dark': '0 8px 25px rgba(0,0,0,0.5)',
        'note': '0 2px 8px rgba(0,0,0,0.08)',
        'note-hover': '0 12px 24px rgba(0,0,0,0.15)',
        'note-dark': '0 2px 8px rgba(0,0,0,0.4)',
        'note-hover-dark': '0 12px 24px rgba(0,0,0,0.6)',
        'button': '0 4px 15px rgba(102, 126, 234, 0.4)',
        'button-hover': '0 8px 25px rgba(102, 126, 234, 0.6)',
        'button-dark': '0 4px 15px rgba(102, 126, 234, 0.3)',
        'button-hover-dark': '0 8px 25px rgba(102, 126, 234, 0.5)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      borderRadius: {
        'card': '16px',
        'note': '12px',
      }
    },
  },
  plugins: [],
}
