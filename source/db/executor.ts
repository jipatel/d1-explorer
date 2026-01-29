import { spawn } from 'child_process';
import type { Config } from '../config/index.js';
import { parseD1Output, type D1Response } from './parser.js';

export interface ExecuteOptions {
  sql: string;
  config: Config;
  timeout?: number;
}

export interface ExecuteResult {
  response: D1Response;
  rawOutput: string;
  rawError: string;
  duration: number;
}

const MUTATION_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE'];

export function isMutationQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  return MUTATION_KEYWORDS.some(keyword => normalized.startsWith(keyword));
}

export function validateSql(sql: string, allowMutations: boolean): { valid: boolean; error?: string } {
  if (!sql.trim()) {
    return { valid: false, error: 'SQL query is empty' };
  }

  if (!allowMutations && isMutationQuery(sql)) {
    return {
      valid: false,
      error: `Mutation queries are blocked. Use --allow-mutations flag to enable. Blocked keywords: ${MUTATION_KEYWORDS.join(', ')}`,
    };
  }

  return { valid: true };
}

export async function executeQuery(options: ExecuteOptions): Promise<ExecuteResult> {
  const { sql, config, timeout = 30000 } = options;
  const startTime = Date.now();

  const validation = validateSql(sql, config.allowMutations);
  if (!validation.valid) {
    return {
      response: {
        success: false,
        error: validation.error!,
      },
      rawOutput: '',
      rawError: validation.error!,
      duration: Date.now() - startTime,
    };
  }

  const args = [
    'd1',
    'execute',
    config.d1DatabaseName,
    '--json',
    '--command',
    sql,
  ];

  if (config.d1Remote) {
    args.push('--remote');
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('wrangler', args, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (timedOut) {
        resolve({
          response: {
            success: false,
            error: `Query timed out after ${timeout}ms`,
          },
          rawOutput: stdout,
          rawError: stderr,
          duration,
        });
        return;
      }

      if (code !== 0 && !stdout.trim()) {
        resolve({
          response: {
            success: false,
            error: stderr.trim() || `wrangler exited with code ${code}`,
          },
          rawOutput: stdout,
          rawError: stderr,
          duration,
        });
        return;
      }

      const response = parseD1Output(stdout);
      resolve({
        response,
        rawOutput: stdout,
        rawError: stderr,
        duration,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        response: {
          success: false,
          error: `Failed to spawn wrangler: ${err.message}`,
        },
        rawOutput: '',
        rawError: err.message,
        duration: Date.now() - startTime,
      });
    });
  });
}
