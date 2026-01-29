#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './app.js';
import { loadConfig, validateConfig } from './config/index.js';

const cli = meow(
  `
  Usage
    $ opticobot [options]

  Options
    --remote, -r       Use remote D1 database (default: true)
    --local, -l        Use local D1 database
    --database, -d     Database name (default: opticobot-prod)
    --allow-mutations  Allow INSERT/UPDATE/DELETE queries

  Examples
    $ opticobot
    $ opticobot --local
    $ opticobot --database opticobot-staging
    $ opticobot --allow-mutations
`,
  {
    importMeta: import.meta,
    flags: {
      remote: {
        type: 'boolean',
        shortFlag: 'r',
        default: true,
      },
      local: {
        type: 'boolean',
        shortFlag: 'l',
        default: false,
      },
      database: {
        type: 'string',
        shortFlag: 'd',
      },
      allowMutations: {
        type: 'boolean',
        default: false,
      },
    },
  }
);

async function main() {
  try {
    // Determine remote flag (--local overrides --remote)
    const isRemote = !cli.flags.local && cli.flags.remote;

    const config = loadConfig({
      remote: isRemote,
      database: cli.flags.database,
      allowMutations: cli.flags.allowMutations,
    });

    const validation = validateConfig(config);
    if (!validation.valid) {
      console.error('Configuration errors:');
      for (const error of validation.errors) {
        console.error(`  - ${error}`);
      }
      console.error('\nPlease check your .env file or environment variables.');
      process.exit(1);
    }

    render(<App config={config} />);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

main();
