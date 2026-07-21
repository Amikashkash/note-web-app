# Handoff: Notes PWA — Cohesive Visual Identity (Hebrew / RTL)

## Overview
This package applies a single cohesive visual identity to the existing Hebrew, RTL, mobile-first notes PWA (React 19 + TS + Tailwind, `darkMode:'class'`). It replaces the "default Tailwind" look (raw `bg-blue-600`, `rounded-lg`, `border-2`, purple-blue gradient everywhere, emoji icons, no Hebrew webfont) with: **Assistant** webfont, a **warm-stone neutral + indigo brand + teal action** palette with light+dark pairs, a **hairline + e1–e3 elevation** language, and **lucide-react** icons replacing all emoji.

## About the Design Files
The bundled files (`Foundations.dc.html`, `Screens.dc.html`) are **design references created in HTML** — prototypes of the intended look, not production code to copy. The task is to **recreate them in the existing React + Tailwind codebase using its established patterns** (the `Button`, `Input`, `Modal`, template components, pages already exist — restyle them; do not rewrite architecture). `.dc.html` is a preview-only format; ignore its `<x-dc>`/`support.js` wrapper.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and icon choices are final. Recreate pixel-close using Tailwind utilities and the tokens below. Behavior/logic of the app is unchanged — this is a restyle, not a rebuild.

## Design Tokens — paste into `tailwind.config.js` → `theme.extend`
```js
fontFamily: { sans: ['Assistant', 'system-ui', 'sans-serif'] },
fontSize: {
  caption:   ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }], // 13/18
  'body-sm': ['0.875rem',  { lineHeight: '1.25rem' }],                     // 14/20
  body:      ['1rem',      { lineHeight: '1.5rem' }],                      // 16/24
  h2:        ['1.125rem',  { lineHeight: '1.5rem',   fontWeight: '600' }], // 18/24
  h1:        ['1.375rem',  { lineHeight: '1.75rem',  fontWeight: '700' }], // 22/28
  display:   ['1.75rem',   { lineHeight: '2.125rem', fontWeight: '700' }], // 28/34
},
colors: {
  brand:   { DEFAULT:'#4F46E5', dark:'#6366F1', text:'#4F46E5', 'text-dark':'#A5B4FC' },
  teal:    { DEFAULT:'#0F766E', fill:'#0D9488', dark:'#2DD4BF' },
  success: { DEFAULT:'#059669', dark:'#34D399' },
  danger:  { DEFAULT:'#DC2626', dark:'#F87171' },
  app:      { light:'#FAFAF9', dark:'#0C0A09' },
  surface:  { light:'#FFFFFF', dark:'#1C1917' },
  raised:   { light:'#F5F5F4', dark:'#292524' },
  ink:      { light:'#1C1917', dark:'#F5F5F4' },
  'ink-2':  { light:'#57534E', dark:'#A8A29E' },
  'ink-3':  { light:'#78716C', dark:'#8A827C' },
  hairline: { light:'#E7E5E4', dark:'#33302D' },
  cat: {
    blue:'#3B82F6','blue-dark':'#60A5FA', purple:'#8B5CF6','purple-dark':'#A78BFA',
    green:'#10B981','green-dark':'#34D399', orange:'#F59E0B','orange-dark':'#FBBF24',
    red:'#EF4444','red-dark':'#F87171', pink:'#EC4899','pink-dark':'#F472B6',
  },
},
boxShadow: {
  e1:'0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.08)',
  e2:'0 4px 12px rgb(0 0 0 / 0.10)',
  e3:'0 12px 32px rgb(0 0 0 / 0.18)',
},
borderRadius: { lg:'12px', xl:'16px' }, // NOTE: intentionally redefines lg→12, xl→16
```
Add to `index.html <head>`:
```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```
Set `font-family` on body to the `sans` stack (it flows from Tailwind's `font-sans`, or set explicitly in `globals.css`). Keep the existing `direction:rtl; text-align:right`.

### Contrast (WCAG AA verified, text needs 4.5:1)
ink/surface 16:1 · ink-2 7:1 · ink-3 4.9:1 · white-on-brand 5.1:1 · white-on-teal(#0F766E) 5.3:1 · white-on-success 4.5:1 · white-on-danger 5.9:1. Dark equivalents all ≥4.6:1.

## Typography
One family, **Assistant** (Hebrew-native screen face; full 200–800 range). Scale above. **Accounting table numerals only**: add `font-feature-settings:'tnum' 1,'lnum' 1` (or a `tabular-nums` utility) so columns align. Body text 16px minimum (prevents iOS input zoom).

## Icons — lucide-react (replace ALL emoji)
Install `lucide-react`. Defaults: `size={24}` nav/touch, `size={20}` inline, `strokeWidth={1.75}`, color `currentColor`. Map:
| emoji | lucide | emoji | lucide |
|---|---|---|---|
| 📝 | `NotebookPen` / `FileText` | 🔍 | `Search` |
| 🛒 | `ShoppingCart` | ✅ checklist | `ListChecks` |
| 📋 workplan | `ClipboardList` | 💰 | `Wallet` |
| 🍳 recipe | `ChefHat` | 📅 | `CalendarDays` |
| ⏰ | `AlarmClock` | 🕐 | `Clock` |
| 📌/📍 | `Pin` (fill when pinned) | 🗑 | `Trash2` |
| 🗄️ | `Archive` | ⚙ | `Settings` |
| ⋮⋮ | `GripVertical` | 👁 | `Eye` |
| ✕ close | `X` | ✓ | `Check` |
| ↺ restore | `RotateCcw` | 🔗 | `Share2` |
| 📁 move | `FolderInput` | 💡 | `Lightbulb` |
| ↑/↓ reorder | `ChevronUp`/`ChevronDown` | ← back | `ChevronRight` (see RTL) |

### RTL — direction matters (critical)
- **Back/home arrow points RIGHT** in RTL → use `ChevronRight` as-is (do NOT mirror). Forward/drill-in points LEFT → `ChevronLeft`.
- **Mirror** (`className="scale-x-[-1]"`): any horizontal arrow implying next/previous, `Undo/Redo`, `Send`.
- **Do NOT mirror** (direction-neutral): `Search, Trash2, Pin, Clock, AlarmClock, Settings, Check, ShoppingCart, Wallet`.
- Category / note accent stripe: use **logical** `border-s-4` (start = right in RTL). The current code hard-codes `borderRight`/`borderRightWidth` inline (NoteCard.tsx, CategoryItem.tsx) — replace with `border-s-4` + `borderInlineStartColor`.

## Element → Tailwind class map (the cheat-sheet)
| Element | Classes |
|---|---|
| Screen bg | `bg-app-light dark:bg-app-dark text-ink-light dark:text-ink-dark` |
| Card (note/category) | `bg-surface-light dark:bg-surface-dark rounded-lg shadow-e1 border border-hairline-light dark:border-hairline-dark hover:shadow-e2` |
| Category/note stripe | `border-s-4` + `style={{borderInlineStartColor: color}}` |
| Primary button | `bg-brand dark:bg-brand-dark text-white rounded-lg h-11 px-5 shadow-e1 hover:bg-brand/90` |
| Positive/secondary (teal) | `bg-teal-fill dark:bg-teal-dark dark:text-ink-dark text-white rounded-lg h-11 px-5` |
| Ghost (replaces `outline` border-2) | `text-brand dark:text-brand-text-dark h-11 px-4 rounded-lg hover:bg-raised-light dark:hover:bg-raised-dark` |
| Neutral/secondary button | `bg-surface-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark rounded-lg h-11 px-5` |
| Danger button | `bg-danger dark:bg-danger-dark text-white rounded-lg h-11 px-5` (or soft: `bg-danger/10 text-danger border border-danger/40`) |
| Input | `bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark rounded-lg h-11 px-3 text-body focus:ring-2 focus:ring-brand/40 focus:border-brand` |
| Chip / tag | `bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark rounded-full px-2.5 py-1 text-caption` |
| Modal container | `bg-surface-light dark:bg-surface-dark rounded-xl shadow-e3` (mobile: bottom sheet `rounded-t-2xl`) |
| Table cell (accounting) | `border border-hairline-light dark:border-hairline-dark px-2 h-11 text-body-sm` |
| Table number | `tabular-nums font-medium` + `text-success` (positive) / `text-danger` (negative) |
| Icon-only touch target | `h-11 w-11 grid place-items-center rounded-xl` (44px min) |
| Progress bar fill | brand for checklist (`bg-brand`), teal (`bg-teal-fill`) for shopping |
| Checkbox (checked) | `bg-success border-success` with white `Check` icon; unchecked `border-2 border-hairline-*` |

## Screens / Views (see `Screens.dc.html`; frame numbers below)
**Global chrome:** header on `surface` with 1px `hairline` bottom border (drop the gradient header). Category view header adds a 3px top border in the category color. Optional bottom nav (Home/Archive/Settings) with lucide + `text-brand` active.

1. **Login** — the ONLY gradient use: full-screen `linear-gradient(150deg,#4F46E5,#4338CA 45%,#0F766E 130%)`, centered white `surface` card (`rounded-2xl shadow-e3`), logo tile, email/password inputs, primary button, "או" divider, Google button, mode-toggle link.
2. **Home** — `surface` header (logo tile + title "פתקים", moon toggle, avatar) + search input; body = **2-col grid of category cards** (icon in a tinted `color-mix 15%` circle, name h2, "N פתקים" caption, category stripe on start edge).
3. **Category view** — back `ChevronRight`, category icon+name+count, `+` icon button (44px), search; body = 1-col note cards (title, 2-line preview `ink-2`, tag chips, pin icon `cat-orange` filled when pinned, category stripe).
4. **Note view modal** — bottom sheet; title h1, meta line (template icon + label + `he-IL` date), pin + close (`X`). Checklist body: brand progress bar; items in rounded rows, checked = success-tinted + strikethrough `ink-3`, overdue = `danger` border + `AlarmClock`. Footer actions: שתף (`Share2`), העבר (`FolderInput`), delete (soft-danger icon).
5. **Note form** — title "פתק חדש", כותרת input (focused = 2px brand ring), **3-col template picker** (icon+label; selected = 2px brand border + `brand-soft` bg), color swatch row (selected = `outline` ring), save (primary) / ביטול (neutral).
6. **Accounting** — 3-col table `date | description | amount` (RTL: date is rightmost). Header row `raised`. Numbers `tabular-nums`, `+`=success `−`=danger. Last-row highlight `cat-orange/8`. Total row `brand-soft`, "יתרה סופית" + `−2,020.50 ₪`. Date cells in JetBrains-Mono-ish mono, small. "+ הוסף תנועה" ghost, help panel on `raised`.
7. **Shopping** — teal progress; quick-add bar on `raised` (product input + qty + teal "הוסף"); suggestion chips (outline pills); item rows with success checkbox, name, qty, `Trash2`.
8. **Recipe** — 3 stat tiles (מנות/הכנה/בישול) on `raised`; מרכיבים list (orange bullet dots) + "הוסף מרכיב" ghost link; ממוספר הוראות (brand-soft numbered circles) + "הוסף שלב".
9. **Work plan** — section cards on `raised`: reorder `ChevronUp`/`ChevronDown` (start side), delete (end side), bold header h2, free-text content; "+ הוסף סעיף" ghost.
10. **Settings** — grouped list on `surface` with `hairline` dividers: dark-mode toggle (brand track), גיבוי/ייצוא, התראות (drill-in `ChevronLeft`), התנתקות (`danger`). **Archive** — count caption; cards with template icon + title + archived date, שחזר (`RotateCcw`, primary) / מחק (soft-danger).

## Interactions & Behavior (unchanged from current app)
Keep all existing logic: debounced autosave in NoteView, Zustand stores, Firestore subscriptions, drag-reorder, template JSON serialization, quick-add focus management in Shopping/Checklist, notification opt-in. Only swap presentation. Transitions: `transition` on shadow/color, ~200ms; hover lifts optional (`hover:-translate-y-0.5`). Dark mode via existing `useTheme` toggling `.dark` on `<html>`.

## Files to restyle (existing codebase)
- `tailwind.config.js` (replace theme.extend), `index.html` (font link), `src/styles/globals.css` (font stack; add dark values to scrollbar rules; delete `.bg-gradient-*` except a login-only one).
- `src/components/common/Button/Button.tsx` (variant map → new classes; drop `border-2` outline → ghost), `Input/Input.tsx`, `Modal/Modal.tsx`.
- `src/components/note/NoteCard/NoteCard.tsx`, `NoteView/NoteView.tsx`, `NoteForm/NoteForm.tsx`, `NotesList`, templates: `AccountingTemplate.tsx`, `ChecklistTemplate.tsx`, `ShoppingTemplate.tsx`, `RecipeTemplate.tsx`, `WorkPlanTemplate.tsx`.
- `src/components/category/CategoryItem.tsx`, `CategoryList.tsx`, `CategoryForm`.
- `src/pages/Home`, `CategoryView`, `Login`, `Settings`, `Archive`.
- Replace every emoji literal with a lucide component per the map; audit for hard-coded `borderRight`, `border-2`, `bg-blue-*`, `text-gray-*`, `bg-gradient-*`.

## Assets
No image assets. Icons = `lucide-react` (npm). Font = Assistant (Google Fonts). PWA icons already exist in `public/`.

## Bundled reference files
- `Foundations.dc.html` — the system reference (type scale, palette swatches w/ contrast, elevation, icon map, config, class map).
- `Screens.dc.html` — all 10 screens with a working light/dark toggle.
Open either in a browser to view.
