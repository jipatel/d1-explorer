import Anthropic from '@anthropic-ai/sdk';
import { executeQuery } from '../db/executor.js';
import type { Config } from '../config/index.js';
import type { D1Result } from '../db/parser.js';
import type { DiscoveredColumn, DiscoveredForeignKey, DiscoveredTable, DiscoveredSchema } from './types.js';
import { SCHEMA_ANALYSIS_PROMPT } from './prompts.js';
import { summarizeAiNotes } from './directives.js';

export interface DiscoveryEvent {
  type: 'progress' | 'table_discovered' | 'analyzing' | 'complete' | 'error';
  message: string;
  table?: DiscoveredTable;
  schema?: DiscoveredSchema;
}

function asD1Result(response: { success: boolean }): D1Result | null {
  if (response.success) {
    return response as D1Result;
  }
  return null;
}

export async function* discoverSchema(config: Config, apiKey: string): AsyncGenerator<DiscoveryEvent, DiscoveredSchema | null, void> {
  yield { type: 'progress', message: 'Querying database tables...' };

  // Step 1: Find all user tables
  const tablesResult = await executeQuery({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    config,
  });

  const tablesD1 = asD1Result(tablesResult.response);
  if (!tablesD1) {
    const errorMsg = 'error' in tablesResult.response ? (tablesResult.response as { error: string }).error : 'Unknown error';
    yield { type: 'error', message: `Failed to query tables: ${errorMsg}` };
    return null;
  }

  const tableNames = tablesD1.rows.map(r => String(r.name));

  if (tableNames.length === 0) {
    yield { type: 'error', message: 'No tables found in database' };
    return null;
  }

  yield { type: 'progress', message: `Found ${tableNames.length} table${tableNames.length !== 1 ? 's' : ''}: ${tableNames.join(', ')}` };

  // Step 2: For each table, get columns and foreign keys
  const tables: DiscoveredTable[] = [];

  for (const tableName of tableNames) {
    yield { type: 'progress', message: `Inspecting table: ${tableName}` };

    // Get columns via PRAGMA table_info
    const columnsResult = await executeQuery({
      sql: `PRAGMA table_info(${tableName})`,
      config,
    });

    const columnsD1 = asD1Result(columnsResult.response);
    const columns: DiscoveredColumn[] = [];

    if (columnsD1) {
      for (const row of columnsD1.rows) {
        columns.push({
          name: String(row.name),
          type: String(row.type ?? 'TEXT'),
          notnull: Boolean(row.notnull),
          pk: Boolean(row.pk),
          defaultValue: row.dflt_value != null ? String(row.dflt_value) : null,
        });
      }
    }

    // Get foreign keys via PRAGMA foreign_key_list
    const fkResult = await executeQuery({
      sql: `PRAGMA foreign_key_list(${tableName})`,
      config,
    });

    const fkD1 = asD1Result(fkResult.response);
    const foreignKeys: DiscoveredForeignKey[] = [];

    if (fkD1) {
      for (const row of fkD1.rows) {
        foreignKeys.push({
          fromColumn: String(row.from),
          toTable: String(row.table),
          toColumn: String(row.to),
        });
      }
    }

    const table: DiscoveredTable = { name: tableName, columns, foreignKeys };
    tables.push(table);

    yield { type: 'table_discovered', message: `Discovered: ${tableName} (${columns.length} columns)`, table };
  }

  // Step 3: AI analysis of the full schema
  yield { type: 'analyzing', message: 'Analyzing schema with AI...' };

  let aiNotes = '';
  try {
    aiNotes = await analyzeSchema(tables, apiKey);
  } catch {
    aiNotes = 'AI analysis unavailable.';
  }

  // Step 4: Generate plain English summary of notes
  yield { type: 'analyzing', message: 'Generating schema summary...' };

  let aiNotesSummary: string | undefined;
  try {
    aiNotesSummary = await summarizeAiNotes(aiNotes, apiKey);
  } catch {
    // Non-critical — summary can be generated later
  }

  const schema: DiscoveredSchema = {
    tables,
    discoveredAt: new Date().toISOString(),
    aiNotes,
    aiNotesSummary,
  };

  yield { type: 'complete', message: 'Schema discovery complete', schema };
  return schema;
}

function buildDDL(tables: DiscoveredTable[]): string {
  const parts: string[] = [];

  for (const table of tables) {
    const colDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (col.pk) def += ' PRIMARY KEY';
      if (col.notnull) def += ' NOT NULL';
      if (col.defaultValue !== null) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    const fkDefs = table.foreignKeys.map(fk =>
      `  FOREIGN KEY (${fk.fromColumn}) REFERENCES ${fk.toTable}(${fk.toColumn})`
    );

    const allDefs = [...colDefs, ...fkDefs].join(',\n');
    parts.push(`CREATE TABLE ${table.name} (\n${allDefs}\n);`);
  }

  return parts.join('\n\n');
}

async function analyzeSchema(tables: DiscoveredTable[], apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const ddl = buildDDL(tables);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SCHEMA_ANALYSIS_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Here is the database schema:\n\n${ddl}\n\nAnalyze this schema.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return '';
  }
  return content.text.trim();
}
