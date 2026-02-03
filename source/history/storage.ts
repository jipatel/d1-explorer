import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { ConversationTurn } from '../agent/types.js';

const HISTORY_DIR = join(homedir(), '.opticobot', 'history');

function historyPath(databaseName: string): string {
  return join(HISTORY_DIR, `${databaseName}.json`);
}

export async function loadHistory(databaseName: string): Promise<ConversationTurn[]> {
  try {
    const data = await readFile(historyPath(databaseName), 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    // File doesn't exist or is invalid - start fresh
    return [];
  }
}

export async function saveHistory(databaseName: string, history: ConversationTurn[]): Promise<void> {
  try {
    const filePath = historyPath(databaseName);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    // Silently fail - history persistence is not critical
    console.error('Failed to save history:', error);
  }
}

export function getHistoryPath(databaseName: string): string {
  return historyPath(databaseName);
}
