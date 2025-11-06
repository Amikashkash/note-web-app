import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPassword,
  isValidCategoryName,
  isValidNoteTitle,
  isValidColor,
} from './validators';

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('validates correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.il')).toBe(true);
      expect(isValidEmail('test+tag@example.com')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('test@domain')).toBe(false);
      expect(isValidEmail('test @domain.com')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('validates passwords with 6+ characters', () => {
      expect(isValidPassword('123456')).toBe(true);
      expect(isValidPassword('password')).toBe(true);
      expect(isValidPassword('a'.repeat(100))).toBe(true);
    });

    it('rejects passwords shorter than 6 characters', () => {
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('abc')).toBe(false);
    });
  });

  describe('isValidCategoryName', () => {
    it('validates category names between 1-50 characters', () => {
      expect(isValidCategoryName('Work')).toBe(true);
      expect(isValidCategoryName('Personal Notes')).toBe(true);
      expect(isValidCategoryName('a'.repeat(50))).toBe(true);
    });

    it('rejects empty category names', () => {
      expect(isValidCategoryName('')).toBe(false);
      expect(isValidCategoryName('   ')).toBe(false);
    });

    it('rejects category names longer than 50 characters', () => {
      expect(isValidCategoryName('a'.repeat(51))).toBe(false);
      expect(isValidCategoryName('a'.repeat(100))).toBe(false);
    });

    it('trims whitespace before validation', () => {
      expect(isValidCategoryName('  Work  ')).toBe(true);
      expect(isValidCategoryName('  ')).toBe(false);
    });
  });

  describe('isValidNoteTitle', () => {
    it('validates note titles between 1-100 characters', () => {
      expect(isValidNoteTitle('My Note')).toBe(true);
      expect(isValidNoteTitle('a'.repeat(100))).toBe(true);
    });

    it('rejects empty note titles', () => {
      expect(isValidNoteTitle('')).toBe(false);
      expect(isValidNoteTitle('   ')).toBe(false);
    });

    it('rejects note titles longer than 100 characters', () => {
      expect(isValidNoteTitle('a'.repeat(101))).toBe(false);
      expect(isValidNoteTitle('a'.repeat(200))).toBe(false);
    });

    it('trims whitespace before validation', () => {
      expect(isValidNoteTitle('  My Note  ')).toBe(true);
      expect(isValidNoteTitle('  ')).toBe(false);
    });
  });

  describe('isValidColor', () => {
    it('validates hex color codes', () => {
      expect(isValidColor('#000000')).toBe(true);
      expect(isValidColor('#FFFFFF')).toBe(true);
      expect(isValidColor('#3B82F6')).toBe(true);
      expect(isValidColor('#fff')).toBe(true);
      expect(isValidColor('#ABC')).toBe(true);
    });

    it('rejects invalid color codes', () => {
      expect(isValidColor('')).toBe(false);
      expect(isValidColor('000000')).toBe(false);
      expect(isValidColor('#GGG')).toBe(false);
      expect(isValidColor('#12')).toBe(false);
      expect(isValidColor('#1234567')).toBe(false);
      expect(isValidColor('red')).toBe(false);
      expect(isValidColor('rgb(0,0,0)')).toBe(false);
    });
  });
});
