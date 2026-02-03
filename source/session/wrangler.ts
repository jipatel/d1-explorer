import { spawn } from 'node:child_process';
import type { CloudflareAccount, D1DatabaseInfo } from './types.js';

function runCommand(command: string, args: string[], env?: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, code: 1 });
    });
  });
}

export async function getAccounts(): Promise<CloudflareAccount[]> {
  const { stdout, stderr, code } = await runCommand('wrangler', ['whoami']);

  if (code !== 0) {
    throw new Error(`wrangler whoami failed: ${stderr}`);
  }

  const accounts: CloudflareAccount[] = [];
  // Parse table rows like: │ Account Name │ account_id │
  const lines = stdout.split('\n');
  for (const line of lines) {
    // Match lines with pipe-separated account data
    const match = line.match(/│\s+(.+?)\s+│\s+([a-f0-9]{32})\s+│/);
    if (match) {
      accounts.push({
        name: match[1].trim(),
        id: match[2].trim(),
      });
    }
  }

  return accounts;
}

export async function listD1Databases(accountId?: string): Promise<D1DatabaseInfo[]> {
  const env: Record<string, string> = {};
  if (accountId) {
    env.CLOUDFLARE_ACCOUNT_ID = accountId;
  }

  const { stdout, stderr, code } = await runCommand('wrangler', ['d1', 'list', '--json'], env);

  if (code !== 0) {
    throw new Error(`wrangler d1 list failed: ${stderr}`);
  }

  try {
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) {
      throw new Error('Unexpected response format');
    }
    return parsed.map((db: Record<string, unknown>) => ({
      uuid: String(db.uuid ?? ''),
      name: String(db.name ?? ''),
      created_at: db.created_at ? String(db.created_at) : undefined,
    }));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse D1 database list: ${error.message}`);
    }
    throw error;
  }
}
