import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Note, TemplateType } from '@/types/note';
import type { Category } from '@/types';
import {
  backupFileName,
  BACKUP_FORMAT_VERSION,
  buildJsonBackup,
  buildMarkdownBackup,
  renderNoteContent,
} from './backupFormat';

const AT = Timestamp.fromDate(new Date('2026-09-25T10:00:00Z'));

const makeNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'n1',
  title: 'פתק',
  content: '',
  categoryId: 'c1',
  templateType: 'plain',
  tags: [],
  color: null,
  order: 0,
  userId: 'u1',
  sharedWith: [],
  createdAt: AT,
  updatedAt: AT,
  isPinned: false,
  isArchived: false,
  ...overrides,
});

const category: Category = {
  id: 'c1',
  name: 'בית',
  color: '#3B82F6',
  icon: null,
  order: 0,
  userId: 'u1',
  sharedWith: [],
  createdAt: AT,
  updatedAt: AT,
};

const render = (content: string, templateType: TemplateType = 'plain') =>
  renderNoteContent(makeNote({ content, templateType }));

describe('renderNoteContent', () => {
  it('marks an empty note', () => {
    expect(render('   ')).toBe('_(פתק ריק)_');
  });

  it('returns free text as is, including text that starts with a bracket', () => {
    expect(render('שלום')).toBe('שלום');
    expect(render('[לא JSON')).toBe('[לא JSON');
  });

  it('renders a checklist with state and due date', () => {
    expect(
      render(
        '[{"text":"חלב","completed":true},{"text":"לחם","completed":false,"dueDate":"2026-09-26","dueTime":"09:00"}]',
        'checklist'
      )
    ).toBe('- [x] חלב\n- [ ] לחם _(יעד: 2026-09-26 09:00)_');
  });

  it('renders a shopping list with quantities', () => {
    expect(render('[{"name":"חלב","quantity":"2","checked":false}]', 'shopping')).toBe(
      '- [ ] חלב — 2'
    );
  });

  it('renders accounting rows with a running balance', () => {
    const output = render(
      '[{"description":"a","amount":10,"date":"2026-01-01"},{"description":"b","amount":-4,"date":"2026-01-02"}]',
      'accounting'
    );
    expect(output).toContain('| 2026-01-02 | b | -4.00 | 6.00 |');
    expect(output).toContain('**יתרה סופית: ₪6.00**');
  });

  it('renders a recipe, accepting steps instead of instructions', () => {
    const output = render('{"servings":"4","ingredients":["קמח"],"steps":["לערבב"]}', 'recipe');
    expect(output).toContain('**מנות:** 4');
    expect(output).toContain('- קמח');
    expect(output).toContain('1. לערבב');
  });

  it('detects the shape when content does not match the declared template', () => {
    expect(render('[{"text":"משימה","completed":false}]', 'plain')).toBe('- [ ] משימה');
  });

  it('keeps unrecognized JSON as a code block instead of dropping it', () => {
    const output = render('{"unknown":true}', 'plain');
    expect(output).toContain('{"unknown":true}');
    expect(output.startsWith('```')).toBe(true);
  });

  it('escapes pipes inside table cells', () => {
    expect(render('[{"description":"a|b","amount":1,"date":""}]', 'accounting')).toContain(
      'a\\|b'
    );
  });
});

describe('buildMarkdownBackup', () => {
  const meta = {
    userEmail: 'me@example.com',
    userId: 'u1',
    appVersion: '1.20.5',
    createdAt: new Date('2026-09-25T10:00:00Z'),
  };

  it('counts active and archived notes and groups them by category', () => {
    const output = buildMarkdownBackup(
      [makeNote({ title: 'פעיל' }), makeNote({ id: 'n2', title: 'ישן', isArchived: true })],
      [category],
      meta
    );
    expect(output).toContain('(1 פעילים, 1 בארכיון)');
    expect(output).toContain('בית');
    expect(output).toContain('# 🗄️ ארכיון');
  });

  it('does not lose notes whose category is missing', () => {
    const output = buildMarkdownBackup([makeNote({ title: 'יתום', categoryId: 'gone' })], [], meta);
    expect(output).toContain('יתום');
  });
});

describe('buildJsonBackup', () => {
  it('writes the format version and ISO timestamps', () => {
    const parsed = JSON.parse(
      buildJsonBackup([makeNote()], [category], {
        userEmail: 'me@example.com',
        userId: 'u1',
        appVersion: '1.20.5',
        createdAt: new Date('2026-09-25T10:00:00Z'),
      })
    );
    expect(parsed.backupFormatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(parsed.notes[0].createdAt).toBe('2026-09-25T10:00:00.000Z');
    expect(parsed.notes[0].archivedAt).toBeNull();
    expect(parsed.categories[0].name).toBe('בית');
  });
});

describe('backupFileName', () => {
  it('stamps the date so consecutive backups do not overwrite each other', () => {
    expect(backupFileName('json', new Date('2026-09-25T10:05:00Z'))).toBe(
      'notes-backup_2026-09-25_10-05.json'
    );
  });
});
