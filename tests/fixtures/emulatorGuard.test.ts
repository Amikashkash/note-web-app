import { describe, expect, it } from 'vitest';
import { assertEmulatorOnly } from './emulatorGuard';

const ok = {
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
  GCLOUD_PROJECT: 'demo-notes-4-me',
};

describe('assertEmulatorOnly: the seed script refuses anything but the local emulator', () => {
  it('allows the local emulator with a demo- project', () => {
    expect(assertEmulatorOnly(ok)).toBe('demo-notes-4-me');
    expect(assertEmulatorOnly({ ...ok, FIRESTORE_EMULATOR_HOST: '[::1]:8080' })).toBe('demo-notes-4-me');
  });

  it('refuses when an emulator host is missing: the Admin SDK would go to the cloud', () => {
    expect(() => assertEmulatorOnly({ ...ok, FIRESTORE_EMULATOR_HOST: undefined })).toThrow('FIRESTORE_EMULATOR_HOST');
    expect(() => assertEmulatorOnly({ ...ok, FIREBASE_AUTH_EMULATOR_HOST: '' })).toThrow('FIREBASE_AUTH_EMULATOR_HOST');
  });

  it('refuses an emulator host that is not this machine', () => {
    expect(() => assertEmulatorOnly({ ...ok, FIRESTORE_EMULATOR_HOST: 'firestore.googleapis.com:443' })).toThrow(
      'must point to a local emulator'
    );
    expect(() => assertEmulatorOnly({ ...ok, FIREBASE_AUTH_EMULATOR_HOST: '10.0.0.5:9099' })).toThrow('local emulator');
  });

  it('refuses the real project, or no project at all', () => {
    expect(() => assertEmulatorOnly({ ...ok, GCLOUD_PROJECT: 'notes-4-me' })).toThrow('demo- project');
    expect(() => assertEmulatorOnly({ ...ok, GCLOUD_PROJECT: undefined })).toThrow('demo- project');
  });

  it('lists every problem at once', () => {
    expect(() => assertEmulatorOnly({})).toThrow(/FIRESTORE_EMULATOR_HOST[\s\S]*FIREBASE_AUTH_EMULATOR_HOST[\s\S]*demo-/);
  });
});
