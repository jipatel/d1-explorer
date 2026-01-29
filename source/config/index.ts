import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const ConfigSchema = z.object({
  anthropicApiKey: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  d1DatabaseName: z.string().default('opticobot'),
  d1Remote: z.boolean().default(true),
  allowMutations: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface CLIFlags {
  remote?: boolean;
  database?: string;
  allowMutations?: boolean;
}

export function loadConfig(flags: CLIFlags = {}): Config {
  const raw = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    d1DatabaseName: flags.database ?? process.env.D1_DATABASE_NAME ?? 'opticobot',
    d1Remote: flags.remote ?? (process.env.D1_REMOTE === undefined ? true : process.env.D1_REMOTE === 'true'),
    allowMutations: flags.allowMutations ?? false,
  };

  return ConfigSchema.parse(raw);
}

export function validateConfig(config: Config): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.anthropicApiKey) {
    errors.push('ANTHROPIC_API_KEY environment variable is not set');
  }

  if (!config.d1DatabaseName) {
    errors.push('D1_DATABASE_NAME is not configured');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
