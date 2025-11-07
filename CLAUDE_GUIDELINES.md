# Claude Development Guidelines

This file contains important guidelines for Claude when working on this project.

## Version Management

### ⚠️ CRITICAL: Always Increment Version Numbers

**NEVER reuse the same version number!**

When making changes, ALWAYS increment the version so the user can verify they have the latest code.

**Version Update Checklist:**
- [ ] Update `package.json` version
- [ ] Update `src/pages/Home/Home.tsx` version display
- [ ] Update `src/pages/Login/Login.tsx` version display
- [ ] Version number should be HIGHER than previous (e.g., 1.0.4 → 1.0.5)
- [ ] Commit message should mention the new version

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

### Push Retry Strategy
- If push fails with 403: branch name doesn't match session ID
- If push fails with network error: retry with exponential backoff (2s, 4s, 8s, 16s)

## Testing Changes

### Before Committing
1. **Build check**: Run `npm run build` (or `npx vite build` to skip TypeScript errors)
2. **Visual check**: Verify in browser if possible
3. **Version check**: Confirm version number is updated and visible

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

### TypeScript Errors
- Pre-existing TypeScript errors may exist
- Use `npx vite build` if `npm run build` fails due to TS errors
- Don't introduce new TypeScript errors
- Document if you need to work around existing errors

### Console Logs
- Use for debugging during development
- Remove before final version (keep version incremental)
- Use descriptive emojis for categorization
- Include version number in debug logs

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

### Known Issues
- TypeScript errors in `src/services/api/categories.ts` (pre-existing)
- Search requires notes to load asynchronously from Firebase
- Build works with `npx vite build` even with TS errors

## Session Context

### Current State (as of v1.0.5)
- Version display added to UI
- Search functionality implemented (searches title, content, tags)
- Search waits for notes to load before filtering
- Debug logs active to diagnose search issues
- Working branch: `claude/add-version-display-011CUrYBh1agrcjAuGUzqP9R`

### Active Issues
- User reports search not working despite implementation
- Investigating with debug logs in v1.0.5
- Waiting for user console output to diagnose

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
