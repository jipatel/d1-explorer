import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import type { DbSession } from './types.js';

const SESSIONS_DIR = join(homedir(), '.opticobot', 'sessions');

function sessionPath(databaseName: string): string {
  return join(SESSIONS_DIR, `${databaseName}.json`);
}

export async function loadSession(databaseName: string): Promise<DbSession | null> {
  try {
    const data = await readFile(sessionPath(databaseName), 'utf-8');
    const parsed = JSON.parse(data);
    if (parsed && parsed.version === 1) {
      return parsed as DbSession;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveSession(session: DbSession): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true });
  const filePath = sessionPath(session.databaseName);
  await writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

export async function listSessions(): Promise<string[]> {
  try {
    const files = await readdir(SESSIONS_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => basename(f, '.json'));
  } catch {
    return [];
  }
}

export async function deleteSession(databaseName: string): Promise<void> {
  try {
    await unlink(sessionPath(databaseName));
  } catch {
    // Ignore if file doesn't exist
  }
}

export async function updateSessionAiNotes(
  databaseName: string,
  aiNotes: string,
): Promise<void> {
  const session = await loadSession(databaseName);
  if (!session) {
    throw new Error(`No session found for database: ${databaseName}`);
  }
  session.schema.aiNotes = aiNotes;
  session.updatedAt = new Date().toISOString();
  await saveSession(session);
}

export async function updateSessionAiNotesSummary(
  databaseName: string,
  aiNotesSummary: string,
): Promise<void> {
  const session = await loadSession(databaseName);
  if (!session) {
    throw new Error(`No session found for database: ${databaseName}`);
  }
  session.schema.aiNotesSummary = aiNotesSummary;
  session.updatedAt = new Date().toISOString();
  await saveSession(session);
}
