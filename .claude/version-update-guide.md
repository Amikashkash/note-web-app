# Version Update Guide

⚠️ **CRITICAL REMINDER: NEVER COMMIT CODE CHANGES WITHOUT UPDATING VERSION NUMBER!**

## 🚨 MANDATORY PROCESS - NO EXCEPTIONS

**Before ANY commit that changes functionality, UI, or fixes bugs:**

1. **CHECK**: Is this a code change that users will see?
2. **IF YES**: YOU MUST update version in ALL THREE places below
3. **IF NO**: Only documentation/config changes can skip versioning

## When updating the version number

**ALWAYS update the version in ALL three places:**

1. **package.json** - Main version file
   - Location: `package.json`
   - Field: `"version": "x.x.x"`

2. **Login Page** - Display on login screen
   - Location: `src/pages/Login/Login.tsx`
   - Search for: `v1.2.x`
   - Line ~129: `<span className="text-[9px] text-gray-400 block -mt-2 mb-2">v1.2.x</span>`

3. **Home Page** - Display in header
   - Location: `src/pages/Home/Home.tsx`
   - Search for: `v1.2.x`
   - Line ~30: `<span className="text-[8px] sm:text-[10px] text-white/60">v1.2.x</span>`

## Quick update commands

```bash
# Find all version references
grep -r "v1.2." src/pages/Login/Login.tsx src/pages/Home/Home.tsx package.json

# Or use regex to find version patterns
grep -rn "version.*1\.\|v1\.2\." src/pages/Login/Login.tsx src/pages/Home/Home.tsx package.json
```

## ✅ MANDATORY Checklist for version updates

**Complete ALL steps BEFORE committing:**

1. [ ] ⚠️ STOP - Did you update the version number?
2. [ ] Update `package.json` version field
3. [ ] Update `src/pages/Login/Login.tsx` version display
4. [ ] Update `src/pages/Home/Home.tsx` version display
5. [ ] Run `npx vite build` to verify build works
6. [ ] Commit all three version files together with code changes
7. [ ] Push to GitHub

## 🔴 Common Mistakes to AVOID

- ❌ Committing code changes without version bump
- ❌ Updating only 1 or 2 of the 3 version locations
- ❌ Forgetting to build after version update
- ❌ Using wrong version number format (use semver: major.minor.patch)

## Example commit message

```
Update version to v1.2.x

- Update package.json
- Update version display on login page
- Update version display on home page
```
