import { describe, expect, it } from 'vitest';
import { isBelowMinimum } from './appVersion';

describe('isBelowMinimum (minClientVersion)', () => {
  it.each([
    ['1.32.0', '1.33.0', true],
    ['1.32.9', '1.33.0', true],
    ['1.9.0', '1.10.0', true],
    ['0.99.99', '1.0.0', true],
    ['1.33.0', '1.33.0', false],
    ['1.33.1', '1.33.0', false],
    ['1.10.0', '1.9.0', false],
    ['2.0.0', '1.99.0', false],
  ])('running %s, minimum %s: %s', (running, minimum, expected) => {
    expect(isBelowMinimum(running, minimum)).toBe(expected);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a number', 1.33],
    ['two parts', '1.33'],
    ['text', 'latest'],
    ['a pre-release tag', '1.33.0-beta'],
    ['empty', ''],
  ])('a minimum that cannot be read (%s) never blocks', (_label, minimum) => {
    expect(isBelowMinimum('1.0.0', minimum)).toBe(false);
  });

  it('spaces around a valid minimum are tolerated', () => {
    expect(isBelowMinimum('1.32.0', ' 1.33.0 ')).toBe(true);
  });

  it('a running version that cannot be read never blocks', () => {
    expect(isBelowMinimum('dev', '1.33.0')).toBe(false);
  });
});
