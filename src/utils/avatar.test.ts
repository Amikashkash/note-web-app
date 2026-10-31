import { describe, expect, it } from 'vitest';
import { avatarInitial } from './avatar';

describe('avatarInitial', () => {
  it('takes the first letter of the name', () => {
    expect(avatarInitial('עמי כהן', 'ami@example.com')).toBe('ע');
    expect(avatarInitial('dana', null)).toBe('D');
  });

  it('falls back to the email when there is no name (email and password sign-in)', () => {
    expect(avatarInitial('', 'ami@example.com')).toBe('A');
    expect(avatarInitial(null, 'ami@example.com')).toBe('A');
    expect(avatarInitial('   ', 'ami@example.com')).toBe('A');
  });

  it('is null when there is nothing to take a letter from', () => {
    expect(avatarInitial(null, null)).toBeNull();
    expect(avatarInitial('', '')).toBeNull();
    expect(avatarInitial(undefined, undefined)).toBeNull();
  });

  it('does not split a character outside the BMP', () => {
    expect(avatarInitial('😀 smile', null)).toBe('😀');
  });
});
