# Claude Development Guidelines

This file contains important guidelines for Claude when working on this project.

## Version Management

### ⚠️ CRITICAL: Always Increment Version Numbers

**NEVER reuse the same version number!**

When a change reaches users, ALWAYS increment the version so the user can verify they have the latest code.

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
- **Minor (x.1.x)**: New features the user can see
- **Patch (x.x.1)**: Bug fixes, small improvements

**Bump only when the app changes.** Tests, CI, documentation, Cloud Functions
refactors with identical behavior, and dependency updates that change nothing
the user sees get no version and no WhatsNew entry. (An earlier version of this
file said "increment patch for each change"; in practice that produced version
numbers for changes no user could observe.)

## Git Workflow

### Branches and Pull Requests
- One branch per task or stage, named `claude/<topic>` (for example
  `claude/group-c-security`). No session IDs.
- Each logical step is its own commit.
- Push the branch and open a PR when the task says so. **Never merge** — the
  owner reviews and merges.
- Merging to `main` triggers CI: tests, then a deploy of Hosting and Firestore
  rules/indexes (see `.github/workflows/SETUP.md`).

### Commit Messages
- Clear, descriptive commit messages
- Include the version number when there is one
- Mention what was changed and why
- Example:
  ```
  Add search functionality (v1.0.5)

  - Add search bar in header
  - Search through note titles, content, and tags
  - Fix async loading issue
  ```

### Push Retry Strategy
- If push fails with a network error: retry with exponential backoff (2s, 4s, 8s, 16s)

## Testing Changes

### Before Committing
Run everything that applies (CI runs all of it on every PR):

1. **Type check**: `npx tsc --noEmit` — must be clean (includes test files)
2. **Lint**: `npm run lint` — must be clean (zero warnings; `--max-warnings 0`)
3. **Build**: `npm run build` — runs `tsc && vite build` and must pass
4. **Client unit tests**: `npm test`
5. **Functions**: `cd functions && npm run build && npm run typecheck && npm test`
6. **Rules tests**: `npm run test:rules` (Firestore emulator)
7. **Functions integration tests**: `npm run test:functions:emulator`
   (Firestore + Auth emulators)
8. **Version check**: confirm the version is updated if the app changed

The emulator suites need Java 21+. Use Node 22 (`.nvmrc`, `engines`) — the
functions runtime is `nodejs22`, and running code discovery under another major
version has made deploys time out.

> Historical note: earlier versions of this file instructed using `npx vite build`
> to bypass TypeScript errors. Those errors came from `services/firebase/config.ts`
> exporting `db`/`auth` as possibly-`null`, and have been fixed. Do not reintroduce
> the bypass — it was hiding real bugs, including a broken sign-out button and a
> ref callback that TypeScript rejected.

### After Pushing
1. Tell the user what version number to look for
2. Give exact verification steps, and any manual deploy steps in order

## Debugging Approach

### When Feature Doesn't Work
1. **Add targeted debug logs** with version number, through `logger.debug`
   ```typescript
   logger.debug('🔍 v1.0.5 - Searching for:', query);
   ```
2. **Log key data**: state values, loaded data, matches found — never note
   contents or emails
3. **Increment version** so user knows they have debug version
4. **Ask user for console output** to diagnose

### Common Issues
- **Async loading**: Check if data is loaded before using it (`hasLoaded`)
- **Cache**: Remind user to hard refresh (Ctrl+Shift+R); the PWA may run old code
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
- Listener errors go to the store's `loadError` (separate from write
  `error`), and the UI shows loading, error and empty as different states
  (`LoadError` component). An error must never look like "no data".
- Components surface errors inline where practical; `window.alert` is still
  used in a few places and is fair game to replace with a toast.

## File Organization

### Test Files
- Client: next to the source file, `foo.ts` → `foo.test.ts` (Vitest, node env)
- Functions unit tests: `functions/test/` (not `src/`, so they are not built
  into `lib/` or deployed)
- Functions integration tests against the emulators: `functions/test-emulator/`
- Firestore rules tests: `tests/rules/`
- **Known holes**: rules tests may assert current, wrong behavior with the
  `knownHole('<step>', ...)` helper. When the fix lands the test fails — invert
  it and move it into the regular tests. Never delete one to make CI green.

### Documentation
- Keep README.md user-facing
- This file (CLAUDE_GUIDELINES.md) is for Claude's reference
- Plans and reviews live in `thinking/` (`architecture-review.md` has the fix
  order; `mcp-plan.md` the MCP server design)
- Update guidelines when learning new patterns

## Project-Specific Notes

### Current Architecture
- **Framework**: React 19 + TypeScript + Vite (PWA via `vite-plugin-pwa`,
  `injectManifest`, own Service Worker in `src/sw.ts`)
- **State**: Zustand stores
- **Backend**: Firebase (Firestore, Auth, FCM) and Cloud Functions v2
  (`firebase-functions` 7), region **europe-west1** — same as the database,
  set once with `setGlobalOptions`
- **Styling**: Tailwind CSS with dark mode
- **Routing**: React Router v7

### Key Files
- `package.json` — the version number
- `src/services/api/*` — every Firestore read and write; `mappers.ts` normalizes documents
- `src/store/noteStore.ts`, `categoryStore.ts` — the shared listeners
- `src/utils/templateContent.ts` — parsing, converting and appending template content
- `firestore.rules` and `tests/rules/firestore.rules.test.ts`
- `functions/src/index.ts` — function wiring; logic lives in the modules next to it
- `thinking/architecture-review.md` — findings and fix order

### Architecture Rules

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

**Writer stamp** — every note write goes through `writeStamp()` in
`src/services/api/notes.ts`, which adds `updatedBy` (the signed-in uid) and
`updatedAt`. The rules reject a foreign `updatedBy`; version history
attributes changes by it. (Phase 2, making it mandatory, is step B6b.)

**Array fields** — `sharedWith` is only ever modified with `arrayUnion` /
`arrayRemove`. Read-modify-write loses concurrent shares. A recipient may
remove only themselves (`isLeavingShare` in the rules).

**Template content** — never write content a template could not parse.
Parsers return `{ ok: false }` rather than an empty value, and templates
initialize only `''`. Converting between templates goes through
`convertContent`; appending shared content through `appendSnippet`.

**Backup rendering** — `src/utils/backupFormat.ts` is pure (no Firebase calls,
no React) so it can be exercised directly. Content renderers dispatch on the
declared `templateType` but fall back to shape detection, because notes
converted between templates hold content that doesn't match the recorded type;
unrecognized JSON is emitted as a fenced code block rather than dropped.

**Template metadata** — labels and icons live only in `src/utils/templates.ts`.
There used to be four separate copies of that map and one had already fallen
out of sync (`aisummary` was missing).

**Sensitive notes** — `isSensitive` on notes and categories hides them from
Claude (the MCP server, `thinking/mcp-plan.md` §3.4). Only the owner sets or
clears it; the rules deny it to shared users, and a shared user cannot change
`categoryId` either (that would move a note out of a sensitive category). It
is always written, including as `false`, and it is not a content field: it
creates no version and does not touch reminders.

**Finding users** — sharing by email calls the `findUserByEmail` callable
(Firebase Auth, verified accounts only, rate-limited). `userLookup` is read
only by id (`get`) for display names; a `list` query against it is denied.

**Note trigger** — `onNoteWritten` is the single Firestore trigger on
`notes/{noteId}`. It decides from `before`/`after` what the write needs and
exits early otherwise: reminder sync (`reminders.ts`) and version history
(`versions.ts`). Versions are written only there; clients can read, never write.

**Reminders** — scheduling happens in Cloud Functions, never in the browser.
An earlier version armed a `setTimeout` inside the Service Worker; browsers
evict idle workers within seconds and every pending timer died with them.
- The trigger derives reminders from the checklist content itself, into the
  `reminders` collection; there is no flag on the note to keep in sync.
  (`reminderPending` was used by an older design and is no longer read.)
- `sendDueReminders` sends **data-only** FCM messages. This app owns its
  Service Worker and renders notifications itself; adding a `notification`
  block would make the browser display one too — a duplicate.
- `sendDueReminders` sends before it marks reminders sent (F-1 in the
  review): two schedulers running at once can double-send. Never have two
  deployed at the same time.

**Cloud Functions deploy** — manual, from the owner's machine
(`firebase deploy --only functions:<name>`), with Node 22. CI only builds and
tests them. When a change needs both a function and new rules, the order
matters and belongs in the PR description.

### Known Issues
See `thinking/architecture-review.md` for the full list and fix order. Still open:
- The main JS bundle is ~1 MB — worth code-splitting.
- `sendDueReminders` is not idempotent (F-1).

## Session Context

The change history lives in `src/pages/WhatsNew/WhatsNew.tsx` (user-facing)
and in git history and PR descriptions (technical). Earlier versions of this
file kept a hand-written "current state" section here; it went stale by fifteen
minor versions and has been removed rather than updated again.

---

## Quick Checklist for Each Change

- [ ] Make code changes on a `claude/<topic>` branch
- [ ] Run the checks and test suites listed above
- [ ] If the app changed: increment the version and add a WhatsNew entry
- [ ] Commit each logical step separately, with the version in the message
- [ ] Push and open a PR when asked; do not merge
- [ ] Tell the user what version to verify, and any manual deploy steps in order

---

**Remember**: The version number is the user's way to verify they have your latest changes. Never reuse a version number!
