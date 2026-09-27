/**
 * החלקים הטהורים של ה-AS: tokens, PKCE, redirect, scope ו-allowlist.
 * הזרימה המלאה, כולל מתקפות, נבדקת מול ה-emulator ב-`test-emulator/oauth.emulator.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { REDIRECT_URI_ALLOWLIST } from '../src/oauth/config';
import { isAllowedRedirectUri, isScopeSubset, isUserAllowed, parseScope } from '../src/oauth/policy';
import {
  isCodeVerifier,
  isS256Challenge,
  isSecretShaped,
  newAccessToken,
  newRefreshToken,
  sha256Hex,
  verifyPkceS256,
} from '../src/oauth/tokens';
import { authorizationServerMetadata, protectedResourceMetadata } from '../src/oauth/metadata';

describe('PKCE', () => {
  // RFC 7636 appendix B
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

  it('accepts the RFC 7636 test vector', () => {
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it('rejects a wrong verifier, and the plain method (verifier equal to challenge)', () => {
    expect(verifyPkceS256(`${verifier.slice(0, -1)}A`, challenge)).toBe(false);
    expect(verifyPkceS256(challenge, challenge)).toBe(false);
  });

  it.each([
    ['too short', 'a'.repeat(42)],
    ['too long', 'a'.repeat(129)],
    ['with a space', `${'a'.repeat(42)} `],
    ['with a slash', `${'a'.repeat(42)}/`],
  ])('rejects a verifier that is %s', (_label, value) => {
    expect(isCodeVerifier(value)).toBe(false);
  });

  it('accepts only 43-character base64url challenges', () => {
    expect(isS256Challenge(challenge)).toBe(true);
    expect(isS256Challenge(`${challenge}=`)).toBe(false);
    expect(isS256Challenge(challenge.slice(1))).toBe(false);
    expect(isS256Challenge(undefined)).toBe(false);
  });
});

describe('tokens', () => {
  it('have a recognisable prefix and 32 random bytes', () => {
    expect(newAccessToken()).toMatch(/^n4m_at_[A-Za-z0-9_-]{43}$/);
    expect(newRefreshToken()).toMatch(/^n4m_rt_[A-Za-z0-9_-]{43}$/);
    expect(newAccessToken()).not.toBe(newAccessToken());
  });

  it('are stored only as a SHA-256 hash', () => {
    const token = newAccessToken();
    expect(sha256Hex(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(token)).not.toContain(token.slice(7, 20));
  });

  it('isSecretShaped checks prefix and shape before any lookup', () => {
    const token = newRefreshToken();
    expect(isSecretShaped(token, 'n4m_rt_')).toBe(true);
    expect(isSecretShaped(token, 'n4m_at_')).toBe(false);
    expect(isSecretShaped(`${token}x`, 'n4m_rt_')).toBe(false);
    expect(isSecretShaped('../../etc', '')).toBe(false);
  });
});

describe('redirect URIs: exact match only', () => {
  it('allows exactly the listed URI', () => {
    expect(REDIRECT_URI_ALLOWLIST).toEqual(['https://claude.ai/api/mcp/auth_callback']);
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
  });

  it.each([
    'https://claude.ai/api/mcp/auth_callback/',
    'https://claude.ai/api/mcp/auth_callback?x=1',
    'https://claude.ai/api/mcp/auth_callback#x',
    'https://claude.ai/api/mcp/auth_callback/../evil',
    'https://claude.ai:443/api/mcp/auth_callback',
    'HTTPS://claude.ai/api/mcp/auth_callback',
    'https://CLAUDE.ai/api/mcp/auth_callback',
    'https://claude.ai.evil.com/api/mcp/auth_callback',
    'https://evil.com/?https://claude.ai/api/mcp/auth_callback',
    'https://user@claude.ai/api/mcp/auth_callback',
    'http://claude.ai/api/mcp/auth_callback',
    'https://claude.ai/api/mcp/auth_callbac',
    ' https://claude.ai/api/mcp/auth_callback',
    // Claude Code (loopback) לא נתמך - החלטה של שלב 1ב
    'http://localhost:3118/callback',
    'http://127.0.0.1:3118/callback',
    'http://localhost/callback',
  ])('rejects %s', (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(false);
  });
});

describe('scopes', () => {
  it('defaults to notes.read and accepts offline_access', () => {
    expect(parseScope(undefined)).toEqual(['notes.read']);
    expect(parseScope('')).toEqual(['notes.read']);
    expect(parseScope('notes.read offline_access')).toEqual(['notes.read', 'offline_access']);
  });

  it('accepts notes.write (phase 2a), and rejects unknown scopes', () => {
    expect(parseScope('notes.read notes.write offline_access')).toEqual(['notes.read', 'notes.write', 'offline_access']);
    expect(parseScope('notes.read admin')).toBeNull();
    expect(parseScope(['notes.read'])).toBeNull();
  });

  it('allows narrowing but not widening', () => {
    expect(isScopeSubset('notes.read', 'notes.read offline_access')).toBe(true);
    expect(isScopeSubset('notes.read notes.write', 'notes.read')).toBe(false);
  });
});

describe('user allowlist (config/mcp) is fail-closed', () => {
  it.each([
    ['an empty list', { allowedUids: [], openToAll: false }, false],
    ['a list without the user', { allowedUids: ['other'], openToAll: false }, false],
    ['a list with the user', { allowedUids: ['me'], openToAll: false }, true],
    ['openToAll', { allowedUids: [], openToAll: true }, true],
  ])('%s', (_label, config, allowed) => {
    expect(isUserAllowed(config, 'me')).toBe(allowed);
  });
});

describe('metadata', () => {
  it('advertises S256 only, public clients only, and no CIMD', () => {
    const metadata = authorizationServerMetadata();
    expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(metadata).not.toHaveProperty('client_id_metadata_document_supported');
    expect(metadata.scopes_supported).toEqual(['notes.read', 'notes.write', 'offline_access']);
  });

  it('names the resource exactly as the user enters it', () => {
    expect(protectedResourceMetadata()).toMatchObject({
      resource: 'https://notes-4-me.web.app/mcp',
      authorization_servers: ['https://notes-4-me.web.app'],
    });
  });
});
