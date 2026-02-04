#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { Router } from './router.js';
import { loadConfig } from './config/index.js';
import { loadSession, listSessions, touchSession } from './session/storage.js';
import type { AppSession } from './session/types.js';

const cli = meow(
  `
  Usage
    $ d1-explorer [options]

  Options
    --remote, -r       Use remote D1 database (default: true)
    --local, -l        Use local D1 database
    --database, -d     Database name
    --allow-mutations  Allow INSERT/UPDATE/DELETE queries
    --setup            Force setup wizard (re-discover schema)
    --list             List saved database sessions

  Examples
    $ d1-explorer
    $ d1-explorer --local
    $ d1-explorer --database my-db
    $ d1-explorer --allow-mutations
    $ d1-explorer --setup
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
      setup: {
        type: 'boolean',
        default: false,
      },
      list: {
        type: 'boolean',
        default: false,
      },
    },
  }
);

async function main() {
  try {
    // --list: print saved sessions and exit
    if (cli.flags.list) {
      const sessions = await listSessions();
      if (sessions.length === 0) {
        console.log('No saved sessions found.');
        process.exit(0);
      }
      for (const name of sessions) {
        const dbSession = await loadSession(name);
        if (dbSession) {
          const tableCount = dbSession.schema.tables.length;
          const updated = new Date(dbSession.updatedAt).toLocaleDateString();
          console.log(
            `  ${dbSession.databaseName}  (${dbSession.cloudflareAccountName})  ${tableCount} table${tableCount !== 1 ? 's' : ''}  updated ${updated}`
          );
        }
      }
      process.exit(0);
    }

    // Determine remote flag (--local overrides --remote)
    const isRemote = !cli.flags.local && cli.flags.remote;

    const config = loadConfig({
      remote: isRemote,
      database: cli.flags.database,
      allowMutations: cli.flags.allowMutations,
    });

    let initialSession: AppSession | null = null;

    // If --setup is passed, skip loading sessions and force the wizard
    if (!cli.flags.setup) {
      // Try to load a saved session
      const databaseName = cli.flags.database;

      if (databaseName) {
        // Specific database requested - try to load that session
        const dbSession = await loadSession(databaseName);
        if (dbSession) {
          initialSession = {
            anthropicApiKey: dbSession.anthropicApiKey,
            cloudflareAccountId: dbSession.cloudflareAccountId,
            databaseName: dbSession.databaseName,
            d1Remote: isRemote,
            allowMutations: cli.flags.allowMutations,
            schema: dbSession.schema,
          };
        }
      } else {
        // No specific database - try to load the first available session
        const sessions = await listSessions();
        if (sessions.length > 0) {
          const dbSession = await loadSession(sessions[0]);
          if (dbSession) {
            initialSession = {
              anthropicApiKey: dbSession.anthropicApiKey,
              cloudflareAccountId: dbSession.cloudflareAccountId,
              databaseName: dbSession.databaseName,
              d1Remote: isRemote,
              allowMutations: cli.flags.allowMutations,
              schema: dbSession.schema,
            };
          }
        }
      }

      // Override API key from env if available (env takes precedence for security)
      if (initialSession && config.anthropicApiKey) {
        initialSession.anthropicApiKey = config.anthropicApiKey;
      }

      // Mark as most recently used so it's loaded first next time
      if (initialSession) {
        touchSession(initialSession.databaseName).catch(() => {});
      }
    }

    render(
      <Router
        initialSession={initialSession}
        envApiKey={config.anthropicApiKey}
        d1Remote={isRemote}
        allowMutations={cli.flags.allowMutations}
      />
    );
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
