/**
 * `McpServer` לבקשה אחת (stateless, mcp-plan §1.2).
 *
 * שרת חדש לכל בקשה, עם `UserScope` של המשתמש שה-token שלו אומת. יצירה
 * זולה: רישום ה-tools סינכרוני.
 */

import { McpServer } from '@modelcontextprotocol/server';
import type { VerifiedIdentity } from '../notesCore/identity';
import { UserScope } from '../notesCore/store';
import type { AuthContext } from '../oauth/verify';
import { SERVER_INFO } from './config';
import { registerTools } from './tools';

/** איך נבנה `UserScope` מזהות מאומתת. בבדיקות: מחובר ל-emulator */
export type ScopeFactory = (identity: VerifiedIdentity) => UserScope;

export const defaultScopeFactory: ScopeFactory = (identity) => UserScope.for(identity);

const INSTRUCTIONS =
  "Read-only access to the user's personal notes in the Notes 4 Me app. Notes and categories are mostly in Hebrew. " +
  'Start with list_categories or search_notes, then read a note with get_note. Notes the user marked as sensitive are not available at all.';

export const createMcpServer = (context: AuthContext, scopeFor: ScopeFactory = defaultScopeFactory): McpServer => {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  registerTools(server, { scope: scopeFor(context.identity), context });
  return server;
};
