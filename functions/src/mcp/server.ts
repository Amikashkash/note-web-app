/**
 * `McpServer` לבקשה אחת (stateless, mcp-plan §1.2).
 *
 * שרת חדש לכל בקשה, עם `UserScope` של המשתמש שה-token שלו אומת. יצירה
 * זולה: רישום ה-tools סינכרוני.
 */

import { McpServer } from '@modelcontextprotocol/server';
import type { VerifiedIdentity } from '../notesCore/identity';
import { UserScope } from '../notesCore/store';
import type { RateLimitResult } from '../oauth/store';
import type { AuthContext } from '../oauth/verify';
import { SERVER_INFO } from './config';
import { registerTools } from './tools';

/** איך נבנה `UserScope` מזהות מאומתת. בבדיקות: מחובר ל-emulator */
export type ScopeFactory = (identity: VerifiedIdentity) => UserScope;

export const defaultScopeFactory: ScopeFactory = (identity) => UserScope.for(identity);

const INSTRUCTIONS =
  "Access to the user's personal notes in the Notes 4 Me app. Notes and categories are mostly in Hebrew. " +
  'Start with list_categories or search_notes, then read a note with get_note, and read it again right before editing. ' +
  'Notes the user marked as sensitive are not available at all. Change only what the user asked for. Notes are never ' +
  'deleted: when the user says delete, use archive_note (restorable). Notes marked read-only for Claude, notes shared by ' +
  "other users and notes open in the app cannot be changed; every change is kept in the note's history.";

export interface ServerDeps {
  scopeFor?: ScopeFactory;
  consumeWriteQuota: () => Promise<RateLimitResult>;
}

export const createMcpServer = (
  context: AuthContext,
  { scopeFor = defaultScopeFactory, consumeWriteQuota }: ServerDeps
): McpServer => {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  registerTools(server, { scope: scopeFor(context.identity), context, consumeWriteQuota });
  return server;
};
