# Version Update Guide

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

## Checklist for version updates

- [ ] Update `package.json`
- [ ] Update `src/pages/Login/Login.tsx`
- [ ] Update `src/pages/Home/Home.tsx`
- [ ] Commit all three files together
- [ ] Push to GitHub

## Example commit message

```
Update version to v1.2.x

- Update package.json
- Update version display on login page
- Update version display on home page
```
