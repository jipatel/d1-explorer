import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { ConversationTurn } from '../agent/types.js';

const HISTORY_FILE = join(homedir(), '.opticobot', 'history.json');

export async function loadHistory(): Promise<ConversationTurn[]> {
  try {
    const data = await readFile(HISTORY_FILE, 'utf-8');
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

export async function saveHistory(history: ConversationTurn[]): Promise<void> {
  try {
    // Ensure directory exists
    await mkdir(dirname(HISTORY_FILE), { recursive: true });
    await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    // Silently fail - history persistence is not critical
    console.error('Failed to save history:', error);
  }
}

export function getHistoryPath(): string {
  return HISTORY_FILE;
}
