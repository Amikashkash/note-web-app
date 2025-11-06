# Testing Guide

This project uses **Vitest** and **React Testing Library** for automated testing.

## Running Tests

```bash
# Run tests in watch mode (recommended for development)
npm test

# Run tests once (useful for CI/CD)
npm run test:run

# Run tests with UI interface
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### Example Tests Included

1. **Component Tests** - `src/components/common/Button/Button.test.tsx`
   - Tests button rendering, interactions, and variants
   - Example of testing user interactions with `@testing-library/user-event`

2. **Utility Tests** - `src/utils/validators.test.ts`
   - Tests validation functions (email, password, category names, etc.)
   - Example of pure function testing

3. **Hook Tests** - `src/hooks/useAuth.test.tsx`
   - Documentation for hook interface
   - Note: Complex Firebase integration tests require Firebase emulator

## Writing New Tests

### Component Test Template

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { YourComponent } from './YourComponent';

describe('YourComponent', () => {
  it('renders correctly', () => {
    render(<YourComponent />);
    expect(screen.getByRole('...')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<YourComponent onClick={handleClick} />);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Utility Function Test Template

```ts
import { describe, it, expect } from 'vitest';
import { yourFunction } from './yourFile';

describe('yourFunction', () => {
  it('returns expected result for valid input', () => {
    expect(yourFunction('valid')).toBe(true);
  });

  it('handles edge cases', () => {
    expect(yourFunction('')).toBe(false);
    expect(yourFunction(null)).toBe(false);
  });
});
```

## Test Utilities

### Custom Render Function

Use the custom `render` from `@/test/utils` which includes all providers:

```tsx
import { render, screen } from '@/test/utils';

// This automatically wraps your component with:
// - BrowserRouter
// - ThemeProvider
```

### Mock Data Helpers

```tsx
import {
  createMockUser,
  createMockCategory,
  createMockNote
} from '@/test/utils';

const mockUser = createMockUser({ email: 'custom@example.com' });
const mockCategory = createMockCategory({ name: 'Work' });
const mockNote = createMockNote({ title: 'Test Note' });
```

## Mocking

### Vitest Mocking

```tsx
import { vi } from 'vitest';

// Mock a function
const mockFn = vi.fn();

// Mock a module
vi.mock('./module', () => ({
  someFunction: vi.fn(() => 'mocked result'),
}));
```

### Firebase Mocking

Firebase modules are pre-mocked in `src/test/mocks/firebase.ts`. For integration tests with Firebase, consider using the Firebase Emulator Suite.

## Testing Best Practices

### 1. Test User Behavior, Not Implementation

```tsx
// ✅ Good - tests what the user sees
expect(screen.getByText('Submit')).toBeInTheDocument();

// ❌ Bad - tests implementation details
expect(component.state.isSubmitting).toBe(false);
```

### 2. Use Accessible Queries

Priority order:
1. `getByRole` - preferred
2. `getByLabelText` - for form inputs
3. `getByPlaceholderText`
4. `getByText`
5. `getByTestId` - last resort

```tsx
// ✅ Good
screen.getByRole('button', { name: /submit/i });

// ⚠️ Use only when necessary
screen.getByTestId('submit-button');
```

### 3. Async Testing

```tsx
import { waitFor } from '@testing-library/react';

// Wait for async changes
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### 4. User Interactions

```tsx
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();

// Type into input
await user.type(screen.getByRole('textbox'), 'Hello');

// Click button
await user.click(screen.getByRole('button'));
```

## Configuration

### vitest.config.ts

- **Environment**: jsdom (simulates browser)
- **Globals**: true (no need to import describe, it, expect)
- **Setup file**: `src/test/setup.ts`
- **Coverage provider**: v8

### Coverage Reports

After running `npm run test:coverage`, view reports in:
- Terminal output
- `coverage/index.html` (open in browser)

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm run test:run

- name: Generate coverage
  run: npm run test:coverage
```

## Firebase Integration Testing

For complete Firebase integration tests:

1. **Install Firebase Emulator**
   ```bash
   firebase init emulators
   ```

2. **Start Emulator**
   ```bash
   firebase emulators:start
   ```

3. **Configure tests to use emulator**
   ```ts
   import { connectAuthEmulator } from 'firebase/auth';
   import { connectFirestoreEmulator } from 'firebase/firestore';

   connectAuthEmulator(auth, 'http://localhost:9099');
   connectFirestoreEmulator(db, 'localhost', 8080);
   ```

## Common Issues

### Import Aliases Not Working

If `@/` imports fail, check:
1. `vitest.config.ts` has correct path alias
2. `tsconfig.json` has matching paths

### CSS/Style Errors

The config has `css: true` to handle CSS imports. If you get CSS errors, ensure your component tests don't rely on specific CSS values.

### Firebase Errors in Tests

Firebase needs valid config or mocking. Current setup mocks Firebase modules. For real Firebase testing, use emulators.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Firebase Emulator](https://firebase.google.com/docs/emulator-suite)

## Next Steps

1. Add more component tests as you build features
2. Test edge cases and error handling
3. Set up Firebase emulator for integration tests
4. Add E2E tests with Playwright/Cypress for critical user flows
5. Monitor test coverage and aim for 80%+ coverage
