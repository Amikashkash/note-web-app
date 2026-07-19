# Claude Development Guidelines

This file contains important guidelines for Claude when working on this project.

## Version Management

### ⚠️ CRITICAL: Always Increment Version Numbers

**NEVER reuse the same version number!**

When making changes, ALWAYS increment the version so the user can verify they have the latest code.

**Version Update Checklist:**
- [ ] Update `package.json` version — this is the ONLY place the number lives
- [ ] Add an entry to `src/pages/WhatsNew/WhatsNew.tsx`
- [ ] Version number should be HIGHER than previous (e.g., 1.0.4 → 1.0.5)
- [ ] Commit message should mention the new version

**Note:** The version displayed in the UI is injected at build time from
`package.json` via the `__APP_VERSION__` global (see `vite.config.ts`).
Home and Login read it automatically — do NOT hardcode version strings in
components. Previously the number was copy-pasted into each screen, and it
drifted (package.json said 1.4.6 while the UI showed 1.4.4).

**Example:**
```
Bad:  v1.0.4 → v1.0.4 (user can't tell if they have latest)
Good: v1.0.4 → v1.0.5 (clear difference)
```

### Version Numbering Scheme

- **Major (1.x.x)**: Breaking changes, major features
- **Minor (x.1.x)**: New features, non-breaking changes
- **Patch (x.x.1)**: Bug fixes, small improvements

For this project, increment patch version for each change.

## Git Workflow

### Branch Naming
- Branch names must start with `claude/` and end with session ID
- Format: `claude/description-SESSIONID`
- Example: `claude/add-search-feature-011CUrYBh1agrcjAuGUzqP9R`

### Commit Messages
- Clear, descriptive commit messages
- Include version number in commit message
- Mention what was changed and why
- Example:
  ```
  Add search functionality (v1.0.5)

  - Add search bar in header
  - Search through note titles, content, and tags
  - Fix async loading issue
  ```

### Push Approval Workflow ⚠️ IMPORTANT
- **NEVER push to GitHub automatically**
- **ALWAYS wait for user approval before pushing**
- After making changes and committing locally:
  1. Run build to verify changes work
  2. Inform user about changes made
  3. Tell user to test locally first
  4. Wait for user's explicit approval to push
  5. Only push after user confirms everything works

### Push Retry Strategy
- If push fails with 403: branch name doesn't match session ID
- If push fails with network error: retry with exponential backoff (2s, 4s, 8s, 16s)

## Testing Changes

### Before Committing
1. **Type check**: `npx tsc --noEmit` — must be clean
2. **Lint**: `npm run lint` — must be clean (zero warnings; `--max-warnings 0`)
3. **Build check**: `npm run build` — this runs `tsc && vite build` and must pass
4. **Visual check**: Verify in browser if possible
5. **Version check**: Confirm version number is updated

> Historical note: earlier versions of this file instructed using `npx vite build`
> to bypass TypeScript errors. Those errors came from `services/firebase/config.ts`
> exporting `db`/`auth` as possibly-`null`, and have been fixed. Do not reintroduce
> the bypass — it was hiding real bugs, including a broken sign-out button and a
> ref callback that TypeScript rejected.

### After Pushing
1. Instruct user to pull with clear commands
2. Tell user what version number to look for
3. Provide verification steps

## Debugging Approach

### When Feature Doesn't Work
1. **Add targeted debug logs** with version number
   ```typescript
   console.log('🔍 v1.0.5 - Searching for:', query);
   ```
2. **Log key data**: state values, loaded data, matches found
3. **Increment version** so user knows they have debug version
4. **Ask user for console output** to diagnose

### Common Issues
- **Async loading**: Check if data is loaded before using it
- **Cache**: Remind user to hard refresh (Ctrl+Shift+R)
- **Wrong branch**: User might be on old branch

## Communication with User

### Clear Instructions
- Always provide exact commands to run
- Include both Windows and Mac/Linux commands when different
- Number steps clearly
- Explain what each step does

### Version Verification
- Always tell user what version to look for
- Have them confirm they see the version number
- If version doesn't match, troubleshoot git/pull issues first

### Debug Collaboration
- Ask user to open console (F12)
- Request specific log outputs
- Explain what each log means
- Use emojis in logs for easy identification (🔍 ✅ ❌ 📋)

## Code Quality

### TypeScript
- The project type-checks cleanly. Keep it that way.
- `strict`, `noUnusedLocals` and `noUnusedParameters` are all on.
- Avoid `any` — the lint config warns on it. For caught errors use `unknown`
  plus the helpers in `src/utils/errors.ts`.

### Logging
- **Never call `console.*` directly** in app code — use `logger` from
  `src/utils/logger.ts`. It silences debug/info/warn in production so user
  data (emails, note contents) doesn't leak into the browser console.
- `logger.error` always logs, in every environment.
- The lint rule `no-console` enforces this.

### Error Handling
- Services throw `Error` objects with a Hebrew message for the user and the
  original error attached as `cause` — never swallow the underlying error,
  it's what tells you a failure was actually `permission-denied`.
- Components surface errors inline where practical; `window.alert` is still
  used in a few places and is fair game to replace with a toast.

## File Organization

### Test Files
- Place tests next to source files: `Button.tsx` → `Button.test.tsx`
- Test utilities in `/src/test/` directory
- Mock files in `/src/test/mocks/`

### Documentation
- Keep README.md user-facing
- This file (CLAUDE_GUIDELINES.md) is for Claude's reference
- Update guidelines when learning new patterns

## Project-Specific Notes

### Current Architecture
- **Framework**: React 18 + TypeScript + Vite
- **State**: Zustand stores
- **Backend**: Firebase (Firestore + Auth)
- **Styling**: Tailwind CSS with dark mode
- **Routing**: React Router v7

### Key Files
- `src/pages/Home/Home.tsx` - Main app page with search
- `src/components/category/CategoryList/CategoryList.tsx` - Category filtering
- `src/components/category/CategoryItem/CategoryItem.tsx` - Note filtering
- `package.json` - Version number

### Architecture Rules (added in v1.5.0)

**Firestore subscriptions** — `noteStore` and `categoryStore` each own a
single listener with a subscriber count. Components subscribe via `useNotes`
/ `useCategories`, never by calling the store's `subscribe` directly. Adding
a second listener per component was the original bug: every `CategoryItem`
tore down the shared subscription and blanked the list for all the others.

**Document normalization** — every Firestore document goes through
`src/services/api/mappers.ts`. Firestore doesn't guarantee fields exist, so
older documents arrive missing `tags`, `sharedWith` or `updatedAt`. Normalize
once there instead of scattering `?.` and `|| []` through components.

**Partial updates** — `updateNote` takes only the fields that changed. Never
spread a whole note object into it: it overwrites concurrent edits from other
users and writes junk fields into the document.

**Array fields** — `sharedWith` is only ever modified with `arrayUnion` /
`arrayRemove`. Read-modify-write loses concurrent shares.

**Template metadata** — labels and icons live only in `src/utils/templates.ts`.
There used to be four separate copies of that map and one had already fallen
out of sync (`aisummary` was missing).

### Known Issues
- Search requires notes to load asynchronously from Firebase
- Service Worker reminders rely on `setTimeout`; a browser may evict an idle
  worker and drop a pending timer. Reminders re-sync on every app load, so it
  self-corrects, but a long-range reminder can be missed if the app is never
  opened. A real fix needs server-side Push.
- Any signed-in user can read the `userLookup` collection, which allows
  checking whether an email is registered. Closing that requires moving the
  email lookup into a Cloud Function.
- The main JS bundle is ~986 kB (257 kB gzipped) — worth code-splitting.

## Session Context

### Current State (as of v1.5.0)
- `npm run build`, `npx tsc --noEmit` and `npm run lint` are all clean
- ESLint migrated to flat config (`eslint.config.js`); the old
  `.eslintrc.cjs` was silently not being loaded by ESLint 9 at all,
  so linting had effectively been off
- Firestore rules hardened: shared users can edit content but not take
  ownership; full user documents are owner-only
- Reminders are actually wired up end to end (`useNoteReminders` → SW)
- Working branch: `main`

### Recent Changes (v1.5.0)
- **Correctness**: debounced inline editing; shared subscription with
  reference counting; atomic reorder via `writeBatch`; `arrayUnion`/
  `arrayRemove` for sharing; document normalization layer
- **Security**: Firestore rules rewritten; `userLookup` collection split out
  so `users/{uid}` is no longer world-readable
- **Bugs fixed**: sign-out button (referenced a store field that never
  existed), markdown parser dropping formatting before a link, crash on
  notes missing `tags`/`updatedAt`, template label map missing `aisummary`
- **Cleanup**: central `logger`, `errors`, `templates`, `search`,
  `notePreview` modules; removed dead code (`Template` type, unused
  template constants, duplicate `DEFAULT_USER_SETTINGS`, vestigial
  `getRedirectResult` handling — Google sign-in uses a popup, not redirect)

### Previous Changes (v1.4.6)
- **Note Cards**: Fixed width issue on screens below 640px - cards now display with horizontal scroll
- **Checklist Template**:
  - Removed accordion date card, replaced with icon-based date/time pickers
  - Date icon (📅) and time icon (🕐) placed next to trash icon
  - Clicking icons opens native date/time pickers
  - Added delete buttons (X) for date/time
  - Dark mode styling for tasks, borders, and checkboxes
  - Auto-focus new task input when pressing Enter
- **Documentation**: Complete README overhaul with all implemented features

### Previous State (v1.4.4-1.4.5)
- About, Privacy, Terms, What's New pages added
- Profile menu implemented
- Pinned notes alignment fixed in collapsed mode
- Category full-screen view with vertical note list
- Dark mode fixes for textarea
- Mobile responsive improvements

---

## Quick Checklist for Each Change

- [ ] Increment version number (package.json + UI)
- [ ] Make code changes
- [ ] Test/build locally
- [ ] Commit with clear message including version
- [ ] Push to correct branch (claude/*-SESSIONID)
- [ ] Provide clear pull instructions
- [ ] Tell user what version to verify
- [ ] If debugging: explain console logs to check

---

**Remember**: The version number is the user's way to verify they have your latest changes. Never reuse a version number!
